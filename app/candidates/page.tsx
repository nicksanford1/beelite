import { db } from "@/lib/db";
import { setCandidateStatus } from "./actions";

export const dynamic = "force-dynamic";

// Building-type buckets, inferred from the permit description (NolaPermit has no use-type field).
// First match wins, so order from most-specific to least.
// Order matters: first match wins. Residential / mixed-use is checked BEFORE Recreation so a tower
// that merely lists a "fitness center" amenity classifies as Multifamily, not as a gym.
const TYPES: { key: string; label: string; kw: string[] }[] = [
  { key: "medical", label: "Medical", kw: ["hospital", "clinic", "medical", "dental", "surger", "healthcare", "patient"] },
  { key: "hotel", label: "Hotel", kw: ["hotel", "motel", " inn", "hospitality", "guest room"] },
  { key: "education", label: "Education", kw: ["school", "classroom", "universit", "education", "academy", "daycare", "childcare", "college"] },
  { key: "multifamily", label: "Multifamily", kw: ["apartment", "multifamily", "multi-family", "mixed-use", "mixed use", "condo", "dwelling", "residential"] },
  { key: "retail_food", label: "Retail / Food", kw: ["retail", "store ", "restaurant", "cafe", "mercantile", "grocery"] },
  { key: "recreation", label: "Recreation / Gym", kw: ["gymnasium", "gym ", "ymca", "natatorium", "field house", "fieldhouse", "athletic complex", "athletic facilit", "recreation cent", "rec center", "wellness cent", "fitness cent"] },
  { key: "warehouse_ind", label: "Warehouse / Industrial", kw: ["warehouse", "industrial", "manufactur", "distribution", "storage"] },
  { key: "office", label: "Office", kw: ["office", "tenant", "corporate", "professional"] },
  { key: "assembly", label: "Assembly", kw: ["church", "worship", "theater", "theatre", "assembly", "museum"] },
];

const PREVIEW = 6; // cards shown before the "show more" expander

function classify(desc: string | null): string | null {
  const d = (desc ?? "").toLowerCase();
  for (const t of TYPES) if (t.kw.some((w) => d.includes(w))) return t.key;
  return null;
}

const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());
const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

type Row = {
  id: string;
  description: string | null;
  originalAddress1: string | null;
  originalZip: string | null;
  totalSqFt: number | null;
  estProjectCost: number | null;
  link: string | null;
  leadStatus: string;
};

const chip: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--primary)",
  background: "var(--primary-soft)",
  borderRadius: 999,
  padding: "3px 10px",
};

function Card({ r, label }: { r: Row; label: string }) {
  const isSaved = r.leadStatus === "saved";
  const isDismissed = r.leadStatus === "dismissed";
  return (
    <div
      style={{
        border: `1px solid ${isSaved ? "var(--marking)" : "var(--border)"}`,
        borderRadius: 12,
        background: "var(--surface)",
        padding: "14px 16px",
        boxShadow: "var(--shadow-sm)",
        opacity: isDismissed ? 0.5 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={chip}>{label}</span>
        <span className="mono" style={{ fontWeight: 700, color: "var(--marking)", fontSize: 15 }}>
          {usd(r.estProjectCost)}
        </span>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--text)" }}>
        {(r.description ?? "No description").replace(/^work descript?on:\s*/i, "").slice(0, 150)}
        {(r.description ?? "").length > 150 ? "…" : ""}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="mono">{num(r.totalSqFt)} SF</span>
        <span aria-hidden>·</span>
        <span>
          {r.originalAddress1 ?? "No address"}
          {r.originalZip ? `, ${r.originalZip}` : ""}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {r.link && (
          <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
            View permit &amp; plans ↗
          </a>
        )}
        <span style={{ flex: 1 }} />
        {isSaved ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--marking)" }}>✓ Saved</span>
            <form action={setCandidateStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="new" />
              <button type="submit" className="btn-mini reset">Undo</button>
            </form>
          </>
        ) : (
          <>
            <form action={setCandidateStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="saved" />
              <button type="submit" className="btn-mini save">Save</button>
            </form>
            <form action={setCandidateStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={isDismissed ? "new" : "dismissed"} />
              <button type="submit" className="btn-mini reset">{isDismissed ? "Restore" : "Skip"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 };

export default async function CandidatesPage() {
  // Gate on cost + having a plans link only. The totalSqFt column is sparsely populated (square
  // footage usually lives in the description, not this field), so requiring it here silently hid
  // good projects — e.g. most standalone gymnasiums. Show SF when present, ignore it when not.
  const rows: Row[] = await db.nolaPermit.findMany({
    where: { estProjectCost: { gte: 100000 }, link: { not: null } },
    orderBy: { estProjectCost: "desc" },
    take: 5000,
    select: {
      id: true,
      description: true,
      originalAddress1: true,
      originalZip: true,
      totalSqFt: true,
      estProjectCost: true,
      link: true,
      leadStatus: true,
    },
  });

  const byType = new Map<string, Row[]>();
  for (const r of rows) {
    const k = classify(r.description);
    if (!k) continue;
    (byType.get(k) ?? byType.set(k, []).get(k)!).push(r);
  }
  const savedCount = rows.filter((r) => r.leadStatus === "saved").length;

  return (
    <div className="wrap-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Test candidates</h1>
          <p className="detail-meta" style={{ margin: "2px 0 0" }}>
            Click through to the NOLA portal to eyeball the plans, then Save the ones you want to test. Aim for a few
            different types — you only need ~6.
          </p>
        </div>
        <span className="page-count">{savedCount} saved</span>
      </div>

      <div
        style={{
          margin: "8px 0 26px",
          padding: "12px 16px",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--marking)",
          borderRadius: 10,
          background: "var(--surface)",
          fontSize: 14,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--text)" }}>How this works:</strong> Saved candidates flow straight into the intake
        pipeline — run <code style={{ fontFamily: "var(--font-mono)" }}>npm run nola:docs</code> to scrape their plans, then{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>npm run nola:intake</code> to import them as projects. Then I take
        over: view each PDF, find the finish-schedule sheets, run the read, and verify it.
      </div>

      {TYPES.map((t) => {
        const bucket = byType.get(t.key) ?? [];
        if (bucket.length === 0) return null;
        // Saved first so a confirmed pick is always in the preview, then by cost (query order).
        const ordered = [...bucket.filter((r) => r.leadStatus === "saved"), ...bucket.filter((r) => r.leadStatus !== "saved")];
        const headN = Math.max(PREVIEW, ordered.filter((r) => r.leadStatus === "saved").length);
        const head = ordered.slice(0, headN);
        const more = ordered.slice(headN);

        return (
          <section key={t.key} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 10 }}>
              {t.label}
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>{bucket.length}</span>
            </h2>

            <div style={grid}>
              {head.map((r) => (
                <Card key={r.id} r={r} label={t.label} />
              ))}
            </div>

            {more.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary
                  style={{ listStyle: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--primary)", display: "inline-block", padding: "4px 0" }}
                >
                  ▾ Show {more.length} more {t.label.toLowerCase()}
                </summary>
                <div style={{ ...grid, marginTop: 12 }}>
                  {more.map((r) => (
                    <Card key={r.id} r={r} label={t.label} />
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
