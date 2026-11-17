import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import { loadResults, weighted, groupBy, bandOf, BAND_LABEL, fmt } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || "").trim();
  const classId = Number(sp?.class) || null;

  const year = await getCurrentYear();
  if (!year) return <section className="empty"><h2>No academic year found</h2></section>;

  const classes = await db.classGroup.findMany({
    where: { yearId: year.id },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const students = await db.student.findMany({
    where: {
      classGroup: { yearId: year.id },
      ...(classId ? { classGroupId: classId } : {}),
      ...(q ? { OR: [{ fullName: { contains: q } }, { studentCode: { contains: q } }] } : {}),
    },
    include: { classGroup: true },
    orderBy: [{ classGroup: { gradeLevel: "asc" } }, { classGroup: { name: "asc" } }, { studentCode: "asc" }],
    take: 500,
  });

  const rows = await loadResults(year.id, students.map((s) => s.id));
  const avgByStudent = new Map([...groupBy(rows, (x) => x.studentId)].map(([id, items]) => [id, weighted(items)]));

  return (
    <>
      <h1>Students</h1>
      <p className="muted">{students.length} shown · academic year {year.name}</p>

      <form className="inline-form filters" method="get">
        <label>
          Search
          <input name="q" defaultValue={q} placeholder="Name or ID" />
        </label>
        <label>
          Class
          <select name="class" defaultValue={classId || ""}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        {(q || classId) && <Link href="/dashboard/students">Clear</Link>}
      </form>

      {students.length === 0 ? (
        <section className="empty">
          <h2>No students found</h2>
          <p>{q || classId ? "Try a different search." : "Import the student list to see students here."}</p>
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Student</th><th>Grade</th><th>Class</th><th>Average</th><th>Status</th></tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const avg = avgByStudent.get(s.id) ?? null;
                const band = bandOf(avg);
                return (
                  <tr key={s.id}>
                    <td>{s.studentCode}</td>
                    <td><Link href={`/dashboard/students/${s.id}`}>{s.fullName}</Link></td>
                    <td>{s.classGroup.gradeLevel}</td>
                    <td>{s.classGroup.name}</td>
                    <td>{fmt(avg)}</td>
                    <td>{band ? <span className={`chip ${band}`}>{BAND_LABEL[band]}</span> : <span className="muted">No results</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
