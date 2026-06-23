"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmFinishes } from "@/app/actions";
import type { ExtractedFinish, FinishAssignment } from "@/lib/anthropic";

const UNITS = ["SF", "LF", "EA", "SY", "other"];

// A blank, user-added finish. Confidence 1 → reads as "Ready" (it's hand-entered, not an unsure read).
// Empty-code rows are skipped on save, so an unfilled row never corrupts the bid.
const blankFinish = (): ExtractedFinish => ({
  code: "",
  application: "floor",
  type: "",
  description: "",
  unit: "SF",
  category: "other",
  includedInFlooringScope: true,
  reason: "Added manually",
  confidence: 1,
});

// Per-room assignments don't drive the estimate (finishes × rates × takeoff quantities do), so the
// By-room view is hidden for now. Flip to true to bring the sub-tab back.
const SHOW_BY_ROOM = false;
const APPLICATIONS = ["floor", "base", "transition", "stair", "accessory", "other"];

// Borderless cell input — reads like a clean table, shows a focus ring (global :focus-visible) on edit.
const cellInput: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "3px 5px",
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text)",
  width: "100%",
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono), ui-monospace, monospace" };

// The status pill is the table's ONE color signal — amber when a row needs a look, green when it's good.
function StatusTag({ review }: { review: boolean }) {
  const c = review ? "var(--gold)" : "var(--green)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 11px 3px 9px",
        borderRadius: 999,
        color: c,
        background: review ? "rgba(156, 116, 20, 0.11)" : "rgba(26, 125, 80, 0.11)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {review ? "Review" : "Ready"}
    </span>
  );
}

