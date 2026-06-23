/**
 * Beelite Google Sheet "bid engine" — reusable builder (v5).
 *
 * Implements docs/contracts/pricing-v5.md: Cost → Sell → Profit → Bid price, material/install split,
 * markup-or-margin lens, needs-rate from EFFECTIVE rates. The Sheet does the math; the app only
 * pushes a bid's INPUTS into the hidden App_* tabs. Verified: the v4 dummy bid still totals $15,205.54.
 */
import type { sheets_v4 } from "googleapis";

const N = 200; // fill-down rows for formula tabs (covers large finish schedules; Codex v5 #4)
const ROWS_END = N + 1; // last formula row index (1-based) → formatting ranges track N
const ENGINE_VERSION = "beelite-v12"; // v12: Waste as %, green profit, BID PRICE highlight, auto-sized Description

const ID = {
  Summary: 10,
  Estimate: 11,
  Rates: 12,
  App_Finishes: 20,
  App_Takeoff: 21,
  App_Scope: 22,
  App_Rates: 23,
  App_Settings: 24,
};

const MY_TABS = [
  { sheetId: ID.Summary, title: "Summary" },
  { sheetId: ID.Estimate, title: "Estimate" },
  { sheetId: ID.Rates, title: "Rates" },
  { sheetId: ID.App_Finishes, title: "App_Finishes", hidden: true },
  { sheetId: ID.App_Takeoff, title: "App_Takeoff", hidden: true },
  { sheetId: ID.App_Scope, title: "App_Scope", hidden: true },
  { sheetId: ID.App_Rates, title: "App_Rates", hidden: true },
  { sheetId: ID.App_Settings, title: "App_Settings", hidden: true },
];

const rowF = (tpl: string, r: number) => tpl.replace(/\$([A-Z]+)2\b/g, (_m, c) => `$${c}${r}`);
function fillBlock(colTemplates: string[], rows: number): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (let r = 2; r < 2 + rows; r++) out.push(colTemplates.map((t) => (t === "" ? "" : rowF(t, r))));
  return out;
}

// ── Rates tab: default / override / effective (override survives re-sync) ──
// Headers are display-only — the formulas reference cells by column letter, not these labels — so
// these are safe to make human-friendly. "(library)" cols are hidden; "override" cols are the yellow
// editable ones; the bare label is the EFFECTIVE value actually used in the bid.
const ratesHeader = [
  "Finish",
  "Material $/u (library)", "Material override", "Material $/u",
  "Install $/u (library)", "Install override", "Install $/u",
  "Waste % (library)", "Waste override", "Waste %",
  "Carton (library)", "Carton override", "Carton size",
  "Source (library)", "Source override", "Material source",
  "Notes", "Application",
];
const ratesBtoQ = [
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$B:$B,0))', // B default material $/u
  "", // C override
  '=IF($A2="","",IF($C2<>"",$C2,$B2))', // D effective
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$C:$C,0))', // E default install rate
  "", // F
  '=IF($A2="","",IF($F2<>"",$F2,$E2))', // G effective
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$D:$D,0))', // H default waste
  "", // I
  '=IF($A2="","",IF($I2<>"",$I2,$H2))', // J effective
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$E:$E,0))', // K default carton
  "", // L
  '=IF($A2="","",IF($L2<>"",$L2,$K2))', // M effective
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$F:$F,"elite_furnishes"))', // N default source
  "", // O
  '=IF($A2="","",IF($O2<>"",$O2,$N2))', // P effective
  "", // Q notes
];

