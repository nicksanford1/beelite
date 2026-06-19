/**
 * Builds the Beelite Google Sheet "bid engine" template from docs/contracts/sheet-template-v5.md.
 * Creates 9 tabs (4 visible + 5 hidden App_*), all formulas, named ranges, and dummy data,
 * shares it to your Google account, and reads back the Bid Total (should be 15205.54).
 *
 * Run: SHARE_WITH=you@gmail.com npm run build:sheet
 * Needs: service-account.json at repo root + Sheets API & Drive API enabled.
 */
import { google } from "googleapis";

const KEY_FILE = "service-account.json";
const SHARE_WITH = process.env.SHARE_WITH || "nicholassanford2024@gmail.com";
const N = 60; // fill-down rows for formula tabs

// stable sheetIds so we can hide tabs / build named ranges
const ID = {
  Summary: 10,
  Estimate: 11,
  Rates: 12,
  Assumptions: 13,
  App_Finishes: 20,
  App_Takeoff: 21,
  App_Scope: 22,
  App_Rates: 23,
  App_Settings: 24,
};

// Bump relative row refs ($A2 -> $A{r}); leaves absolute ($A$2) and ranges untouched.
const rowF = (tpl: string, r: number) => tpl.replace(/\$([A-Z]+)2\b/g, (_m, c) => `$${c}${r}`);

// Build a fill-down block for columns, given each column's row-2 template ("" = blank cell).
function fillBlock(colTemplates: string[], rows: number): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (let r = 2; r < 2 + rows; r++) {
    out.push(colTemplates.map((t) => (t === "" ? "" : rowF(t, r))));
  }
  return out;
}

// ── Tab data ────────────────────────────────────────────────
const appFinishes = [
  ["code", "type", "description", "unit", "category", "inScope"],
  ["LVT-1", "LVT", "Luxury vinyl tile", "SF", "floor", "TRUE"],
  ["CPT-1", "Carpet tile", "Office carpet tile", "SF", "floor", "TRUE"],
  ["RB-1", "Rubber base", '4" rubber base', "LF", "base", "TRUE"],
  ["PT-2", "Paint", "Wall paint", "--", "wall", "FALSE"],
];

const appRates = [
  ["code", "materialCost", "installMode", "installAmount", "wastePct", "cartonSize", "furnishType"],
  ["LVT-1", 2.85, "unit_rate", 1.55, 0.08, 30, "furnish_and_sub"],
  ["CPT-1", 3.2, "unit_rate", 0.95, 0.06, 48, "furnish_and_sub"],
  ["RB-1", 0.92, "unit_rate", 1.1, 0.05, 100, "furnish_and_sub"],
];

const appTakeoff = [
  ["sheet", "area", "finishCode", "qty", "unit", "status"],
  ["A101", "Rooms 101-108", "LVT-1", 1250, "SF", "approved"],
  ["A101", "Corridor", "LVT-1", 200, "SF", "approved"],
  ["A101", "Open office", "CPT-1", 900, "SF", "approved"],
  ["A101", "Whole floor", "RB-1", 500, "LF", "approved"],
  ["A101", "Storage", "CPT-1", 100, "SF", "needs_review"],
];

const appScope = [
  ["label", "mode", "allowance"],
  ["Floor prep", "included", 3500],
  ["Moisture mitigation", "excluded", ""],
  ["Demolition", "excluded", ""],
];

const appSettings = [
  ["projectName", "Westside Medical"],
  ["gc", "Turner"],
  ["location", "Phoenix, AZ"],
  ["bidDate", "2026-06-20"],
  ["pricingMode", "markup"],
  ["pct", 0.15],
  ["taxPct", 0.08],
  ["taxMode", "total_sell_plus_freight"],
  ["freight", 500],
  ["notes", ""],
  ["subMarkupPct", 0.15],
];

