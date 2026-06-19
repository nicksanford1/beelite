import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { PermitSelectAll } from "@/components/permit-select-all";
import { CopyLeadsForClaude } from "@/components/permit-copy-for-claude";
import { setLeadStatus, setLeadStatusBulk } from "./actions";
import { unstable_cache } from "next/cache";

// Browse + triage the ingested City of New Orleans permits (NolaPermit). Filters drive a GET form so
// the table is shareable/bookmarkable; the per-row Save/Hide buttons are server-action forms that
// re-render in place. See docs/architecture.md (External lead source - NolaPermit).

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// The building-class dropdown options come from a groupBy that scans the whole 456k-row table — the
// heaviest of this page's concurrent queries (it triggered the connection-pool timeout). The set of
// classes changes rarely, so cache it for 10 min instead of re-scanning on every load.
const getPermitClasses = unstable_cache(
  async () => {
    const groups = await db.nolaPermit.groupBy({
      by: ["permitClassMapped"],
      _count: true,
      orderBy: { permitClassMapped: "asc" },
    });
    return groups.map((g) => g.permitClassMapped).filter((c): c is string => !!c);
  },
  ["permit-class-options"],
  { revalidate: 600 },
);

// The permit codes that carry flooring scope (any project that builds/renovates interior space).
// Shown as the curated checkbox set + the one-click preset. See the code catalog in chat history.
const FLOORING_CODES: { code: string; label: string }[] = [
  { code: "RNVN", label: "Renovation · non-structural" },
  { code: "RNVS", label: "Renovation · structural" },
  { code: "NEWC", label: "New construction" },
  { code: "CUSE", label: "Change of use" },
  { code: "DEMI", label: "Interior demolition" },
  { code: "ACCS", label: "Accessory structure" },
];
const PRESET_CODES = ["RNVN", "RNVS", "NEWC", "CUSE"]; // the strongest flooring leads
const FLOORING_CODE_VALUES = FLOORING_CODES.map((c) => c.code); // the curated set, applied by default

// Trade-only scope we never want in the flooring lead views: any permit whose description mentions
// these is hidden from every view/filter/count below. Substring, case-insensitive — "electric"
// catches electric / electrical / electrician. Add keywords here to hide more trades.
const HIDE_DESCRIPTION_KEYWORDS = ["electric"];

