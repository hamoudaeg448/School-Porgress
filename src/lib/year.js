import { db } from "./db";

// The current academic year is the one that started most recently.
export function getCurrentYear() {
  return db.academicYear.findFirst({ orderBy: { startsOn: "desc" } });
}
