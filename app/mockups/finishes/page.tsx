// MOCKUP / throwaway — visual comparison of two Finishes layouts (Option A vs B).
// Not wired to data; safe to delete. View at /mockups/finishes.

type Room = { level: string; number: string; name: string; sheet: string; review?: boolean };
type Finish = {
  code: string;
  application: string;
  description: string;
  unit: string;
  rooms: Room[];
  review?: boolean;
};

// Realistic-ish sample so the layouts feel like a real bid, not lorem ipsum.
const FINISHES: Finish[] = [
  {
    code: "LVT-1",
    application: "floor",
    description: 'Luxury vinyl tile — 6"×48" plank, warm oak',
    unit: "SF",
    rooms: [
      { level: "1st", number: "101", name: "Lobby", sheet: "A6.1" },
      { level: "1st", number: "102", name: "Reception", sheet: "A6.1" },
      { level: "1st", number: "110", name: "Corridor", sheet: "A6.1" },
      { level: "2nd", number: "201", name: "Open Office", sheet: "A6.2" },
      { level: "2nd", number: "210", name: "Corridor", sheet: "A6.2" },
    ],
  },
  {
    code: "CPT-2",
    application: "floor",
    description: "Carpet tile — 24×24, charcoal loop",
    unit: "SY",
    review: true,
    rooms: [
      { level: "2nd", number: "202", name: "Conference", sheet: "A6.2" },
      { level: "2nd", number: "203", name: "Office", sheet: "A6.2", review: true },
      { level: "2nd", number: "204", name: "Office", sheet: "A6.2", review: true },
    ],
  },
  {
    code: "PT-1",
    application: "floor",
    description: "Porcelain tile — 12×24, matte slate",
    unit: "SF",
    rooms: [
      { level: "1st", number: "105", name: "Restroom", sheet: "A6.1" },
      { level: "2nd", number: "205", name: "Restroom", sheet: "A6.2" },
    ],
  },
  {
    code: "RB-1",
    application: "base",
    description: 'Rubber base — 4", coved, black',
    unit: "LF",
    rooms: [
      { level: "1st", number: "101", name: "Lobby", sheet: "A6.1" },
      { level: "1st", number: "110", name: "Corridor", sheet: "A6.1" },
      { level: "2nd", number: "201", name: "Open Office", sheet: "A6.2" },
    ],
  },
];

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
};
const cell: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "left" };
const th: React.CSSProperties = { ...cell, color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono), ui-monospace, monospace" };

function ReviewPill({ review }: { review?: boolean }) {
  return (
    <span style={{ color: review ? "var(--gold)" : "var(--green)", fontSize: 12, fontWeight: 600 }}>
      {review ? "Review" : "Ready"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION A — Room-centric. One row per room. Estimators think in rooms.
// Finish definitions become a compact legend above the table.
// ─────────────────────────────────────────────────────────────────────────────
function OptionA() {
  const rows = FINISHES.flatMap((f) => f.rooms.map((r) => ({ ...r, finish: f })));
  return (
    <div>
      {/* Finish legend / key */}
      <div style={{ ...card, padding: 14, marginBottom: 16 }}>
        <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          Finish key
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {FINISHES.map((f) => (
            <div key={f.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ ...mono, fontWeight: 700, color: "var(--blueprint)" }}>{f.code}</span>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{f.description}</span>
              <span style={{ ...mono, fontSize: 11, color: "var(--muted)" }}>· {f.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* One row per room */}
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>Level</th>
              <th style={th}>Room</th>
              <th style={th}>Name</th>
              <th style={th}>Finish</th>
              <th style={th}>Application</th>
              <th style={th}>Sheet</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={r.review ? { background: "rgba(224,179,65,0.06)" } : undefined}>
                <td style={cell}>{r.level}</td>
                <td style={{ ...cell, ...mono, fontWeight: 600 }}>{r.number}</td>
                <td style={cell}>{r.name}</td>
                <td style={cell}>
                  <span style={{ ...mono, fontWeight: 700, color: "var(--blueprint)" }}>{r.finish.code}</span>
                </td>
                <td style={{ ...cell, color: "var(--muted)" }}>{r.finish.application}</td>
                <td style={{ ...cell, ...mono, fontSize: 12 }}>
                  <a href="#" style={{ color: "var(--marking)", textDecoration: "none" }}>{r.sheet} ↗</a>
                </td>
                <td style={cell}><ReviewPill review={r.review} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION B — Master/detail. Finish list left; selected finish's rooms right.
// (Static mock: first finish shown "selected".)
// ─────────────────────────────────────────────────────────────────────────────
function OptionB() {
  const selected = FINISHES[0];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      {/* Master list */}
      <div style={{ ...card, overflow: "hidden" }}>
        {FINISHES.map((f) => {
          const active = f.code === selected.code;
          return (
            <div
              key={f.code}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                background: active ? "var(--primary-soft)" : undefined,
                borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...mono, fontWeight: 700, color: active ? "var(--primary-hover)" : "var(--blueprint)" }}>{f.code}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.rooms.length} rooms</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.description}
              </div>
              {f.review && <span style={{ color: "var(--gold)", fontSize: 11, fontWeight: 600 }}>⚠ needs review</span>}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ ...mono, fontSize: 22, fontWeight: 700, color: "var(--blueprint)" }}>{selected.code}</span>
          <span style={{ color: "var(--text)", fontSize: 15 }}>{selected.description}</span>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>
          {selected.application} · measured in {selected.unit} · {selected.rooms.length} rooms assigned
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>Level</th>
              <th style={th}>Room</th>
              <th style={th}>Name</th>
              <th style={th}>Sheet</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {selected.rooms.map((r, i) => (
              <tr key={i} style={r.review ? { background: "rgba(224,179,65,0.06)" } : undefined}>
                <td style={cell}>{r.level}</td>
                <td style={{ ...cell, ...mono, fontWeight: 600 }}>{r.number}</td>
                <td style={cell}>{r.name}</td>
                <td style={{ ...cell, ...mono, fontSize: 12 }}>
                  <a href="#" style={{ color: "var(--marking)", textDecoration: "none" }}>{r.sheet} ↗</a>
                </td>
                <td style={cell}><ReviewPill review={r.review} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FinishesMockup() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px 80px" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Finishes — layout comparison</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 40px" }}>
        Throwaway mockup with sample data. Compare how room assignments read in each.
      </p>

      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Option A — Room-centric table</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px", maxWidth: 720 }}>
          One row per room, finish as a column, with a compact finish key on top. Best for “what’s going in 204?”
          and for scanning the whole job at once. No nested dropdowns.
        </p>
        <OptionA />
      </div>

      <div>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Option B — Master / detail</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px", maxWidth: 720 }}>
          Finish list on the left; click one to see its rooms on the right. Best when finishes have many rooms each
          and you want to focus on one finish at a time. (Mock shows LVT-1 selected.)
        </p>
        <OptionB />
      </div>
    </div>
  );
}
