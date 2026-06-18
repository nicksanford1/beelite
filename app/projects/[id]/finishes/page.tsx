import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProjectWorkspace } from "@/components/project-workspace";
import { FinishReview } from "@/components/finish-review";
import { readWholeDoc, passProject } from "@/app/actions";
import type { ExtractedFinish } from "@/lib/anthropic";

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
  const firstDoc = project.documents[0];

  const raw = (ext?.rawOutput ?? {}) as { status?: string; reason?: string; evidencePages?: string[] };
  const status = raw.status ?? (finishes.length ? "found" : ext ? "not_found" : "");
  const reason = raw.reason ?? "";
  const evidencePages: string[] = raw.evidencePages ?? [];

  return (
    <ProjectWorkspace projectId={id} active="finishes">
      <div className="page-head">
        <h1 className="page-title">Finishes</h1>
      </div>
      <p className="detail-meta">{project.name}</p>

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
            <h2 className="section-title">Review the finishes Claude found ({finishes.length})</h2>
            <p className="detail-meta">
              Edit anything that’s off, then confirm. Flagged rows are low-confidence or out-of-scope.
              {ext.corrected ? " (Previously confirmed — re-confirm to update.)" : ""}
            </p>
            <FinishReview projectId={id} planSheetId={sheet!.id} initial={finishes} />
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

      <form
        action={passProject.bind(null, id)}
        style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        <span className="card-meta">Not a flooring job?</span>
        <input
          name="reason"
          placeholder="Reason (e.g. no finish schedule / no flooring scope)"
          style={{ font: "inherit", fontSize: 13, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", minWidth: 280, flex: 1, maxWidth: 420 }}
        />
        <button type="submit" className="btn" style={{ color: "var(--muted)" }}>Pass / Not a fit</button>
      </form>
    </ProjectWorkspace>
  );
}
