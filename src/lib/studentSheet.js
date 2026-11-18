import { unzipSync, strFromU8 } from "fflate";

// An .xlsx file is a zip of XML files. This reads just what a student list needs
// (first sheet, columns A and B) with a single tiny dependency.

const MAX_UNZIPPED = 50 * 1024 * 1024;

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

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : "";
};

// Joins every <t> text run in a fragment (rich text, inline strings), ignoring phonetic hints.
function textRuns(xml) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of clean.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) out += m[1] ? decode(m[1]) : "";
  return out;
}

// Student numbers that are plain digits become 4 digits: 1 -> 0001.
export function normalizeNo(no) {
  return /^\d+$/.test(no) ? no.padStart(4, "0") : no;
}

export async function readStudentSheet(buffer) {
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) =>
        f.originalSize < MAX_UNZIPPED &&
        /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name),
    });
  } catch {
    throw new Error("Not a valid .xlsx file.");
  }
  const read = (name) => (files[name] ? strFromU8(files[name]) : "");

  const workbook = read("xl/workbook.xml");
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: attr(m[0], "name"),
    rid: attr(m[0], "r:id"),
  }));
  if (sheets.length === 0) throw new Error("The workbook has no sheets.");

  const rels = read("xl/_rels/workbook.xml.rels");
  let target = "";
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    if (attr(m[0], "Id") === sheets[0].rid) target = attr(m[0], "Target");
  }
  if (!target) throw new Error("Could not find the first sheet.");
  target = target.replace(/^\//, "");
  const sheetXml = read(target.startsWith("xl/") ? target : `xl/${target}`);
  if (!sheetXml) throw new Error("Could not read the first sheet.");

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) =>
    m[1] ? textRuns(m[1]) : ""
  );

  const cellText = (attrs, inner) => {
    const type = attr(attrs, "t");
    const v = (inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1];
    if (type === "inlineStr") return textRuns(inner).trim();
    if (v == null) return "";
    if (type === "s") return (shared[Number(v)] ?? "").trim();
    if (type === "str") return decode(v).trim();
    if (type === "b") return v === "1" ? "TRUE" : "FALSE";
    if (type === "e") return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : decode(v).trim();
  };

  const rows = [];
  let auto = 0;
  for (const rm of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    auto += 1;
    const line = Number(attr(rm[1], "r")) || auto;
    let no = "";
    let name = "";
    for (const cm of (rm[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = (attr(cm[1], "r").match(/^[A-Z]+/) || [""])[0];
      if (col === "A") no = cellText(cm[1], cm[2] || "");
      else if (col === "B") name = cellText(cm[1], cm[2] || "").replace(/\s+/g, " ");
    }
    if (!no && !name) continue;
    rows.push({ line, no, name });
  }

  // Skip a header row such as "Student No | Student Name".
  if (rows.length && !/^\d+$/.test(rows[0].no) && /name/i.test(rows[0].name)) rows.shift();

  return { sheet: sheets[0].name, otherSheets: sheets.length - 1, rows };
}
