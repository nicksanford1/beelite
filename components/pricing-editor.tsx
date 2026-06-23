"use client";

import { useMemo, useState, useTransition } from "react";
import { savePricing } from "@/app/actions";
import { usd } from "@/lib/estimate";

// One row per in-scope finish: its rate AND its single total quantity, with the line cost computed
// live beside it. This is the rates + takeoff merge — the estimate only ever sums one total per finish
// (estimate.ts), so there are no sub-rows. The authoritative bid PRICE (with profit) still comes from
// the server on save; this previews line COST only, mirroring estimate.ts so the two never disagree.
type Row = {
  id: string;
  code: string;
  type: string;
  application: string;
  unit: string;
  totalQty: number;
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

// Waste is stored as a decimal (0.08) but shown as a whole percent (8). Empty when zero.
function displayPct(w: number): number | "" {
  const p = Math.round(w * 10000) / 100;
  return p === 0 ? "" : p;
}

// Cost mirror of estimate.ts (cost level only — no sell/profit, which stays server-authoritative).
function lineCost(r: Row) {
  const owner = r.materialSource === "owner_furnishes";
  const orderRaw = r.totalQty * (1 + (r.wastePct || 0));
  const carton = r.cartonSize ?? 0;
  const orderQty = carton > 0 ? Math.ceil(orderRaw / carton) * carton : orderRaw;
  const material = owner ? 0 : orderQty * (r.materialUnitCost || 0);
  const install = r.totalQty * (r.installRate || 0);
  return material + install;
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono), ui-monospace, monospace" };
const numInput: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  width: 84,
  textAlign: "right",
};

export function PricingEditor({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [toLibrary, setToLibrary] = useState(false);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const needsRate = (r: Row) =>
    (r.materialSource !== "owner_furnishes" && r.materialUnitCost <= 0) || r.installRate <= 0;
  const needsQty = (r: Row) => r.totalQty <= 0;

  const scopeCost = useMemo(() => rows.reduce((a, r) => a + lineCost(r), 0), [rows]);
  const openCount = rows.filter((r) => needsRate(r) || needsQty(r)).length;

  if (rows.length === 0) {
    return (
      <div className="empty">
        <h2>Confirm finishes first</h2>
        <p>Once you confirm which finishes are in scope above, they show up here to price and measure.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Finish</th>
              <th style={{ ...th, textAlign: "right" }}>Quantity</th>
              <th style={{ ...th, textAlign: "right" }}>Material $/u</th>
              <th style={{ ...th, textAlign: "right" }}>Install $/u</th>
              <th style={{ ...th, textAlign: "right" }}>Waste</th>
              <th style={th}>Material</th>
              <th style={{ ...th, textAlign: "right" }}>Line cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const owner = r.materialSource === "owner_furnishes";
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <div style={{ ...mono, fontWeight: 700, color: "var(--blueprint)", fontSize: 14.5 }}>{r.code}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.type || r.application}</div>
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <input
                      style={{ ...numInput, border: needsQty(r) ? "1px solid var(--gold)" : "1px solid var(--border)" }}
                      type="number" step="1" min="0" value={r.totalQty || ""}
                      placeholder="0"
                      onChange={(e) => set(i, { totalQty: parseFloat(e.target.value) || 0 })}
                      aria-label={`Total ${r.unit} for ${r.code}`}
                    />
                    <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>{r.unit}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span className="cell-affix" data-disabled={owner}>
                      <span className="affix-sym">$</span>
                      <input
                        type="number" step="0.01" min="0" disabled={owner}
                        value={owner ? "" : r.materialUnitCost || ""}
                        placeholder={owner ? "—" : "0.00"}
                        onChange={(e) => set(i, { materialUnitCost: parseFloat(e.target.value) || 0 })}
                        aria-label={`Material unit cost for ${r.code}`}
                      />
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span className="cell-affix">
                      <span className="affix-sym">$</span>
                      <input
                        type="number" step="0.01" min="0" value={r.installRate || ""}
                        placeholder="0.00"
                        onChange={(e) => set(i, { installRate: parseFloat(e.target.value) || 0 })}
                        aria-label={`Install rate for ${r.code}`}
                      />
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {/* Waste only applies to material Elite buys; owner-furnished material has no waste cost. */}
                    <span className="cell-affix" data-disabled={owner} title={owner ? "No waste — owner furnishes the material" : undefined}>
                      <input
                        type="number" step="1" min="0" disabled={owner}
                        style={{ width: 44 }}
                        value={owner ? "" : displayPct(r.wastePct)}
                        placeholder={owner ? "—" : "0"}
                        onChange={(e) => set(i, { wastePct: (parseFloat(e.target.value) || 0) / 100 })}
                        aria-label={`Waste percent for ${r.code}`}
                      />
                      <span className="affix-sym">%</span>
                    </span>
                  </td>
                  <td style={td}>
                    <select
                      style={{ font: "inherit", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", width: 132 }}
                      value={r.materialSource}
                      onChange={(e) => set(i, { materialSource: e.target.value })}
                      aria-label={`Material source for ${r.code}`}
                    >
                      <option value="elite_furnishes">Elite furnishes</option>
                      <option value="owner_furnishes">Owner / GC</option>
                    </select>
                  </td>
                  <td style={{ ...td, ...mono, textAlign: "right", fontWeight: 700, color: needsRate(r) || needsQty(r) ? "var(--muted)" : "var(--marking)" }}>
                    {needsRate(r) || needsQty(r) ? (
                      <span className="badge" style={{ background: "var(--marking-soft)", color: "var(--gold)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
                        {needsQty(r) ? "needs qty" : "needs rate"}
                      </span>
                    ) : (
                      usd(lineCost(r))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...td, borderBottom: "none", fontWeight: 600, color: "var(--muted)" }} colSpan={6}>
                Scope cost {openCount > 0 && <span style={{ color: "var(--gold)", fontWeight: 500 }}>· {openCount} need input</span>}
              </td>
              <td style={{ ...td, ...mono, borderBottom: "none", textAlign: "right", fontWeight: 700, fontSize: 15.5, color: "var(--marking)" }}>
                {usd(scopeCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="form-actions" style={{ marginTop: 16, gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-primary" disabled={pending}
          onClick={() => start(() => savePricing(projectId, rows, toLibrary))}>
          {pending ? "Saving…" : "Save pricing"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--muted)" }}>
          <input type="checkbox" checked={toLibrary} onChange={(e) => setToLibrary(e.target.checked)} />
          Also save to my standard rates
        </label>
      </div>
      <p className="hint">
        One total quantity per finish. Material $/u is your material cost per unit; Install $/u is what the sub
        charges. Waste is a percent of material (8 = 8%). “Owner / GC” zeroes material and waste — Elite prices the
        install only. Saving updates your Google Sheet; the line cost here is a live preview and the bid price
        (with profit) follows on save.
      </p>
    </div>
  );
}
