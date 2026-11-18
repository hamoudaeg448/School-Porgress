import { db } from "./db";
import { normalizeNo } from "./studentSheet";

// Checks rows against each other and against the database.
// status: "new" (will be added), "exists" (same student already saved), "error" (must be fixed)
export async function validateStudents(classId, rows) {
  const codes = rows.map((r) => normalizeNo(String(r.no || ""))).filter(Boolean);
  const existing = codes.length
    ? await db.student.findMany({
        where: { studentCode: { in: codes } },
        include: { classGroup: { select: { name: true } } },
      })
    : [];
  const byCode = new Map(existing.map((s) => [s.studentCode, s]));

  const nameCount = new Map();
  for (const r of rows) {
    const k = String(r.name || "").toLowerCase();
    nameCount.set(k, (nameCount.get(k) || 0) + 1);
  }

  const seen = new Map();
  return rows.map((r) => {
    const code = normalizeNo(String(r.no || ""));
    const name = String(r.name || "");
    const out = { line: r.line, code, name, status: "new", note: "" };

    if (!code) return { ...out, status: "error", note: "Missing student number" };
    if (!name) return { ...out, status: "error", note: "Missing student name" };
    if (code.length > 50 || name.length > 191) return { ...out, status: "error", note: "Value is too long" };
    if (seen.has(code)) return { ...out, status: "error", note: `Same number as line ${seen.get(code)}` };
    seen.set(code, r.line);

    const ex = byCode.get(code);
    if (ex) {
      if (ex.classGroupId === classId && ex.fullName === name) {
        return { ...out, status: "exists", note: "Already imported" };
      }
      return { ...out, status: "error", note: `Number already used by ${ex.fullName} (${ex.classGroup.name})` };
    }
    if (nameCount.get(name.toLowerCase()) > 1) out.note = "This name appears more than once";
    return out;
  });
}
