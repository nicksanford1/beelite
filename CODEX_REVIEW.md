# Codex Review — v5 Math Contract

Reviewed `STATUS.md` and `claude/v5-math-contract.md` against latest committed code:
`0f0f7d5`, `4ce25ba`, `84273ae`, `2999022`, `caf684c`, `a465d53`, `f1db7be`, `1dfbfd0`.
Static review only; no build/tests run.

## Findings

1. **The core v5 math is sound and preserves the v4 tax modes.**
   The contract correctly separates cost, sell, profit, freight, and tax. `material_cost_only`,
   `material_sell_only`, and `total_sell_plus_freight` still map cleanly to v4's tax bases, with
   `jobMaterialCost`, `jobMaterialSell`, and `jobSell + freight`. I do not see double-counting as
   written, as long as profit remains `jobSell - jobCost` and never includes freight or tax.

2. **Add explicit guards for invalid margin percentages and divide-by-zero displays.**
   `sell = cost / (1 - pct)` is correct for margin mode, but the contract should require app + Sheet
   validation for `pct < 1` and preferably `pct >= 0`. Also guard `blendedMarkup = profit / jobCost`
   and `blendedMargin = profit / jobSell` when cost/sell are zero, otherwise a bid with no approved
   takeoff or all zero rates will show sheet errors instead of clean blanks/warnings.

3. **Clarify that `jobCost` excludes freight by design.**
   The contract treats freight as pass-through at cost and excludes it from profit and blended
   percentages. That is fine, but the Summary should label this carefully, for example "priced scope
   cost" or "material + install cost", not just "job cost", unless the statement also shows a separate
   "total cost incl. freight" line. Otherwise accounting users may expect freight to be included in
   cost while markup/margin excludes it.

4. **`rateStatus` must be based on effective bid rates, not only seeded defaults.**
   The contract says per-bid override wins, but also says `needs_rate` lines warn and block ready-to-send.
   In v5, if the visible Rates override columns can fix a missing material/install rate, the warning
   must clear from the effective values. Otherwise the Sheet may keep blocking a bid after the estimator
   has entered valid overrides. Define `effectiveRateStatus` or warning formulas from effective material
   and install rates.

5. **Keep the v4 known-answer test as a required parity check.**
   The one-line worked check is correct: material sell `285 / 0.8 = 356.25`, install sell
   `155 / 0.7 = 221.43`, profit `137.68`, blended margin about `23.8%`, blended markup about `31.3%`.
   Add the v4 dummy bid as a v5 regression too: with `elite_furnishes`, markup mode, both profit pcts
   at `0.15`, same freight/tax, the bid total should still be `$15,205.54`.

6. **Migration from v4 values needs one explicit rule.**
   Current code/schema still have `installMode`, `installAmount`, and `furnishType`. Normal
   `unit_rate + furnish_and_sub` rows migrate cleanly to `installRate + elite_furnishes`. Any existing
   `pending`, `sub_quote`, or `turnkey_sub` rows cannot be losslessly mapped to "always per-unit
   install" without a decision. For demo data this may be minor, but the contract should state the
   migration behavior before schema work starts.

## Open Decisions

1. **Freight markup:** OK to defer. Keep freight pass-through in v5. Do not include freight in profit
   or blended markup/margin. If needed later, add an explicit `freightSell` or `freightProfitPct`; do
   not hide it inside the existing material/install profit formulas.

2. **Library fallback:** use exact-match-or-needs-rate for v1. Type/category fallback is useful as a
   suggestion, but it is risky to auto-price a bid from a "similar" finish without human approval.
   A safe v1 path is exact `(companyId, code)` seed first, otherwise `needs_rate`, with optional
   suggested matches shown to the user.

3. **Material pricing shape:** keep `materialUnitCost` as $/unit for v1. It preserves waste/carton
   math and keeps material pricing parallel to takeoff quantities. If a lump material quote becomes
   necessary later, add a deliberate `materialPricingMode = unit | lump`; do not overload the unit-cost
   field.

## Recommended Next Step

Revise `claude/v5-math-contract.md` once before implementation: add margin/zero guards, clarify
freight labeling, define effective-rate warning behavior, add the `$15,205.54` v4 parity check, and
state the v4 migration rule. After that, use the contract to update `sheet-template.md` v5, schema,
`lib/estimate.ts`, and `lib/sheet-builder.ts` together.
