"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { previewScores, importScores } from "./actions";

const STATUS = {
  matched: ["Matched", "strong"],
  manual: ["Chosen", "ontrack"],
  unmatched: ["No match", "support"],
  ambiguous: ["Several matches", "support"],
};
const ROW_NOTE = { new: "new", same: "unchanged", changed: "will update", skip: "skipped", error: "problem" };

export default function ScoreImport({ scopes, terms }) {
  const [preview, previewAction, previewing] = useActionState(previewScores, null);

  return (
    <>
      <section className="card">
        <h2>1. Choose the students, the term and the file</h2>
        <form action={previewAction} className="inline-form">
          <label>
            Students
            <select name="scope" required defaultValue="">
              <option value="" disabled>Select</option>
              {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>
            Term
            <select name="termId" required defaultValue="">
              <option value="" disabled>Select</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label>
            Word file (.docx)
            <input name="file" type="file" accept=".docx" required />
          </label>
          <button type="submit" disabled={previewing}>{previewing ? "Reading…" : "Preview"}</button>
          {preview?.error && <p className="error" role="alert">{preview.error}</p>}
        </form>
        <p className="muted small">
          Each student&apos;s name, subjects, full marks and marks come from the file. Students are matched by name.
        </p>
      </section>

      {preview?.plan && <Review key={preview.at} preview={preview} />}
    </>
  );
}

function Review({ preview }) {
  const { plan } = preview;
  const [choices, setChoices] = useState({});
  const [result, action, pending] = useActionState(importScores, null);

  if (result?.done) {
    return (
      <section className="card">
        <h2>Scores saved</h2>
        <p>
          Saved {result.written} marks for {result.students} student{result.students === 1 ? "" : "s"}.
          {result.skipped > 0 && ` ${result.skipped} card${result.skipped === 1 ? " was" : "s were"} skipped (no student chosen).`}
        </p>
        {result.newSubjects.length > 0 && <p>New subjects created: {result.newSubjects.join(", ")}.</p>}
        <p>
          <Link href="/dashboard">See the overview</Link> · <Link href="/dashboard/students">Students</Link> ·{" "}
          <a href="/dashboard/import/scores">Import another file</a>
        </p>
      </section>
    );
  }

  const resolved = (c) => Boolean(c.studentId || choices[c.index]);
  const ready = plan.cards.filter(resolved).length;
  const problems = plan.cards.filter((c) => c.rows.some((r) => r.state === "error")).length;
  const marks = plan.cards.reduce((n, c) => {
    if (c.studentId) return n + c.rows.filter((r) => r.state === "new" || r.state === "changed").length;
    return choices[c.index] ? n + c.rows.filter((r) => r.state !== "skip" && r.state !== "error").length : n;
  }, 0);

  return (
    <section className="card">
      <h2>2. Check and save</h2>
      <p>
        <strong>{preview.fileName}</strong> · {plan.cards.length} report cards · {plan.title}
      </p>
      {plan.headingMismatches > 0 && (
        <p className="error">
          {plan.headingMismatches} card{plan.headingMismatches === 1 ? " has" : "s have"} a heading other than “{plan.title}”.
          They are marked below. Check that their marks belong to this term.
        </p>
      )}
      {plan.newSubjects.length > 0 && (
        <p className="muted small">
          New subjects that will be created: <strong>{plan.newSubjects.join(", ")}</strong>
        </p>
      )}
      <p>
        {ready} students ready · {plan.cards.length - ready} need a choice or will be skipped · {problems} with problems
      </p>

      <div className="table-wrap flat preview tall">
        <table>
          <thead>
            <tr><th>Name in the file</th><th>Student</th><th>Marks</th></tr>
          </thead>
          <tbody>
            {plan.cards.map((c) => {
              const [text, chip] = STATUS[choices[c.index] ? "manual" : c.status];
              return (
                <tr key={c.index}>
                  <td>
                    {c.name || <span className="muted">(no name)</span>}
                    <br />
                    <span className={`chip ${chip}`}>{text}</span>
                    {c.headingMismatch && <small className="error"> File heading: “{c.heading || "none"}”</small>}
                  </td>
                  <td>
                    {c.studentId ? (
                      c.studentLabel
                    ) : (
                      <select
                        value={choices[c.index] || ""}
                        onChange={(e) => setChoices((p) => ({ ...p, [c.index]: e.target.value }))}
                        aria-label={`Student for ${c.name}`}
                      >
                        <option value="">Skip this card</option>
                        {(c.candidates.length ? c.candidates : c.suggestions).length > 0 && (
                          <optgroup label={c.candidates.length ? "Matching names" : "Closest names"}>
                            {(c.candidates.length ? c.candidates : c.suggestions).map((s) => (
                              <option key={`s${s.id}`} value={s.id}>{s.label}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="All students">
                          {plan.students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </optgroup>
                      </select>
                    )}
                  </td>
                  <td>
                    <details>
                      <summary>{c.rows.length} subjects</summary>
                      <ul className="mark-list">
                        {c.rows.map((r, i) => (
                          <li key={i} className={r.state === "error" ? "error" : ""}>
                            {r.subjectName}: {r.mark ?? "—"}/{r.full ?? "—"}{" "}
                            <small className="muted">
                              {ROW_NOTE[r.state]}
                              {r.state === "changed" && ` (was ${r.old})`}
                              {r.note && ` · ${r.note}`}
                              {r.isNewSubject && " · new subject"}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={action} className="inline-form">
        <input type="hidden" name="scope" value={preview.scope} />
        <input type="hidden" name="termId" value={preview.termId} />
        <input type="hidden" name="fileName" value={preview.fileName} />
        <input type="hidden" name="cards" value={JSON.stringify(preview.cards)} />
        <input type="hidden" name="choices" value={JSON.stringify(choices)} />
        <button type="submit" disabled={pending || problems > 0 || marks === 0}>
          {pending ? "Saving…" : `Save ${marks} marks`}
        </button>
        {problems > 0 && <p className="error">Fix the problems in the file, then upload it again.</p>}
        {result?.error && <p className="error" role="alert">{result.error}</p>}
      </form>
    </section>
  );
}
