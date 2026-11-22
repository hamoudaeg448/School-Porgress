"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="stack-form">
      <label>
        Current password
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label>
        New password
        <input name="next" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label>
        Confirm new password
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
      {state?.ok && <p role="status">Password changed. Use the new password next time you sign in.</p>}
      {state?.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
