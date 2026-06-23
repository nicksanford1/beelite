// MOCKUP / throwaway — page-background + typography directions. White tables on a colored page.
// Not wired to data. View at /mockups/bg. Safe to delete.

type Theme = {
  id: string;
  name: string;
  blurb: string;
  pageBg: string; // the page behind the tables
  ink: string;
  muted: string;
  border: string; // table hairlines + card border
  accent: string; // money / active
  code: string; // finish-code color
  green: string;
  gold: string;
  body: string;
  display: string;
  base: number; // base font size
};

const THEMES: Theme[] = [
  {
    id: "slate",
    name: "1 · Slate",
    blurb: "Cool light-gray page, white tables, Inter. Crisp and software-clean — maximum legibility, no color cast.",
    pageBg: "#eceff3",
    ink: "#1b2430",
    muted: "#586472",
    border: "#e3e8ee",
    accent: "#c2491f",
    code: "#235b96",
    green: "#1a7d50",
    gold: "#946c10",
    body: '"Inter", system-ui, sans-serif',
    display: '"Inter", system-ui, sans-serif',
    base: 15,
  },
  {
    id: "blueprint",
    name: "2 · Blueprint sky",
    blurb: "Faint blue page (a nod to the plans), white tables, IBM Plex Sans set bigger and heavier. On-brand and clear.",
    pageBg: "#e8eef6",
    ink: "#172433",
    muted: "#54616f",
    border: "#dde5ee",
    accent: "#cc4c24",
    code: "#1f5a93",
    green: "#1a7d50",
    gold: "#946c10",
    body: '"IBM Plex Sans", system-ui, sans-serif',
    display: '"IBM Plex Sans", system-ui, sans-serif',
    base: 15.5,
  },
  {
    id: "warm",
    name: "3 · Warm near-white",
    blurb: "Much lighter warm page (fixes the muddy gray), white tables, Archivo headers + Inter body, set large.",
    pageBg: "#f6f3ed",
    ink: "#201d18",
    muted: "#6a6356",
    border: "#e8e2d6",
    accent: "#c8471f",
    code: "#9a5a1e",
    green: "#1a7d50",
    gold: "#8a6410",
    body: '"Inter", system-ui, sans-serif',
    display: '"Archivo", system-ui, sans-serif',
    base: 16,
  },
];

const FINISHES = [
  { code: "STONE", app: "floor", desc: "Stone tile flooring", unit: "SF", used: "1 room", sheet: "A-111", review: false },
  { code: "TILE-FLOOR", app: "floor", desc: "Tile flooring used in toilet rooms", unit: "SF", used: "2 rooms", sheet: "A-111", review: false },
  { code: "TILE-BASE", app: "base", desc: "Tile base used in toilet rooms (1st floor)", unit: "LF", used: "2 rooms", sheet: "A-111", review: true },
  { code: "LVT-1", app: "floor", desc: "Luxury vinyl tile — warm oak plank", unit: "SF", used: "5 rooms", sheet: "A-6.1, A-6.2", review: false },
  { code: "CPT-2", app: "floor", desc: "Carpet tile — charcoal loop", unit: "SY", used: "3 rooms", sheet: "A-6.2", review: true },
];

const RATES = [
  { code: "STONE", desc: "Stone tile", mat: "12.40", install: "6.50", waste: "8%", source: "Elite furnishes" },
  { code: "TILE-FLOOR", desc: "Tile flooring", mat: "5.80", install: "4.25", waste: "10%", source: "Elite furnishes" },
  { code: "LVT-1", desc: "LVT — warm oak", mat: "3.95", install: "2.10", waste: "8%", source: "Elite furnishes" },
  { code: "CPT-2", desc: "Carpet tile", mat: "28.00", install: "7.00", waste: "5%", source: "Owner furnishes" },
];

