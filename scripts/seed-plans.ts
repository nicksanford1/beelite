// Seed the sample plans as ready-to-use bids (project + PDF in storage + Document).
// Idempotent: skips a plan whose project already has a document.
process.loadEnvFile(".env");
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const db = new PrismaClient();
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const PLANS = [
  { file: "samples/midlands-A701.pdf", name: "Midlands Tech — Finish Materials (A-701)", gc: "Quackenbush Architects", location: "Columbia, SC" },
  { file: "samples/nn-campus.pdf", name: "Newport News — Campus Renovation", gc: "Newport News Public Schools", location: "Newport News, VA" },
  { file: "samples/pjhs-flooring.pdf", name: "PJHS — LVT & Carpet Replacement", gc: "Paradise USD", location: "Paradise, CA" },
  { file: "samples/dc-youth-gym.pdf", name: "DC Youth Services — Gymnasium", gc: "DC DGS", location: "Washington, DC" },
];

async function main() {
  const company = (await db.company.findFirst()) ?? (await db.company.create({ data: { name: "My Company" } }));
  for (const p of PLANS) {
    if (!existsSync(p.file)) { console.log("skip (missing file):", p.file); continue; }
    let project = await db.project.findFirst({ where: { name: p.name }, include: { documents: true } });
    if (project?.documents.length) { console.log("skip (already seeded):", p.name); continue; }
    if (!project) {
      project = await db.project.create({
        data: { companyId: company.id, name: p.name, gc: p.gc, location: p.location },
        include: { documents: true },
      });
    }
    const bytes = readFileSync(p.file);
    const path = `${project.id}/${Date.now()}-${p.file.split("/").pop()}`;
    const { error } = await sb.storage.from("plans").upload(path, bytes, { contentType: "application/pdf" });
    if (error) { console.log("upload error:", p.name, error.message); continue; }
    await db.document.create({ data: { projectId: project.id, fileUrl: path } });
    console.log("seeded:", p.name);
  }
  console.log("total projects:", await db.project.count());
  await db.$disconnect();
}
main();
