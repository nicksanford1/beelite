"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { analyzeUpload, confirmProject } from "@/app/actions";
import type { ProjectInfo } from "@/lib/anthropic";

const STEPS = [
  { label: "Upload Plans", sub: "Add the plan PDF" },
  { label: "Review Details", sub: "Confirm what AI found" },
  { label: "Create", sub: "Start the estimate + Sheet" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Creating estimate + Sheet…" : "Create estimate"}
    </button>
  );
}

export function NewEstimateWizard() {
  const [stage, setStage] = useState<"upload" | "review">("upload");
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [info, setInfo] = useState<Partial<ProjectInfo>>({});
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr(null);
    // Shift straight to Review Details and stream the details in as the read finishes.
    setStage("review");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      const res = await analyzeUpload(fd);
      if (res.error || !res.projectId) {
        setErr(res.error ?? "Couldn't read that PDF. Try another file.");
        setStage("upload");
        setLoading(false);
        return;
      }
      setProjectId(res.projectId);
      setInfo(res.info ?? {});
      setLoading(false);
    });
  };

  const activeIdx = stage === "upload" ? 0 : 1;
  // Structured metadata (owner, sqft, project #, issue date) is persisted to its own columns now —
  // notes is just the one-line scope, left for the user to flesh out.
  const defaultNotes = info.scope ?? "";

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

            <label className="est-drop">
              <input type="file" accept="application/pdf" hidden onChange={onFile} />
              <div className="est-drop-icon">↑</div>
              <div className="est-drop-title">Drop PDF here or click to upload</div>
              <div className="est-muted">An architectural plan set works best</div>
            </label>

            {err && <p className="est-err">⚠ {err}</p>}

            <div className="est-next">
              <strong>What happens next?</strong> After you upload, AI reads the cover sheet, fills in the
              project details, finds the likely flooring pages, and prepares the estimate for review.
            </div>
          </>
        ) : (
          <form action={confirmProject.bind(null, projectId!)}>
            <div className="est-review-head">
              <h2 className="est-h">Review project details</h2>
              {loading ? (
                <span className="est-reading"><span className="est-dot" /> Reading cover sheet… <span className="est-muted">{fileName}</span></span>
              ) : (
                <span className="est-read-done">✓ Pulled from the cover sheet — fix anything that&apos;s off</span>
              )}
            </div>

            <div className={`est-grid${loading ? " est-grid-loading" : ""}`}>
              <Field cls="est-col-2" i={0} loading={loading}>
                <label>Project name <span className="est-req">*</span></label>
                <input name="name" required defaultValue={info.name ?? ""} />
              </Field>
              <Field i={1} loading={loading}>
                <label>GC / Customer</label>
                <input name="gc" defaultValue={info.contractor ?? ""} placeholder="Often not on the cover" />
              </Field>
              <Field i={2} loading={loading}>
                <label>Bid due date</label>
                <input name="bidDate" type="date" />
              </Field>
              <Field i={3} loading={loading}>
                <label>Location / address</label>
                <input name="location" defaultValue={info.address ?? ""} />
              </Field>
              <Field i={4} loading={loading}>
                <label>Architect</label>
                <input name="architect" defaultValue={info.architect ?? ""} placeholder="From the cover sheet" />
              </Field>
              <Field i={5} loading={loading}>
                <label>Project type</label>
                <input name="projectType" defaultValue={info.useType ?? ""} placeholder="e.g. Office TI" />
              </Field>
              <Field i={6} loading={loading}>
                <label>Estimator</label>
                <input name="estimator" defaultValue="Nick" />
              </Field>
              <Field cls="est-col-2" i={7} loading={loading}>
                <label>Notes</label>
                <textarea name="notes" defaultValue={defaultNotes} rows={3} />
              </Field>
            </div>

            {err && <p className="est-err">⚠ {err}</p>}

            <div className="est-actions">
              <button type="button" className="btn" onClick={() => { setStage("upload"); setLoading(false); }}>
                Back
              </button>
              <SubmitButton />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// One form field. While the read is in flight it shows a shimmer; when data lands it
// fades/slides in (staggered by `i`) so the details visibly "fill in".
function Field({ children, cls = "", i, loading }: { children: React.ReactNode; cls?: string; i: number; loading: boolean }) {
  if (loading) {
    return (
      <div className={`est-field est-skel ${cls}`}>
        <div className="est-skel-label" />
        <div className="est-skel-input" />
      </div>
    );
  }
  return (
    <div className={`est-field est-fieldin ${cls}`} style={{ animationDelay: `${i * 70}ms` }}>
      {children}
    </div>
  );
}
