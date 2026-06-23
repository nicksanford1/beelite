"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { analyzeUpload, readProjectDetails, confirmProject } from "@/app/actions";

const STEPS = [
  { label: "Upload Plans", sub: "Add the plan PDF" },
  { label: "Review Details", sub: "Confirm what AI found" },
  { label: "Create", sub: "Start the estimate + Sheet" },
];

type Form = {
  name: string; gc: string; bidDate: string; location: string;
  architect: string; projectType: string; estimator: string; notes: string;
};
const BLANK: Form = { name: "", gc: "", bidDate: "", location: "", architect: "", projectType: "", estimator: "Nick", notes: "" };

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending || !ready}>
      {pending ? "Creating estimate + Sheet…" : "Create estimate"}
    </button>
  );
}

export function NewEstimateWizard() {
  const [stage, setStage] = useState<"upload" | "review">("upload");
  const [reading, setReading] = useState(false); // cover read in flight (details filling in)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr(null);
    setForm({ ...BLANK, name: file.name.replace(/\.pdf$/i, "") }); // show the columns immediately, blank
    setStage("review");
    setReading(true);

    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      try {
        const res = await analyzeUpload(fd);
        if (res.error || !res.projectId) {
          setErr(res.error ?? "Couldn't read that PDF. Try another file.");
          setStage("upload");
          setReading(false);
          return;
        }
        setProjectId(res.projectId);

        if (res.documentId) {
          const doc = encodeURIComponent(res.documentId);
          // Background jobs: page ingest (Plans viewer) + the slow whole-doc finish read.
          void fetch(`/api/ingest?doc=${doc}`).catch((e) => console.error("[wizard] ingest failed:", e));
          void fetch(`/api/read-finishes?doc=${doc}`).catch((e) => console.error("[wizard] finish-read failed:", e));
          // Second call: the fast cover read fills the detail fields in place.
          readProjectDetails(res.documentId)
            .then((r) => {
              if (r.info) {
                const i = r.info;
                setForm((f) => ({
                  ...f,
                  name: i.name || f.name, // never let an empty read wipe the filename fallback
                  gc: i.contractor || f.gc,
                  location: i.address || f.location,
                  architect: i.architect || f.architect,
                  projectType: i.useType || f.projectType,
                  notes: i.scope || f.notes,
                }));
              }
            })
            .catch((e) => console.error("[wizard] details read failed:", e))
            .finally(() => setReading(false));
        } else {
          setReading(false);
        }
      } catch (e) {
        console.error("[wizard] upload failed:", e);
        setErr("The upload didn't go through. Try the PDF again.");
        setStage("upload");
        setReading(false);
      }
    });
  };

  const activeIdx = stage === "upload" ? 0 : 1;

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
              {reading ? (
                <span className="est-reading">Reading cover sheet… <span className="est-muted">{fileName}</span></span>
              ) : (
                <span className="est-read-done">✓ Pulled from the cover sheet — fix anything that&apos;s off</span>
              )}
            </div>

            <div className="est-grid">
              <div className="est-field est-col-2">
                <label>Project name <span className="est-req">*</span></label>
                <input name="name" required value={form.name} onChange={set("name")} />
              </div>
              <div className="est-field">
                <label>GC / Customer</label>
                <input name="gc" value={form.gc} onChange={set("gc")} placeholder="Often not on the cover" />
              </div>
              <div className="est-field">
                <label>Bid due date</label>
                <input name="bidDate" type="date" value={form.bidDate} onChange={set("bidDate")} />
              </div>
              <div className="est-field">
                <label>Location / address</label>
                <input name="location" value={form.location} onChange={set("location")} />
              </div>
              <div className="est-field">
                <label>Architect</label>
                <input name="architect" value={form.architect} onChange={set("architect")} placeholder="From the cover sheet" />
              </div>
              <div className="est-field">
                <label>Project type</label>
                <input name="projectType" value={form.projectType} onChange={set("projectType")} placeholder="e.g. Office TI" />
              </div>
              <div className="est-field">
                <label>Estimator</label>
                <input name="estimator" value={form.estimator} onChange={set("estimator")} />
              </div>
              <div className="est-field est-col-2">
                <label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={set("notes")} rows={3} />
              </div>
            </div>

            {err && <p className="est-err">⚠ {err}</p>}

            <div className="est-actions">
              <button type="button" className="btn" onClick={() => { setStage("upload"); setReading(false); }}>
                Back
              </button>
              <SubmitButton ready={!!projectId} />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
