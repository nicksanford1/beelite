import { ingestDocument } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// TEMP manual trigger for the "reverse" workflow (file already in the bucket).
// GET /api/ingest?doc=<documentId>            → ingest every page
// GET /api/ingest?doc=<documentId>&pages=13,14 → ingest just those pages (cheap test)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentId = url.searchParams.get("doc");
  if (!documentId) return new Response("missing ?doc=", { status: 400 });
  const pagesParam = url.searchParams.get("pages");
  const only = pagesParam ? pagesParam.split(",").map((n) => parseInt(n, 10)).filter(Number.isFinite) : undefined;
  try {
    const t = Date.now();
    const result = await ingestDocument(documentId, { only });
    return Response.json({ ok: true, documentId, seconds: Math.round((Date.now() - t) / 1000), ...result });
  } catch (e: unknown) {
    const err = e as { message?: string; name?: string };
    return Response.json({ ok: false, documentId, error: { name: err?.name, message: err?.message } });
  }
}
