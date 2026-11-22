import { getSession } from "@/lib/auth";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  return (
    <>
      <h1>Account</h1>
      <p className="muted">Signed in as {session?.name}</p>
      <section className="card narrow">
        <h2>Change password</h2>
        <p className="muted small">Use at least 10 characters. A few random words work well and are easy to remember.</p>
        <PasswordForm />
      </section>
    </>
  );
}
