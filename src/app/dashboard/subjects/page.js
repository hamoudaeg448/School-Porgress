import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import { loadResults, weighted, groupBy, bandOf, fmt } from "@/lib/analytics";
import ScoreBar from "@/components/ScoreBar";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const year = await getCurrentYear();
  if (!year) return <section className="empty"><h2>No academic year found</h2></section>;

  const [subjects, rows] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    loadResults(year.id),
  ]);
  const bySubject = groupBy(rows, (x) => x.subjectId);

  const list = subjects.map((s) => {
    const items = bySubject.get(s.id) || [];
    const perStudent = [...groupBy(items, (x) => x.studentId)]
      .map(([, it]) => weighted(it))
      .filter((a) => a != null);
    const support = perStudent.filter((a) => bandOf(a) === "support").length;
    return { ...s, avg: weighted(items), students: perStudent.length, support };
  });

  return (
    <>
      <h1>Subjects</h1>
      <p className="muted">Academic year {year.name}</p>

      {list.length === 0 ? (
        <section className="empty">
          <h2>No subjects yet</h2>
          <p>Subjects are created when you import scores.</p>
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Subject</th><th>Average</th><th>Students</th><th>Needing support</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/dashboard/subjects/${s.id}`}>{s.name}</Link></td>
                  <td>
                    {s.avg == null ? (
                      <span className="muted">No results yet</span>
                    ) : (
                      <div className="score-cell">
                        <ScoreBar value={s.avg} label={s.name} />
                        <strong>{fmt(s.avg)}</strong>
                      </div>
                    )}
                  </td>
                  <td>{s.students || "—"}</td>
                  <td>{s.students ? `${s.support} of ${s.students}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
