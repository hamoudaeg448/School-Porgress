import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [students, subjects, assessments, results] = await Promise.all([
    db.student.count(),
    db.subject.count(),
    db.assessment.count(),
    db.result.count(),
  ]);

  const stats = [
    ["Students", students],
    ["Subjects", subjects],
    ["Assessments", assessments],
    ["Results recorded", results],
  ];

  return (
    <>
      <header className="topbar">
        <strong>School Progress</strong>
        <form action={logout}>
          <span className="muted">{session.name} · {session.role.toLowerCase()}</span>
          <button className="ghost" type="submit">Sign out</button>
        </form>
      </header>
      <main className="page">
        <h1>Overview</h1>
        <dl className="stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {results === 0 && (
          <section className="empty">
            <h2>No results yet</h2>
            <p>Add students and import a spreadsheet of scores to see progress charts here.</p>
          </section>
        )}
      </main>
    </>
  );
}
