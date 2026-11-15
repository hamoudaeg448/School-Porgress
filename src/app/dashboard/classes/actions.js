"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCurrentYear } from "@/lib/year";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Not allowed");
}

function parse(formData) {
  const name = String(formData.get("name") || "").trim();
  const gradeLevel = Number(formData.get("gradeLevel"));
  if (!name || name.length > 30) return { error: "Enter a class name of up to 30 characters." };
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12)
    return { error: "Grade level must be a whole number from 1 to 12." };
  return { name, gradeLevel };
}

export async function addClass(_prev, formData) {
  await requireAdmin();
  const data = parse(formData);
  if (data.error) return { error: data.error };

  const year = await getCurrentYear();
  if (!year) return { error: "No academic year exists yet." };

  try {
    await db.classGroup.create({ data: { ...data, yearId: year.id } });
  } catch (e) {
    if (e.code === "P2002") return { error: `A class named "${data.name}" already exists this year.` };
    throw e;
  }
  revalidatePath("/dashboard/classes");
  return { ok: true, at: Date.now() };
}

export async function updateClass(_prev, formData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const data = parse(formData);
  if (data.error) return { error: data.error };

  try {
    await db.classGroup.update({ where: { id }, data });
  } catch (e) {
    if (e.code === "P2002") return { error: `A class named "${data.name}" already exists this year.` };
    throw e;
  }
  revalidatePath("/dashboard/classes");
  return { ok: true, at: Date.now() };
}

export async function deleteClass(formData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const count = await db.student.count({ where: { classGroupId: id } });
  if (count > 0) return; // classes with students can't be deleted
  await db.classGroup.delete({ where: { id } });
  revalidatePath("/dashboard/classes");
}