// ── Estimate tab: cost → sell → profit (overrides live in Rates) ──
// settings refs: mode=App_Settings!$B$5, materialProfitPct=$B$6, installProfitPct=$B$11
const estHeader = [
  "Finish", "Description", "Unit", "Takeoff Qty", "Material source", "Waste %",
  "Order Qty (raw)", "Carton", "Order Qty", "Material $/u", "Install $/u",
  "Material Cost", "Install Cost", "Line Cost",
  "Material Sell", "Install Sell", "Line Sell", "Line Profit", "Rate status",
];
const estBtoS = [
  '=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$C:$C,""))', // B desc
  '=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$D:$D,""))', // C unit
  '=IF($A2="","",SUMIFS(App_Takeoff!$D:$D,App_Takeoff!$C:$C,$A2,App_Takeoff!$F:$F,"approved"))', // D qty
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$P:$P,"elite_furnishes"))', // E material source
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$J:$J,0))', // F waste
  '=IF($A2="","",$D2*(1+$F2))', // G order raw
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$M:$M,0))', // H carton
  '=IF($A2="","",IF($H2>0,CEILING($G2,$H2),$G2))', // I order rounded
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$D:$D,0))', // J material $/u
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$G:$G,0))', // K install $/u
  '=IF($A2="","",IF($E2="owner_furnishes",0,$I2*$J2))', // L material cost (owner→0)
  '=IF($A2="","",$D2*$K2)', // M install cost (on approved qty)
  '=IF($A2="","",$L2+$M2)', // N line cost
  '=IF($A2="","",IF($E2="owner_furnishes",0,IF(App_Settings!$B$5="margin",IF(App_Settings!$B$6>=1,"",$L2/(1-App_Settings!$B$6)),$L2*(1+App_Settings!$B$6))))', // O material sell
  '=IF($A2="","",IF(App_Settings!$B$5="margin",IF(App_Settings!$B$11>=1,"",$M2/(1-App_Settings!$B$11)),$M2*(1+App_Settings!$B$11)))', // P install sell
  '=IF($A2="","",$O2+$P2)', // Q line sell
  '=IF($A2="","",$Q2-$N2)', // R line profit
  '=IF($A2="","",IF(OR(AND($E2<>"owner_furnishes",$J2<=0),$K2<=0),"needs_rate","ok"))', // S rate status
];

// Bid block — labels col U, values col V (absolute refs)
const bidBlock: [string, string][] = [
  ["Material cost", "=SUM(L2:L)"], // V1
  ["Install cost", "=SUM(M2:M)"], // V2
  ["Priced scope cost", "=$V$1+$V$2"], // V3
  ["Material sell", "=SUM(O2:O)"], // V4
  ["Install sell", "=SUM(P2:P)"], // V5
  ["Job sell", "=$V$4+$V$5"], // V6
  ["Profit", "=$V$6-$V$3"], // V7
  ["Freight", "=App_Settings!$B$9"], // V8
  ["Total cost incl. freight", "=$V$3+$V$8"], // V9
  ["Blended markup", '=IF($V$3>0,$V$7/$V$3,"")'], // V10
  ["Blended margin", '=IF($V$6>0,$V$7/$V$6,"")'], // V11
  ["Tax mode", "=App_Settings!$B$8"], // V12
  ["Tax %", "=App_Settings!$B$7"], // V13
  ["Tax base", '=IFS($V$12="material_cost_only",$V$1,$V$12="material_sell_only",$V$4,$V$12="total_sell_plus_freight",$V$6+$V$8)'], // V14
  ["Tax", "=$V$14*$V$13"], // V15
  ["BID PRICE", "=$V$6+$V$8+$V$15"], // V16
  ["Bid $/SF", '=IF($V$16>0,IFERROR($V$16/SUMIF($C$2:$C,"SF",$D$2:$D),""),"")'], // V17 — bid price ÷ total SF
];

