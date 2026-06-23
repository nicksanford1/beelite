/**
 * Run the Opus subset read once and write the result straight into a project's Extraction, so the
 * Finishes UI shows it WITHOUT triggering a live (expensive) read. Demo-prep tooling.
 *   npx tsx --env-file=.env scripts/load-read.ts <projectNameContains> "<pdf>" "14,15,16,17"
 */
import { readFileSync } from "fs";
import { db } from "@/lib/db";
import { extractPages } from "@/lib/pdf";
import { readFinishesGuarded } from "@/lib/anthropic";

async function main() {
  const nameContains = process.argv[2];
  const pdfPath = process.argv[3];
  const pages = (process.argv[4] ?? "14,15,16,17").split(",").map(Number);

  const project = await db.project.findFirst({
    where: { name: { contains: nameContains } },
    include: { documents: { orderBy: { createdAt: "asc" }, include: { pages: { orderBy: { pageNumber: "asc" } } } } },
  });
  if (!project) throw new Error(`No project matching "${nameContains}" — intake it first.`);
  const primary = project.documents[0]?.pages[0];
  if (!primary) throw new Error("Project has no ingested plan sheets yet.");

  console.log(`Reading pages ${pages.join(", ")} with Opus 4.8…`);
  const subset = await extractPages(readFileSync(pdfPath), pages);
  const { result, model } = await readFinishesGuarded(subset, "claude-opus-4-8");
  console.log(`status ${result.status} · ${result.finishes.length} finishes · ${result.assignments.length} assignments`);

  const confidence = result.finishes.map((f) => ({ code: f.code, confidence: f.confidence }));
  const rawOutput = { ...result, whole: true };
  await db.extraction.upsert({
    where: { planSheetId: primary.id },
    create: { planSheetId: primary.id, model, rawOutput, confidence },
    update: { model, rawOutput, corrected: undefined, confidence },
  });
  console.log(`✓ Loaded into project ${project.id}. Open /projects/${project.id}/finishes`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
