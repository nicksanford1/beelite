import { db } from "@/lib/db";

/** V1 is single-company; get the one company or create it on first use. */
export async function getOrCreateDefaultCompany() {
  const existing = await db.company.findFirst();
  if (existing) return existing;
  return db.company.create({ data: { name: "My Company" } });
}
