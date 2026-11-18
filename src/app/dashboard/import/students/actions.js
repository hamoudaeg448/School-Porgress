"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readStudentSheet } from "@/lib/studentSheet";
import { validateStudents } from "@/lib/studentImport";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Not allowed");
  return session;
}

// Step 1: read the file and show what would happen. Nothing is saved.
export async function previewStudents(_prev, formData) {
  await requireAdmin();
  const classId = Number(formData.get("classId"));
  const file = formData.get("file");

  if (!classId) return { error: "Choose a class." };
  if (!file || typeof file === "string" || file.size === 0) return { error: "Choose an Excel file." };
  if (!/\.xlsx$/i.test(file.name))
    return { error: "Please upload an .xlsx file. If yours is .xls, open it in Excel and save it as .xlsx." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 5 MB." };

  let parsed;
  try {
    parsed = await readStudentSheet(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "That file could not be read. Check that it is a valid .xlsx file." };
  }
  if (parsed.rows.length === 0) return { error: "No student rows were found in the first sheet." };
  if (parsed.rows.length > MAX_ROWS) return { error: `The file has more than ${MAX_ROWS} rows.` };

  const rows = await validateStudents(classId, parsed.rows);
  return { rows, fileName: file.name, classId, sheet: parsed.sheet, otherSheets: parsed.otherSheets };
}

// Step 2: check again on the server, then save.
export async function importStudents(_prev, formData) {
  const session = await requireAdmin();
  const classId = Number(formData.get("classId"));
  const fileName = String(formData.get("fileName") || "").slice(0, 191);

  let rows;
  try {
    rows = JSON.parse(String(formData.get("rows") || "[]"));
  } catch {
    return { error: "Something went wrong. Upload the file again." };
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS)
    return { error: "Something went wrong. Upload the file again." };

  const cls = await db.classGroup.findUnique({ where: { id: classId } });
  if (!cls) return { error: "That class no longer exists." };

  const checked = await validateStudents(
    classId,
    rows.map((r) => ({ line: r.line, no: r.code, name: r.name }))
  );
  if (checked.some((r) => r.status === "error"))
    return { error: "The file has problems. Fix them and upload it again." };

  const fresh = checked.filter((r) => r.status === "new");
  if (fresh.length === 0) return { error: "There is nothing new to import." };

  try {
    await db.$transaction([
      db.student.createMany({
        data: fresh.map((r) => ({ studentCode: r.code, fullName: r.name, classGroupId: classId })),
      }),
      db.importBatch.create({
        data: { userId: Number(session.uid), fileName, status: "COMPLETED", rowCount: fresh.length },
      }),
    ]);
  } catch (e) {
    if (e.code === "P2002") return { error: "Some student numbers were just added elsewhere. Upload the file again." };
    throw e;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/classes");
  return { done: true, created: fresh.length, skipped: checked.length - fresh.length, className: cls.name };
}