// Default min est. cost — hide small jobs (< $100k) unless the estimator opts back in via `min=0`.
const DEFAULT_MIN_COST = 100_000;
const MIN_COST_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any cost" },
  { value: 100_000, label: "$100k+" },
  { value: 250_000, label: "$250k+" },
  { value: 500_000, label: "$500k+" },
  { value: 1_000_000, label: "$1M+" },
];

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function fmtMoney(n: number | null) {
  if (n === null || n === undefined) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const all = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export default async function PermitsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const work = one(sp.work); // "" | "New" | "Existing"
  const cls = one(sp.cls); // permitClassMapped
  const codes = all(sp.code).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const view = one(sp.view) || "active"; // active | new | saved | dismissed | all
  // Minimum est. cost. Default $100k so small jobs are hidden; `min=0` shows everything.
  const minRaw = one(sp.min);
  const minCost = minRaw === "" ? DEFAULT_MIN_COST : parseInt(minRaw, 10) || 0;
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);

  const where: Prisma.NolaPermitWhereInput = {};
  // Always drop trade-only descriptions (electrical, etc.). Keep rows with no description — they
  // don't mention the keyword. AND-combines with the rest of the filters (incl. the search OR).
  where.AND = HIDE_DESCRIPTION_KEYWORDS.map((kw) => ({
    OR: [
      { description: null },
      { description: { not: { contains: kw }, mode: "insensitive" as const } },
    ],
  }));
  if (work) where.workClassMapped = work;
  if (cls) where.permitClassMapped = cls;
  // Default to the curated flooring codes when nothing is ticked, so SERV/HVAC/PLMB/etc. never
  // show up uninvited. Ticking boxes narrows to that selection instead.
  where.permitType = { in: codes.length ? codes : FLOORING_CODE_VALUES };
  if (minCost > 0) where.estProjectCost = { gte: minCost }; // nulls (unknown cost) drop out too
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { originalAddress1: { contains: q, mode: "insensitive" } },
      { permitNum: { contains: q, mode: "insensitive" } },
      { contractorCompanyName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (view === "active") where.leadStatus = { not: "dismissed" };
  else if (view !== "all") where.leadStatus = view; // new | saved | downloaded | dismissed

  const [rows, total, savedTotal, downloadedTotal, classes] = await Promise.all([
    db.nolaPermit.findMany({
      where,
      orderBy: { issueDate: { sort: "desc", nulls: "last" } },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.nolaPermit.count({ where }),
    db.nolaPermit.count({ where: { leadStatus: "saved" } }),
    db.nolaPermit.count({ where: { leadStatus: "downloaded" } }),
    getPermitClasses(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build query strings preserving the active filters (codes is multi-valued).
  const buildHref = (overrides: Record<string, string | number | string[] | undefined>) => {
    const params = new URLSearchParams();
    const set = {
      q,
      work,
      cls,
      view: view === "active" ? "" : view,
      // Keep min in the URL only when it differs from the default (incl. "0" to show all).
      min: minCost === DEFAULT_MIN_COST ? "" : String(minCost),
      page: page > 1 ? page : "",
      ...overrides,
    };
    if (set.q) params.set("q", String(set.q));
    if (set.work) params.set("work", String(set.work));
    if (set.cls) params.set("cls", String(set.cls));
    if (set.view) params.set("view", String(set.view));
    if (set.min !== "" && set.min !== undefined) params.set("min", String(set.min));
    const codeList = (overrides.code as string[]) ?? codes;
    codeList.forEach((c) => params.append("code", c));
    if (set.page) params.set("page", String(set.page));
    const s = params.toString();
    return s ? `/permits?${s}` : "/permits";
  };
  const pageHref = (p: number) => buildHref({ page: p > 1 ? p : "" });
  const hasFilters = !!(q || work || cls || codes.length || view !== "active" || minCost !== DEFAULT_MIN_COST);

  return (
    <main className="wrap-wide">
      <SiteHeader
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/" className="btn">Bids</Link>
            <Link href="/library" className="btn">Standard rates</Link>
          </div>
        }
      />

      <div className="page-head">
        <h1 className="page-title">NOLA permits</h1>
        <span className="page-count">
          <span className="mono">{total.toLocaleString("en-US")}</span> match
          {hasFilters ? " filters" : " (all)"}
          {" · "}
          <Link href={buildHref({ view: "saved", code: codes, page: "" })} style={{ color: "var(--marking)", fontWeight: 600 }}>
            <span className="mono">{savedTotal.toLocaleString("en-US")}</span> saved ⚑
          </Link>
          {" · "}
          <Link href={buildHref({ view: "downloaded", code: codes, page: "" })} style={{ color: "var(--ok, #6bbf73)", fontWeight: 600 }}>
            <span className="mono">{downloadedTotal.toLocaleString("en-US")}</span> plans ⬇
          </Link>
        </span>
      </div>

      {/* Quick presets — first one is "home"; the current view is highlighted so you always know
          where you are and how to get back. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Link className={`btn${view === "active" && !codes.length && !work ? " btn-primary" : ""}`} href="/permits">
          🏠 All active leads
        </Link>
        <Link className="btn" href={buildHref({ code: PRESET_CODES, view: "", page: "" })}>
          ⚑ Flooring-relevant codes
        </Link>
        <Link className="btn" href={buildHref({ code: PRESET_CODES, work: "New", view: "", page: "" })}>
          🏗 New construction only
        </Link>
        <Link className={`btn${view === "saved" ? " btn-primary" : ""}`} href={buildHref({ view: "saved", code: [], page: "" })}>
          ⭐ My saved leads
        </Link>
      </div>

      {/* GET form → filters live in the URL (shareable / bookmarkable, server-rendered) */}
      <form className="filters" method="get" action="/permits">
        <label className="filter-field grow">
          <span>Search · description, address, permit #, contractor</span>
          <input type="text" name="q" defaultValue={q} placeholder="e.g. duplex, Magazine St, daycare, 26-08606-NEWC" />
        </label>

        <label className="filter-field">
          <span>Work class</span>
          <select name="work" defaultValue={work}>
            <option value="">All</option>
            <option value="New">New construction</option>
            <option value="Existing">Existing</option>
          </select>
        </label>

        <label className="filter-field">
          <span>Building class</span>
          <select name="cls" defaultValue={cls}>
            <option value="">All</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Min est. cost</span>
          <select name="min" defaultValue={String(minCost)}>
            {MIN_COST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Lead status</span>
          <select name="view" defaultValue={view}>
            <option value="active">Active (hide dismissed)</option>
            <option value="new">New / untriaged</option>
            <option value="saved">Saved ⚑</option>
            <option value="downloaded">Plans downloaded ⬇</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </label>

        <fieldset className="code-checks">
          <span>Permit codes</span>
          <div className="code-grid">
            {FLOORING_CODES.map((c) => (
              <label key={c.code} className="code-check">
                <input type="checkbox" name="code" value={c.code} defaultChecked={codes.includes(c.code)} />
                <span className="code-chip">{c.code}</span>
                <span className="code-check-label">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="filter-actions">
          <button type="submit" className="btn btn-primary">Apply</button>
          {hasFilters && <Link href="/permits" className="btn">Reset</Link>}
        </div>
      </form>

      {/* Bulk triage bar — the row checkboxes below submit into this form via form="bulkTriage". */}
      <form id="bulkTriage" action={setLeadStatusBulk} className="bulk-bar">
        <span className="bulk-label">With selected:</span>
        <button type="submit" name="status" value="saved" className="btn-mini save">⚑ Save</button>
        <button type="submit" name="status" value="downloaded" className="btn-mini plans">⬇ Plans</button>
        <button type="submit" name="status" value="dismissed" className="btn-mini hide">✕ Hide</button>
        <button type="submit" name="status" value="new" className="btn-mini reset">↺ Reset</button>
        <span className="bulk-sep" aria-hidden="true" />
        <CopyLeadsForClaude />
      </form>

      <div className="table-wrap">
        <table className="ptable">
          <thead>
            <tr>
              <th className="check-col"><PermitSelectAll /></th>
              <th>Lead</th>
              <th>Code</th>
              <th>Work</th>
              <th className="addr">Address</th>
              <th className="desc">Description</th>
              <th>Building class</th>
              <th style={{ textAlign: "right" }}>Est. cost</th>
              <th>Issued</th>
              <th>Plans</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
                  No permits match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} data-lead={r.leadStatus}>
                  <td className="check-col">
                    <input
                      type="checkbox"
                      name="ids"
                      value={r.id}
                      form="bulkTriage"
                      data-permit={r.permitNum}
                      data-addr={r.originalAddress1 ?? ""}
                      aria-label="Select this permit"
                    />
                  </td>
                  <td>
                    <details className={`lead-menu ${r.leadStatus}`}>
                      <summary className="lead-menu-btn" title="Triage this lead">
                        {r.leadStatus === "saved"
                          ? "⚑ Saved"
                          : r.leadStatus === "downloaded"
                            ? "⬇ Plans"
                            : r.leadStatus === "dismissed"
                              ? "Hidden"
                              : "Triage"}
                        <span className="caret">▾</span>
                      </summary>
                      <div className="lead-menu-pop">
                        {r.leadStatus !== "saved" && (
                          <form action={setLeadStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="saved" />
                            <button type="submit" className="btn-mini save" title="Good lead — save to scrape later">⚑ Save</button>
                          </form>
                        )}
                        {r.leadStatus !== "downloaded" && (
                          <form action={setLeadStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="downloaded" />
                            <button type="submit" className="btn-mini plans" title="Plans pulled from the portal">⬇ Plans downloaded</button>
                          </form>
                        )}
                        {r.leadStatus !== "dismissed" && (
                          <form action={setLeadStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="dismissed" />
                            <button type="submit" className="btn-mini hide" title="No good — hide this lead">✕ Hide</button>
                          </form>
                        )}
                        {r.leadStatus !== "new" && (
                          <form action={setLeadStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="new" />
                            <button type="submit" className="btn-mini reset" title="Undo — back to untriaged">↺ Reset</button>
                          </form>
                        )}
                      </div>
                    </details>
                  </td>
                  <td>{r.permitType ? <span className="code-chip">{r.permitType}</span> : "—"}</td>
                  <td className={r.workClassMapped === "New" ? "work-new" : undefined}>{r.workClassMapped ?? "—"}</td>
                  <td className="addr">
                    {r.originalAddress1 ?? "—"}
                    {r.originalZip ? <span style={{ color: "var(--muted)" }}> · {r.originalZip}</span> : null}
                  </td>
                  <td className="desc">
                    {r.description ? (
                      <>
                        <span className="desc-text">{r.description}</span>
                        <span className="desc-tip">{r.description}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{r.permitClass ?? "—"}</td>
                  <td className="num">{fmtMoney(r.estProjectCost)}</td>
                  <td className="mono" style={{ color: "var(--muted)" }}>{fmtDate(r.issueDate)}</td>
                  <td>
                    {r.link ? (
                      <a className="portal-link" href={r.link} target="_blank" rel="noopener noreferrer">Portal ↗</a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="pager-info">
          Page <span className="mono">{page}</span> of <span className="mono">{totalPages.toLocaleString("en-US")}</span>
          {total > 0 && (
            <>
              {" · "}showing{" "}
              <span className="mono">{((page - 1) * PAGE_SIZE + 1).toLocaleString("en-US")}</span>–
              <span className="mono">{Math.min(page * PAGE_SIZE, total).toLocaleString("en-US")}</span>
            </>
          )}
        </span>
        <div className="pager-btns">
          <Link className="btn" href={pageHref(page - 1)} aria-disabled={page <= 1}>← Prev</Link>
          <Link className="btn" href={pageHref(page + 1)} aria-disabled={page >= totalPages}>Next →</Link>
        </div>
      </div>
    </main>
  );
}
