"use client";

import { useState, useTransition } from "react";
import { replaceTakeoff } from "@/app/actions";

type Finish = { code: string; unit: string; application: string };
type Row = { sheet: string; area: string; finishCode: string; qty: number; unit: string; status: string };

const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const inp: React.CSSProperties = { font: "inherit", fontSize: 14, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", width: "100%" };

export function TakeoffEditor({
  projectId,
  finishes,
  initial,
}: {
  projectId: string;
  finishes: Finish[];
  initial: Row[];
}) {
  const blank = (): Row => ({ sheet: "", area: "", finishCode: finishes[0]?.code ?? "", qty: 0, unit: finishes[0]?.unit ?? "SF", status: "approved" });
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [blank()]);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const setFinish = (i: number, code: string) =>
    set(i, { finishCode: code, unit: finishes.find((f) => f.code === code)?.unit ?? "SF" });

  // live rollup by finish (approved only)
  const totals = new Map<string, number>();
  for (const r of rows) if (r.status === "approved" && r.finishCode) totals.set(r.finishCode, (totals.get(r.finishCode) ?? 0) + (Number(r.qty) || 0));

  return (
    <div>
      <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 680 }}>
          <thead>
            <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}>
              <th style={cell}>Sheet</th>
              <th style={cell}>Area / room</th>
              <th style={cell}>Finish</th>
              <th style={cell}>Qty</th>
              <th style={cell}>Unit</th>
              <th style={cell}>Status</th>
              <th style={cell}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={cell}><input style={{ ...inp, width: 80 }} value={r.sheet} onChange={(e) => set(i, { sheet: e.target.value })} placeholder="A101" /></td>
                <td style={cell}><input style={inp} value={r.area} onChange={(e) => set(i, { area: e.target.value })} placeholder="Rooms 101–108" /></td>
                <td style={cell}>
                  <select style={{ ...inp, width: 110 }} value={r.finishCode} onChange={(e) => setFinish(i, e.target.value)}>
                    {finishes.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.application}</option>)}
                  </select>
                </td>
                <td style={cell}><input style={{ ...inp, width: 90 }} type="number" step="1" value={r.qty} onChange={(e) => set(i, { qty: parseFloat(e.target.value) || 0 })} /></td>
                <td style={cell}><span style={{ color: "var(--muted)" }}>{r.unit}</span></td>
                <td style={cell}>
                  <select style={{ ...inp, width: 130 }} value={r.status} onChange={(e) => set(i, { status: e.target.value })}>
                    <option value="approved">approved</option>
                    <option value="needs_review">needs review</option>
                    <option value="draft">draft</option>
                    <option value="excluded">excluded</option>
                  </select>
                </td>
                <td style={cell}><button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} style={{ ...inp, width: "auto", cursor: "pointer", color: "var(--muted)" }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-actions" style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setRows((r) => [...r, blank()])}>+ Add row</button>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(() => replaceTakeoff(projectId, rows))}>
          {pending ? "Saving…" : "Save takeoff"}
        </button>
      </div>

      {totals.size > 0 && (
        <p className="hint">
          Approved totals: {[...totals.entries()].map(([c, q]) => `${c} ${q.toLocaleString()}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
