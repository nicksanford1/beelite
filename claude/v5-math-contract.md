# Bid Engine v5 — Math Contract (proposed)

The precise math + field changes for the cost→profit→price redesign. Written **before** code so the
Sheet (`claude/sheet-template.md`), the app mirror (`lib/estimate.ts`), and the schema all implement
the *same* contract. Supersedes the v4 pricing concepts (`installMode=pending`, `furnishType=turnkey`).
Once this is stable: fold into `sheet-template.md` (→ v5), then schema + `lib/sheet-builder.ts`.

Addresses Codex review (CODEX_REVIEW.md, 7 findings) — finding # noted inline.

## 1. Per-finish inputs (after rename — finding #5)
| field | was (v4) | meaning |
|---|---|---|
| `materialUnitCost` | `materialCost` | $/unit Elite pays the supplier |
| `materialSource` | `furnishType` | `elite_furnishes` (default) \| `owner_furnishes` |
| `installRate` | `installAmount` | $/unit Elite pays the sub (the "ceiling" standard rate) |
| `wastePct`, `cartonSize` | same | material ordering only |
| `rateStatus` | *(new)* | `seeded` \| `override` \| `needs_rate` (finding #1) |
| ~~`installMode`~~ | removed | install is always per-unit subbed (finding #2) |

Settings (per bid):
| field | was (v4) | meaning |
|---|---|---|
| `profitPctMode` | `pricingMode` | `markup` \| `margin` — the lens the owner enters |
| `materialProfitPct` | `pct` | profit % on material |
| `installProfitPct` | `subMarkupPct` | profit % on install |
| `taxPct`, `taxMode`, `freight` | same | unchanged |

## 2. Quantities (unchanged from v4)
```
orderQty   = IF(carton>0, CEILING(approvedQty*(1+wastePct), cartonSize), approvedQty*(1+wastePct))
installQty = approvedQty            // install on actual, NOT over-ordered material
approvedQty = SUM of takeoff lines for this code with status "approved"
```

## 3. Cost (what Elite pays out)
```
materialCost = IF(materialSource="owner_furnishes", 0, orderQty * materialUnitCost)
installCost  = installQty * installRate
lineCost     = materialCost + installCost
```

## 4. Sell (what the customer pays for that scope) — finding #3, #4
`sell(cost, pct)` depends on the lens:
```
markup mode:  sell = cost * (1 + pct)
margin mode:  sell = cost / (1 - pct)        // pct < 1
```
```
materialSell = IF(materialSource="owner_furnishes", 0, sell(materialCost, materialProfitPct))
installSell  = sell(installCost, installProfitPct)
lineSell     = materialSell + installSell
lineProfit   = lineSell - lineCost
```

## 5. Profit / blended % — finding #3, #4
Profit is sell−cost only. **Never includes freight or tax.**
```
jobMaterialCost = Σ materialCost     jobMaterialSell = Σ materialSell
jobInstallCost  = Σ installCost      jobInstallSell  = Σ installSell
jobCost   = jobMaterialCost + jobInstallCost
jobSell   = jobMaterialSell + jobInstallSell
profit    = jobSell - jobCost                      // = Σ lineProfit
blendedMarkup = profit / jobCost                   // displayed, computed from totals
blendedMargin = profit / jobSell                   // displayed, computed from totals
```

## 6. Freight + tax (modes unchanged from v4)
Freight passes through at cost (not marked up in v5). Tax base by mode:
```
taxBase = SWITCH(taxMode,
  "material_cost_only",        jobMaterialCost,
  "material_sell_only",        jobMaterialSell,
  "total_sell_plus_freight",   jobSell + freight)
tax       = taxBase * taxPct
BID PRICE = jobSell + freight + tax
```

## 7. Truth table (one line; carton/waste omitted for clarity)
materialUnitCost `u`, installRate `r`, approvedQty `q`=orderQty here, mp/ip = the two profit %s.

| materialSource | mode | materialCost | materialSell | installCost | installSell |
|---|---|---|---|---|---|
| elite_furnishes | markup | q·u | q·u·(1+mp) | q·r | q·r·(1+ip) |
| elite_furnishes | margin | q·u | q·u/(1−mp) | q·r | q·r/(1−ip) |
| owner_furnishes | markup | 0 | 0 | q·r | q·r·(1+ip) |
| owner_furnishes | margin | 0 | 0 | q·r | q·r/(1−ip) |

Worked check (q=100, u=$2.85, r=$1.55, mp=20%, ip=30%, elite, margin, no waste/carton/freight/tax):
materialCost 285 → sell 285/0.8 = **356.25**; installCost 155 → sell 155/0.7 = **221.43**;
profit = (356.25−285)+(221.43−155) = 71.25+66.43 = **137.68**;
blendedMargin = 137.68 / 577.68 = **23.8%**; blendedMarkup = 137.68/440 = **31.3%**. ✓

## 8. Library seeding + needs-rate — finding #1, #6
- **Match order:** exact `(companyId, code)` in the rate library → (optional) `type`/`category`
  fallback, flagged `seeded (similar)` → else `rateStatus="needs_rate"`, rates left 0.
- **Snapshot, not live:** library seeds `ProjectFinish` once at confirm/create time. Library edits do
  **not** retroactively change existing bids. Per-bid override always wins. Re-sync reflects the bid's
  stored rates, never re-pulls the library.
- **No silent $0:** any `needs_rate` line shows a Summary warning and is excluded from "ready to send."
- Optional `ProjectFinish.libraryItemId` to record provenance (finding #6).

## 9. Source-of-truth split — finding #7
The Sheet computes everything above (it's the bid engine + estimator artifact). `lib/estimate.ts`
mirrors §2–§6 for the in-app preview. `scripts/test-sync.ts` reads back BID PRICE **and** profit /
blended-margin cells from a real synced Sheet so the two can't silently diverge.

## Open decisions for Codex
- §6: freight always at cost in v5 (no freight markup) — OK to defer markup-on-freight?
- §8 fallback: do we want type/category fallback in v1, or exact-match-or-needs-rate only (simpler)?
- §1: keep `materialUnitCost` as $/unit, or also allow a per-line lump material total like install?
