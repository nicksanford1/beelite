"use client";

import { useState, useTransition } from "react";
import { saveRates } from "@/app/actions";

type Row = {
  id: string;
  code: string;
  type: string;
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const num: React.CSSProperties = { font: "inherit", fontSize: 14, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", width: 90 };

export function RatesEditor({ projectId, initial }: { projectId: string; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const needs = (r: Row) =>
    (r.materialSource !== "owner_furnishes" && r.materialUnitCost <= 0) || r.installRate <= 0;

  return (
    <div>
      <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
          <thead>
            <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}>
              <th style={cell}>Finish</th>
              <th style={cell}>Material $/u</th>
              <th style={cell}>Install $/u (sub)</th>
              <th style={cell}>Waste %</th>
              <th style={cell}>Carton</th>
              <th style={cell}>Material source</th>
              <th style={cell}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const owner = r.materialSource === "owner_furnishes";
              return (
                <tr key={r.id}>
                  <td style={cell}>
                    <strong>{r.code}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.type}</div>
                  </td>
                  <td style={cell}>
                    <input style={{ ...num, opacity: owner ? 0.4 : 1 }} type="number" step="0.01" disabled={owner}
                      value={owner ? "" : r.materialUnitCost}
                      onChange={(e) => set(i, { materialUnitCost: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td style={cell}>
                    <input style={num} type="number" step="0.01" value={r.installRate}
                      onChange={(e) => set(i, { installRate: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td style={cell}>
                    <input style={num} type="number" step="0.01" value={r.wastePct}
                      onChange={(e) => set(i, { wastePct: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td style={cell}>
                    <input style={num} type="number" step="1" value={r.cartonSize ?? ""}
                      onChange={(e) => set(i, { cartonSize: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td style={cell}>
                    <select style={{ ...num, width: 150 }} value={r.materialSource}
                      onChange={(e) => set(i, { materialSource: e.target.value })}>
                      <option value="elite_furnishes">Elite furnishes</option>
                      <option value="owner_furnishes">Owner/GC furnishes</option>
                    </select>
                  </td>
                  <td style={cell}>
                    {needs(r) && (
                      <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>needs rate</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="form-actions" style={{ marginTop: 18 }}>
        <button className="btn btn-primary" disabled={pending}
          onClick={() => start(() => saveRates(projectId, rows))}>
          {pending ? "Saving…" : "Save rates"}
        </button>
        <span className="hint" style={{ margin: 0, padding: 0, border: 0 }}>
          Waste as a decimal (0.08 = 8%). Install $/u is what the sub charges per unit (your standard rate).
          “Owner/GC furnishes” zeroes material — Elite only prices the install.
        </span>
      </div>
    </div>
  );
}