export function FinishReview({
  projectId,
  planSheetId,
  initial,
  initialAssignments,
}: {
  projectId: string;
  planSheetId: string;
  initial: ExtractedFinish[];
  initialAssignments: FinishAssignment[];
}) {
  const [rows, setRows] = useState<ExtractedFinish[]>(initial);
  const [assignments, setAssignments] = useState<FinishAssignment[]>(initialAssignments);
  const [tab, setTab] = useState<"breakdown" | "rooms">("breakdown");
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<ExtractedFinish>) => {
    const oldCode = rows[i]?.code;
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    if (oldCode && patch.code && patch.code !== oldCode) {
      setAssignments((all) => all.map((a) => (a.finishCode === oldCode ? { ...a, finishCode: patch.code! } : a)));
    }
  };
  const remove = (i: number) => {
    const code = rows[i]?.code;
    setRows((r) => r.filter((_, j) => j !== i));
    setAssignments((all) => all.filter((a) => a.finishCode !== code));
  };

  // A row needs review only if it's out of flooring scope OR the AI was genuinely unsure. The model is
  // well-calibrated and rarely reports above ~0.85, so the bar is low — "Review" must mean uncertain,
  // not merely "less than 100% sure" (which would flag everything).
  const isReview = (f: ExtractedFinish) => !f.includedInFlooringScope || f.confidence < 0.65;
  const flaggedCount = rows.filter(isReview).length;

  // Has any room/area assignment at all? Drives whether the "By room" tab appears.
  const roomRows = useMemo(
    () =>
      assignments
        .filter((a) => a.roomNumber || a.roomName || a.level)
        .slice()
        .sort((a, b) => (a.level ?? "").localeCompare(b.level ?? "") || (a.roomNumber ?? "").localeCompare(b.roomNumber ?? "")),
    [assignments]
  );
  const hasRooms = roomRows.length > 0;
  const view = SHOW_BY_ROOM && tab === "rooms" && hasRooms ? "rooms" : "breakdown";

  const tabBtn = (active: boolean): React.CSSProperties => ({
    font: "inherit",
    fontSize: 14,
    fontWeight: 600,
    padding: "7px 14px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: active ? "var(--surface-2)" : "transparent",
    color: active ? "var(--text)" : "var(--muted)",
  });

  return (
    <div>
      {/* Sub-tabs — By room only appears when there are assignments to show */}
      {SHOW_BY_ROOM && hasRooms && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button type="button" style={tabBtn(view === "breakdown")} onClick={() => setTab("breakdown")}>
            Breakdown
          </button>
          <button type="button" style={tabBtn(view === "rooms")} onClick={() => setTab("rooms")}>
            By room <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {roomRows.length}</span>
          </button>
        </div>
      )}

      {/* ── Breakdown: the priced finish list (editable) ── */}
      {view === "breakdown" && (
        <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 14 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col />
              <col style={{ width: 88 }} />
              <col style={{ width: 74 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 46 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={th}>Type</th>
                <th style={th}>Description</th>
                <th style={th}>Source</th>
                <th style={{ ...th, textAlign: "center" }}>Unit</th>
                <th style={{ ...th, textAlign: "center" }}>Scope</th>
                <th style={{ ...th, textAlign: "center" }}>Status</th>
                <th style={th} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => {
                const review = isReview(f);
                return (
                  <tr key={`${f.code}-${i}`}>
                    <td style={td}>
                      <input
                        style={{ ...cellInput, ...mono, fontWeight: 700, fontSize: 14.5 }}
                        value={f.code}
                        onChange={(e) => update(i, { code: e.target.value })}
                        aria-label="Finish code"
                      />
                    </td>
                    <td style={td}>
                      <select
                        style={{ ...cellInput, color: "var(--muted)", fontSize: 13 }}
                        value={f.application ?? "other"}
                        onChange={(e) => update(i, { application: e.target.value as ExtractedFinish["application"] })}
                        aria-label="Type"
                      >
                        {APPLICATIONS.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <input
                        style={cellInput}
                        value={f.description}
                        onChange={(e) => update(i, { description: e.target.value })}
                        aria-label="Finish description"
                      />
                      {(f.manufacturer || f.product || f.thickness || f.notes) && (
                        <div style={{ padding: "2px 5px 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                          {[f.manufacturer, f.product, f.thickness && `${f.thickness}`].filter(Boolean).join(" · ")}
                          {f.notes && (
                            <span style={{ color: "var(--gold)" }}>{(f.manufacturer || f.product || f.thickness) ? " — " : ""}{f.notes}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      {f.sourcePage ? (
                        <a
                          href={`/projects/${projectId}/plans?sheet=${encodeURIComponent(f.sourcePage)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...mono, fontSize: 13, color: "var(--marking)", textDecoration: "none" }}
                          title="Open this sheet in Plans"
                        >
                          {f.sourcePage} ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <select
                        style={{ ...cellInput, textAlign: "center" }}
                        value={f.unit}
                        onChange={(e) => update(i, { unit: e.target.value as ExtractedFinish["unit"] })}
                        aria-label="Unit"
                      >
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        style={{ accentColor: "var(--primary)", width: 16, height: 16, cursor: "pointer" }}
                        checked={f.includedInFlooringScope}
                        onChange={(e) => update(i, { includedInFlooringScope: e.target.checked })}
                        aria-label="Included in flooring scope"
                      />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <StatusTag review={review} />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label="Remove finish"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 15, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "breakdown" && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => setRows((r) => [...r, blankFinish()])}
        >
          + Add finish
        </button>
      )}

      {/* ── By room: where each finish lands (read-only). Material only — no SF. ── */}
      {view === "rooms" && (
        <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={th}>Level</th>
                <th style={th}>Room</th>
                <th style={th}>Name</th>
                <th style={th}>Finish</th>
                <th style={th}>Sheet</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map((a, i) => {
                const review = a.needsReview || a.confidence < 0.9;
                return (
                  <tr key={i} style={review ? { background: "var(--marking-soft)" } : undefined}>
                    <td style={td}>{a.level || "—"}</td>
                    <td style={{ ...td, ...mono }}>{a.roomNumber || "—"}</td>
                    <td style={td}>{a.roomName || "—"}</td>
                    <td style={{ ...td, ...mono, fontWeight: 700, color: "var(--blueprint)" }}>{a.finishCode}</td>
                    <td style={td}>
                      {a.sourcePage ? (
                        <a
                          href={`/projects/${projectId}/plans?sheet=${encodeURIComponent(a.sourcePage)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...mono, color: "var(--marking)", textDecoration: "none" }}
                        >
                          {a.sourcePage} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <StatusTag review={review} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm applies to the whole finish list, from either tab */}
      <div className="form-actions" style={{ marginTop: 18 }}>
        <button
          className="btn btn-primary"
          disabled={pending || rows.length === 0}
          onClick={() => start(() => confirmFinishes(projectId, planSheetId, rows, assignments))}
        >
          {pending ? "Saving…" : `Confirm ${rows.length} finishes`}
        </button>
        {flaggedCount > 0 && (
          <span className="hint" style={{ margin: 0, padding: 0, border: 0, color: "var(--gold)" }}>
            ⚠ {flaggedCount} flagged for review — shown as Review in the Status column.
          </span>
        )}
      </div>
    </div>
  );
}
