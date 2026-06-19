import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readPageArtifact } from "@/lib/ingest";
import { getProjectOverview, type FinishReadStatus } from "@/lib/overview";
import { readWholeDoc, passProject } from "@/app/actions";
import { ProjectWorkspace } from "@/components/project-workspace";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  no_plans: "No plans",
  plans_uploaded: "Plans uploaded",
  finish_read_processing: "Reading finishes…",
  finish_read_error: "Read failed",
  finishes_found: "Finishes found",
  ambiguous_finish_info: "Possible finishes",
  no_finish_schedule_found: "No finish schedule",
  finishes_confirmed: "Finishes confirmed",
  rates_needed: "Rates needed",
  ready_to_sync: "Ready to sync",
  synced: "Synced",
  passed: "Passed",
};

const READ_LABEL: Record<FinishReadStatus, { text: string; tone: string }> = {
  not_started: { text: "Not started", tone: "muted" },
  processing: { text: "Reading…", tone: "warn" },
  found: { text: "Found", tone: "good" },
  possible: { text: "Possible", tone: "warn" },
  not_found: { text: "No finish schedule", tone: "off" },
  error: { text: "Read failed", tone: "off" },
};

// The pipeline as a horizontal status strip (no "Sheet Sync" step — sync lives inside Bid).
const STEPS: Array<{ key: keyof ReturnType<typeof stepKeys>; label: string }> = [
  { key: "plans", label: "Plans" },
  { key: "finishes", label: "Finishes" },
  { key: "rates", label: "Rates" },
  { key: "takeoff", label: "Takeoff" },
  { key: "scope", label: "Scope" },
  { key: "bid", label: "Bid" },
];
function stepKeys() {
  return { plans: "", finishes: "", rates: "", takeoff: "", scope: "", bid: "" };
}

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ov = await getProjectOverview(id);
  if (!ov) notFound();

  const { project: p, document: docMeta, aiFindings: ai, workflow: wf } = ov;
  const read = READ_LABEL[ai.finishReadStatus];
  const roles = ai.pageRoles;

  // PDF url + page-1 thumbnail (for "Open PDF" + the small preview), fetched here (no AI).
  const doc = await db.document.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { pages: { orderBy: { pageNumber: "asc" }, take: 1 } },
  });
  const pdfUrl = doc ? await signedUrl(doc.fileUrl).catch(() => null) : null;
  const thumbPath = doc?.pages[0] ? readPageArtifact(doc.pages[0].scanSignals)?.imagePath : null;
  const thumbUrl = thumbPath ? await signedUrl(thumbPath, 3600).catch(() => null) : null;

  const details: Array<[string, string | null]> = [
    ["GC / Customer", p.gc],
    ["Location", p.location],
    ["Project type", p.projectType],
    ["Architect", p.architect],
    ["Owner", p.owner],
    ["Square footage", p.squareFeet],
    ["Project #", p.projectNumber],
    ["Issue date", p.issueDate],
    ["Estimator", p.estimator],
    ["Bid due", fmtDate(p.bidDate)],
  ];

  // Findings — honest rows only. Page roles appear only after the read actually ran.
  type Finding = { label: string; value: string; tone: string; conf?: string };
  const roleRow = (label: string, r: { sheets: string[]; confidence: string } | undefined): Finding => ({
    label,
    value: r && r.sheets.length ? r.sheets.join(", ") : "Not identified",
    tone: r && r.sheets.length ? "good" : "muted",
    conf: r && r.sheets.length ? r.confidence : undefined,
  });
  const findings: Finding[] = [
    {
      label: "Project details",
      value: ai.projectDetailsStatus === "found" ? "Found" : ai.projectDetailsStatus === "partial" ? "Partial" : "Missing",
      tone: ai.projectDetailsStatus === "found" ? "good" : ai.projectDetailsStatus === "partial" ? "warn" : "muted",
    },
    { label: "Plan file", value: docMeta ? `${docMeta.pageCount} page${docMeta.pageCount === 1 ? "" : "s"}` : "None", tone: docMeta ? "good" : "muted" },
    { label: "Finish read", value: read.text, tone: read.tone },
  ];
  if (roles) {
    findings.push(roleRow("Drawing index", roles.drawingIndex));
    findings.push(roleRow("Floor plans", roles.floorPlans));
    findings.push(roleRow("Specifications", roles.specs));
  }

  return (
    <ProjectWorkspace projectId={id}>
      <div className="page-head">
        <h1 className="page-title">Overview</h1>
        <div className="ov-head-actions">
          <Link href={`/projects/${id}/plans`} className="btn">Open plans</Link>
          {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn">Open PDF</a>}
        </div>
      </div>

      {/* Project status + horizontal pipeline */}
      <div className="ov-statuscard">
        <div className="ov-statuscard-top">
          <div>
            <div className="ov-next-kicker">Project status</div>
            <div className="ov-statuscard-label" data-status={wf.currentStatus}>{STATUS_LABEL[wf.currentStatus] ?? wf.currentStatus}</div>
          </div>
          <div className="ov-statuscard-meta">
            <div><span>Bid due</span><strong>{fmtDate(p.bidDate) ?? "—"}</strong></div>
            <div><span>Updated</span><strong>{fmtDate(p.updatedAt)}</strong></div>
          </div>
        </div>
        <ol className="ov-stepper">
          {STEPS.map((s, i) => {
            const st = wf.steps[s.key];
            const state = st === "complete" ? "done" : st === "blocked" ? "blocked" : st === "pending" ? "todo" : "active";
            return (
              <li key={s.key} data-state={state}>
                <span className="ov-step-tick">{state === "done" ? "✓" : i + 1}</span>
                <span className="ov-step-label">{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="ov-grid">
        <div className="ov-maincol">
          {/* AI findings */}
          <section className="ov-card">
            <h2 className="ov-card-title">What the read found</h2>
            <ul className="ov-findings">
              {findings.map((f) => (
                <li key={f.label}>
                  <span className="ov-f-label">{f.label}</span>
                  <span className="ov-f-right">
                    {f.conf && <span className="ov-conf" data-c={f.conf}>{f.conf}</span>}
                    <span className="ov-f-val" data-tone={f.tone}>{f.value}</span>
                  </span>
                </li>
              ))}
            </ul>
            {ai.finishReadStatus === "found" && (
              <p className="ov-f-sub" style={{ marginTop: 10 }}>
                {ai.confirmedFinishes > 0 ? `${ai.confirmedFinishes} confirmed` : `${ai.finishesFound} read`}
                {ai.evidencePages.length ? ` · evidence ${ai.evidencePages.join(", ")}` : ""}
                {ai.finishReadConfidence != null ? ` · confidence ${ai.finishReadConfidence.toFixed(2)}` : ""}
              </p>
            )}
            {ai.finishReadStatus === "not_found" && ai.finishReadReason && (
              <p className="ov-f-sub" style={{ marginTop: 10 }}>{ai.finishReadReason}</p>
            )}
            {(thumbUrl || docMeta) && (
              <Link href={`/projects/${id}/plans`} className="ov-planpeek">
                {thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt="Cover sheet" />
                )}
                <span>{docMeta ? `${docMeta.pageCount} page${docMeta.pageCount === 1 ? "" : "s"}` : ""} · View all pages →</span>
              </Link>
            )}
          </section>

          {/* The one next action */}
          <section className="ov-next">
            <div>
              <div className="ov-next-kicker">Next step</div>
              <div className="ov-next-label">{wf.nextAction.label}</div>
            </div>
            {wf.nextAction.key === "read_finishes" && doc ? (
              <form action={readWholeDoc.bind(null, doc.id)}>
                <button type="submit" className="btn btn-primary">{wf.nextAction.buttonText}</button>
              </form>
            ) : wf.nextAction.href ? (
              <Link href={wf.nextAction.href} className="btn btn-primary">{wf.nextAction.buttonText}</Link>
            ) : null}
          </section>
        </div>

        <aside className="ov-aside">
          <section className="ov-card">
            <h2 className="ov-card-title">Project details</h2>
            <dl className="ov-details">
              {details.map(([k, v]) => (
                <div key={k} className="ov-detail">
                  <dt>{k}</dt>
                  <dd className={v ? "" : "ov-empty"}>{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {p.notes && <p className="ov-notes">{p.notes}</p>}
            <div className="ov-updated">
              {docMeta?.originalFilename ? `${docMeta.originalFilename} · ` : ""}updated {fmtDate(p.updatedAt)}
            </div>
          </section>

          <section className="ov-card">
            <h2 className="ov-card-title">Quick actions</h2>
            <div className="ov-qa">
              {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="ov-qa-btn">Open PDF</a>}
              {doc && ai.finishReadStatus !== "processing" && (
                <form action={readWholeDoc.bind(null, doc.id)}>
                  <button type="submit" className="ov-qa-btn">{ai.finishReadStatus === "not_started" ? "Read finishes" : "Re-read finishes"}</button>
                </form>
              )}
              <form action={passProject.bind(null, id)}>
                <button type="submit" className="ov-qa-btn ov-qa-danger">Pass / Not a fit</button>
              </form>
            </div>
          </section>
        </aside>
      </div>
    </ProjectWorkspace>
  );
}
