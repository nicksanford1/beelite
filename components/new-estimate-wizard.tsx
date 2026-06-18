"use client";

import { useState, useTransition } from "react";
import { analyzeUpload, confirmProject } from "@/app/actions";
import type { ProjectInfo } from "@/lib/anthropic";

const STEPS = [
  { label: "Upload Plans", sub: "Add the plan PDF" },
  { label: "Review Details", sub: "Confirm what AI found" },
  { label: "Create", sub: "Start the estimate" },
];

export function NewEstimateWizard() {
  const [stage, setStage] = useState<"upload" | "review">("upload");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [info, setInfo] = useState<Partial<ProjectInfo>>({});
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      setErr(null);
      const res = await analyzeUpload(fd);
      if (res.error || !res.projectId) {
        setErr(res.error ?? "Couldn't read that PDF. Try another file.");
        return;
      }
      setProjectId(res.projectId);
      setInfo(res.info ?? {});
      setStage("review");
    });
  };

  const activeIdx = stage === "upload" ? 0 : 1;
  const defaultNotes = [
    info.scope,
    info.squareFeet && `~${info.squareFeet}`,
    info.architect && `Architect: ${info.architect}`,
    info.owner && `Owner: ${info.owner}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="est-wizard">
      <ol className="est-steps">
        {STEPS.map((s, i) => (
          <li key={s.label} data-state={i < activeIdx ? "done" : i === activeIdx ? "active" : "todo"}>
            <span className="est-step-num">{i < activeIdx ? "✓" : i + 1}</span>
            <span className="est-step-text">
              <span className="est-step-label">{s.label}</span>
              <span className="est-step-sub">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="est-panel">
        {stage === "upload" ? (
          <>
            <h2 className="est-h">Upload plans</h2>
            <p className="est-sub">
              Drop the plan set (PDF). We&apos;ll read the cover sheet and fill in the project details for
              you to review — no typing first.
            </p>

            <label className={`est-drop${busy ? " est-drop-busy" : ""}`}>
              <input type="file" accept="application/pdf" hidden disabled={busy} onChange={onFile} />
              {busy ? (
                <>
                  <div className="est-spinner" />
                  <div className="est-drop-title">Reading cover sheet…</div>
                  <div className="est-muted">{fileName}</div>
                </>
              ) : (
                <>
                  <div className="est-drop-icon">↑</div>
                  <div className="est-drop-title">Drop PDF here or click to upload</div>
                  <div className="est-muted">An architectural plan set works best</div>
                </>
              )}
            </label>

            {err && <p className="est-err">⚠ {err}</p>}

            <div className="est-next">
              <strong>What happens next?</strong> After you upload, AI reads the cover sheet, fills in the
              project details, finds the likely flooring pages, and prepares the estimate for review.
            </div>
          </>
        ) : (
          <form action={confirmProject.bind(null, projectId!)}>
            <h2 className="est-h">Review project details</h2>
            <p className="est-sub">
              Here&apos;s what Claude pulled from the cover sheet. Fix anything that&apos;s off, then create
              the estimate. The plan pages are processing in the background.
            </p>

            {info.finishSheets && info.finishSheets.length > 0 && (
              <div className="est-hint">
                📐 Likely finish sheets from the index: <strong>{info.finishSheets.join(", ")}</strong> —
                we&apos;ll verify when reading finishes.
              </div>
            )}

            <div className="est-grid">
              <div className="est-field est-col-2">
                <label>Project name <span className="est-req">*</span></label>
                <input name="name" required autoFocus defaultValue={info.name ?? ""} />
              </div>
              <div className="est-field">
                <label>GC / Customer</label>
                <input name="gc" defaultValue={info.contractor ?? ""} placeholder="Often not on the cover" />
              </div>
              <div className="est-field">
                <label>Bid due date</label>
                <input name="bidDate" type="date" />
              </div>
              <div className="est-field">
                <label>Location / address</label>
                <input name="location" defaultValue={info.address ?? ""} />
              </div>
              <div className="est-field">
                <label>Project type</label>
                <input name="projectType" defaultValue={info.useType ?? ""} placeholder="e.g. Office TI" />
              </div>
              <div className="est-field">
                <label>Estimator</label>
                <input name="estimator" placeholder="Who's bidding it" />
              </div>
              <div className="est-field">
                <label>Lead source</label>
                <input name="leadSource" placeholder="Permit · GC email · referral" />
              </div>
              <div className="est-field">
                <label>Internal bid #</label>
                <input name="internalBidNum" placeholder="Optional reference" />
              </div>
              <div className="est-field est-col-2">
                <label>Notes</label>
                <textarea name="notes" defaultValue={defaultNotes} rows={3} />
              </div>
            </div>

            <div className="est-actions">
              <button type="button" className="btn" onClick={() => setStage("upload")}>Back</button>
              <button type="submit" className="btn btn-primary">Create estimate</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
