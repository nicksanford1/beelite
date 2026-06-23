// MOCKUP / throwaway — color & identity directions for Beelite. Not wired to data.
// Same components rendered in 3 palettes so they compare fairly. View at /mockups/theme.

type Theme = {
  id: string;
  name: string;
  rationale: string;
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string; // money + active
  accentInk: string; // text on accent
  confirm: string; // ready / synced
  display: string;
  body: string;
  mono: string;
};

const THEMES: Theme[] = [
  {
    id: "daybook",
    name: "A · Daybook",
    rationale: "Warm manila paper, technical ink, surveyor-red for the money. The worktable in daylight.",
    bg: "#EFE7D6",
    surface: "#FBF8F0",
    surface2: "#F4EEDF",
    ink: "#232A21",
    muted: "#6E7567",
    line: "#DDD3BD",
    accent: "#D8482E",
    accentInk: "#FFFFFF",
    confirm: "#2E6F5E",
    display: '"Archivo", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"Spline Sans Mono", ui-monospace, monospace',
  },
  {
    id: "material",
    name: "B · Material",
    rationale: "Concrete grey, swatch white, safety amber. Palette pulled from the flooring itself and jobsite signage.",
    bg: "#E5E3DD",
    surface: "#FFFFFF",
    surface2: "#F0EEE8",
    ink: "#211F1B",
    muted: "#85817A",
    line: "#D5D2CA",
    accent: "#E8991B",
    accentInk: "#1A1300",
    confirm: "#0E7C68",
    display: '"Saira Condensed", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  {
    id: "blueprint",
    name: "C · Blueprint, refined",
    rationale: "Your dark concept, executed properly: deeper navy, hairline rules, orange-on-blue with intent.",
    bg: "#0A1019",
    surface: "#121C27",
    surface2: "#1A2735",
    ink: "#E9EFF5",
    muted: "#8DA0B2",
    line: "#233340",
    accent: "#F26A3F",
    accentInk: "#FFFFFF",
    confirm: "#4FB68C",
    display: '"IBM Plex Sans", system-ui, sans-serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
];

const FINISHES = [
  { code: "LVT-1", desc: "LVT — warm oak plank", qty: "4,820", unit: "SF", status: "ready" },
  { code: "CPT-2", desc: "Carpet tile — charcoal loop", qty: "612", unit: "SY", status: "review" },
  { code: "PT-1", desc: "Porcelain — matte slate", qty: "340", unit: "SF", status: "ready" },
];

function Mark({ t }: { t: Theme }) {
  // Simple geometric mark — a measured corner bracket, not a logo commitment.
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: t.accent,
          display: "inline-block",
          position: "relative",
        }}
      >
        <span style={{ position: "absolute", inset: 6, border: `2px solid ${t.accentInk}`, borderRadius: 2, opacity: 0.9 }} />
      </span>
      <span style={{ fontFamily: t.display, fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", color: t.ink }}>
        Beelite
      </span>
    </span>
  );
}

function Pill({ t, kind }: { t: Theme; kind: "ready" | "review" | "synced" }) {
  const map = {
    ready: { c: t.confirm, label: "Ready" },
    review: { c: t.accent, label: "Review" },
    synced: { c: t.confirm, label: "Synced" },
  } as const;
  const { c, label } = map[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: t.body,
        fontSize: 12,
        fontWeight: 600,
        color: c,
        border: `1px solid ${c}`,
        borderRadius: 999,
        padding: "3px 10px",
        background: "transparent",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {label}
    </span>
  );
}

function AppPreview({ t }: { t: Theme }) {
  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: t.body,
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: 8,
    cursor: "pointer",
    border: primary ? "none" : `1px solid ${t.line}`,
    background: primary ? t.accent : t.surface,
    color: primary ? t.accentInk : t.ink,
  });
  const cell: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: `1px solid ${t.line}`,
    textAlign: "left",
    fontFamily: t.body,
    fontSize: 13.5,
    color: t.ink,
  };
  const thc: React.CSSProperties = {
    ...cell,
    color: t.muted,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ background: t.bg, padding: "26px 28px 30px", borderRadius: 14, border: `1px solid ${t.line}` }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Mark t={t} />
          <nav style={{ display: "flex", gap: 18, fontFamily: t.body, fontSize: 14 }}>
            <span style={{ color: t.ink, fontWeight: 600, borderBottom: `2px solid ${t.accent}`, paddingBottom: 4 }}>Projects</span>
            <span style={{ color: t.muted, paddingBottom: 4 }}>Rates</span>
            <span style={{ color: t.muted, paddingBottom: 4 }}>Library</span>
          </nav>
        </div>
        <button style={btn(true)}>New estimate</button>
      </div>

      {/* Body grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16 }}>
        {/* Project / bid total card — the hero is the money */}
        <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: t.muted }}>
            Riverside Medical · Fit-out
          </div>
          <div style={{ fontFamily: t.body, fontSize: 13, color: t.muted, marginTop: 2 }}>New Orleans, LA · 10 sheets</div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: t.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.accent }}>
              Bid total
            </div>
            <div
              style={{
                fontFamily: t.mono,
                fontSize: 40,
                fontWeight: 600,
                color: t.ink,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              $15,205<span style={{ color: t.muted }}>.54</span>
            </div>
            {/* signature: highlighter mark under the money */}
            <div style={{ height: 5, width: 168, background: t.accent, opacity: 0.85, borderRadius: 2, marginTop: 6 }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button style={btn(true)}>Open sheet</button>
            <button style={btn(false)}>Review finishes</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Pill t={t} kind="synced" />
            <Pill t={t} kind="review" />
          </div>
        </div>

        {/* Finishes mini table */}
        <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", fontFamily: t.display, fontWeight: 700, fontSize: 15, color: t.ink }}>
            Finishes
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thc}>Code</th>
                <th style={thc}>Material</th>
                <th style={{ ...thc, textAlign: "right" }}>Qty</th>
                <th style={thc}>Status</th>
              </tr>
            </thead>
            <tbody>
              {FINISHES.map((f) => (
                <tr key={f.code}>
                  <td style={{ ...cell, fontFamily: t.mono, fontWeight: 600, color: t.confirm }}>{f.code}</td>
                  <td style={cell}>{f.desc}</td>
                  <td style={{ ...cell, fontFamily: t.mono, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {f.qty} <span style={{ color: t.muted, fontSize: 11 }}>{f.unit}</span>
                  </td>
                  <td style={cell}>
                    <Pill t={t} kind={f.status === "ready" ? "ready" : "review"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ThemeMockup() {
  return (
    <div style={{ background: "#0d1620", minHeight: "100vh" }}>
      {/* Load the display/body/mono faces used across the directions */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Saira+Condensed:wght@500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
      />
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "44px 24px 90px", color: "#e6ecf2", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Beelite — identity & color directions</h1>
        <p style={{ color: "#93a3b4", margin: "0 0 8px", maxWidth: 720 }}>
          Same components in three palettes. The bid total ($15,205.54) is your canonical regression number, used as the hero
          so you can judge how the money reads in each. Desktop mock.
        </p>

        {THEMES.map((t) => (
          <section key={t.id} style={{ marginTop: 40 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.name}</div>
              <div style={{ color: "#93a3b4", fontSize: 14, maxWidth: 720 }}>{t.rationale}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {[t.bg, t.surface, t.ink, t.accent, t.confirm].map((c) => (
                  <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#93a3b4", fontFamily: "monospace" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: c, border: "1px solid #2b3a49", display: "inline-block" }} />
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <AppPreview t={t} />
          </section>
        ))}
      </div>
    </div>
  );
}
