import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import { loadResults, weighted, groupBy, bandOf, BANDS, BAND_LABEL, fmt } from "@/lib/analytics";
import ScoreBar from "@/components/ScoreBar";

export const dynamic = "force-dynamic";

const TERMS = [1, 2, 3];
const SORTS = { high: "Highest first", low: "Lowest first", name: "Name" };

export default async function SubjectPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId)) notFound();

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) notFound();
  const year = await getCurrentYear();
  if (!year) notFound();

  const classId = Number(sp?.class) || null;
  const sort = SORTS[sp?.sort] ? sp.sort : "high";

  const rows = await loadResults(year.id, undefined, subjectId);
  const students = rows.length
    ? await db.student.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } },
        include: { classGroup: { select: { id: true, name: true, gradeLevel: true } } },
      })
    : [];
  const studentById = new Map(students.map((s) => [s.id, s]));

  // One entry per student.
  let perStudent = [...groupBy(rows, (x) => x.studentId)]
    .map(([sid, items]) => {
      const termAvg = {};
      for (const [t, ti] of groupBy(items, (x) => x.term)) termAvg[t] = weighted(ti);
      const nums = Object.keys(termAvg).map(Number).sort((a, b) => a - b);
      return {
        student: studentById.get(sid),
        avg: weighted(items),
        termAvg,
        change: nums.length >= 2 ? termAvg[nums[nums.length - 1]] - termAvg[nums[nums.length - 2]] : null,
      };
    })
    .filter((s) => s.student && s.avg != null);

  const overall = weighted(rows);
  const bands = { strong: 0, ontrack: 0, support: 0 };
  perStudent.forEach((s) => bands[bandOf(s.avg)]++);
  const best = perStudent.reduce((m, s) => (m == null || s.avg > m ? s.avg : m), null);
  const worst = perStudent.reduce((m, s) => (m == null || s.avg < m ? s.avg : m), null);

  const byTerm = [...groupBy(rows, (x) => x.term)]
    .map(([n, items]) => ({ n, avg: weighted(items) }))
    .filter((t) => t.avg != null)
    .sort((a, b) => a.n - b.n);

  const classRows = rows.map((r) => ({ ...r, classId: studentById.get(r.studentId)?.classGroup.id }));
  const byClass = [...groupBy(classRows.filter((r) => r.classId), (x) => x.classId)]
    .map(([cid, items]) => ({
      name: studentById.get(items[0].studentId).classGroup.name,
      avg: weighted(items),
      count: new Set(items.map((i) => i.studentId)).size,
    }))
    .filter((c) => c.avg != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const classOptions = [...new Map(students.map((s) => [s.classGroup.id, s.classGroup.name]))].sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  if (classId) perStudent = perStudent.filter((s) => s.student.classGroupId === classId);
  perStudent.sort((a, b) =>
    sort === "name"
      ? a.student.fullName.localeCompare(b.student.fullName)
      : sort === "low"
        ? a.avg - b.avg
        : b.avg - a.avg
  );

  const link = (over) => {
    const q = new URLSearchParams();
    const next = { class: classId || "", sort, ...over };
    Object.entries(next).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return `/dashboard/subjects/${subjectId}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <p><Link href="/dashboard/subjects">← All subjects</Link></p>
      <h1>{subject.name}</h1>
      <p className="muted">Academic year {year.name}</p>

      {rows.length === 0 ? (
        <section className="empty">
          <h2>No results yet</h2>
          <p>Scores for this subject will appear here after you import them.</p>
        </section>
      ) : (
        <>
          <dl className="stats">
            <div><dt>Overall average</dt><dd>{fmt(overall)}</dd></div>
            <div><dt>Students</dt><dd>{students.length}</dd></div>
            <div><dt>Highest</dt><dd>{fmt(best)}</dd></div>
            <div><dt>Lowest</dt><dd>{fmt(worst)}</dd></div>
          </dl>

          <div className="grid-2">
            <section className="card">
              <h2>Student performance</h2>
              <ul className="bands">
                <li><span className="chip strong">{BAND_LABEL.strong}</span> {bands.strong} <small>{BANDS.strong}% and above</small></li>
                <li><span className="chip ontrack">{BAND_LABEL.ontrack}</span> {bands.ontrack} <small>{BANDS.onTrack}–{BANDS.strong - 1}%</small></li>
                <li><span className="chip support">{BAND_LABEL.support}</span> {bands.support} <small>below {BANDS.onTrack}%</small></li>
              </ul>
              {byTerm.length > 0 && (
                <>
                  <h2 className="sub">Average by term</h2>
                  <ul className="bars">
                    {byTerm.map((t) => (
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

            <section className="card">
              <h2>Average by class</h2>
              <ul className="bars">
                {byClass.map((c) => (
                  <li key={c.name}>
                    <span>{c.name} <small className="muted">({c.count})</small></span>
                    <ScoreBar value={c.avg} label={`Class ${c.name}`} />
                    <strong>{fmt(c.avg)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <h2>Every student</h2>
            <p className="muted small">
              Sort:{" "}
              {Object.entries(SORTS).map(([k, text], i) => (
                <span key={k}>
                  {i > 0 && " · "}
                  {k === sort ? <strong>{text}</strong> : <Link href={link({ sort: k })}>{text}</Link>}
                </span>
              ))}
              {classOptions.length > 1 && (
                <>
                  {" "}· Class:{" "}
                  {!classId ? <strong>All</strong> : <Link href={link({ class: "" })}>All</Link>}
                  {classOptions.map(([cid, name]) => (
                    <span key={cid}>
                      {" · "}
                      {cid === classId ? <strong>{name}</strong> : <Link href={link({ class: cid })}>{name}</Link>}
                    </span>
                  ))}
                </>
              )}
            </p>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Score</th>
                    {TERMS.map((t) => <th key={t}>T{t}</th>)}
                    <th>Change</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {perStudent.map((s) => {
                    const band = bandOf(s.avg);
                    return (
                      <tr key={s.student.id}>
                        <td><Link href={`/dashboard/students/${s.student.id}`}>{s.student.fullName}</Link></td>
                        <td>{s.student.classGroup.name}</td>
                        <td>
                          <div className="score-cell">
                            <ScoreBar value={s.avg} marker={overall} label={s.student.fullName} />
                            <strong>{fmt(s.avg)}</strong>
                          </div>
                        </td>
                        {TERMS.map((t) => <td key={t}>{fmt(s.termAvg[t])}</td>)}
                        <td>
                          {s.change == null ? "—" : s.change > 0 ? `▲ +${Math.round(s.change)}` : s.change < 0 ? `▼ ${Math.round(s.change)}` : "0"}
                        </td>
                        <td><span className={`chip ${band}`}>{BAND_LABEL[band]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">The tick on each bar marks the overall average for this subject.</p>
          </section>
        </>
      )}
    </>
  );
}
