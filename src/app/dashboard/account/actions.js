"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function changePassword(_prev, formData) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (next.length < 10) return { error: "The new password must be at least 10 characters." };
  if (Buffer.byteLength(next) > 72) return { error: "The new password is too long (72 characters at most)." };
  if (next !== confirm) return { error: "The new password and its confirmation do not match." };
  if (next === current) return { error: "Choose a password different from the current one." };

  const user = await db.user.findUnique({ where: { id: Number(session.uid) } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash)))
    return { error: "The current password is incorrect." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  return { ok: true, at: Date.now() };
}