const RNG = "$2:$1000";
// Summary statement (cols A label / B cost / C price)
const summaryStatement: (string)[][] = [
  ["BID PROPOSAL", "", ""],
  ["=App_Settings!$B$1", "", ""],
  ['=IF(App_Settings!$B$2<>"","GC: "&App_Settings!$B$2&"   ·   ","")&App_Settings!$B$3&IF(App_Settings!$B$4<>"","   ·   Due "&App_Settings!$B$4,"")', "", ""],
  ["", "", ""],
  ["", "Cost", "Price"],
  ["Material (Elite furnishes)", "=Estimate!$V$1", "=Estimate!$V$4"],
  ["Install (subcontracted)", "=Estimate!$V$2", "=Estimate!$V$5"],
  ["Freight", "=Estimate!$V$8", "=Estimate!$V$8"],
  ["Priced scope cost (material + install)", "=Estimate!$V$3", ""],
  ["Total cost incl. freight", "=Estimate!$V$9", ""],
  ["Elite profit", "", "=Estimate!$V$7"],
  ["   markup on cost", "", "=Estimate!$V$10"],
  ["   margin on price", "", "=Estimate!$V$11"],
  ["Tax", "", "=Estimate!$V$15"],
  ["BID PRICE", "", "=Estimate!$V$16"],
  ["Bid per SF", "", "=Estimate!$V$17"],
];
const summaryChecks: (string)[][] = [
  ["Checks (0 = ready to send)", ""],
  ["Finishes needing a rate", '=COUNTIF(Estimate!$S$2:$S,"needs_rate")'],
  ["Takeoff rows needs_review", '=COUNTIF(App_Takeoff!$F$2:$F,"needs_review")'],
  ["Takeoff code not in finishes", `=SUMPRODUCT((App_Takeoff!$C${RNG}<>"")*(COUNTIF(App_Finishes!$A:$A,App_Takeoff!$C${RNG})=0))`],
  ["Duplicate finish codes", `=SUMPRODUCT((App_Finishes!$A${RNG}<>"")*(COUNTIF(App_Finishes!$A${RNG},App_Finishes!$A${RNG}&"")>1))`],
  ["Duplicate rate codes", `=SUMPRODUCT((App_Rates!$A${RNG}<>"")*(COUNTIF(App_Rates!$A${RNG},App_Rates!$A${RNG}&"")>1))`],
  // invalid profit % (Codex v5 #2): negative anywhere, or margin-mode pct >= 1
  ["Invalid pricing %", '=IF(OR(App_Settings!$B$6<0,App_Settings!$B$11<0,AND(App_Settings!$B$5="margin",OR(App_Settings!$B$6>=1,App_Settings!$B$11>=1))),1,0)'],
];

const NAMED = [
  { name: "app_finishes", sheetId: ID.App_Finishes, startRowIndex: 1, endColumnIndex: 7 },
  { name: "app_takeoff", sheetId: ID.App_Takeoff, startRowIndex: 1, endColumnIndex: 6 },
  { name: "app_scope", sheetId: ID.App_Scope, startRowIndex: 1, endColumnIndex: 3 },
  { name: "app_rates", sheetId: ID.App_Rates, startRowIndex: 1, endColumnIndex: 6 },
  { name: "app_settings", sheetId: ID.App_Settings, startRowIndex: 0, endRowIndex: 11, startColumnIndex: 1, endColumnIndex: 2 },
];

// ── Bid → App_* tables ────────────────────────────────────────
type Cell = string | number;

