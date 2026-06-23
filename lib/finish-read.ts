import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readFinishesGuarded } from "@/lib/anthropic";

// Whole-PDF guarded finish read. Lives in lib/ (not app/actions) so the maxDuration API route can run
// it as its own request — the reliable way to do long background work on Vercel (a bare void/after in a
// server action gets killed when the function returns).

// The Extraction attaches to the page-1 PlanSheet; create a stub if ingest hasn't reached it yet.
async function primarySheet(documentId: string) {
  const existing = await db.planSheet.findFirst({ where: { documentId }, orderBy: { pageNumber: "asc" } });
  return (
    existing ??
    (await db.planSheet.upsert({
      where: { documentId_pageNumber: { documentId, pageNumber: 1 } },
      create: { documentId, pageNumber: 1, sheetType: "untagged" },
      update: {},
    }))
  );
}

// Mark the read in-progress so Overview/Finishes show "Reading…" immediately. The processing row's
// updatedAt is the read "generation" the client watcher keys off — so DON'T re-mark while a read is
// already running (it would churn the generation and re-trigger). Callers mark once; the read route
// does not re-mark.
export async function markFinishReadProcessing(documentId: string) {
  const primary = await primarySheet(documentId);
  // startedAt is the read "generation" the client watcher keys off: a fresh value each time a read is
  // (re)started, stable for the duration of that read (the route doesn't re-mark).
  const rawOutput = { status: "processing", whole: true, startedAt: new Date().toISOString() };
  await db.extraction.deleteMany({ where: { planSheet: { documentId, id: { not: primary.id } } } });
  await db.extraction.upsert({
    where: { planSheetId: primary.id },
    create: { planSheetId: primary.id, model: "(reading)", rawOutput, confidence: [] },
    update: { model: "(reading)", rawOutput, corrected: undefined },
  });
}

// In-process guard so concurrent triggers for the same doc (the wizard kicks the read at upload AND the
// Overview watcher fires it) don't run two reads. Single-process `next start` shares this; on Vercel a
// rare cross-instance double-fire just wastes one call (last write wins) — never corrupts.
const inFlight = new Set<string>();

// Run the guarded whole-PDF read: mark "processing" (so the UI shows "Reading…"), do the read, save the
// 3-state result (or an "error" status). Never throws — a failed read is recorded so the UI can show
// "Error" + offer Re-read, not hang. Skips immediately if a read for this doc is already running.
export async function runGuardedRead(documentId: string) {
  if (inFlight.has(documentId)) return; // a read is already running in THIS process
  // DB-backed idempotency: never run a fresh (paid) read on a doc that already has a completed result.
  // The in-memory lock above only blocks concurrent reads in one process; it can't stop a navigation /
  // FinishReadRunner from re-firing a read after the first one finished (and on Vercel each request is a
  // separate instance with its own empty lock). A Re-read button first marks the status back to
  // "processing" (markFinishReadProcessing), so this guard lets a genuine re-read through.
  const existing = await db.planSheet.findFirst({
    where: { documentId, extraction: { isNot: null } },
    orderBy: { pageNumber: "asc" },
    select: { extraction: { select: { rawOutput: true } } },
  });
  const prevStatus = (existing?.extraction?.rawOutput as { status?: string } | null)?.status;
  if (prevStatus && prevStatus !== "processing") return; // found / not_found / possible / error — already read
  inFlight.add(documentId);
  try {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc) return;
    await markFinishReadProcessing(documentId); // status -> processing, before the long call
    const primary = await primarySheet(documentId);
    try {
      const url = await signedUrl(doc.fileUrl, 900); // Anthropic fetches it — we never download the big file
      const { result, model } = await readFinishesGuarded(url, "claude-sonnet-4-6"); // Sonnet for cheaper testing (~$0.12/read vs Opus ~$0.20); switch back to claude-opus-4-8 for best accuracy
      const confidence = result.finishes.map((f) => ({ code: f.code, confidence: f.confidence }));
      const rawOutput = { ...result, whole: true };
      await db.extraction.upsert({
        where: { planSheetId: primary.id },
        create: { planSheetId: primary.id, model, rawOutput, confidence },
        update: { model, rawOutput, corrected: undefined },
      });
    } catch (e) {
      console.error("[runGuardedRead] failed:", e);
      const rawOutput = { status: "error", reason: "The finish read failed — try again.", finishes: [], whole: true };
      await db.extraction.upsert({
        where: { planSheetId: primary.id },
        create: { planSheetId: primary.id, model: "(error)", rawOutput, confidence: [] },
        update: { model: "(error)", rawOutput },
      });
    }
  } finally {
    inFlight.delete(documentId);
  }
}
