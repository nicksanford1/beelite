import { runGuardedRead } from "@/lib/finish-read";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Runs the whole-PDF finish read as its own request so it survives on Vercel (a void/after in a server
// action gets killed when the function returns). The caller (confirmProject / readWholeDoc) has already
// marked the read "processing"; the client FinishReadRunner triggers this, then polls for the result.
// GET /api/read-finishes?doc=<documentId>
export async function GET(req: Request) {
  const documentId = new URL(req.url).searchParams.get("doc");
  if (!documentId) return new Response("missing ?doc=", { status: 400 });
  try {
    const t = Date.now();
    await runGuardedRead(documentId);
    return Response.json({ ok: true, documentId, seconds: Math.round((Date.now() - t) / 1000) });
  } catch (e: unknown) {
    const err = e as { message?: string; name?: string };
    return Response.json({ ok: false, documentId, error: { name: err?.name, message: err?.message } });
  }
}