export interface BidInput {
  name: string;
  gc: string | null;
  location: string | null;
  bidDate: Date | null;
  notes: string | null;
  finishes: {
    code: string; type: string; description: string; unit: string; category: string; application: string;
    inScope: boolean; materialUnitCost: number; installRate: number; wastePct: number;
    cartonSize: number | null; materialSource: string;
  }[];
  takeoff: { sheet: string | null; area: string; finishCode: string; qty: number; unit: string; status: string }[];
  scopeItems: { label: string; mode: string; allowance: number | null }[];
  settings: {
    profitPctMode: string; materialProfitPct: number; installProfitPct: number;
    taxPct: number | null; taxMode: string; freight: number | null;
  } | null;
}

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function bidToTables(bid: BidInput) {
  const appFinishes: Cell[][] = [
    ["code", "type", "description", "unit", "category", "inScope", "application"],
    ...bid.finishes.map((f) => [f.code, f.type, f.description, f.unit, f.category, f.inScope ? "TRUE" : "FALSE", f.application]),
  ];
  const appRates: Cell[][] = [
    ["code", "materialUnitCost", "installRate", "wastePct", "cartonSize", "materialSource"],
    ...bid.finishes
      .filter((f) => f.inScope)
      .map((f) => [f.code, f.materialUnitCost, f.installRate, f.wastePct, f.cartonSize ?? 0, f.materialSource]),
  ];
  const appTakeoff: Cell[][] = [
    ["sheet", "area", "finishCode", "qty", "unit", "status"],
    ...bid.takeoff.map((t) => [t.sheet ?? "", t.area, t.finishCode, t.qty, t.unit, t.status]),
  ];
  const appScope: Cell[][] = [
    ["label", "mode", "allowance"],
    ...bid.scopeItems.map((s) => [s.label, s.mode, s.allowance ?? ""]),
  ];
  const s = bid.settings;
  const appSettings: Cell[][] = [
    ["projectName", bid.name],
    ["gc", bid.gc ?? ""],
    ["location", bid.location ?? ""],
    ["bidDate", ymd(bid.bidDate)],
    ["profitPctMode", s?.profitPctMode ?? "margin"],
    ["materialProfitPct", s?.materialProfitPct ?? 0.25],
    ["taxPct", s?.taxPct ?? 0],
    ["taxMode", s?.taxMode ?? "total_sell_plus_freight"],
    ["freight", s?.freight ?? 0],
    ["notes", bid.notes ?? ""],
    ["installProfitPct", s?.installProfitPct ?? 0.3],
  ];
  return { appFinishes, appRates, appTakeoff, appScope, appSettings };
}

type Tables = ReturnType<typeof bidToTables>;

function appData(t: Tables) {
  return [
    { range: "App_Finishes!A1", values: t.appFinishes },
    { range: "App_Rates!A1", values: t.appRates },
    { range: "App_Takeoff!A1", values: t.appTakeoff },
    { range: "App_Scope!A1", values: t.appScope },
    { range: "App_Settings!A1", values: t.appSettings },
  ];
}

function formulaData() {
  return [
    { range: "Rates!A1", values: [ratesHeader] },
    { range: "Rates!A2", values: [['=IFERROR(App_Rates!$A$2:$A,"")']] },
    { range: "Rates!B2", values: fillBlock(ratesBtoQ, N) },
    { range: "Rates!R1", values: [["application"]] },
    { range: "Rates!R2", values: fillBlock(['=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$G:$G,""))'], N) },
    { range: "Estimate!A1", values: [estHeader] },
    { range: "Estimate!A2", values: [['=IFERROR(UNIQUE(FILTER(App_Finishes!$A$2:$A,App_Finishes!$F$2:$F=TRUE)),"")']] },
    { range: "Estimate!B2", values: fillBlock(estBtoS, N) },
    { range: "Estimate!T1", values: [["Application"]] },
    { range: "Estimate!T2", values: fillBlock(['=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$G:$G,""))'], N) },
    { range: "Estimate!U1", values: bidBlock.map(([l, f]) => [l, f]) },
    { range: "Summary!A1", values: summaryStatement },
    { range: "Summary!E1", values: summaryChecks },
    { range: "App_Settings!D1", values: [[ENGINE_VERSION]] }, // engine-version sentinel (Codex v5 #1)
  ];
}

// ── Formatting (makes the Sheet a presentable statement, not a raw grid) ──
const BRAND = { red: 0.929, green: 0.11, blue: 0.141 }; // Elite red — Summary banner
const WHITE = { red: 1, green: 1, blue: 1 };
const YELLOW = { red: 1, green: 0.97, blue: 0.82 };
const GREEN = { red: 0.1, green: 0.49, blue: 0.31 }; // profit text — "this is your money"
const PALE = { red: 0.98, green: 0.93, blue: 0.93 }; // faint tint behind the BID PRICE row
const CURRENCY = { type: "CURRENCY", pattern: "$#,##0.00" };
const PERCENT = { type: "PERCENT", pattern: "0.0%" };

