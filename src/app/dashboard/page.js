import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [classes, students, subjects, assessments, results] = await Promise.all([
    db.classGroup.count(),
    db.student.count(),
    db.subject.count(),
    db.assessment.count(),
    db.result.count(),
  ]);

  const stats = [
    ["Classes", classes],
    ["Students", students],
    ["Subjects", subjects],
    ["Assessments", assessments],
    ["Results recorded", results],
  ];

  return (
    <>
      <h1>Overview</h1>
      <dl className="stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {students === 0 && (
        <section className="empty">
          <h2>No students yet</h2>
          <p>Create your classes first, then import the student list from Excel.</p>
        </section>
      )}
    </>
  );
}
