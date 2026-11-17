import { db } from "./db";

// Performance bands (percent). Easy to change in one place.
export const BANDS = { strong: 80, onTrack: 60 };
export const BAND_LABEL = { strong: "Strong", ontrack: "On track", support: "Needs support" };

export function bandOf(p) {
  if (p == null) return null;
  if (p >= BANDS.strong) return "strong";
  if (p >= BANDS.onTrack) return "ontrack";
  return "support";
}

export const fmt = (n) => (n == null ? "—" : `${Math.round(n)}%`);
const r = (n) => Math.round(n);

// One flat row per result, with the score converted to a percentage.
export async function loadResults(yearId, studentIds) {
  const rows = await db.result.findMany({
    where: {
      assessment: { term: { yearId } },
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
    },
    select: {
      studentId: true,
      score: true,
      assessment: {
        select: {
          subjectId: true,
          maxScore: true,
          weight: true,
          subject: { select: { name: true } },
          term: { select: { number: true } },
        },
      },
    },
  });
  return rows.map((x) => ({
    studentId: x.studentId,
    subjectId: x.assessment.subjectId,
    subject: x.assessment.subject.name,
    term: x.assessment.term.number,
    p: (Number(x.score) / Number(x.assessment.maxScore)) * 100,
    w: Number(x.assessment.weight),
  }));
}

// Weighted average percentage (exams can count more than quizzes).
export function weighted(items) {
  const total = items.reduce((s, i) => s + i.w, 0);
  return total > 0 ? items.reduce((s, i) => s + i.p * i.w, 0) / total : null;
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

// Plain, explainable rules for strengths and weaknesses of one subject.
// s = { avg, classAvg, change }
export function judge(s) {
  const strengths = [];
  const weaknesses = [];
  const gap = s.classAvg != null ? s.avg - s.classAvg : null;
  if (s.avg >= BANDS.strong) strengths.push(`Average of ${r(s.avg)}%`);
  if (gap != null && gap >= 10) strengths.push(`${r(gap)} points above the class average`);
  if (s.avg < BANDS.onTrack) weaknesses.push(`Average of ${r(s.avg)}%, below ${BANDS.onTrack}%`);
  if (gap != null && gap <= -10) weaknesses.push(`${r(-gap)} points below the class average`);
  if (s.change != null && s.change <= -10) weaknesses.push(`Dropped ${r(-s.change)} points since the previous term`);
  return { strengths, weaknesses };
}