const gr = (sheetId: number, sr: number, er: number, sc: number, ec: number) => ({
  sheetId, startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec,
});
const fmtNum = (sheetId: number, sr: number, er: number, sc: number, ec: number, numberFormat: object) => ({
  repeatCell: { range: gr(sheetId, sr, er, sc, ec), cell: { userEnteredFormat: { numberFormat } }, fields: "userEnteredFormat.numberFormat" },
});
const fmtBold = (sheetId: number, sr: number, er: number, sc: number, ec: number) => ({
  repeatCell: { range: gr(sheetId, sr, er, sc, ec), cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" },
});
const fmtBg = (sheetId: number, sr: number, er: number, sc: number, ec: number, backgroundColor: object) => ({
  repeatCell: { range: gr(sheetId, sr, er, sc, ec), cell: { userEnteredFormat: { backgroundColor } }, fields: "userEnteredFormat.backgroundColor" },
});
const fmtColor = (sheetId: number, sr: number, er: number, sc: number, ec: number, foregroundColor: object) => ({
  repeatCell: { range: gr(sheetId, sr, er, sc, ec), cell: { userEnteredFormat: { textFormat: { foregroundColor } } }, fields: "userEnteredFormat.textFormat.foregroundColor" },
});
const colWidth = (sheetId: number, startIndex: number, endIndex: number, pixelSize: number) => ({
  updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex, endIndex }, properties: { pixelSize }, fields: "pixelSize" },
});
const hideCols = (sheetId: number, idxs: number[]) =>
  idxs.map((c) => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } }));

