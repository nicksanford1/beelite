import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readPageArtifact } from "@/lib/ingest";
import { deriveWorkflow } from "@/lib/workflow";
import { usd } from "@/lib/estimate";
import { readWholeDoc, passProject } from "@/app/actions";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { WorkspaceRail, type RailSection } from "@/components/workspace-rail";
import { FinishReview } from "@/components/finish-review";
import { PricingEditor } from "@/components/pricing-editor";
import { FinishReadRunner } from "@/components/finish-read-runner";
import { SheetSyncRunner } from "@/components/sheet-sync-runner";
import type { ExtractedFinish, FinishAssignment } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

// The whole bid as ONE scrolling column — Plans → Finishes → Pricing → Bid. The left rail is a
// measuring rule that tracks where you are and pins the live bid; no tab-hopping. After creating a
// project the page lands on Finishes (?focus=finishes), which is the first thing to confirm.
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { id } = await params;
  const { focus } = await searchParams;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "asc" }, include: { pages: true } },
      finishes: { orderBy: { code: "asc" } },
      takeoff: true,
      scopeItems: true,
      settings: true,
    },
  });
  if (!project) notFound();

  const { bid } = deriveWorkflow(project);

  // Plans: primary doc → PDF link + page-1 thumbnail. A split set still opens from the primary file.
  const doc = project.documents[0];
  const totalPages = project.documents.reduce((n, d) => n + d.pages.length, 0);
  const pdfUrl = doc ? await signedUrl(doc.fileUrl).catch(() => null) : null;
  const thumbPath = doc?.pages.find((p) => p.pageNumber === 1)?.scanSignals
    ? readPageArtifact(doc.pages.find((p) => p.pageNumber === 1)!.scanSignals)?.imagePath
    : null;
  const thumbUrl = thumbPath ? await signedUrl(thumbPath, 3600).catch(() => null) : null;
  const hasSheet = !!project.sheetId;

  // Finishes: the saved finish-read for the schedule page (same source the old Finishes tab read).
  const sheet = await db.planSheet.findFirst({
    where: { document: { projectId: id }, extraction: { isNot: null } },
    orderBy: { pageNumber: "asc" },
    include: { extraction: true },
  });
  const ext = sheet?.extraction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const corrected = ext?.corrected as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (ext?.rawOutput ?? {}) as any;
  const finishes: ExtractedFinish[] = corrected?.finishes ?? raw?.finishes ?? [];
  const assignments: FinishAssignment[] = corrected?.assignments ?? raw?.assignments ?? [];
  const readStatus: string = raw.status ?? (finishes.length ? "found" : ext ? "not_found" : "");
  const reason: string = raw.reason ?? "";
  const confirmed = !!corrected;

  // Pricing: one row per in-scope finish, with its single total quantity rolled up from takeoff.
  const inScope = project.finishes.filter((f) => f.inScope);
  const qtyByCode = new Map<string, number>();
  for (const t of project.takeoff) {
    if (t.status === "approved") qtyByCode.set(t.finishCode, (qtyByCode.get(t.finishCode) ?? 0) + t.qty);
  }
  const pricingRows = inScope.map((f) => ({
    id: f.id,
    code: f.code,
    type: f.type,
    application: f.application,
    unit: f.unit,
    totalQty: qtyByCode.get(f.code) ?? 0,
    materialUnitCost: f.materialUnitCost,
    installRate: f.installRate,
    wastePct: f.wastePct,
    cartonSize: f.cartonSize,
    materialSource: f.materialSource,
  }));
  const pricingOpen = pricingRows.filter(
    (r) =>
      r.totalQty <= 0 ||
      (r.materialSource !== "owner_furnishes" && r.materialUnitCost <= 0) ||
      r.installRate <= 0
  ).length;

  // Rail states — done / active / todo per block, mirroring the same readiness the bid uses.
  const sections: RailSection[] = [
    {
      id: "plans",
      label: "Plans",
      note: doc ? `${totalPages || "…"} page${totalPages === 1 ? "" : "s"}` : "Upload a plan",
      state: doc ? "done" : "active",
    },
    {
      id: "finishes",
      label: "Finishes",
      note: confirmed ? `${finishes.length} confirmed` : finishes.length ? `${finishes.length} to review` : "Read the schedule",
      state: confirmed ? "done" : finishes.length ? "active" : "todo",
    },
    {
      id: "pricing",
      label: "Pricing",
      note: inScope.length === 0 ? "Confirm finishes first" : pricingOpen ? `${pricingOpen} need input` : "All priced",
      state: inScope.length === 0 ? "todo" : pricingOpen ? "active" : "done",
    },
    {
      id: "bid",
      label: "Bid",
      note: hasSheet ? "Synced to Sheets" : "Review & sync",
      state: hasSheet ? "done" : "todo",
    },
  ];

  const meta = [project.gc, project.location].filter(Boolean).join(" · ") || "No GC · No location";

  const rail = (
    <WorkspaceRail
      projectName={project.name}
      projectMeta={meta}
      sections={sections}
      bidPrice={usd(bid.bidPrice)}
      profit={bid.profit > 0 ? usd(bid.profit) : null}
      focus={focus && ["plans", "finishes", "pricing", "bid"].includes(focus) ? focus : undefined}
    />
  );

  return (
    <WorkspaceFrame rail={rail}>
      {doc && <FinishReadRunner documentId={doc.id} status={readStatus} />}
      <SheetSyncRunner projectId={id} hasSheet={hasSheet} />

      <div className="flow">
        <div className="flow-top">
          <div>
            <div className="flow-top-name">{project.name}</div>
            <div className="flow-top-meta">{meta}</div>
          </div>
          {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn">Open PDF</a>}
        </div>

        {/* ── Plans ── */}
        <section id="plans" className="flow-section">
          <div className="flow-eyebrow">Plans <span className="flow-rule" /></div>
          <h2 className="flow-h">The plan set</h2>
          <p className="flow-sub">The architectural set this bid reads from. Open the full viewer to inspect any sheet.</p>
          {doc ? (
            <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", padding: 16 }}>
              {thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="Plan cover"
                  style={{ width: 84, height: 108, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flex: "none" }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{doc.originalFilename ?? "Plan PDF"}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
                  {totalPages ? `${totalPages} pages` : "processing pages…"}
                  {project.documents.length > 1 ? ` · ${project.documents.length} files` : ""}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Link href={`/projects/${id}/plans`} className="btn">Open plans</Link>
                  {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn">Open PDF</a>}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <h2>No plan uploaded</h2>
              <p>Upload the architectural set to start the bid.</p>
              <Link href={`/projects/${id}/plans`} className="btn btn-primary">Upload a plan</Link>
            </div>
          )}
        </section>

        {/* ── Finishes ── */}
        <section id="finishes" className="flow-section">
          <div className="flow-eyebrow">Finishes <span className="flow-rule" /></div>
          <h2 className="flow-h">Confirm the finishes</h2>
          <p className="flow-sub">
            What Claude read from the finish schedule. Fix anything that&apos;s off, set what&apos;s in scope, then confirm —
            confirmed finishes flow into Pricing below.
          </p>
          {finishes.length > 0 ? (
            <FinishReview projectId={id} planSheetId={sheet!.id} initial={finishes} initialAssignments={assignments} />
          ) : !doc ? (
            <div className="empty">
              <h2>Upload a plan first</h2>
              <p>Finishes come from the plan set — add it above, then they read automatically.</p>
            </div>
          ) : readStatus === "error" || readStatus === "not_found" ? (
            <div className="empty">
              <h2>{readStatus === "error" ? "The finish read didn’t finish" : "No finish schedule found"}</h2>
              <p>
                {readStatus === "error"
                  ? reason || "Something went wrong reading the set. Try again."
                  : reason || "No flooring finish schedule was found in this set. It may be a shell, structural, or incomplete drawing set."}
              </p>
              <form action={readWholeDoc.bind(null, doc.id)}>
                <button type="submit" className="btn btn-primary">Read again</button>
              </form>
              <details style={{ marginTop: 18 }}>
                <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--muted)" }}>Not a flooring job?</summary>
                <form action={passProject.bind(null, id)} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                  <input name="reason" placeholder="Reason (e.g. no flooring scope)"
                    style={{ font: "inherit", fontSize: 13, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", minWidth: 240, flex: 1, maxWidth: 380 }} />
                  <button type="submit" className="btn" style={{ color: "var(--muted)" }}>Pass / Not a fit</button>
                </form>
              </details>
            </div>
          ) : (
            // No completed result yet (just uploaded / still processing) — the read runs on its own.
            <div className="empty">
              <h2>Reading the plan set…</h2>
              <p>Claude is scanning the whole set for a flooring finish schedule. This fills in on its own — no need to do anything.</p>
            </div>
          )}
        </section>

        {/* ── Pricing (rates + total takeoff, merged) ── */}
        <section id="pricing" className="flow-section">
          <div className="flow-eyebrow">Pricing <span className="flow-rule" /></div>
          <h2 className="flow-h">Rates &amp; quantities</h2>
          <p className="flow-sub">
            One row per finish: set its total quantity and rates, and watch the line cost. This is your whole takeoff —
            the bid only needs one total per finish.
          </p>
          <PricingEditor projectId={id} initial={pricingRows} />
        </section>

        {/* ── Bid ── */}
        <section id="bid" className="flow-section">
          <div className="flow-eyebrow">Bid <span className="flow-rule" /></div>
          <h2 className="flow-h">The bid</h2>
          <p className="flow-sub">
            Google Sheets is the authoritative calculator; this is the live preview. Open the full estimate to sync and adjust.
          </p>
          <div className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--muted)" }}>Bid price</div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontVariantNumeric: "tabular-nums", fontSize: 34, fontWeight: 600, color: "var(--marking)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {usd(bid.bidPrice)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--muted)" }}>Cost</div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontVariantNumeric: "tabular-nums", fontSize: 20, fontWeight: 600 }}>{usd(bid.pricedScopeCost)}</div>
            </div>
            {bid.profit > 0 && (
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--muted)" }}>Profit</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontVariantNumeric: "tabular-nums", fontSize: 20, fontWeight: 600, color: "var(--green)" }}>{usd(bid.profit)}</div>
              </div>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {hasSheet && project.sheetId && (
                <a href={`https://docs.google.com/spreadsheets/d/${project.sheetId}`} target="_blank" rel="noreferrer" className="btn">Open Sheet</a>
              )}
              <Link href={`/projects/${id}/estimate`} className="btn btn-primary">Open full estimate</Link>
            </div>
          </div>
          {pricingOpen > 0 && (
            <p className="hint" style={{ color: "var(--gold)" }}>
              {pricingOpen} finish{pricingOpen === 1 ? "" : "es"} still need a quantity or rate — the bid is incomplete until those are filled in Pricing.
            </p>
          )}
        </section>
      </div>
    </WorkspaceFrame>
  );
}
