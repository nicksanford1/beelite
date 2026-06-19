import type { ProjectFinish, TakeoffLine, EstimateSettings } from "@prisma/client";

// In-app bid PREVIEW. Mirrors docs/contracts/pricing-v5.md (the Google Sheet stays the authoritative
// calculator; this is the read-only preview). Cost → Sell → Profit → Bid price.

export type BidLine = {
  code: string;
  takeoffQty: number;
  orderQty: number;
  materialSource: string;
  materialCost: number;
  installCost: number;
  lineCost: number;
  materialSell: number;
  installSell: number;
  lineSell: number;
  lineProfit: number;
  needsRate: boolean;
};

export type BidResult = {
  lines: BidLine[];
  jobMaterialCost: number;
  jobInstallCost: number;
  pricedScopeCost: number;
  jobMaterialSell: number;
  jobInstallSell: number;
  jobSell: number;
  profit: number;
  blendedMarkup: number | null; // null when cost is 0 (avoid div-by-zero)
  blendedMargin: number | null; // null when sell is 0
  freight: number;
  totalCostInclFreight: number;
  tax: number;
  bidPrice: number;
  warnings: string[];
};

export const DEFAULT_SETTINGS = {
  profitPctMode: "margin",
  materialProfitPct: 0.25,
  installProfitPct: 0.3,
  taxPct: 0.08,
  taxMode: "total_sell_plus_freight",
  freight: 0,
};

type Settings = Pick<
  EstimateSettings,
  "profitPctMode" | "materialProfitPct" | "installProfitPct" | "taxPct" | "taxMode" | "freight"
>;

// cost → sell. markup: cost*(1+pct); margin: cost/(1-pct). Guard pct out of range (Codex #2).
function sell(cost: number, pct: number, mode: string): number {
  const p = pct ?? 0;
  if (mode === "margin") {
    if (p >= 1 || p < 0) return cost; // invalid margin — fall back to cost, app/Sheet flag it
    return cost / (1 - p);
  }
  return cost * (1 + Math.max(0, p));
}

export function computeBid(
  finishes: ProjectFinish[],
  takeoff: TakeoffLine[],
  settings: Settings | null
): BidResult {
  const s = (settings ?? DEFAULT_SETTINGS) as Settings;
  const mode = s.profitPctMode ?? "margin";
  const mp = s.materialProfitPct ?? 0;
  const ip = s.installProfitPct ?? 0;
  const warnings: string[] = [];
  const lines: BidLine[] = [];
  let needsRateCount = 0;

  for (const f of finishes.filter((f) => f.inScope)) {
    const qty = takeoff
      .filter((t) => t.finishCode === f.code && t.status === "approved")
      .reduce((a, t) => a + t.qty, 0);

    const orderRaw = qty * (1 + (f.wastePct ?? 0));
    const carton = f.cartonSize ?? 0;
    const orderQty = carton > 0 ? Math.ceil(orderRaw / carton) * carton : orderRaw;

    const ownerFurnishes = f.materialSource === "owner_furnishes";
    const materialCost = ownerFurnishes ? 0 : orderQty * (f.materialUnitCost ?? 0);
    const installCost = qty * (f.installRate ?? 0); // install on approved qty, not over-order

    const materialSell = ownerFurnishes ? 0 : sell(materialCost, mp, mode);
    const installSell = sell(installCost, ip, mode);

    // effective needs-rate: material rate missing (when Elite furnishes) or install rate missing
    const needsRate = (!ownerFurnishes && (f.materialUnitCost ?? 0) <= 0) || (f.installRate ?? 0) <= 0;
    if (needsRate) needsRateCount++;

    lines.push({
      code: f.code,
      takeoffQty: qty,
      orderQty,
      materialSource: f.materialSource,
      materialCost,
      installCost,
      lineCost: materialCost + installCost,
      materialSell,
      installSell,
      lineSell: materialSell + installSell,
      lineProfit: materialSell + installSell - materialCost - installCost,
      needsRate,
    });
  }

  const jobMaterialCost = lines.reduce((a, l) => a + l.materialCost, 0);
  const jobInstallCost = lines.reduce((a, l) => a + l.installCost, 0);
  const pricedScopeCost = jobMaterialCost + jobInstallCost;
  const jobMaterialSell = lines.reduce((a, l) => a + l.materialSell, 0);
  const jobInstallSell = lines.reduce((a, l) => a + l.installSell, 0);
  const jobSell = jobMaterialSell + jobInstallSell;
  const profit = jobSell - pricedScopeCost;

  const freight = s.freight ?? 0;
  const taxPct = s.taxPct ?? 0;
  const taxBase =
    s.taxMode === "material_cost_only"
      ? jobMaterialCost
      : s.taxMode === "material_sell_only"
        ? jobMaterialSell
        : jobSell + freight;
  const tax = taxPct * taxBase;
  const bidPrice = jobSell + freight + tax;

  if (needsRateCount) warnings.push(`${needsRateCount} finish(es) still need a rate`);
  const needsReview = takeoff.filter((t) => t.status === "needs_review").length;
  if (needsReview) warnings.push(`${needsReview} takeoff row(s) still need review`);
  if (mode === "margin" && (mp >= 1 || ip >= 1)) warnings.push("Margin % must be below 100%");

  return {
    lines,
    jobMaterialCost,
    jobInstallCost,
    pricedScopeCost,
    jobMaterialSell,
    jobInstallSell,
    jobSell,
    profit,
    blendedMarkup: pricedScopeCost > 0 ? profit / pricedScopeCost : null,
    blendedMargin: jobSell > 0 ? profit / jobSell : null,
    freight,
    totalCostInclFreight: pricedScopeCost + freight,
    tax,
    bidPrice,
    warnings,
  };
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const pct = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
