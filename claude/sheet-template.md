# Beelite — Google Sheet Template Spec (the bid engine) · v4

Build this once, by hand, in one Google Sheet. Type the dummy data (last section) and confirm
you get **Bid Total ≈ $15,205.54**. Then it's trusted, and the app just feeds the hidden tabs.

**Contract:** hidden `App_*` tabs hold raw values the app writes; visible tabs hold formulas and
the estimator's `override` cells. **The app never writes a visible tab.** On resync the app
**writes `App_Rates` rows in a stable order and never reorders/deletes them**, so the visible
`Rates` override cells stay aligned to their finish.

**The "aha":** app fills the bid sheet → estimator changes a rate/waste/sub quote in the visible
`Rates` `override` column → total updates instantly → resync brings defaults again but the
**override wins**. *Only edit the override columns.*

**Install = subcontracted** (sub price; `pending` = awaiting quote, carried at $0 and flagged).
**Bid structure per job** (`furnishType`): `furnish_and_sub` (buy material + sub labor, two lines)
or `turnkey_sub` (sub furnishes + installs, one number, **material auto $0**).
**Markup:** `pct` (material) and `subMarkupPct` (sub) — default equal to behave like one markup.

---

## Step 1 — locked data fields

| Entity | Fields |
|---|---|
| **Finish** | code, type, description, unit, category, inScope |
| **Takeoff row** | sheet, area, finishCode, qty, unit, status |
| **Scope item** | label, mode (included/excluded/pending), allowance |
| **Settings** | projectName, gc, location, bidDate, pricingMode, pct, subMarkupPct, taxPct, taxMode, freight, notes |
| **Rate** | code, materialCost, installMode, installAmount, wastePct, cartonSize, furnishType |

---

## Tabs (9 total)

### Hidden — app writes raw values

**`App_Finishes`** — `A code · B type · C description · D unit · E category · F inScope`
**`App_Takeoff`** — `A sheet · B area · C finishCode · D qty · E unit · F status`
**`App_Scope`** — `A label · B mode · C allowance`
**`App_Rates`** — `A code · B materialCost · C installMode · D installAmount · E wastePct · F cartonSize · G furnishType`
**`App_Settings`** — key/value, app writes column B:

| Cell | Key | Example |
|---|---|---|
| B1 | projectName | Westside Medical |
| B2 | gc | Turner |
| B3 | location | Phoenix, AZ |
| B4 | bidDate | 2026-06-20 |
| B5 | pricingMode | markup \| margin |
| B6 | pct *(material)* | 0.15 |
| B7 | taxPct | 0.08 |
| B8 | taxMode | material_cost_only \| material_sell_only \| total_sell_plus_freight |
| B9 | freight | 500 |
| B10 | notes | … |
| B11 | subMarkupPct | 0.15 |

### Visible — formulas + estimator `override` cells
**`Rates`**, **`Estimate`**, **`Summary`**, **`Assumptions`**.

---

## `Rates` tab — default / override / effective (resync-safe)

App writes only `App_Rates`. Visible `Rates` mirrors it as **defaults**, estimator edits only
**override**, **effective = override if set, else default**. `Estimate` reads *effective*.

| Col | Header | Row-2 formula (fill down) |
|---|---|---|
| A | code | `=IFERROR(App_Rates!$A$2:$A,"")` *(spill)* |
| B | defaultMaterialCost | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$B:$B,0))` |
| C | overrideMaterialCost | *(estimator)* |
| D | effectiveMaterialCost | `=IF($A2="","",IF($C2<>"",$C2,$B2))` |
| E | defaultInstallMode | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$C:$C,"pending"))` |
| F | overrideInstallMode | *(estimator)* |
| G | effectiveInstallMode | `=IF($A2="","",IF($F2<>"",$F2,$E2))` |
| H | defaultInstallAmount | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$D:$D,0))` |
| I | overrideInstallAmount | *(estimator)* |
| J | effectiveInstallAmount | `=IF($A2="","",IF($I2<>"",$I2,$H2))` |
| K | defaultWastePct | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$E:$E,0))` |
| L | overrideWastePct | *(estimator)* |
| M | effectiveWastePct | `=IF($A2="","",IF($L2<>"",$L2,$K2))` |
| N | defaultCartonSize | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$F:$F,0))` |
| O | overrideCartonSize | *(estimator)* |
| P | effectiveCartonSize | `=IF($A2="","",IF($O2<>"",$O2,$N2))` |
| Q | defaultFurnishType | `=IF($A2="","",XLOOKUP($A2,App_Rates!$A:$A,App_Rates!$G:$G,"furnish_and_sub"))` |
| R | overrideFurnishType | *(estimator)* |
| S | effectiveFurnishType | `=IF($A2="","",IF($R2<>"",$R2,$Q2))` |
| T | notes | *(estimator)* |

`installAmount`: for `unit_rate` it's $/unit; for `sub_quote`/turnkey it's the lump sum.

---

## `Estimate` tab — all formulas (overrides live in `Rates`)

Col A spills **unique** in-scope finish codes; B–O fill down, guarded by `IF($A2="","",…)`.

| Col | Header | Row-2 formula |
|---|---|---|
| A | Finish | `=IFERROR(UNIQUE(FILTER(App_Finishes!$A$2:$A,App_Finishes!$F$2:$F=TRUE)),"")` |
| B | Description | `=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$C:$C,""))` |
| C | Unit | `=IF($A2="","",XLOOKUP($A2,App_Finishes!$A:$A,App_Finishes!$D:$D,""))` |
| D | Takeoff Qty | `=IF($A2="","",SUMIFS(App_Takeoff!$D:$D,App_Takeoff!$C:$C,$A2,App_Takeoff!$F:$F,"approved"))` |
| E | Waste % | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$M:$M,0))` |
| F | Order Qty (raw) | `=IF($A2="","",$D2*(1+$E2))` |
| G | Carton size | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$P:$P,0))` |
| H | Order Qty (rounded) | `=IF($A2="","",IF($G2>0,CEILING($F2,$G2),$F2))` |
| I | Material $/unit | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$D:$D,0))` |
| J | Material Total | `=IF($A2="","",IF($O2="turnkey_sub",0,$H2*$I2))` |
| K | Install mode | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$G:$G,"pending"))` |
| L | Install amount | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$J:$J,0))` |
| M | Install (sub) Total | `=IF($A2="","",IFS($K2="unit_rate",$D2*$L2,$K2="sub_quote",$L2,$K2="pending",0))` |
| N | Line Total | `=IF($A2="","",$J2+$M2)` |
| O | Furnish type | `=IF($A2="","",XLOOKUP($A2,Rates!$A:$A,Rates!$S:$S,"furnish_and_sub"))` |

