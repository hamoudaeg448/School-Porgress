"use client";

import { useActionState, useEffect, useRef } from "react";
import { addClass, updateClass } from "./actions";

export function AddClassForm() {
  const [state, action, pending] = useActionState(addClass, null);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="inline-form">
      <label>
        Class name
        <input name="name" placeholder="8A" maxLength={30} required />
      </label>
      <label>
        Grade level
        <input name="gradeLevel" type="number" min="1" max="12" placeholder="8" required />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Adding…" : "Add class"}</button>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}

export function EditClassForm({ cls }) {
  const [state, action, pending] = useActionState(updateClass, null);
  return (
    <details className="edit">
      <summary>Edit</summary>
      <form action={action} className="inline-form">
        <input type="hidden" name="id" value={cls.id} />
        <label>
          Class name
          <input name="name" defaultValue={cls.name} maxLength={30} required />
        </label>
        <label>
          Grade level
          <input name="gradeLevel" type="number" min="1" max="12" defaultValue={cls.gradeLevel} required />
        </label>
        <button type="submit" disabled={pending}>Save changes</button>
        {state?.ok && <p className="muted">Saved.</p>}
        {state?.error && <p className="error" role="alert">{state.error}</p>}
      </form>
    </details>
  );
}
