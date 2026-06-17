import { db } from "@/lib/db";
import { downloadPlan } from "@/lib/storage";
import { renderPage } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// In-process caches so we don't re-download the whole PDF (and re-render) on every page request.
// Plans are immutable once uploaded, so cached renders never go stale.
const PDF_CACHE = new Map<string, { bytes: Buffer; at: number }>(); // documentId -> bytes
const PAGE_CACHE = new Map<string, Buffer>(); // `${documentId}:${page}` -> rendered JPEG
const MAX_PDFS = 4; // keep a few recent plans' bytes
const MAX_PAGES = 600; // ~a few full sets of rendered pages

async function pdfBytes(documentId: string): Promise<Buffer | null> {
  const hit = PDF_CACHE.get(documentId);
  if (hit) return hit.bytes;
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;
  const bytes = await downloadPlan(doc.fileUrl);
  if (PDF_CACHE.size >= MAX_PDFS) {
    // evict the oldest
    const oldest = [...PDF_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) PDF_CACHE.delete(oldest);
  }
  PDF_CACHE.set(documentId, { bytes, at: Date.now() });
  return bytes;
}

// GET /api/preview?doc=<documentId>&page=<n> → JPEG of that page
export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentId = url.searchParams.get("doc");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  if (!documentId || !Number.isFinite(page)) return new Response("bad request", { status: 400 });

  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" };
  const key = `${documentId}:${page}`;
  const cached = PAGE_CACHE.get(key);
  if (cached) return new Response(new Uint8Array(cached), { headers });

  try {
    const bytes = await pdfBytes(documentId);
    if (!bytes) return new Response("not found", { status: 404 });
    const img = await renderPage(bytes, page, 1.4, "image/jpeg");
    if (PAGE_CACHE.size >= MAX_PAGES) PAGE_CACHE.clear();
    PAGE_CACHE.set(key, img);
    return new Response(new Uint8Array(img), { headers });
  } catch (e) {
    console.error("preview render failed:", e);
    return new Response("render failed", { status: 500 });
  }
}
