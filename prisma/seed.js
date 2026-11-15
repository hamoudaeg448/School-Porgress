const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");

  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "School Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });

  const year = await db.academicYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: { name: "2026-2027", startsOn: new Date("2026-09-01"), endsOn: new Date("2027-06-30") },
  });
  const terms = [
    [1, "Term 1", "2026-09-01", "2026-12-20"],
    [2, "Term 2", "2027-01-10", "2027-04-10"],
    [3, "Term 3", "2027-04-20", "2027-06-30"],
  ];
  for (const [number, name, s, e] of terms) {
    await db.term.upsert({
      where: { yearId_number: { yearId: year.id, number } },
      update: {},
      create: { yearId: year.id, number, name, startsOn: new Date(s), endsOn: new Date(e) },
    });
  }
  for (const name of ["Mathematics", "Science", "English", "Arabic"]) {
    await db.subject.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log("Seeded admin, academic year, terms and subjects.");
}

main().finally(() => db.$disconnect());
