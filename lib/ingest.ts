import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { db } from "@/lib/db";
import { downloadPlan, supabaseAdmin, PLANS_BUCKET } from "@/lib/storage";
import { renderPage } from "@/lib/pdf";

// One-time ingest: turn a stored PDF into per-page artifacts so reads never re-pull the whole file.
// For each page we persist (a) its text and (b) a small page image. No scoring/guessing — the human tags.
//
// NOTE (prototype): page text + image path are stashed in the existing `PlanSheet.scanSignals` JSON to
// avoid a DB migration while another agent shares the schema. Promote to real columns later.

export type PageArtifact = { text: string; imagePath: string | null };

export function pageImagePath(projectId: string, documentId: string, pageNumber: number) {
  return `${projectId}/${documentId}/pages/${String(pageNumber).padStart(4, "0")}.jpg`;
}

/** Read the per-page artifact we stored at ingest (text + image path). */
export function readPageArtifact(scanSignals: unknown): PageArtifact | null {
  if (scanSignals && typeof scanSignals === "object" && "text" in scanSignals) {
    const s = scanSignals as { text?: string; imagePath?: string | null };
    return { text: s.text ?? "", imagePath: s.imagePath ?? null };
  }
  return null;
}

export type IngestResult = { pages: number; processed: number; textPages: number; imagesOk: number };

/**
 * Process a document's pages. `only` limits to specific 1-based page numbers (for cheap testing);
 * omit it to ingest every page. Idempotent — re-running overwrites the per-page artifacts.
 */
export async function ingestDocument(
  documentId: string,
  opts: { scale?: number; only?: number[] } = {}
): Promise<IngestResult> {
  const scale = opts.scale ?? 1.1; // small but legible page image
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`document ${documentId} not found`);

  const bytes = await downloadPlan(doc.fileUrl); // the one and only full-file pull
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const total = pdf.numPages;
  const targets = opts.only?.length
    ? opts.only.filter((n) => n >= 1 && n <= total)
    : Array.from({ length: total }, (_, i) => i + 1);

  const sb = supabaseAdmin();
  let textPages = 0;
  let imagesOk = 0;

  for (const i of targets) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = (tc.items as Array<{ str?: string }>)
      .map((it) => it.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) textPages++;

    let imagePath: string | null = null;
    try {
      const img = await renderPage(bytes, i, scale, "image/jpeg");
      const path = pageImagePath(doc.projectId, doc.id, i);
      const { error } = await sb.storage.from(PLANS_BUCKET).upload(path, img, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (!error) {
        imagePath = path;
        imagesOk++;
      }
    } catch {
      imagePath = null; // a single bad page shouldn't fail the whole ingest
    }

    // Preserve any human tag (sheetType); only (re)write the per-page artifact.
    await db.planSheet.upsert({
      where: { documentId_pageNumber: { documentId, pageNumber: i } },
      create: { documentId, pageNumber: i, sheetType: "untagged", scanSignals: { text, imagePath } },
      update: { scanSignals: { text, imagePath } },
    });
  }

  return { pages: total, processed: targets.length, textPages, imagesOk };
}