// Rates visible tab (A..T): default/override/effective triplets
const ratesHeader = [
  "code", "defaultMaterialCost", "overrideMaterialCost", "effectiveMaterialCost",
  "defaultInstallMode", "overrideInstallMode", "effectiveInstallMode",
  "defaultInstallAmount", "overrideInstallAmount", "effectiveInstallAmount",
  "defaultWastePct", "overrideWastePct", "effectiveWastePct",
  "defaultCartonSize", "overrideCartonSize", "effectiveCartonSize",
  "defaultFurnishType", "overrideFurnishType", "effectiveFurnishType", "notes",
];
// templates for columns B..T (A handled separately as a spill)
const ratesBtoT = [
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$B:$B,0))', // B default material
  "", // C override
  '=IF($A2="","",IF($C2<>"",$C2,$B2))', // D effective
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$C:$C,"pending"))', // E default mode
  "", // F
  '=IF($A2="","",IF($F2<>"",$F2,$E2))', // G effective mode
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$D:$D,0))', // H default amount
  "", // I
  '=IF($A2="","",IF($I2<>"",$I2,$H2))', // J effective amount
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$E:$E,0))', // K default waste
  "", // L
  '=IF($A2="","",IF($L2<>"",$L2,$K2))', // M effective waste
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$F:$F,0))', // N default carton
  "", // O
  '=IF($A2="","",IF($O2<>"",$O2,$N2))', // P effective carton
  '=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$G:$G,"furnish_and_sub"))', // Q default furnish
  "", // R
  '=IF($A2="","",IF($R2<>"",$R2,$Q2))', // S effective furnish
  "", // T notes
];

// Estimate visible tab (A..O)
const estHeader = [
  "Finish", "Description", "Unit", "Takeoff Qty", "Waste %", "Order Qty (raw)",
  "Carton size", "Order Qty (rounded)", "Material $/unit", "Material Total",
  "Install mode", "Install amount", "Install (sub) Total", "Line Total", "Furnish type",
];
const estBtoO = [
  '=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$C:$C,""))', // B desc
  '=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$D:$D,""))', // C unit
  '=IF($A2="","",SUMIFS(App_Takeoff!$D:$D,App_Takeoff!$C:$C,$A2,App_Takeoff!$F:$F,"approved"))', // D takeoff
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$M:$M,0))', // E waste
  '=IF($A2="","",$D2*(1+$E2))', // F order raw
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$P:$P,0))', // G carton
  '=IF($A2="","",IF($G2>0,CEILING($F2,$G2),$F2))', // H order rounded
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$D:$D,0))', // I material $/u
  '=IF($A2="","",IF($O2="turnkey_sub",0,$H2*$I2))', // J material total (turnkey->0)
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$G:$G,"pending"))', // K install mode
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$J:$J,0))', // L install amount
  '=IF($A2="","",IFS($K2="unit_rate",$D2*$L2,$K2="sub_quote",$L2,$K2="pending",0))', // M install total
  '=IF($A2="","",$J2+$M2)', // N line total
  '=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$S:$S,"furnish_and_sub"))', // O furnish
];

// Estimate bid block (Q labels / R formulas)
const bidBlock: [string, string][] = [
  ["Subtotal", "=SUM(N2:N)"],
  ["Material subtotal", "=SUM(J2:J)"],
  ["Sub-install subtotal", "=SUM(M2:M)"],
  ["Pricing mode", "=App_Settings!$B$5"],
  ["Material pct", "=App_Settings!$B$6"],
  ["Sub markup pct", "=App_Settings!$B$11"],
  ["Material after", '=IF($R$4="margin",$R$2/(1-$R$5),$R$2*(1+$R$5))'],
  ["Sub after", '=IF($R$4="margin",$R$3/(1-$R$6),$R$3*(1+$R$6))'],
  ["After markup/margin", "=$R$7+$R$8"],
  ["Freight", "=App_Settings!$B$9"],
  ["Tax mode", "=App_Settings!$B$8"],
  ["Tax %", "=App_Settings!$B$7"],
  ["Tax", '=$R$12*IFS($R$11="material_cost_only",$R$2,$R$11="material_sell_only",$R$7,$R$11="total_sell_plus_freight",$R$9+$R$10)'],
  ["BID TOTAL", "=$R$9+$R$10+$R$13"],
];

