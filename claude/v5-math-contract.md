# Bid Engine v5 — Math Contract (proposed)

The precise math + field changes for the cost→profit→price redesign. Written **before** code so the
Sheet (`claude/sheet-template.md`), the app mirror (`lib/estimate.ts`), and the schema all implement
the *same* contract. Supersedes the v4 pricing concepts (`installMode=pending`, `furnishType=turnkey`).
Once this is stable: fold into `sheet-template.md` (→ v5), then schema + `lib/sheet-builder.ts`.

**Status: rev 2 — Codex-reviewed twice, core math approved, all findings folded in. Ready to implement.**
Finding #s noted inline reference the two CODEX_REVIEW rounds (pricing proposal, then this contract).

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
margin mode:  sell = cost / (1 - pct)
```
**Guards (rev — Codex #2):** require `0 <= pct` always, and `pct < 1` in margin mode (a 100%+ margin
is undefined). App validates on input; the Sheet wraps margin sell in `IFERROR`/`IF(pct>=1,…)` so a
bad % shows a clean warning, not `#DIV/0!`.
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
pricedScopeCost = jobMaterialCost + jobInstallCost   // material + install Elite pays (NO freight)
jobSell   = jobMaterialSell + jobInstallSell
profit    = jobSell - pricedScopeCost              // = Σ lineProfit
totalCostInclFreight = pricedScopeCost + freight   // shown as its own Summary line (Codex #3)
blendedMarkup = IF(pricedScopeCost>0, profit / pricedScopeCost, "")   // guard (Codex #2)
blendedMargin = IF(jobSell>0,        profit / jobSell,        "")   // guard (Codex #2)
```
**Labeling (Codex #3):** the Summary shows **"Priced scope cost (material + install)"** for
`pricedScopeCost` and a separate **"Total cost incl. freight"** line — never a bare "job cost" — so
the markup/margin (which exclude freight) aren't mistaken for being freight-inclusive.

## 6. Freight + tax (modes unchanged from v4)
Freight passes through **at cost** (not marked up in v5 — Codex open-decision #1, accepted). If
freight markup is ever needed, add an explicit `freightProfitPct`/`freightSell`; never fold it into
the material/install profit formulas. Tax base by mode:
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

## 8. Library seeding + needs-rate — finding #1, #4, #6
- **Match policy (v1, Codex open-decision #2):** exact `(companyId, code)` in the rate library seeds
  the rate → else `needs_rate`, rates left 0. **No auto-pricing from a "similar" finish.** Type/category
  matches may be *shown to the user as suggestions* but never applied without a human click.
- **Snapshot, not live:** library seeds `ProjectFinish` once at confirm/create time. Library edits do
  **not** retroactively change existing bids. Per-bid override always wins. Re-sync reflects the bid's
  stored rates, never re-pulls the library.
- **Warnings key off EFFECTIVE rates (Codex #4):** the `needs_rate` warning is computed from the
  *effective* material + install rate (override-or-default), not just the seeded default — so an
  estimator typing a valid override in the Rates tab **clears** the flag. Define an
  `effectiveRateStatus` = `needs_rate` iff (materialSource=elite_furnishes AND effMaterial<=0) OR
  (effInstall<=0); else `ok`. The Sheet's "ready to send" check and the app both read this.
- **No silent $0:** any effective-`needs_rate` line shows a Summary warning and blocks "ready to send."
- Optional `ProjectFinish.libraryItemId` to record provenance (finding #6).

## 9. Source-of-truth split + regression tests — finding #5, #7
The Sheet computes everything above (it's the bid engine + estimator artifact). `lib/estimate.ts`
mirrors §2–§6 for the in-app preview. `scripts/test-sync.ts` reads back BID PRICE **and** profit /
blended-margin cells from a real synced Sheet so the two can't silently diverge.

**Required parity checks (Codex #5):**
- §7 worked line: profit `137.68`, blended margin `23.8%`, markup `31.3%`.
- **v4 known-answer regression:** the v4 dummy bid under v5 — all `elite_furnishes`, `markup` mode,
  `materialProfitPct = installProfitPct = 0.15`, same freight/tax — must still total **$15,205.54**.
  Both `lib/estimate.ts` and a real synced Sheet must reproduce it before v5 ships.

## 10. v4 → v5 migration rule (Codex #6)
Existing demo rows convert as:
| v4 value | v5 result |
|---|---|
| `installMode=unit_rate`, `installAmount=r` | `installRate=r` |
| `furnishType=furnish_and_sub` | `materialSource=elite_furnishes` |
| `furnishType=turnkey_sub` | `materialSource=owner_furnishes` (both = Elite material cost $0) |
| `installMode=pending` | `installRate=0`, `effectiveRateStatus=needs_rate` (re-enter or override) |
| `installMode=sub_quote` (lump) | `installRate=0` → `needs_rate`; re-enter as a per-unit override |
Lossy cases (`pending`, `sub_quote`) are acceptable for demo data because they had no real number yet;
the rule is **stated** so the migration is deliberate, not silent.

## Open decisions — RESOLVED by Codex review
1. **Freight markup:** deferred — freight stays pass-through at cost (§6).
2. **Library fallback:** exact-match-or-`needs_rate` for v1; "similar" matches are suggestions only (§8).
3. **Material pricing shape:** keep `materialUnitCost` as $/unit; if a lump material quote is ever
   needed, add a deliberate `materialPricingMode = unit | lump` rather than overloading the field.