function Tables({ t }: { t: Theme }) {
  const mono = '"IBM Plex Mono", ui-monospace, monospace';
  const card: React.CSSProperties = {
    background: "#fff",
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(20,24,32,0.04), 0 1px 3px rgba(20,24,32,0.05)",
  };
  const cap: React.CSSProperties = {
    fontFamily: t.display,
    fontWeight: 700,
    fontSize: t.base + 4,
    color: t.ink,
    padding: "15px 16px 11px",
    letterSpacing: "-0.01em",
  };
  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 14px",
    borderBottom: `1px solid ${t.border}`,
    borderTop: `1px solid ${t.border}`,
    color: t.muted,
    fontSize: 11.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "#fff",
  };
  const td: React.CSSProperties = {
    padding: "11px 14px",
    borderBottom: `1px solid ${t.border}`,
    color: t.ink,
    fontSize: t.base,
  };
  const codePill: React.CSSProperties = {
    fontFamily: mono,
    fontWeight: 700,
    fontSize: t.base - 1,
    color: t.code,
  };
  const tag = (review: boolean): React.CSSProperties => ({ color: review ? t.gold : t.green, fontWeight: 700, fontSize: t.base - 1 });
  const center: React.CSSProperties = { textAlign: "center" };
  const num: React.CSSProperties = { fontFamily: mono, fontVariantNumeric: "tabular-nums", textAlign: "right" };

  return (
    <div style={{ display: "grid", gap: 18, fontFamily: t.body }}>
      {/* Finishes */}
      <div style={card}>
        <div style={cap}>Finishes</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Code</th>
              <th style={th}>Description</th>
              <th style={{ ...th, ...center }}>Unit</th>
              <th style={{ ...th, ...center }}>Used in</th>
              <th style={{ ...th, ...center }}>Scope</th>
              <th style={{ ...th, ...center }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {FINISHES.map((f, i) => (
              <tr key={i} style={f.review ? { background: "#fdf6e9" } : undefined}>
                <td style={td}>
                  <div style={codePill}>{f.code}</div>
                  <div style={{ color: t.muted, fontSize: t.base - 3, marginTop: 2 }}>{f.app}</div>
                </td>
                <td style={td}>{f.desc}</td>
                <td style={{ ...td, ...center }}>{f.unit}</td>
                <td style={{ ...td, ...center }}>
                  <div>{f.used}</div>
                  <div style={{ fontFamily: mono, fontSize: t.base - 3.5, color: t.muted, marginTop: 2 }}>{f.sheet}</div>
                </td>
                <td style={{ ...td, ...center, color: t.green, fontWeight: 700 }}>✓</td>
                <td style={{ ...td, ...center }}>
                  <span style={tag(f.review)}>{f.review ? "Review" : "Ready"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rates */}
      <div style={card}>
        <div style={cap}>Rates</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Code</th>
              <th style={th}>Description</th>
              <th style={{ ...th, textAlign: "right" }}>Material $/unit</th>
              <th style={{ ...th, textAlign: "right" }}>Install $/unit</th>
              <th style={{ ...th, ...center }}>Waste</th>
              <th style={th}>Source</th>
            </tr>
          </thead>
          <tbody>
            {RATES.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, ...codePill }}>{r.code}</td>
                <td style={td}>{r.desc}</td>
                <td style={{ ...td, ...num }}>
                  <span style={{ color: t.muted }}>$</span>
                  {r.mat}
                </td>
                <td style={{ ...td, ...num }}>
                  <span style={{ color: t.muted }}>$</span>
                  {r.install}
                </td>
                <td style={{ ...td, ...center, fontFamily: mono }}>{r.waste}</td>
                <td style={{ ...td, color: t.muted }}>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BgMockup() {
  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", color: "#1b2430", fontFamily: "system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 22px 90px" }}>
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Background + typography directions</h1>
        <p style={{ color: "#586472", margin: "0 0 8px", maxWidth: 720 }}>
          White Finishes and Rates tables on three different page backgrounds, each with its own type treatment. Judge which
          page color reads best behind the white tables.
        </p>

        {THEMES.map((t) => (
          <section key={t.id} style={{ marginTop: 34 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.name}</div>
              <div style={{ color: "#586472", fontSize: 14, maxWidth: 760 }}>{t.blurb}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", fontSize: 11, color: "#586472", fontFamily: "monospace" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: t.pageBg, border: "1px solid #ccc", display: "inline-block" }} />
                page {t.pageBg}
                <span style={{ width: 16, height: 16, borderRadius: 4, background: "#fff", border: "1px solid #ccc", display: "inline-block", marginLeft: 10 }} />
                table #ffffff
              </div>
            </div>
            {/* the band IS the page background */}
            <div style={{ background: t.pageBg, borderRadius: 16, padding: "22px 22px 26px", border: "1px solid #e2e2e2" }}>
              <Tables t={t} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
