import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import { loadResults, weighted, groupBy, bandOf, BANDS, BAND_LABEL, fmt } from "@/lib/analytics";
import ScoreBar from "@/components/ScoreBar";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const year = await getCurrentYear();
  if (!year) {
    return (
      <section className="empty">
        <h2>No academic year found</h2>
        <p>Run the database setup to create the academic year.</p>
      </section>
    );
  }

  const [classes, students, assessments, rows] = await Promise.all([
    db.classGroup.count({ where: { yearId: year.id } }),
    db.student.count({ where: { classGroup: { yearId: year.id } } }),
    db.assessment.count({ where: { term: { yearId: year.id } } }),
    loadResults(year.id),
  ]);

  const overall = weighted(rows);
  const subjects = [...groupBy(rows, (x) => x.subject)]
    .map(([name, items]) => ({ name, avg: weighted(items) }))
    .filter((s) => s.avg != null)
    .sort((a, b) => b.avg - a.avg);
  const terms = [...groupBy(rows, (x) => x.term)]
    .map(([n, items]) => ({ n, avg: weighted(items) }))
    .filter((t) => t.avg != null)
    .sort((a, b) => a.n - b.n);
  const perStudent = [...groupBy(rows, (x) => x.studentId)]
    .map(([id, items]) => ({ id, avg: weighted(items) }))
    .filter((s) => s.avg != null);

  const bands = { strong: 0, ontrack: 0, support: 0 };
  perStudent.forEach((s) => bands[bandOf(s.avg)]++);

  const lowest = [...perStudent].sort((a, b) => a.avg - b.avg).slice(0, 5);
  const lowestStudents = lowest.length
    ? await db.student.findMany({
        where: { id: { in: lowest.map((s) => s.id) } },
        select: { id: true, fullName: true, studentCode: true, classGroup: { select: { name: true } } },
      })
    : [];
  const byId = new Map(lowestStudents.map((s) => [s.id, s]));

  const stats = [
    ["School average", fmt(overall)],
    ["Students", students],
    ["Classes", classes],
    ["Assessments", assessments],
    ["Results recorded", rows.length],
  ];

  return (
    <>
      <h1>Overview</h1>
      <p className="muted">Academic year {year.name}</p>

      <dl className="stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <section className="empty">
          <h2>No results yet</h2>
          <p>Create your classes, import the student list, then import scores to see progress here.</p>
        </section>
      ) : (
        <>
          <div className="grid-2">
            <section className="card">
              <h2>Average by subject</h2>
              <ul className="bars">
                {subjects.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <ScoreBar value={s.avg} label={s.name} />
                    <strong>{fmt(s.avg)}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>Student performance</h2>
              <ul className="bands">
                <li><span className="chip strong">{BAND_LABEL.strong}</span> {bands.strong} <small>{BANDS.strong}% and above</small></li>
                <li><span className="chip ontrack">{BAND_LABEL.ontrack}</span> {bands.ontrack} <small>{BANDS.onTrack}–{BANDS.strong - 1}%</small></li>
                <li><span className="chip support">{BAND_LABEL.support}</span> {bands.support} <small>below {BANDS.onTrack}%</small></li>
              </ul>
              {terms.length > 0 && (
                <>
                  <h2 className="sub">Average by term</h2>
                  <ul className="bars">
                    {terms.map((t) => (
                      <li key={t.n}>
                        <span>Term {t.n}</span>
                        <ScoreBar value={t.avg} label={`Term ${t.n}`} />
                        <strong>{fmt(t.avg)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="card">
            <h2>Students who need the most support</h2>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr><th>ID</th><th>Student</th><th>Class</th><th>Average</th></tr>
                </thead>
                <tbody>
                  {lowest.map((s) => {
                    const st = byId.get(s.id);
                    return (
                      <tr key={s.id}>
                        <td>{st?.studentCode}</td>
                        <td><Link href={`/dashboard/students/${s.id}`}>{st?.fullName}</Link></td>
                        <td>{st?.classGroup.name}</td>
                        <td>{fmt(s.avg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