Logic: **waste → carton rounding** (`H`); **material on order qty, sub-install on actual qty**;
**`turnkey_sub` → material auto $0** (`J`); **`pending` sub = $0** (flagged).

### Bid block (Estimate, columns Q–R; col P left as spacer)

| Cell | Label | Formula |
|---|---|---|
| R1 | Subtotal | `=SUM(N2:N)` |
| R2 | Material subtotal | `=SUM(J2:J)` |
| R3 | Sub-install subtotal | `=SUM(M2:M)` |
| R4 | Pricing mode | `=App_Settings!$B$5` |
| R5 | Material pct | `=App_Settings!$B$6` |
| R6 | Sub markup pct | `=App_Settings!$B$11` |
| R7 | Material after | `=IF($R$4="margin",$R$2/(1-$R$5),$R$2*(1+$R$5))` |
| R8 | Sub after | `=IF($R$4="margin",$R$3/(1-$R$6),$R$3*(1+$R$6))` |
| R9 | After markup/margin | `=$R$7+$R$8` |
| R10 | Freight | `=App_Settings!$B$9` |
| R11 | Tax mode | `=App_Settings!$B$8` |
| R12 | Tax % | `=App_Settings!$B$7` |
| R13 | Tax | `=$R$12*IFS($R$11="material_cost_only",$R$2,$R$11="material_sell_only",$R$7,$R$11="total_sell_plus_freight",$R$9+$R$10)` |
| R14 | **BID TOTAL** | `=$R$9+$R$10+$R$13` |

Tax bases: **material_cost_only** = material cost (`R2`); **material_sell_only** = material after
markup (`R7`); **total_sell_plus_freight** = everything (`R9`+freight). Default `subMarkupPct = pct`
+ same mode → `R9` equals one blended markup (the known answer holds).

---

## `Summary` tab — project + warnings (no silent underbid)

| Label | Formula |
|---|---|
| Project | `=App_Settings!$B$1` |
| GC | `=App_Settings!$B$2` |
| Location | `=App_Settings!$B$3` |
| Bid date | `=App_Settings!$B$4` |
| **Bid Total** | `=Estimate!$R$14` |
| ⚠ Install items pending sub quote | `=COUNTIF(Estimate!$K$2:$K,"pending")` |
| ⚠ Furnish lines missing material cost | `=COUNTIFS(Estimate!$A$2:$A,"<>",Estimate!$I$2:$I,0,Estimate!$O$2:$O,"furnish_and_sub")` |
| ⚠ Install amount missing (not pending) | `=COUNTIFS(Estimate!$A$2:$A,"<>",Estimate!$L$2:$L,0,Estimate!$K$2:$K,"<>pending")` |
| ⚠ Takeoff rows still needs_review | `=COUNTIF(App_Takeoff!$F$2:$F,"needs_review")` |
| ⚠ Takeoff unit ≠ finish unit | `=SUMPRODUCT((App_Takeoff!$C$2:$C<>"")*(App_Takeoff!$E$2:$E<>IFERROR(XLOOKUP(App_Takeoff!$C$2:$C,App_Finishes!$A:$A,App_Finishes!$D:$D),App_Takeoff!$E$2:$E)))` |
| ⚠ Takeoff code not in finishes | `=SUMPRODUCT((App_Takeoff!$C$2:$C<>"")*(ISNA(MATCH(App_Takeoff!$C$2:$C,App_Finishes!$A:$A,0))))` |
| ⚠ Duplicate finish codes | `=SUMPRODUCT((App_Finishes!$A$2:$A<>"")*(COUNTIF(App_Finishes!$A$2:$A,App_Finishes!$A$2:$A&"")>1))` |
| ⚠ Duplicate rate codes | `=SUMPRODUCT((App_Rates!$A$2:$A<>"")*(COUNTIF(App_Rates!$A$2:$A,App_Rates!$A$2:$A&"")>1))` |

