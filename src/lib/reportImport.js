import { db } from "./db";
import { getCurrentYear } from "./year";
import { nameKey, similarity } from "./reportCards";

const ALIAS = { math: "Mathematics", maths: "Mathematics", mathematics: "Mathematics" };
const label = (s) => ({ id: s.id, label: `${s.fullName} (${s.classGroup.name} · ${s.studentCode})` });

// scope: "class:12" (one class) or "grade:10" (every class of that grade).
// choices: { cardIndex: studentId } picked by hand for names that did not match.
export async function buildPlan({ scope, termId, cards, choices = {} }) {
  const year = await getCurrentYear();
  if (!year) throw new Error("No academic year exists.");
  const [kind, val] = String(scope).split(":");
  const v = Number(val);
  if (!["class", "grade"].includes(kind) || !Number.isInteger(v)) throw new Error("Choose which students the file is for.");
  const classWhere = kind === "class" ? { id: v, yearId: year.id } : { gradeLevel: v, yearId: year.id };

  const term = await db.term.findFirst({ where: { id: termId, yearId: year.id } });
  if (!term) throw new Error("Choose a term.");
  const title = `Term ${term.number} Result`;

  const [students, subjects, assessments] = await Promise.all([
    db.student.findMany({
      where: { classGroup: classWhere },
      include: { classGroup: { select: { name: true } } },
      orderBy: [{ fullName: "asc" }],
    }),
    db.subject.findMany(),
    db.assessment.findMany({
      where: { termId: term.id, title, classGroup: classWhere },
      include: { results: { select: { studentId: true, score: true } } },
    }),
  ]);

  const byKey = new Map();
  for (const s of students) {
    const k = nameKey(s.fullName);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(s);
  }
  const byId = new Map(students.map((s) => [s.id, s]));
  const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));
  const assessmentFor = new Map(assessments.map((a) => [`${a.classGroupId}:${a.subjectId}`, a]));
  const fullSeen = new Map();
  const newSubjects = new Set();

  const out = cards.map((c, index) => {
    const card = {
      index, name: c.name, stage: c.stage, term: c.term, heading: c.heading,
      headingMismatch: c.term !== term.number,
      status: "unmatched", studentId: null, classGroupId: null, studentLabel: "",
      candidates: [], suggestions: [], rows: [],
    };

    let student = null;
    const picked = byId.get(Number(choices[index]));
    if (picked) {
      student = picked;
      card.status = "manual";
    } else {
      const hits = byKey.get(nameKey(c.name)) || [];
      if (hits.length === 1) {
        student = hits[0];
        card.status = "matched";
      } else if (hits.length > 1) {
        card.status = "ambiguous";
        card.candidates = hits.map(label);
      } else {
        card.suggestions = students
          .map((s) => ({ s, score: similarity(c.name, s.fullName) }))
          .filter((x) => x.score >= 0.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((x) => label(x.s));
      }
    }
    if (!c.name) card.status = "unmatched";
    if (student) {
      card.studentId = student.id;
      card.classGroupId = student.classGroupId;
      card.studentLabel = label(student).label;
    }

    const seen = new Set();
    for (const r of c.rows) {
      const lower = r.subject.toLowerCase();
      const existing = subjectByName.get((ALIAS[lower] || r.subject).toLowerCase());
      const subjectName = existing ? existing.name : ALIAS[lower] || r.subject;
      const row = { subject: r.subject, subjectName, isNewSubject: !existing, full: r.full, mark: r.mark, state: "new", note: "" };
      const fail = (note) => { row.state = "error"; row.note = note; };

      if (!r.subject) fail("Missing subject name");
      else if (r.mark == null) { row.state = "skip"; row.note = "No mark"; }
      else if (r.full == null || r.full <= 0) fail("Missing or invalid full mark");
      else if (r.mark < 0 || r.mark > r.full) fail(`Mark ${r.mark} is outside 0 to ${r.full}`);
      else if (seen.has(subjectName.toLowerCase())) fail("This subject appears twice");
      seen.add(subjectName.toLowerCase());

      if (row.state === "new" && !existing) newSubjects.add(subjectName);
      if (row.state === "new" && student) {
        const a = existing && assessmentFor.get(`${student.classGroupId}:${existing.id}`);
        if (a && Number(a.maxScore) !== r.full) fail(`This subject already exists with full mark ${Number(a.maxScore)}`);
        else if (a) {
          const prev = a.results.find((x) => x.studentId === student.id);
          if (prev) {
            row.old = Number(prev.score);
            row.state = row.old === r.mark ? "same" : "changed";
          }
        }
        const tk = `${student.classGroupId}:${subjectName.toLowerCase()}`;
        if (row.state !== "error") {
          if (fullSeen.has(tk) && fullSeen.get(tk) !== r.full) fail("Different full mark from other students in this subject");
          else fullSeen.set(tk, r.full);
        }
      }
      card.rows.push(row);
    }
    return card;
  });

  return {
    cards: out,
    newSubjects: [...newSubjects],
    students: students.map(label),
    term: { id: term.id, number: term.number, endsOn: term.endsOn },
    title,
    headingMismatches: cards.filter((c) => c.term !== term.number).length,
  };
}
