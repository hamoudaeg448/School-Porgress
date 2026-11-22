import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import ScoreImport from "./ScoreImport";

export const dynamic = "force-dynamic";

export default async function ImportScoresPage() {
  const year = await getCurrentYear();
  const [classes, terms, students] = year
    ? await Promise.all([
        db.classGroup.findMany({ where: { yearId: year.id }, orderBy: [{ gradeLevel: "asc" }, { name: "asc" }] }),
        db.term.findMany({ where: { yearId: year.id }, orderBy: { number: "asc" } }),
        db.student.count({ where: { classGroup: { yearId: year.id } } }),
      ])
    : [[], [], 0];

  const scopes = [];
  for (const level of [...new Set(classes.map((c) => c.gradeLevel))]) {
    scopes.push({ value: `grade:${level}`, label: `All Grade ${level} classes` });
    classes.filter((c) => c.gradeLevel === level).forEach((c) => scopes.push({ value: `class:${c.id}`, label: `Class ${c.name}` }));
  }

  return (
    <>
      <h1>Import scores</h1>
      <p className="muted">Import term results from a Word file of report cards. Nothing is saved until you confirm.</p>
      {students === 0 ? (
        <section className="empty">
          <h2>Import the student list first</h2>
          <p>Scores are matched to students by name. <Link href="/dashboard/import/students">Import students</Link>.</p>
        </section>
      ) : (
        <ScoreImport scopes={scopes} terms={terms.map((t) => ({ id: t.id, label: t.name }))} />
      )}
    </>
  );
}