function formattingRequests(): object[] {
  return [
    // Summary banner
    { mergeCells: { range: gr(ID.Summary, 0, 1, 0, 3), mergeType: "MERGE_ALL" } },
    { repeatCell: { range: gr(ID.Summary, 0, 1, 0, 3), cell: { userEnteredFormat: { backgroundColor: BRAND, textFormat: { bold: true, fontSize: 15, foregroundColor: WHITE }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)" } },
    { repeatCell: { range: gr(ID.Summary, 1, 2, 0, 1), cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } }, fields: "userEnteredFormat.textFormat" } },
    fmtBold(ID.Summary, 4, 5, 0, 3), // Cost/Price header
    fmtNum(ID.Summary, 5, 16, 1, 3, CURRENCY), // money block (incl. Bid per SF)
    fmtNum(ID.Summary, 11, 13, 2, 3, PERCENT), // markup/margin
    { repeatCell: { range: gr(ID.Summary, 14, 15, 0, 3), cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: "userEnteredFormat.textFormat" } }, // BID PRICE
    fmtBg(ID.Summary, 14, 15, 0, 3, PALE), // faint tint behind the hero BID PRICE row
    fmtColor(ID.Summary, 10, 11, 2, 3, GREEN), // Elite profit value in green
    fmtBold(ID.Summary, 0, 1, 4, 6), // checks header
    colWidth(ID.Summary, 0, 1, 300), // wide label column (nothing cut off)
    colWidth(ID.Summary, 1, 3, 130), // Cost / Price columns
    ...hideCols(ID.Summary, [4, 5]), // hide the Checks block for a clean proposal (still computes if unhidden)
    // Estimate
    fmtBold(ID.Estimate, 0, 1, 0, 20),
    { updateSheetProperties: { properties: { sheetId: ID.Estimate, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    fmtNum(ID.Estimate, 1, ROWS_END, 9, 18, CURRENCY), // J:R money
    fmtNum(ID.Estimate, 0, 17, 21, 22, CURRENCY), // V bid block (incl. Bid $/SF)
    fmtNum(ID.Estimate, 9, 11, 21, 22, PERCENT), // V10:V11 blended %
    fmtBold(ID.Estimate, 0, 17, 20, 21), // U labels
    fmtNum(ID.Estimate, 1, ROWS_END, 5, 6, PERCENT), // Waste % column (0.06 → 6%)
    fmtColor(ID.Estimate, 1, ROWS_END, 17, 18, GREEN), // Line Profit (col R) in green
    fmtColor(ID.Estimate, 6, 7, 21, 22, GREEN), // bid-block Profit (V7) in green
    // Hide the Estimate's intermediate "plumbing" columns — formulas stay, the view stays clean.
    // E=src, G=order raw, H=carton, L=mat cost, M=inst cost, O=mat sell, P=inst sell, T=app helper.
    ...hideCols(ID.Estimate, [4, 6, 7, 11, 12, 14, 15, 19]),
    colWidth(ID.Estimate, 0, 1, 120), // Finish code
    // Description — auto-size to fit the longest description (no more, no less) instead of a fixed width.
    { autoResizeDimensions: { dimensions: { sheetId: ID.Estimate, dimension: "COLUMNS", startIndex: 1, endIndex: 2 } } },
    // Rates
    fmtBold(ID.Rates, 0, 1, 0, 18),
    { updateSheetProperties: { properties: { sheetId: ID.Rates, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    ...[2, 5, 8, 11, 14].map((c) => fmtBg(ID.Rates, 1, ROWS_END, c, c + 1, YELLOW)), // override columns (editable)
    fmtNum(ID.Rates, 1, ROWS_END, 7, 10, PERCENT), // Waste columns (default/override/effective) as % (0.06 → 6%)
    // Hide the raw "default" rate columns — show only the editable override (yellow) + effective result.
    ...hideCols(ID.Rates, [1, 4, 7, 10, 13]),
    colWidth(ID.Rates, 0, 1, 120), // Finish code
    colWidth(ID.Rates, 1, 16, 125), // rate columns — fit the friendly headers
    colWidth(ID.Rates, 16, 18, 170), // notes + application
  ];
}

function namedRangeRequests(): object[] {
  return NAMED.map((n) => ({
    addNamedRange: {
      namedRange: {
        name: n.name,
        range: { sheetId: n.sheetId, startRowIndex: n.startRowIndex, endRowIndex: n.endRowIndex, startColumnIndex: n.startColumnIndex ?? 0, endColumnIndex: n.endColumnIndex },
      },
    },
  }));
}

type Sheets = sheets_v4.Sheets;

/** Create a fresh v5 Bid Engine spreadsheet in the connected user's Drive and populate it. */
export async function createBidSpreadsheet(sheets: Sheets, bid: BidInput) {
  const tables = bidToTables(bid);
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Beelite — ${bid.name}` },
      sheets: MY_TABS.map((t) => ({ properties: { sheetId: t.sheetId, title: t.title, hidden: !!t.hidden } })),
    },
  });
  const spreadsheetId = created.data.spreadsheetId!;
  const url = created.data.spreadsheetUrl!;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: [...formulaData(), ...appData(tables)] },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [...namedRangeRequests(), ...formattingRequests()] },
  });
  return { spreadsheetId, url };
}

/** Read the engine-version sentinel from App_Settings!D1. null = missing/unreadable (treat as stale). */
export async function readEngineVersion(sheets: Sheets, spreadsheetId: string): Promise<string | null> {
  try {
    const got = await sheets.spreadsheets.values.get({ spreadsheetId, range: "App_Settings!D1" });
    return (got.data.values?.[0]?.[0] as string) ?? null;
  } catch {
    return null; // trashed / no access / pre-v5 sheet without the tab
  }
}

export const isCurrentEngine = (v: string | null) => v === ENGINE_VERSION;

/** Re-push a bid's inputs into an existing Sheet. Clears App_* data, rewrites it; formulas/formats untouched. */
export async function updateBidData(sheets: Sheets, spreadsheetId: string, bid: BidInput) {
  const tables = bidToTables(bid);
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: {
      ranges: ["App_Finishes!A2:Z1000", "App_Rates!A2:Z1000", "App_Takeoff!A2:Z1000", "App_Scope!A2:Z1000", "App_Settings!A1:B1000"],
    },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: appData(tables) },
  });
}
