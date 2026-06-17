/**
 * Load a sample plan as a real project (create + upload + scan pages) — no extraction/takeoff, so you
 * tag + read it in the UI like a real upload. Run: PLAN=samples/x.pdf NAME="Job name" tsx --env-file=.env scripts/load-plan.ts
 */
import { readFileSync } from "fs";
import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan } from "@/lib/storage";
import { scanPdf } from "@/lib/pdf";

const PLAN = process.env.PLAN!;
const NAME = process.env.NAME || (PLAN?.split("/").pop() ?? "Sample");

async function main() {
  if (!PLAN) throw new Error("set PLAN=samples/x.pdf");
  const company = await getOrCreateDefaultCompany();
  const bytes = readFileSync(PLAN);
  const project = await db.project.create({ data: { companyId: company.id, name: NAME, status: "draft" } });
  const path = `${project.id}/${PLAN.split("/").pop()}`;
  await uploadPlan(path, bytes);
  const doc = await db.document.create({ data: { projectId: project.id, fileUrl: path } });
  const scans = await scanPdf(bytes);
  await db.planSheet.createMany({
    data: scans.map((s) => ({
      documentId: doc.id, pageNumber: s.pageNumber, sheetNumber: s.sheetNumber, sheetTitle: s.sheetTitle,
      suggestedSheetType: s.suggestedSheetType, scanScore: s.score, scanSignals: s.signals as object,
    })),
  });
  const flagged = scans.filter((s) => s.suggestedSheetType === "finish_schedule").map((s) => s.pageNumber);
  console.log(`Loaded "${NAME}" — ${scans.length} pages, scanner flagged finish-schedule page(s): [${flagged.join(", ") || "none"}]`);
  console.log(`Open: /projects/${project.id}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
