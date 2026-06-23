// MOCKUP / throwaway — Elite-branded theme comparison: black page vs white page, both with Elite red.
// View at /mockups/elite. Not wired to data. Safe to delete.

type Theme = {
  name: string;
  note: string;
  pageBg: string;
  headerInk: string;
  headerMuted: string;
  card: string;
  ink: string;
  muted: string;
  border: string;
  accent: string; // Elite red
  green: string;
  gold: string;
  cardShadow: string;
};

const ELITE_RED = "#ED1C24";

const THEMES: Theme[] = [
  {
    name: "A · Elite Black",
    note: "Near-black page (Elite's brand background), white tables that pop hard, red accent.",
    pageBg: "#0f1113",
    headerInk: "#ffffff",
    headerMuted: "#9aa3af",
    card: "#ffffff",
    ink: "#1b1f27",
    muted: "#586170",
    border: "#e4e7ec",
    accent: ELITE_RED,
    green: "#1a7d50",
    gold: "#9c7414",
    cardShadow: "0 8px 30px rgba(0,0,0,0.55)",
  },
  {
    name: "B · White",
    note: "Pure white page, white tables defined by a border + soft shadow, red accent.",
    pageBg: "#ffffff",
    headerInk: "#1b1f27",
    headerMuted: "#586170",
    card: "#ffffff",
    ink: "#1b1f27",
    muted: "#586170",
    border: "#e4e7ec",
    accent: ELITE_RED,
    green: "#1a7d50",
    gold: "#9c7414",
    cardShadow: "0 1px 2px rgba(20,24,32,0.06), 0 4px 16px rgba(20,24,32,0.06)",
  },
];

const ROWS = [
  { code: "WD-1", type: "floor", desc: "Wood athletic floor — gymnasium", unit: "SF", review: false },
  { code: "WD-2", type: "floor", desc: "Wood floor — stage/platform area", unit: "SF", review: false },
  { code: "CPT-1", type: "floor", desc: "Carpet — offices / meeting rooms", unit: "SF", review: false },
  { code: "EPX-1", type: "floor", desc: "Epoxy resin floor — locker rooms & restrooms", unit: "SF", review: false },
  { code: "VCT-1", type: "floor", desc: "Vinyl composition tile — corridors / break room", unit: "SF", review: false },
  { code: "VCT-2", type: "floor", desc: "Vinyl composition tile — corridors / break room", unit: "SF", review: false },
  { code: "SEALED-CONC", type: "floor", desc: "Sealed concrete floor — service areas", unit: "SF", review: false },
  { code: "RBT-1", type: "floor", desc: "Rubber tile flooring", unit: "SF", review: true },
  { code: "RB-1", type: "base", desc: "Resilient rubber wall base — typical", unit: "LF", review: false },
  { code: "PT-2", type: "other", desc: "Paint — wall finish (not flooring)", unit: "SF", review: true },
];

const mono = '"IBM Plex Mono", ui-monospace, monospace';

function Pill({ t, review }: { t: Theme; review: boolean }) {
  const c = review ? t.gold : t.green;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "3px 11px 3px 9px", borderRadius: 999, color: c, background: review ? "rgba(156,116,20,0.12)" : "rgba(26,125,80,0.12)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {review ? "Review" : "Ready"}
    </span>
  );
}

function Panel({ t }: { t: Theme }) {
  const th: React.CSSProperties = { textAlign: "left", padding: "11px 14px", borderBottom: `1px solid ${t.border}`, color: t.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: `1px solid ${t.border}`, color: t.ink, fontSize: 14, verticalAlign: "middle" };
  const btn: React.CSSProperties = { fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: "9px 16px", borderRadius: 9, border: "none", background: t.accent, color: "#fff", cursor: "pointer" };

  return (
    <div style={{ background: t.pageBg, borderRadius: 16, padding: "22px 24px 28px", border: "1px solid rgba(120,120,120,0.25)" }}>
      {/* header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: t.accent, display: "inline-grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>E</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: t.headerInk, letterSpacing: "-0.01em" }}>Beelite</div>
            <div style={{ fontSize: 11, color: t.headerMuted, letterSpacing: "0.04em" }}>ELITE INSTALLATION</div>
          </div>
        </div>
        <button style={btn}>New estimate</button>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: t.headerInk, marginBottom: 3 }}>Review 10 flooring finishes</div>
      <div style={{ fontSize: 13, color: t.headerMuted, marginBottom: 14 }}>The priced list Claude pulled from the schedule — edit any row, then confirm.</div>

      {/* white finishes table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", boxShadow: t.cardShadow }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 120 }} /><col style={{ width: 84 }} /><col /><col style={{ width: 64 }} /><col style={{ width: 64 }} /><col style={{ width: 104 }} /><col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>Code</th><th style={th}>Type</th><th style={th}>Description</th>
              <th style={{ ...th, textAlign: "center" }}>Unit</th><th style={{ ...th, textAlign: "center" }}>Scope</th><th style={{ ...th, textAlign: "center" }}>Status</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.code}>
                <td style={{ ...td, fontFamily: mono, fontWeight: 700, color: t.accent }}>{r.code}</td>
                <td style={{ ...td, color: t.muted, fontSize: 13 }}>{r.type}</td>
                <td style={td}>{r.desc}</td>
                <td style={{ ...td, textAlign: "center", fontFamily: mono }}>{r.unit}</td>
                <td style={{ ...td, textAlign: "center" }}><input type="checkbox" defaultChecked style={{ accentColor: t.accent, width: 16, height: 16 }} /></td>
                <td style={{ ...td, textAlign: "center" }}><Pill t={t} review={r.review} /></td>
                <td style={{ ...td, textAlign: "center", color: t.muted }}>✕</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <button style={btn}>Confirm 10 finishes</button>
      </div>
    </div>
  );
}

export default function EliteMockup() {
  return (
    <div style={{ background: "#2a2d31", minHeight: "100vh", padding: "40px 24px 90px", fontFamily: "system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap" />
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ color: "#fff", fontSize: 24, margin: "0 0 4px" }}>Elite-branded — two backgrounds</h1>
        <p style={{ color: "#aeb4bd", margin: "0 0 28px" }}>Same finishes table, Elite red accent (#ED1C24). Black page vs white page — pick the backdrop.</p>
        {THEMES.map((t) => (
          <section key={t.name} style={{ marginBottom: 30 }}>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>{t.name}</div>
            <div style={{ color: "#aeb4bd", fontSize: 14, margin: "2px 0 12px" }}>{t.note}</div>
            <Panel t={t} />
          </section>
        ))}
      </div>
    </div>
  );
}
