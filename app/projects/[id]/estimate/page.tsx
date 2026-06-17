import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { computeBid, usd, pct, DEFAULT_SETTINGS } from "@/lib/estimate";
import { saveSettings } from "@/app/actions";
import { SyncSheetButton } from "@/components/sync-sheet-button";

export const dynamic = "force-dynamic";

const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const rcell: React.CSSProperties = { ...cell, textAlign: "right" };
const field: React.CSSProperties = { font: "inherit", fontSize: 15, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", width: "100%" };

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { finishes: true, takeoff: true, settings: true },
  });
  if (!project) notFound();

  const bid = computeBid(project.finishes, project.takeoff, project.settings);
  const s = project.settings ?? DEFAULT_SETTINGS;
  const saved = saveSettings.bind(null, id);
  const isMargin = s.profitPctMode === "margin";

  return (
    <main className="wrap">
      <SiteHeader action={<Link href={`/projects/${id}`} className="btn">Back to bid</Link>} />
      <div className="page-head">
        <h1 className="page-title">Bid preview</h1>
      </div>
      <p className="detail-meta">{project.name}</p>

      {/* the bid statement */}
      <section className="section">
        <div className="card" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
            <div>
              <div className="card-meta">Bid price</div>
              <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                {usd(bid.bidPrice)}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 14, color: "var(--muted)" }}>
              <div>Job cost <strong style={{ color: "var(--text)" }}>{usd(bid.pricedScopeCost)}</strong></div>
              <div>Elite profit <strong style={{ color: "var(--primary)" }}>{usd(bid.profit)}</strong></div>
              <div>{pct(bid.blendedMarkup)} markup · {pct(bid.blendedMargin)} margin</div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 18 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "right" }}>
                <th style={{ ...cell, textAlign: "left" }}></th>
                <th style={rcell}>Cost</th>
                <th style={rcell}>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>Material</td>
                <td style={rcell}>{usd(bid.jobMaterialCost)}</td>
                <td style={rcell}>{usd(bid.jobMaterialSell)}</td>
              </tr>
              <tr>
                <td style={cell}>Install (subcontracted)</td>
                <td style={rcell}>{usd(bid.jobInstallCost)}</td>
                <td style={rcell}>{usd(bid.jobInstallSell)}</td>
              </tr>
              <tr>
                <td style={cell}>Freight</td>
                <td style={rcell}>{usd(bid.freight)}</td>
                <td style={rcell}>{usd(bid.freight)}</td>
              </tr>
              <tr>
                <td style={{ ...cell, fontWeight: 600 }}>Tax</td>
                <td style={rcell}></td>
                <td style={{ ...rcell, fontWeight: 600 }}>{usd(bid.tax)}</td>
              </tr>
              <tr>
                <td style={{ ...cell, fontWeight: 700, borderBottom: "none" }}>Bid price</td>
                <td style={{ ...rcell, borderBottom: "none" }}></td>
                <td style={{ ...rcell, fontWeight: 700, borderBottom: "none" }}>{usd(bid.bidPrice)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {bid.warnings.length > 0 && (
          <ul className="hint" style={{ marginTop: 14 }}>
            {bid.warnings.map((w, i) => <li key={i} style={{ color: "#b45309" }}>⚠ {w}</li>)}
          </ul>
        )}
        <div style={{ marginTop: 16 }}>
          <SyncSheetButton projectId={id} sheetId={project.sheetId} />
        </div>
      </section>

      {/* line breakdown */}
      <section className="section">
        <h2 className="section-title">Lines</h2>
        <div className="card" style={{ padding: 0, display: "block", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "right" }}>
                <th style={{ ...cell, textAlign: "left" }}>Finish</th>
                <th style={rcell}>Material cost</th>
                <th style={rcell}>Sub fee</th>
                <th style={rcell}>Line cost</th>
                <th style={rcell}>Profit</th>
                <th style={rcell}>Line price</th>
              </tr>
            </thead>
            <tbody>
              {bid.lines.map((l) => (
                <tr key={l.code}>
                  <td style={{ ...cell, fontWeight: 600 }}>
                    {l.code}
                    {l.needsRate && <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309" }}>needs rate</span>}
                  </td>
                  <td style={rcell}>{usd(l.materialCost)}</td>
                  <td style={rcell}>{usd(l.installCost)}</td>
                  <td style={rcell}>{usd(l.lineCost)}</td>
                  <td style={{ ...rcell, color: "var(--primary)" }}>{usd(l.lineProfit)}</td>
                  <td style={{ ...rcell, fontWeight: 600 }}>{usd(l.lineSell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* pricing settings */}
      <section className="section">
        <h2 className="section-title">Pricing</h2>
        <form action={saved} className="form" style={{ maxWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <label>Pricing lens
              <select name="profitPctMode" defaultValue={s.profitPctMode} style={field}>
                <option value="margin">target margin (% of price)</option>
                <option value="markup">markup (% on cost)</option>
              </select>
            </label>
            <span />
            <label>Material {isMargin ? "margin" : "markup"} %
              <input name="materialProfitPct" type="number" step="0.01" defaultValue={s.materialProfitPct} style={field} />
            </label>
            <label>Install {isMargin ? "margin" : "markup"} %
              <input name="installProfitPct" type="number" step="0.01" defaultValue={s.installProfitPct} style={field} />
            </label>
            <label>Tax % <input name="taxPct" type="number" step="0.01" defaultValue={s.taxPct ?? 0} style={field} /></label>
            <label>Tax base
              <select name="taxMode" defaultValue={s.taxMode} style={field}>
                <option value="material_cost_only">material cost only</option>
                <option value="material_sell_only">material sell only</option>
                <option value="total_sell_plus_freight">total + freight</option>
              </select>
            </label>
            <label>Freight $ <input name="freight" type="number" step="0.01" defaultValue={s.freight ?? 0} style={field} /></label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Save pricing &amp; recompute</button>
          </div>
        </form>
        <p className="hint">
          Percentages as decimals (0.30 = 30%). Margin is % of the sale price; markup is % added to cost — they’re
          not equal (30% margin ≈ 43% markup). The Google Sheet stays the source of truth for the math.
        </p>
      </section>
    </main>
  );
}
