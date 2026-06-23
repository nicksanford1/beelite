/**
 * End-to-end proof for the OAuth per-bid sheet path:
 * creates a real sheet in the connected user's Drive via createBidSpreadsheet() and reads back the
 * Bid Total. Uses the template's dummy data → must equal $15,205.54 (proves formulas + OAuth create).
 *
 * Run: tsx --env-file=.env scripts/test-sync.ts   (cleans up the test sheet afterward)
 */
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";
import { createBidSpreadsheet, readEngineVersion, isCurrentEngine, type BidInput } from "@/lib/sheet-builder";

const bid: BidInput = {
  name: "Westside Medical",
  gc: "Turner",
  location: "Phoenix, AZ",
  bidDate: new Date("2026-06-20"),
  notes: "",
  finishes: [
    { code: "LVT-1", application: "floor", type: "LVT", description: "Luxury vinyl tile", unit: "SF", category: "floor", inScope: true, materialUnitCost: 2.85, installRate: 1.55, wastePct: 0.08, cartonSize: 30, materialSource: "elite_furnishes" },
    { code: "CPT-1", application: "floor", type: "Carpet tile", description: "Office carpet tile", unit: "SF", category: "floor", inScope: true, materialUnitCost: 3.2, installRate: 0.95, wastePct: 0.06, cartonSize: 48, materialSource: "elite_furnishes" },
    { code: "RB-1", application: "base", type: "Rubber base", description: '4" rubber base', unit: "LF", category: "base", inScope: true, materialUnitCost: 0.92, installRate: 1.1, wastePct: 0.05, cartonSize: 100, materialSource: "elite_furnishes" },
    { code: "PT-2", application: "other", type: "Paint", description: "Wall paint", unit: "--", category: "wall", inScope: false, materialUnitCost: 0, installRate: 0, wastePct: 0, cartonSize: null, materialSource: "elite_furnishes" },
  ],
  takeoff: [
    { sheet: "A101", area: "Rooms 101-108", finishCode: "LVT-1", qty: 1250, unit: "SF", status: "approved" },
    { sheet: "A101", area: "Corridor", finishCode: "LVT-1", qty: 200, unit: "SF", status: "approved" },
    { sheet: "A101", area: "Open office", finishCode: "CPT-1", qty: 900, unit: "SF", status: "approved" },
    { sheet: "A101", area: "Whole floor", finishCode: "RB-1", qty: 500, unit: "LF", status: "approved" },
    { sheet: "A101", area: "Storage", finishCode: "CPT-1", qty: 100, unit: "SF", status: "needs_review" },
  ],
  scopeItems: [
    { label: "Floor prep", mode: "included", allowance: 3500 },
    { label: "Moisture mitigation", mode: "excluded", allowance: null },
    { label: "Demolition", mode: "excluded", allowance: null },
  ],
  settings: { profitPctMode: "markup", materialProfitPct: 0.15, installProfitPct: 0.15, taxPct: 0.08, taxMode: "total_sell_plus_freight", freight: 500 },
};

async function main() {
  const auth = await getAuthedClient();
  if (!auth) throw new Error("Google not connected — connect from the home page first.");
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const { spreadsheetId, url } = await createBidSpreadsheet(sheets, bid);
  console.log("Created sheet in your Drive:", url);

  const got = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Summary!C15", "Estimate!V7", "Estimate!V10", "Estimate!V11"],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const [price, profit, markup, margin] = (got.data.valueRanges ?? []).map((v) => Number(v.values?.[0]?.[0]));
  console.log("BID PRICE:", price, Math.abs(price - 15205.54) < 0.01 ? "✅ matches $15,205.54" : "⚠️ expected 15205.54");
  console.log("Profit:", profit.toFixed(2), "· blended markup", (markup * 100).toFixed(1) + "%", "· margin", (margin * 100).toFixed(1) + "%");
  console.log("Profit check:", Math.abs(profit - 1771.2) < 0.01 ? "✅ $1,771.20" : "⚠️ expected 1771.20");

  const version = await readEngineVersion(sheets, spreadsheetId);
  console.log("Engine version:", version, isCurrentEngine(version) ? "✅ current (sync will reuse)" : "⚠️ stale (sync would rebuild)");

  // clean up the throwaway test sheet
  await drive.files.delete({ fileId: spreadsheetId });
  console.log("Cleaned up test sheet.");
}

main().catch((e) => {
  console.error(e?.response?.data?.error ?? e);
  process.exit(1);
});
