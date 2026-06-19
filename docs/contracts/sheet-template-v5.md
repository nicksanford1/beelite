# Beelite — Google Sheet Template Spec (the bid engine) · v5

**The math contract is `pricing-v5.md`. The exact, verified formulas live in
`lib/sheet-builder.ts` (the app builds every bid's Sheet from there).** This file is the **tab/field
map** — what each tab holds and how the app feeds it. Don't restate formulas here; link to the code.

**Contract:** hidden `App_*` tabs hold raw values the app writes; visible tabs hold formulas and the
estimator's `override` cells. **The app never writes a visible tab.** On resync the app rewrites the
`App_*` rows; the visible `Rates` override columns are untouched, so an estimator's edits survive.

**v5 model (was v4):** bid is **cost → profit → price**. Install is always a per-unit sub rate
(no `installMode`); material is `elite_furnishes` (Elite buys) or `owner_furnishes` (material $0).
Profit lens `profitPctMode` = `markup | margin`; `materialProfitPct` + `installProfitPct`.
Removed: `installMode=pending`, `furnishType=turnkey_sub`. **Parity: the old v4 dummy bid still
totals $15,205.54** (elite_furnishes, markup, both pct 0.15) — enforced by `scripts/test-sync.ts`.

---

## Locked data fields

| Entity | Fields |
|---|---|
| **Finish** | code, type, description, unit, category, inScope |
| **Rate** | code, materialUnitCost, installRate, wastePct, cartonSize, materialSource |
| **Takeoff row** | sheet, area, finishCode, qty, unit, status |
| **Scope item** | label, mode (included/excluded/pending), allowance |
| **Settings** | projectName, gc, location, bidDate, profitPctMode, materialProfitPct, taxPct, taxMode, freight, notes, installProfitPct |

---

## Tabs (9 total)

### Hidden — app writes raw values (named ranges below)
- **`App_Finishes`** — `A code · B type · C description · D unit · E category · F inScope`
- **`App_Rates`** — `A code · B materialUnitCost · C installRate · D wastePct · E cartonSize · F materialSource`
- **`App_Takeoff`** — `A sheet · B area · C finishCode · D qty · E unit · F status`
- **`App_Scope`** — `A label · B mode · C allowance`
- **`App_Settings`** — key/value in column B:

| Cell | Key | | Cell | Key |
|---|---|---|---|---|
| B1 | projectName | | B7 | taxPct |
| B2 | gc | | B8 | taxMode |
| B3 | location | | B9 | freight |
| B4 | bidDate | | B10 | notes |
| B5 | profitPctMode (`markup`\|`margin`) | | B11 | installProfitPct |
| B6 | materialProfitPct | | | |

### Visible — formulas + estimator `override` cells
- **`Rates`** — default/override/effective triplets (cols A–Q). Override columns (C, F, I, L, O) are
  shaded; **effective = override if set, else default**. `Estimate` reads *effective*.
- **`Estimate`** — per-line **cost → sell → profit** (cols A–S) + the bid block (labels col U, values
  col V). Key cells: `V1` material cost, `V2` install cost, `V3` priced-scope cost, `V4`/`V5` material/
  install sell, `V6` job sell, `V7` profit, `V8` freight, `V10`/`V11` blended markup/margin,
  `V15` tax, `V16` BID PRICE. `S` = effective `needs_rate` flag.
- **`Summary`** — the **bid statement** (proposal page): banner + project header; a Cost/Price table
  (`A5:C15`) ending in **BID PRICE** (`C15`); scope assumptions (`A17+`); a **Checks** block (`E1:F6`,
  all must be 0 to send — needs_rate, needs_review, bad codes, duplicates).
- **`Assumptions`** — auto scope list (col A) + manual notes (col C).

**Formulas:** see `lib/sheet-builder.ts` (`ratesBtoQ`, `estBtoS`, `bidBlock`, `summaryStatement`,
`summaryChecks`) and the derivations in `pricing-v5.md` §2–§8.

---

## Named ranges (app's sync targets — all hidden)
| Name | Range |
|---|---|
| `app_finishes` | `App_Finishes!A2:F` |
| `app_takeoff` | `App_Takeoff!A2:F` |
| `app_scope` | `App_Scope!A2:C` |
| `app_rates` | `App_Rates!A2:F` |
| `app_settings` | `App_Settings!B1:B11` |

---

## Formatting (applied at build by `formattingRequests()`)
Teal banner on Summary; currency on money cells, percent on markup/margin; bold BID PRICE; frozen +
bold Estimate header; shaded Rates override columns. Makes the Sheet a presentable statement, not a
raw grid.

---

## Parity / regression — expect **$15,205.54**
Dummy bid (`scripts/test-sync.ts`): 3 in-scope finishes, all `elite_furnishes`, `markup` mode,
`materialProfitPct = installProfitPct = 0.15`, freight 500, 8% tax `total_sell_plus_freight`.

| Finish | Approved | Order | Material cost | Sub cost | Line cost |
|---|---|---|---|---|---|
| LVT-1 | 1,450 | 1,590 | $4,531.50 | $2,247.50 | $6,779.00 |
| CPT-1 | 900 | 960 | $3,072.00 | $855.00 | $3,927.00 |
| RB-1 | 500 | 600 | $552.00 | $550.00 | $1,102.00 |

Priced-scope cost **$11,808** → ×1.15 sell **$13,579.20** → +$500 freight → +8% tax ($1,126.34)
= **BID PRICE $15,205.54** · profit **$1,771.20** (15.0% markup, 13.0% margin) · Checks: 1 needs_review.
Verified against a real OAuth-built Sheet **and** `lib/estimate.ts` (the in-app preview).

---

## Notes
- `scripts/build-sheet-template.ts` is the **legacy v4** standalone master-template builder (service
  account). Superseded by `lib/sheet-builder.ts`; kept only for reference.
- Per-line overrides live in `Rates` (not `Estimate`). Mixed markup modes per line: not in v5.
