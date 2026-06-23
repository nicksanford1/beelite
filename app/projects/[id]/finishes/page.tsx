import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProjectWorkspace } from "@/components/project-workspace";
import { FinishReview } from "@/components/finish-review";
import { FinishReadRunner } from "@/components/finish-read-runner";
import { readWholeDoc, passProject } from "@/app/actions";
import type { ExtractedFinish, FinishAssignment } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

const ERR_MESSAGES: Record<string, string> = {
  untagged: "No finish-schedule page is tagged yet. Open Pages and tag the schedule page(s) first.",
  not_ingested: "These pages haven't been processed yet (ingest hasn't run on them). Process the plan, then read.",
  read_failed: "The read failed (timed out or errored). Try again — if it keeps failing, check the server logs.",
};

export default async function FinishesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const { err } = await searchParams;
  const errMessage = err ? (ERR_MESSAGES[err] ?? "Something went wrong reading the finishes.") : null;
  const project = await db.project.findUnique({ where: { id }, include: { documents: true } });
  if (!project) notFound();

  const sheet = await db.planSheet.findFirst({
    where: { document: { projectId: id }, extraction: { isNot: null } },
    orderBy: { pageNumber: "asc" },
    include: { extraction: true },
  });
  const ext = sheet?.extraction;
  const finishes: ExtractedFinish[] = ext
    ? ((ext.corrected as any)?.finishes ?? (ext.rawOutput as any)?.finishes ?? [])
    : [];
  const assignments: FinishAssignment[] = ext
    ? ((ext.corrected as any)?.assignments ?? (ext.rawOutput as any)?.assignments ?? [])
    : [];
  const firstDoc = project.documents[0];

  const raw = (ext?.rawOutput ?? {}) as { status?: string; reason?: string; evidencePages?: string[]; startedAt?: string };
  const status = raw.status ?? (finishes.length ? "found" : ext ? "not_found" : "");
  const reason = raw.reason ?? "";
  const evidencePages: string[] = raw.evidencePages ?? [];

  return (
    <ProjectWorkspace projectId={id} active="finishes">
      {firstDoc && <FinishReadRunner documentId={firstDoc.id} status={status} />}
      <div className="page-head">
        <div>
          <h1 className="page-title">Finishes</h1>
          <p className="detail-meta" style={{ margin: "3px 0 0" }}>{project.name}</p>
        </div>
      </div>

      {errMessage && (
        <div className="banner banner-error" role="alert" style={{ margin: "12px 0", padding: "10px 14px", border: "1px solid var(--marking, #c0392b)", borderRadius: 6, background: "rgba(192,57,43,0.06)", color: "var(--marking, #c0392b)" }}>
          {errMessage}
        </div>
      )}

      <section className="section">
        {!ext ? (
          !firstDoc ? (
            <div className="empty">
              <h2>No plan uploaded</h2>
              <p>Upload a plan first, then read its finishes.</p>
              <Link href="/projects/new" className="btn btn-primary">Upload a plan</Link>
            </div>
          ) : (
            <div className="empty">
              <h2>Read the finishes</h2>
              <p>Claude reads the whole plan set, finds the finish schedule itself, and pulls out the finishes for you to review. No page tagging needed.</p>
              <form action={readWholeDoc.bind(null, firstDoc.id)}>
                <button type="submit" className="btn btn-primary">Read finishes</button>
              </form>
            </div>
          )
        ) : finishes.length > 0 ? (
          <>
            {status === "possible" && (
              <div className="banner" style={{ margin: "0 0 14px", padding: "10px 14px", border: "1px solid var(--gold)", borderRadius: 6, background: "rgba(224,179,65,0.08)", color: "var(--gold)" }}>
                These pages may not be a standard finish schedule — review carefully.
                {evidencePages.length ? ` Looked at: ${evidencePages.join(", ")}.` : ""}
              </div>
            )}
            <h2 className="section-title" style={{ marginBottom: 6 }}>Review {finishes.length} flooring finishes</h2>
            <p className="detail-meta" style={{ margin: "0 0 16px", maxWidth: 640 }}>
              The priced list Claude pulled from the schedule — edit any row, then confirm.
              {ext.corrected ? " (Previously confirmed — re-confirm to update.)" : ""}
            </p>
            <FinishReview projectId={id} planSheetId={sheet!.id} initial={finishes} initialAssignments={assignments} />
          </>
        ) : status === "possible" ? (
          <div className="empty">
            <h2>Possible finish information found</h2>
            <p>{reason || "We found pages that may contain flooring information, but not a standard finish schedule."}</p>
            {evidencePages.length > 0 && <p className="detail-meta">Possible pages: <strong>{evidencePages.join(", ")}</strong></p>}
            {firstDoc && (
              <form action={readWholeDoc.bind(null, firstDoc.id)}>
                <button type="submit" className="btn btn-primary">Read again</button>
              </form>
            )}
          </div>
        ) : status === "processing" ? (
          <div className="empty">
            <h2>Reading the plan set…</h2>
            <p>Claude is scanning the whole set for a flooring finish schedule. This takes a moment.</p>
            <Link href={`/projects/${id}/finishes`} className="btn btn-primary">Refresh</Link>
          </div>
        ) : status === "error" ? (
          <div className="empty">
            <h2>The finish read failed</h2>
            <p>{reason || "Something went wrong reading the plan set. Try again."}</p>
            {firstDoc && (
              <form action={readWholeDoc.bind(null, firstDoc.id)}>
                <button type="submit" className="btn btn-primary">Re-read finishes</button>
              </form>
            )}
          </div>
        ) : (
          <div className="empty">
            <h2>No finish schedule found</h2>
            <p>{reason || "No flooring finish schedule, room finish schedule, finish legend, or flooring material schedule was found in this plan set. It may be a shell, structural, permit, or incomplete drawing set."}</p>
            <p className="detail-meta">If you have a separate finishes sheet, upload it; otherwise pass this bid below.</p>
            {firstDoc && (
              <form action={readWholeDoc.bind(null, firstDoc.id)}>
                <button type="submit" className="btn">Read again</button>
              </form>
            )}
          </div>
        )}
      </section>

      <details style={{ marginTop: 30, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--muted)" }}>Not a flooring job?</summary>
        <form
          action={passProject.bind(null, id)}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}
        >
          <input
            name="reason"
            placeholder="Reason (e.g. no finish schedule / no flooring scope)"
            style={{ font: "inherit", fontSize: 13, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", minWidth: 280, flex: 1, maxWidth: 420 }}
          />
          <button type="submit" className="btn" style={{ color: "var(--muted)" }}>Pass / Not a fit</button>
        </form>
      </details>
    </ProjectWorkspace>
  );
}
