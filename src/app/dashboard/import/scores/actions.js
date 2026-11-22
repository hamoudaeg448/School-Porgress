"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readReportCards, sanitizeCards } from "@/lib/reportCards";
import { buildPlan } from "@/lib/reportImport";

const MAX_BYTES = 5 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Not allowed");
  return session;
}

// Step 1: read the Word file and show what would happen. Nothing is saved.
export async function previewScores(_prev, formData) {
  await requireAdmin();
  const scope = String(formData.get("scope") || "");
  const termId = Number(formData.get("termId"));
  const file = formData.get("file");

  if (!scope) return { error: "Choose the class or grade the file is for." };
  if (!termId) return { error: "Choose the term." };
  if (!file || typeof file === "string" || file.size === 0) return { error: "Choose a Word file." };
  if (!/\.docx$/i.test(file.name))
    return { error: "Please upload a .docx file. If yours is .doc, open it in Word and save it as .docx." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 5 MB." };

  let cards;
  try {
    cards = sanitizeCards(readReportCards(Buffer.from(await file.arrayBuffer())));
  } catch {
    return { error: "That file could not be read. Check that it is a valid .docx file." };
  }
  if (cards.length === 0) return { error: "No report cards were found in this file." };

  try {
    const plan = await buildPlan({ scope, termId, cards });
    return { plan, cards, scope, termId, fileName: file.name, at: Date.now() };
  } catch (e) {
    return { error: e.message };
  }
}

// Step 2: check again on the server, then save.
export async function importScores(_prev, formData) {
  const session = await requireAdmin();
  const scope = String(formData.get("scope") || "");
  const termId = Number(formData.get("termId"));
  const fileName = String(formData.get("fileName") || "").slice(0, 191);

  let cards;
  let choices;
  try {
    cards = sanitizeCards(JSON.parse(String(formData.get("cards") || "[]")));
    choices = JSON.parse(String(formData.get("choices") || "{}"));
  } catch {
    return { error: "Something went wrong. Upload the file again." };
  }

  let plan;
  try {
    plan = await buildPlan({ scope, termId, cards, choices });
  } catch (e) {
    return { error: e.message };
  }

  const usable = plan.cards.filter((c) => c.studentId);
  const bad = usable.filter((c) => c.rows.some((r) => r.state === "error"));
  if (bad.length > 0)
    return { error: `Fix the problems first (${bad.map((c) => c.name).slice(0, 3).join(", ")}${bad.length > 3 ? "…" : ""}).` };
  if (!usable.some((c) => c.rows.some((r) => r.state === "new" || r.state === "changed")))
    return { error: "There is nothing new to save." };

  const term = plan.term;
  let written = 0;
  let students = 0;
  try {
    await db.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: { userId: Number(session.uid), fileName, status: "COMPLETED", rowCount: 0 },
        });
        const subjects = new Map((await tx.subject.findMany()).map((s) => [s.name.toLowerCase(), s]));
        const assessments = new Map();

        for (const card of usable) {
          let touched = false;
          for (const row of card.rows) {
            if (row.state !== "new" && row.state !== "changed") continue;
            let subject = subjects.get(row.subjectName.toLowerCase());
            if (!subject) {
              subject = await tx.subject.create({ data: { name: row.subjectName } });
              subjects.set(row.subjectName.toLowerCase(), subject);
            }
            const key = `${card.classGroupId}:${subject.id}`;
            let a =
              assessments.get(key) ||
              (await tx.assessment.findFirst({
                where: { classGroupId: card.classGroupId, subjectId: subject.id, termId, title: plan.title },
              }));
            if (!a) {
              a = await tx.assessment.create({
                data: {
                  title: plan.title, type: "EXAM", subjectId: subject.id, classGroupId: card.classGroupId,
                  termId, maxScore: row.full, weight: 1, date: term.endsOn,
                },
              });
            }
            assessments.set(key, a);
            await tx.result.upsert({
              where: { assessmentId_studentId: { assessmentId: a.id, studentId: card.studentId } },
              update: { score: row.mark, importBatchId: batch.id },
              create: { assessmentId: a.id, studentId: card.studentId, score: row.mark, importBatchId: batch.id },
            });
            written++;
            touched = true;
          }
          if (touched) students++;
        }
        await tx.importBatch.update({ where: { id: batch.id }, data: { rowCount: written } });
      },
      { timeout: 60000, maxWait: 10000 }
    );
  } catch (e) {
    return { error: "The scores could not be saved. Nothing was changed. Try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");
  return {
    done: true, written, students,
    skipped: plan.cards.length - usable.length,
    newSubjects: plan.newSubjects,
  };
}
