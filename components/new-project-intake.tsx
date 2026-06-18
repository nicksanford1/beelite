"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { analyzeUpload, confirmProject } from "@/app/actions";
import type { ProjectInfo } from "@/lib/anthropic";

export function NewProjectIntake() {
  const [stage, setStage] = useState<"upload" | "confirm">("upload");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [info, setInfo] = useState<Partial<ProjectInfo>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      setErr(null);
      const res = await analyzeUpload(fd);
      if (res.error || !res.projectId) {
        setErr(res.error ?? "Something went wrong reading the plan.");
        return;
      }
      setProjectId(res.projectId);
      setInfo(res.info ?? {});
      setStage("confirm");
    });
  };

  if (stage === "upload") {
    return (
      <div className="form">
        <p className="detail-meta">
          Upload a plan PDF. Claude reads the cover sheet and fills in the project details for you to
          confirm — no typing. (The pages process in the background while you review.)
        </p>
        <label className="btn btn-primary" style={{ display: "inline-block", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Reading the cover sheet…" : "Choose plan PDF"}
          <input type="file" accept="application/pdf" hidden disabled={busy} onChange={onFile} />
        </label>
        {err && <p style={{ color: "#b45309", marginTop: 12 }}>⚠ {err}</p>}
        <div style={{ marginTop: 16 }}>
          <Link href="/" className="btn">Cancel</Link>
        </div>
      </div>
    );
  }

  const defaultNotes = [info.scope, info.squareFeet && `~${info.squareFeet}`, info.architect && `Architect: ${info.architect}`, info.owner && `Owner: ${info.owner}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <form action={confirmProject.bind(null, projectId!)} className="form">
      <p className="detail-meta">
        Here&apos;s what Claude pulled from the cover. Fix anything that&apos;s off, then confirm. The plan&apos;s
        pages are processing in the background.
      </p>
      <div className="field">
        <label htmlFor="name">Project name <span className="req">*</span></label>
        <input id="name" name="name" required autoFocus defaultValue={info.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="location">Building / address</label>
        <input id="location" name="location" defaultValue={info.address ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="gc">General contractor</label>
        <input id="gc" name="gc" defaultValue={info.contractor ?? ""} placeholder="(often not on the cover — add if known)" />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes (scope · SF · architect)</label>
        <textarea id="notes" name="notes" defaultValue={defaultNotes} />
      </div>
      {info.finishSheets && info.finishSheets.length > 0 && (
        <p className="detail-meta">📐 Likely finish sheets from the index: <strong>{info.finishSheets.join(", ")}</strong> (we&apos;ll verify when reading).</p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Create bid</button>
        <Link href="/" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
