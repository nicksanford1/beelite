"use client";

import { useState, useTransition } from "react";
import { confirmFinishes } from "@/app/actions";
import type { ExtractedFinish } from "@/lib/anthropic";

const UNITS = ["SF", "LF", "EA", "SY", "other"];
// Material vocabulary — must mirror FinishCategory in lib/anthropic.ts so the AI's value
// (e.g. "lvt_lvp", "tile") matches an option instead of silently falling back to the first.
const CATEGORIES = [
  "resilient", "rubber", "lvt_lvp", "vct", "carpet", "tile", "turf", "sheet_vinyl",
  "epoxy", "polished_concrete", "sealed_concrete", "wood", "laminate",
  "base", "transition", "stair", "prep", "moisture_mitigation", "adhesive", "accessory",
  "unknown_flooring_related", "other",
];

const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const input: React.CSSProperties = { font: "inherit", fontSize: 14, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", width: "100%" };

export function FinishReview({ projectId, planSheetId, initial }: { projectId: string; planSheetId: string; initial: ExtractedFinish[] }) {
  const [rows, setRows] = useState<ExtractedFinish[]>(initial);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<ExtractedFinish>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));

  const flagged = (f: ExtractedFinish) => f.confidence < 0.9 || !f.includedInFlooringScope;
  const flaggedCount = rows.filter(flagged).length;

  return (
    <div>
      <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}>
              <th style={cell}>Code</th>
              <th style={cell}>Type</th>
              <th style={cell}>Description</th>
              <th style={cell}>Unit</th>
              <th style={cell}>Category</th>
              <th style={{ ...cell, textAlign: "center" }}>In&nbsp;scope</th>
              <th style={{ ...cell, textAlign: "center" }}>Conf.</th>
              <th style={cell}>Source</th>
              <th style={cell}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={i} style={flagged(f) ? { background: "#fff7ed" } : undefined}>
                <td style={cell}>
                  <input style={{ ...input, fontWeight: 600, width: 90 }} value={f.code} onChange={(e) => update(i, { code: e.target.value })} />
                </td>
                <td style={cell}>
                  <input style={{ ...input, minWidth: 110 }} value={f.type} onChange={(e) => update(i, { type: e.target.value })} />
                </td>
                <td style={cell}>
                  <input style={{ ...input, minWidth: 260 }} value={f.description} onChange={(e) => update(i, { description: e.target.value })} />
                </td>
                <td style={cell}>
                  <select style={{ ...input, width: 80 }} value={f.unit} onChange={(e) => update(i, { unit: e.target.value as ExtractedFinish["unit"] })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={cell}>
                  <select style={{ ...input, width: 120 }} value={f.category} onChange={(e) => update(i, { category: e.target.value as ExtractedFinish["category"] })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ ...cell, textAlign: "center" }}>
                  <input type="checkbox" checked={f.includedInFlooringScope} onChange={(e) => update(i, { includedInFlooringScope: e.target.checked })} />
                </td>
                <td style={{ ...cell, textAlign: "center", color: f.confidence < 0.9 ? "#b45309" : "var(--muted)" }}>
                  {f.confidence.toFixed(2)}
                </td>
                <td style={{ ...cell, color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {f.sourcePage ? (
                    <a
                      href={`/projects/${projectId}/plans?sheet=${encodeURIComponent(f.sourcePage)}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open sheet ${f.sourcePage} in the plans viewer${f.sourceText ? ` — "${f.sourceText}"` : ""}`}
                      style={{ color: "var(--gold, #e0b341)", textDecoration: "none", fontWeight: 600 }}
                    >
                      {f.sourcePage} ↗
                    </a>
                  ) : "—"}
                </td>
                <td style={cell}>
                  <button type="button" onClick={() => remove(i)} aria-label="Remove" style={{ ...input, width: "auto", cursor: "pointer", color: "var(--muted)" }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-actions" style={{ marginTop: 18 }}>
        <button
          className="btn btn-primary"
          disabled={pending || rows.length === 0}
          onClick={() => start(() => confirmFinishes(projectId, planSheetId, rows))}
        >
          {pending ? "Saving…" : `Confirm ${rows.length} finishes`}
        </button>
        {flaggedCount > 0 && (
          <span className="hint" style={{ margin: 0, padding: 0, border: 0, color: "#b45309" }}>
            ⚠ {flaggedCount} flagged for review (low confidence or out-of-scope) — highlighted above.
          </span>
        )}
      </div>
    </div>
  );
}
