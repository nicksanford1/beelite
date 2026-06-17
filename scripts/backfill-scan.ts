// Scan already-seeded plans into PlanSheet records (one per page). Idempotent.
process.loadEnvFile(".env");
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { scanPdf } from "../lib/pdf";

const db = new PrismaClient();
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const docs = await db.document.findMany({ include: { pages: true, project: true } });
  for (const doc of docs) {
    if (doc.pages.length) { console.log("skip (already scanned):", doc.project.name); continue; }
    const { data, error } = await sb.storage.from("plans").download(doc.fileUrl);
    if (error || !data) { console.log("download failed:", doc.project.name, error?.message); continue; }
    const bytes = Buffer.from(await data.arrayBuffer());
    const scans = await scanPdf(bytes);
    await db.planSheet.createMany({
      data: scans.map((s) => ({
        documentId: doc.id, pageNumber: s.pageNumber, sheetNumber: s.sheetNumber,
        sheetTitle: s.sheetTitle, suggestedSheetType: s.suggestedSheetType,
        scanScore: s.score, scanSignals: s.signals as object,
      })),
    });
    const flagged = scans.filter((s) => s.suggestedSheetType === "finish_schedule");
    console.log(`${doc.project.name}: ${scans.length} pages · finish-schedule suggested on pp ${flagged.map((s) => `${s.pageNumber}(${s.score})`).join(", ") || "none"}`);
  }
  await db.$disconnect();
}
main();