Any warning > 0 means the bid is incomplete/unsafe — surface these prominently.

## `Assumptions` tab — auto from scope + manual notes
- **Column A** *(formula, do not edit)* — auto-drafted from scope, row 2:
  `=IFERROR(FILTER(App_Scope!$A$2:$A&" — "&App_Scope!$B$2:$B&IF(App_Scope!$C$2:$C<>""," (allowance $"&App_Scope!$C$2:$C&")",""),App_Scope!$A$2:$A<>""),"")`
- **Column C** *(estimator types here)* — free-form manual notes/exclusions. The export includes both.

(The auto column is formula-generated, so it isn't hand-editable; column C is the editable area.)

---

## Named ranges (app's sync targets — all hidden)
| Name | Range |
|---|---|
| `app_finishes` | `App_Finishes!A2:F` |
| `app_takeoff` | `App_Takeoff!A2:F` |
| `app_scope` | `App_Scope!A2:C` |
| `app_rates` | `App_Rates!A2:G` |
| `app_settings` | `App_Settings!B1:B11` |

---

## Dummy test data — type this in, expect **$15,205.54**

**App_Finishes**
```
LVT-1 | LVT          | Luxury vinyl tile  | SF | floor | TRUE
CPT-1 | Carpet tile  | Office carpet tile | SF | floor | TRUE
RB-1  | Rubber base  | 4" rubber base     | LF | base  | TRUE
PT-2  | Paint        | Wall paint         | -- | wall  | FALSE
```
**App_Rates** *(furnishType = furnish_and_sub for all)*
```
LVT-1 | 2.85 | unit_rate | 1.55 | 0.08 | 30  | furnish_and_sub
CPT-1 | 3.20 | unit_rate | 0.95 | 0.06 | 48  | furnish_and_sub
RB-1  | 0.92 | unit_rate | 1.10 | 0.05 | 100 | furnish_and_sub
```
**App_Takeoff**
```
A101 | Rooms 101-108 | LVT-1 | 1250 | SF | approved
A101 | Corridor      | LVT-1 |  200 | SF | approved
A101 | Open office   | CPT-1 |  900 | SF | approved
A101 | Whole floor   | RB-1  |  500 | LF | approved
A101 | Storage       | CPT-1 |  100 | SF | needs_review   ← excluded; fires a warning
```
**App_Settings**: pricingMode=`markup`, pct=`0.15`, subMarkupPct=`0.15`, taxPct=`0.08`,
taxMode=`total_sell_plus_freight`, freight=`500` *(leave all Rates `override` cells blank)*

**Expected**
| Finish | Approved | +Waste | →Carton | Material | Sub-install | Line |
|---|---|---|---|---|---|---|
| LVT-1 | 1,450 | 1,566 | 1,590 | $4,531.50 | $2,247.50 | $6,779.00 |
| CPT-1 | 900 | 954 | 960 | $3,072.00 | $855.00 | $3,927.00 |
| RB-1 | 500 | 525 | 600 | $552.00 | $550.00 | $1,102.00 |

Subtotal **$11,808** → ×1.15 = **$13,579.20** → +$500 = **$14,079.20** → +8% tax ($1,126.34)
= **Bid Total $15,205.54** ✅  · Summary: **1 takeoff row needs review**.

**Spot checks:**
- `taxMode=material_cost_only` → tax = 8% × $8,155.50 = **$652.44** (different total — setting works).
- **Turnkey:** set a finish `materialCost=0`, `installMode=sub_quote`, `furnishType=turnkey_sub` →
  material auto $0, one sub line, no false material warning.
- **Bad code:** add a takeoff row with `finishCode=ZZZ` → "Takeoff code not in finishes" = 1.

---

## Resolved since v3
- **Turnkey material auto $0** (Estimate `J`).
- **Code-validation warnings** — unknown takeoff code, duplicate finish codes, duplicate rate codes.
- **Tax mode names** clarified (`material_cost_only | material_sell_only | total_sell_plus_freight`).
- **Assumptions genuinely editable** — auto lines in col A, manual notes in col C.
- **Resync stability rule** — app writes `App_Rates` in stable order, never reorders/deletes rows.

## Still open (Claude ↔ Codex)
1. **Adhesive / extras** — `Estimate` columns now, or defer past V1?
2. **Per-line overrides on `Estimate`** — none today (overrides live in `Rates`).
3. **Mixed markup modes** — one `pricingMode` toggles both material & sub; split later if needed.
4. **Overrides keyed by code** (vs stable-row) — production hardening, not needed for demo.