const RNG = "$2:$1000"; // bounded ranges for SUMPRODUCT warnings
const summary: [string, string][] = [
  ["Project", "=App_Settings!$B$1"],
  ["GC", "=App_Settings!$B$2"],
  ["Location", "=App_Settings!$B$3"],
  ["Bid date", "=App_Settings!$B$4"],
  ["Bid Total", "=Estimate!$R$14"],
  ["! Install items pending sub quote", '=COUNTIF(Estimate!$K$2:$K,"pending")'],
  ["! Furnish lines missing material cost", '=COUNTIFS(Estimate!$A$2:$A,"<>",Estimate!$I$2:$I,0,Estimate!$O$2:$O,"furnish_and_sub")'],
  ["! Install amount missing (not pending)", '=COUNTIFS(Estimate!$A$2:$A,"<>",Estimate!$L$2:$L,0,Estimate!$K$2:$K,"<>pending")'],
  ["! Takeoff rows needs_review", '=COUNTIF(App_Takeoff!$F$2:$F,"needs_review")'],
  ["! Takeoff code not in finishes", `=SUMPRODUCT((App_Takeoff!$C${RNG}<>"")*(COUNTIF(App_Finishes!$A:$A,App_Takeoff!$C${RNG})=0))`],
  ["! Duplicate finish codes", `=SUMPRODUCT((App_Finishes!$A${RNG}<>"")*(COUNTIF(App_Finishes!$A${RNG},App_Finishes!$A${RNG}&"")>1))`],
  ["! Duplicate rate codes", `=SUMPRODUCT((App_Rates!$A${RNG}<>"")*(COUNTIF(App_Rates!$A${RNG},App_Rates!$A${RNG}&"")>1))`],
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const myTabs = [
    { sheetId: ID.Summary, title: "Summary" },
    { sheetId: ID.Estimate, title: "Estimate" },
    { sheetId: ID.Rates, title: "Rates" },
    { sheetId: ID.Assumptions, title: "Assumptions" },
    { sheetId: ID.App_Finishes, title: "App_Finishes", hidden: true },
    { sheetId: ID.App_Takeoff, title: "App_Takeoff", hidden: true },
    { sheetId: ID.App_Scope, title: "App_Scope", hidden: true },
    { sheetId: ID.App_Rates, title: "App_Rates", hidden: true },
    { sheetId: ID.App_Settings, title: "App_Settings", hidden: true },
  ];

  // 1) Use an existing blank sheet you share with the service account (SET SHEET_ID),
  //    because a service account on personal Gmail can't CREATE files (no Drive storage).
  const SHEET_ID = process.env.SHEET_ID;
  let spreadsheetId: string;
  let url: string;

  if (SHEET_ID) {
    spreadsheetId = SHEET_ID;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    url = meta.data.spreadsheetUrl!;
    const existing = (meta.data.sheets ?? []).map((s) => s.properties!.sheetId!);
    // add my tabs, then delete the original default sheet(s)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: myTabs.map((t) => ({
          addSheet: { properties: { sheetId: t.sheetId, title: t.title, hidden: !!t.hidden } },
        })),
      },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: existing.map((id) => ({ deleteSheet: { sheetId: id } })) },
    });
    console.log("Populating existing sheet:", url);
  } else {
    // Workspace path (service account with a Shared Drive can create directly)
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Beelite — Bid Engine Template" },
        sheets: myTabs.map((t) => ({ properties: { sheetId: t.sheetId, title: t.title, hidden: !!t.hidden } })),
      },
    });
    spreadsheetId = created.data.spreadsheetId!;
    url = created.data.spreadsheetUrl!;
    console.log("Created:", url);
  }

  // 2) write all values + formulas (USER_ENTERED interprets formulas)
  const data: { range: string; values: (string | number)[][] }[] = [
    { range: "App_Finishes!A1", values: appFinishes },
    { range: "App_Rates!A1", values: appRates },
    { range: "App_Takeoff!A1", values: appTakeoff },
    { range: "App_Scope!A1", values: appScope },
    { range: "App_Settings!A1", values: appSettings },
    // Rates: header, A2 spill, B2:T fill-down
    { range: "Rates!A1", values: [ratesHeader] },
    { range: "Rates!A2", values: [['=IFERROR(App_Rates!$A$2:$A,"")']] },
    { range: "Rates!B2", values: fillBlock(ratesBtoT, N) },
    // Estimate: header, A2 spill, B2:O fill-down, bid block Q/R
    { range: "Estimate!A1", values: [estHeader] },
    { range: "Estimate!A2", values: [['=IFERROR(UNIQUE(FILTER(App_Finishes!$A$2:$A,App_Finishes!$F$2:$F=TRUE)),"")']] },
    { range: "Estimate!B2", values: fillBlock(estBtoO, N) },
    { range: "Estimate!Q1", values: bidBlock.map(([l, f]) => [l, f]) },
    // Summary
    { range: "Summary!A1", values: summary.map(([l, f]) => [l, f]) },
    // Assumptions: auto col A + manual col C header
    { range: "Assumptions!A1", values: [["Assumptions (auto from scope — do not edit)", "", "Manual notes (type here)"]] },
    { range: "Assumptions!A2", values: [['=IFERROR(FILTER(App_Scope!$A$2:$A&" — "&App_Scope!$B$2:$B&IF(App_Scope!$C$2:$C<>""," (allowance $"&App_Scope!$C$2:$C&")",""),App_Scope!$A$2:$A<>""),"")']] },
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  // 3) named ranges the app's sync targets
  const named = [
    { name: "app_finishes", sheetId: ID.App_Finishes, startRowIndex: 1, endColumnIndex: 6 },
    { name: "app_takeoff", sheetId: ID.App_Takeoff, startRowIndex: 1, endColumnIndex: 6 },
    { name: "app_scope", sheetId: ID.App_Scope, startRowIndex: 1, endColumnIndex: 3 },
    { name: "app_rates", sheetId: ID.App_Rates, startRowIndex: 1, endColumnIndex: 7 },
    { name: "app_settings", sheetId: ID.App_Settings, startRowIndex: 0, endRowIndex: 11, startColumnIndex: 1, endColumnIndex: 2 },
  ];
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: named.map((n) => ({
        addNamedRange: {
          namedRange: {
            name: n.name,
            range: {
              sheetId: n.sheetId,
              startRowIndex: n.startRowIndex,
              endRowIndex: n.endRowIndex,
              startColumnIndex: n.startColumnIndex ?? 0,
              endColumnIndex: n.endColumnIndex,
            },
          },
        },
      })),
    },
  });

  // 4) share to your Google account (only when WE created it; if you supplied SHEET_ID you own it)
  if (!SHEET_ID) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: { type: "user", role: "writer", emailAddress: SHARE_WITH },
      });
      console.log("Shared with:", SHARE_WITH);
    } catch (e: any) {
      console.warn("Share failed (open via the URL above):", e?.message);
    }
  }

  // 5) read back Bid Total
  const got = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Summary!B5",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const bid = got.data.values?.[0]?.[0];
  console.log("Bid Total:", bid, Math.abs(Number(bid) - 15205.54) < 0.01 ? "✅ matches $15,205.54" : "⚠️ expected 15205.54");
  console.log("\nTemplate id (for SHEET_TEMPLATE_ID in .env):", spreadsheetId);
}

main().catch((e) => {
  console.error(e?.response?.data?.error ?? e);
  process.exit(1);
});
