import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import { AddClassForm, EditClassForm } from "./forms";
import { deleteClass } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const year = await getCurrentYear();
  if (!year) {
    return (
      <section className="empty">
        <h2>No academic year found</h2>
        <p>Run the database setup to create the 2026-2027 year.</p>
      </section>
    );
  }

  const classes = await db.classGroup.findMany({
    where: { yearId: year.id },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    include: { _count: { select: { students: true } } },
  });

  return (
    <>
      <h1>Classes</h1>
      <p className="muted">Academic year {year.name}</p>

      <section className="card">
        <h2>Add a class</h2>
        <AddClassForm />
      </section>

      {classes.length === 0 ? (
        <section className="empty">
          <h2>No classes yet</h2>
          <p>Add your first class above, for example 1A with grade level 1.</p>
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Grade level</th>
                <th>Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.gradeLevel}</td>
                  <td>{c._count.students}</td>
                  <td className="actions">
                    <EditClassForm cls={c} />
                    <form action={deleteClass}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        className="ghost"
                        type="submit"
                        disabled={c._count.students > 0}
                        title={c._count.students > 0 ? "Remove the students first" : "Delete this class"}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
