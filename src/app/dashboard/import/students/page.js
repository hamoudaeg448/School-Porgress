import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/year";
import StudentImport from "./StudentImport";

export const dynamic = "force-dynamic";

export default async function ImportStudentsPage() {
  const year = await getCurrentYear();
  const classes = year
    ? await db.classGroup.findMany({
        where: { yearId: year.id },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      })
    : [];

  return (
    <>
      <h1>Import students</h1>
      <p className="muted">Add a class list from Excel. Nothing is saved until you confirm.</p>
      {classes.length === 0 ? (
        <section className="empty">
          <h2>Create a class first</h2>
          <p>Students are added to a class. <Link href="/dashboard/classes">Go to Classes</Link>.</p>
        </section>
      ) : (
        <StudentImport classes={classes} />
      )}
    </>
  );
}
