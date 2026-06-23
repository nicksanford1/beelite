import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { db } from "@/lib/db";
import { downloadPlan, supabaseAdmin, PLANS_BUCKET } from "@/lib/storage";

const PDFJS_ERRORS_ONLY = 0;

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
  opts: { scale?: number; only?: number[]; bytes?: Buffer } = {}
): Promise<IngestResult> {
  // Page images feed ONLY the Plans preview (the finish read sends the PDF straight to Anthropic), so
  // they don't need to be sharp. Keep the render small: a large-format architectural sheet at 1.1 made
  // ~30MB RGBA canvases that, six-in-flight, spiked memory enough to OOM a small box and starve the rest
  // of the server (a 100s ingest dragged the create action past the client's timeout). 0.7 is ~2.5x
  // lighter per page and still legible in the viewer.
  const scale = opts.scale ?? 0.7;
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`document ${documentId} not found`);

  const bytes = opts.bytes ?? (await downloadPlan(doc.fileUrl)); // reuse caller's bytes (upload) if given
  const pdf = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: PDFJS_ERRORS_ONLY,
  }).promise;
  const total = pdf.numPages;
  const targets = opts.only?.length
    ? opts.only.filter((n) => n >= 1 && n <= total)
    : Array.from({ length: total }, (_, i) => i + 1);

  const sb = supabaseAdmin();
  const canvasModule = await import("@napi-rs/canvas").catch(() => null);
  let textPages = 0;
  let imagesOk = 0;

  // Rendering is CPU-bound and stays serial, but each page's Supabase upload + DB write are I/O —
  // overlap them with the next page's render via a small bounded pool, so a 50-page set isn't 50
  // sequential round-trips. A single page's failure is logged, never aborts the whole ingest.
  const CONCURRENCY = 2;
  const inFlight = new Set<Promise<void>>();
  const persist = (pageNumber: number, text: string, img: Buffer | null) => {
    const task = (async () => {
      let imagePath: string | null = null;
      if (img) {
        const path = pageImagePath(doc.projectId, doc.id, pageNumber);
        const { error } = await sb.storage.from(PLANS_BUCKET).upload(path, img, { contentType: "image/jpeg", upsert: true });
        if (!error) {
          imagePath = path;
          imagesOk++;
        }
      }
      // Preserve any human tag (sheetType); only (re)write the per-page artifact.
      await db.planSheet.upsert({
        where: { documentId_pageNumber: { documentId, pageNumber } },
        create: { documentId, pageNumber, sheetType: "untagged", scanSignals: { text, imagePath } },
        update: { scanSignals: { text, imagePath } },
      });
    })().catch((e) => console.error(`[ingest] page ${pageNumber} persist failed:`, e));
    inFlight.add(task);
    void task.finally(() => inFlight.delete(task));
  };

  try {
    for (const i of targets) {
      if (inFlight.size >= CONCURRENCY) await Promise.race(inFlight);
      const page = await pdf.getPage(i);
      // Text extraction dropped on purpose: the whole-doc finish read sends the PDF straight to
      // Anthropic, so per-page text is never used downstream — only the page image feeds the Plans
      // viewer. Skipping getTextContent trims ingest with zero impact on the read.
      const text = "";
      let img: Buffer | null = null;
      try {
        if (canvasModule) {
          try {
            const viewport = page.getViewport({ scale });
            const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
            img = canvas.toBuffer("image/jpeg", 88);
          } catch {
            img = null; // a single bad page shouldn't fail the whole ingest
          }
        }
      } finally {
        page.cleanup();
      }
      persist(i, text, img);
    }
    await Promise.all(inFlight);
  } finally {
    await pdf.destroy();
  }

  return { pages: total, processed: targets.length, textPages, imagesOk };
}
