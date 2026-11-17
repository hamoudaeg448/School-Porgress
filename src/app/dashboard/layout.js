import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logout } from "../actions";

export default async function DashboardLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <header className="topbar">
        <nav className="nav">
          <strong>School Progress</strong>
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/students">Students</Link>
          <Link href="/dashboard/classes">Classes</Link>
        </nav>
        <form action={logout}>
          <span className="muted">{session.name}</span>
          <button className="ghost" type="submit">Sign out</button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
