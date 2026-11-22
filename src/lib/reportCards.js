import { unzipSync, strFromU8 } from "fflate";

// ---------- names ----------
export function normName(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}
// Same words in any order, any case, any spacing -> same key.
export const nameKey = (s) => normName(s).split(" ").filter(Boolean).sort().join(" ");

function lev(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// 0..1, used only to suggest likely matches for names that do not match exactly.
export function similarity(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  const chars = 1 - lev(x, y) / Math.max(x.length, y.length);
  const ta = new Set(x.split(" "));
  const tb = new Set(y.split(" "));
  let common = 0;
  ta.forEach((t) => tb.has(t) && common++);
  return Math.max(chars, common / (ta.size + tb.size - common));
}

// ---------- reading the Word file ----------
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    try {
      return String.fromCodePoint(code);
    } catch {
      return "";
    }
  });
}

const toNum = (s) => {
  const t = String(s ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const TOKEN = /<w:(p|tr|tc)\b[^>]*?(\/)?>|<\/w:(p|tr|tc)>|<w:t\b[^>]*>([^<]*)<\/w:t>/g;

// Walks the document in order and returns paragraphs and table rows.
// Text boxes are handled, and the duplicate "fallback" copy Word stores for them is ignored.
function walk(xml) {
  const items = [];
  const stack = [];
  for (const m of xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "").matchAll(TOKEN)) {
    if (m[4] !== undefined) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].k === "p") {
          stack[i].text += decode(m[4]);
          break;
        }
      }
    } else if (m[1]) {
      if (!m[2]) stack.push({ k: m[1], text: "", cells: [], parts: [] });
    } else {
      const top = stack.pop();
      if (!top) continue;
      const parent = stack[stack.length - 1];
      if (top.k === "p") {
        const text = top.text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (parent && parent.k === "tc") parent.parts.push(text);
        else items.push({ t: "p", text });
      } else if (top.k === "tc") {
        if (parent && parent.k === "tr") parent.cells.push(top.parts.join(" ").trim());
      } else if (top.k === "tr") {
        items.push({ t: "row", cells: top.cells });
      }
    }
  }
  return items;
}

// One card per student: { name, stage, term, rows: [{ subject, full, mark }] }
export function readReportCards(buffer) {
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => f.name === "word/document.xml" && f.originalSize < 80 * 1024 * 1024,
    });
  } catch {
    throw new Error("Not a valid .docx file.");
  }
  if (!files["word/document.xml"]) throw new Error("Not a valid .docx file.");

  const cards = [];
  let card = null;
  for (const it of walk(strFromU8(files["word/document.xml"]))) {
    if (it.t === "p") {
      const tx = it.text;
      let m;
      if (/^academic year/i.test(tx)) {
        card = { name: "", stage: null, term: null, heading: "", rows: [], capture: false, past: false };
        cards.push(card);
      } else if (!card) {
        continue;
      } else if (/^(class|name):?$/i.test(tx)) {
        card.past = true;
      } else if ((m = tx.match(/^stage:?\s*(\d+)/i))) {
        card.stage = Number(m[1]);
      } else if ((m = tx.match(/^(?:term\s*(\d+)|mid[\s-]*term)\s*result/i))) {
        card.term = m[1] ? Number(m[1]) : null;
        card.heading = tx.slice(0, 60);
        card.capture = true;
      } else if (!card.name && !card.past && !/^report$/i.test(tx)) {
        card.name = tx;
      }
    } else if (card && card.capture) {
      const [subject, full, mark] = it.cells;
      if (!subject || /^subject$/i.test(subject.replace(/\s+/g, ""))) continue;
      card.rows.push({ subject: subject.replace(/\s+/g, " ").trim(), full: toNum(full), mark: toNum(mark) });
    }
  }
  return cards.map(({ name, stage, term, heading, rows }) => ({ name, stage, term, heading, rows }));
}

// Anything coming back from the browser is re-cleaned before use.
export function sanitizeCards(input) {
  if (!Array.isArray(input)) return [];
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return input.slice(0, 500).map((c) => ({
    name: String(c?.name || "").replace(/\s+/g, " ").trim().slice(0, 191),
    stage: num(c?.stage),
    term: num(c?.term),
    heading: String(c?.heading || "").slice(0, 60),
    rows: (Array.isArray(c?.rows) ? c.rows : []).slice(0, 40).map((r) => ({
      subject: String(r?.subject || "").replace(/\s+/g, " ").trim().slice(0, 60),
      full: num(r?.full),
      mark: num(r?.mark),
    })),
  }));
}
