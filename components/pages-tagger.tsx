"use client";

import { useState, useTransition } from "react";
import { saveSheetTags, readSchedule } from "@/app/actions";

type Page = {
  id: string;
  pageNumber: number;
  sheetNumber: string | null;
  sheetTitle: string | null;
  suggestedSheetType: string | null;
  scanScore: number | null;
  sheetType: string;
};

const TAGS = ["untagged", "finish_schedule", "finish_plan", "floor_plan", "specs", "ignore"];
const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

export function PagesTagger({ projectId, documentId, initial }: { projectId: string; documentId: string; initial: Page[] }) {
  // No scanner guessing: every page starts untagged unless a human already tagged it.
  const [tags, setTags] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((p) => [p.id, p.sheetType !== "untagged" ? p.sheetType : "untagged"]))
  );
  const [preview, setPreview] = useState<number | null>(null);
  const [savePending, startSave] = useTransition();
  const [readPending, startRead] = useTransition();

  const tagList = () => initial.map((p) => ({ id: p.id, sheetType: tags[p.id] }));
  const taggedCount = Object.values(tags).filter((v) => v === "finish_schedule").length;

  const save = () => startSave(() => saveSheetTags(projectId, tagList()));
  const read = () =>
    startRead(async () => {
      await saveSheetTags(projectId, tagList());
      await readSchedule(documentId); // redirects to /finishes
    });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: 20, alignItems: "start" }}>
      {/* page list */}
      <div>
        <div className="card" style={{ padding: 0, display: "block", maxHeight: 560, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left", position: "sticky", top: 0, background: "var(--surface)" }}>
                <th style={cell}>Pg</th>
                <th style={cell}>Sheet</th>
                <th style={cell}>Tag</th>
              </tr>
            </thead>
            <tbody>
              {initial.map((p) => {
                return (
                  <tr
                    key={p.id}
                    onClick={() => setPreview(p.pageNumber)}
                    style={{ cursor: "pointer", background: preview === p.pageNumber ? "var(--primary-soft)" : undefined }}
                  >
                    <td style={{ ...cell, fontWeight: 600 }}>{p.pageNumber}</td>
                    <td style={cell}>
                      <div>{p.sheetNumber ?? "—"}</div>
                    </td>
                    <td style={cell} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={tags[p.id]}
                        onChange={(e) => setTags((t) => ({ ...t, [p.id]: e.target.value }))}
                        style={{ font: "inherit", fontSize: 13, padding: "5px 6px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}
                      >
                        {TAGS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={savePending} onClick={save}>{savePending ? "Saving…" : "Save tags"}</button>
          <button className="btn btn-primary" disabled={readPending || taggedCount === 0} onClick={read}>
            {readPending ? "Reading…" : `Read finishes from ${taggedCount} page${taggedCount === 1 ? "" : "s"}`}
          </button>
        </div>
        {taggedCount === 0 && <p className="hint">Tag at least one page as “finish schedule” to read it.</p>}
      </div>

      {/* on-demand preview */}
      <div style={{ position: "sticky", top: 20 }}>
        {preview ? (
          <div className="card" style={{ padding: 8, display: "block" }}>
            <div className="card-meta" style={{ padding: "4px 6px 8px" }}>Page {preview}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={preview}
              src={`/api/preview?doc=${documentId}&page=${preview}`}
              alt={`Page ${preview}`}
              style={{ width: "100%", borderRadius: 8, display: "block", background: "#fff" }}
            />
          </div>
        ) : (
          <div className="empty"><p>Click a page to preview it.</p></div>
        )}
      </div>
    </div>
  );
}
