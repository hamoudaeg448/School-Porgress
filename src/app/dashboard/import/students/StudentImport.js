"use client";

import Link from "next/link";
import { useActionState } from "react";
import { previewStudents, importStudents } from "./actions";

const LABEL = { new: "New", exists: "Already imported", error: "Fix this" };
const CHIP = { new: "strong", exists: "muted", error: "support" };

export default function StudentImport({ classes }) {
  const [preview, previewAction, previewing] = useActionState(previewStudents, null);
  const [result, importAction, importing] = useActionState(importStudents, null);

  if (result?.done) {
    return (
      <section className="card">
        <h2>Import complete</h2>
        <p>
          Added {result.created} student{result.created === 1 ? "" : "s"} to class {result.className}
          {result.skipped > 0 && ` (${result.skipped} already existed)`}.
        </p>
        <p>
          <Link href="/dashboard/students">View students</Link> · <a href="/dashboard/import/students">Import another file</a>
        </p>
      </section>
    );
  }

  const rows = preview?.rows;
  const count = (s) => (rows ? rows.filter((r) => r.status === s).length : 0);
  const className = rows ? classes.find((c) => c.id === preview.classId)?.name : "";

  return (
    <>
      <section className="card">
        <h2>1. Choose the class and the file</h2>
        <form action={previewAction} className="inline-form">
          <label>
            Class
            <select name="classId" required defaultValue="">
              <option value="" disabled>Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Excel file (.xlsx)
            <input name="file" type="file" accept=".xlsx" required />
          </label>
          <button type="submit" disabled={previewing}>{previewing ? "Reading…" : "Preview"}</button>
          {preview?.error && <p className="error" role="alert">{preview.error}</p>}
        </form>
        <p className="muted small">
          Column A is the student number, column B is the student name. Numbers like 1 become 0001.
        </p>
      </section>

      {rows && (
        <section className="card">
          <h2>2. Check and import</h2>
          <p>
            <strong>{preview.fileName}</strong> → class <strong>{className}</strong> · sheet “{preview.sheet}”
          </p>
          {preview.otherSheets > 0 && (
            <p className="muted small">
              Only the first sheet was read. {preview.otherSheets} other sheet{preview.otherSheets === 1 ? " was" : "s were"} ignored.
            </p>
          )}
          <p>
            {count("new")} new · {count("exists")} already imported · {count("error")} with problems
          </p>

          <div className="table-wrap flat preview">
            <table>
              <thead>
                <tr><th>Line</th><th>Student no</th><th>Name</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>
                      <span className={`chip ${CHIP[r.status]}`}>{LABEL[r.status]}</span>
                      {r.note && <small className="muted"> {r.note}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={importAction} className="inline-form">
            <input type="hidden" name="classId" value={preview.classId} />
            <input type="hidden" name="fileName" value={preview.fileName} />
            <input type="hidden" name="rows" value={JSON.stringify(rows)} />
            <button type="submit" disabled={importing || count("error") > 0 || count("new") === 0}>
              {importing ? "Importing…" : `Import ${count("new")} student${count("new") === 1 ? "" : "s"}`}
            </button>
            {count("error") > 0 && <p className="error">Fix the problems in your Excel file, then upload it again.</p>}
            {result?.error && <p className="error" role="alert">{result.error}</p>}
          </form>
        </section>
      )}
    </>
  );
}
