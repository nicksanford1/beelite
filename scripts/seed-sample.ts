// Seeds one sample bid so the ledger isn't empty for the demo. Safe to re-run.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const company = (await db.company.findFirst()) ?? (await db.company.create({ data: { name: "My Company" } }));
  const name = "Westside Medical — Tenant Improvement";
  const exists = await db.project.findFirst({ where: { name } });
  if (!exists) {
    await db.project.create({
      data: { companyId: company.id, name, gc: "Turner Construction", location: "Phoenix, AZ", bidDate: new Date("2026-06-20") },
    });
  }
  console.log("projects:", await db.project.count());
  await db.$disconnect();
}
main();
