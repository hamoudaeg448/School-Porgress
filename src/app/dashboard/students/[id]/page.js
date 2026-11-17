import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadResults, weighted, groupBy, bandOf, judge, BAND_LABEL, fmt } from "@/lib/analytics";
import ScoreBar from "@/components/ScoreBar";

export const dynamic = "force-dynamic";

const TERMS = [1, 2, 3];

export default async function StudentProfile({ params }) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid)) notFound();

  const student = await db.student.findUnique({ where: { id: sid }, include: { classGroup: true } });
  if (!student) notFound();

  const classmates = await db.student.findMany({
    where: { classGroupId: student.classGroupId },
    select: { id: true },
  });
  const all = await loadResults(student.classGroup.yearId, classmates.map((c) => c.id));
  const mine = all.filter((x) => x.studentId === student.id);

  const subjects = [...groupBy(mine, (x) => x.subjectId)]
    .map(([subjectId, items]) => {
      const termAvg = {};
      for (const [t, ti] of groupBy(items, (x) => x.term)) termAvg[t] = weighted(ti);
      const nums = Object.keys(termAvg).map(Number).sort((a, b) => a - b);
      const change = nums.length >= 2 ? termAvg[nums[nums.length - 1]] - termAvg[nums[nums.length - 2]] : null;
      const s = {
        name: items[0].subject,
        avg: weighted(items),
        classAvg: weighted(all.filter((x) => x.subjectId === subjectId)),
        termAvg,
        change,
      };
      return { ...s, ...judge(s) };
    })
    .filter((s) => s.avg != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const overall = weighted(mine);
  const classOverall = weighted(all);
  const band = bandOf(overall);
  const strengths = subjects.filter((s) => s.strengths.length).sort((a, b) => b.avg - a.avg);
  const weaknesses = subjects.filter((s) => s.weaknesses.length).sort((a, b) => a.avg - b.avg);

  return (
    <>
      <p><Link href="/dashboard/students">← All students</Link></p>
      <h1>{student.fullName}</h1>
      <p className="muted">
        ID {student.studentCode} · Grade {student.classGroup.gradeLevel} · Class {student.classGroup.name}
      </p>

      {subjects.length === 0 ? (
        <section className="empty">
          <h2>No results yet</h2>
          <p>Scores will appear here once results are imported for this student.</p>
        </section>
      ) : (
        <>
          <dl className="stats">
            <div><dt>Overall average</dt><dd>{fmt(overall)}</dd></div>
            <div><dt>Class average</dt><dd>{fmt(classOverall)}</dd></div>
            <div><dt>Status</dt><dd><span className={`chip big ${band}`}>{BAND_LABEL[band]}</span></dd></div>
            <div><dt>Results recorded</dt><dd>{mine.length}</dd></div>
          </dl>

          <div className="grid-2">
            <section className="card">
              <h2>Strengths</h2>
              {strengths.length === 0 ? (
                <p className="muted">No clear strengths flagged yet.</p>
              ) : (
                <ul className="reasons">
                  {strengths.map((s) => (
                    <li key={s.name}>
                      <strong>{s.name}</strong> <span className="muted">{fmt(s.avg)}</span>
                      <br /><small>{s.strengths.join(" · ")}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card">
              <h2>Areas to improve</h2>
              {weaknesses.length === 0 ? (
                <p className="muted">No concerns flagged.</p>
              ) : (
                <ul className="reasons">
                  {weaknesses.map((s) => (
                    <li key={s.name}>
                      <strong>{s.name}</strong> <span className="muted">{fmt(s.avg)}</span>
                      <br /><small>{s.weaknesses.join(" · ")}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card">
            <h2>Scores by subject</h2>
            <p className="muted small">The tick on each bar marks the class average.</p>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Score</th>
                    <th>Class avg</th>
                    {TERMS.map((t) => <th key={t}>T{t}</th>)}
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>
                        <div className="score-cell">
                          <ScoreBar value={s.avg} marker={s.classAvg} label={s.name} />
                          <strong>{fmt(s.avg)}</strong>
                        </div>
                      </td>
                      <td>{fmt(s.classAvg)}</td>
                      {TERMS.map((t) => <td key={t}>{fmt(s.termAvg[t])}</td>)}
                      <td>
                        {s.change == null
                          ? "—"
                          : s.change > 0
                            ? `▲ +${Math.round(s.change)}`
                            : s.change < 0
                              ? `▼ ${Math.round(s.change)}`
                              : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
