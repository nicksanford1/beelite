# Codex Review — Pricing Model + Bid Statement Proposal

Reviewed `STATUS.md` against latest committed code:
`4ce25ba`, `84273ae`, `2999022`, `caf684c`, `a465d53`, `f1db7be`, `1dfbfd0`, `a25c6bc`.
Static review only; no build/tests run.

## Findings

1. **The proposed Elite pricing model is coherent, but keep a non-pricing "needs rate" state.**
   Removing `installMode="pending"` and `furnishType="turnkey_sub"` as pricing concepts makes sense
   for the owner's workflow: Elite buys material unless `owner_furnishes`, and install is always
   subcontracted at a per-unit standard rate. The gap is unmatched/new finishes. Today extracted
   finishes are created with zero rates and `installMode="pending"` (`app/actions.ts:138`-`149`,
   `prisma/schema.prisma:112`-`118`). If `pending` goes away, v5 still needs a warning/status for
   "library did not seed a usable material/install rate" so the app cannot silently bid $0.

2. **Do not model "real quote arrived" as a different install mode.**
   The proposal is stronger if install stays one formula: `approvedQty * effectiveInstallRate`.
   If a real sub quote arrives later, represent it as a per-bid override rate or an optional quoted
   total explicitly converted to an effective rate. Keeping `sub_quote` as a lump-sum branch would
   preserve v4 complexity and make line profit/margin harder to explain.

3. **The Cost -> Profit -> Price waterfall must define profit before freight and tax.**
   In v4, tax can be based on material cost, material sell, or total sell plus freight
   (`claude/sheet-template.md`, bid block R13; mirrored in `lib/estimate.ts`). For v5, "Elite profit"
   should be:
   `materialSell + installSell - materialCost - installCost`.
   It should not include freight unless Elite marks freight as profitable, and it should never include
   tax. Then bid price is `materialSell + installSell + freight + tax`. This avoids double counting
   and keeps the three existing tax modes valid.

4. **One displayed markup/margin is a blended result, not a single input.**
   Because material and install can have different profit percentages (`pct` and `subMarkupPct` today),
   Summary can show a total profit $, blended markup %, and blended margin %, but those blended
   percentages must be calculated from totals:
   `blendedMarkup = totalProfit / totalCost`;
   `blendedMargin = totalProfit / (materialSell + installSell)`.
   Do not imply that one headline percentage was applied uniformly unless material and install rates
   actually share the same percentage.

5. **Rename the percentage fields or the UI will stay confusing.**
   Current code stores `pricingMode`, `pct`, and `subMarkupPct` (`prisma/schema.prisma:145`-`153`) and
   the UI labels one field "Sub markup %" even when `pricingMode="margin"` (`app/projects/[id]/estimate/page.tsx`).
   If owner-facing v5 defaults to target margin, keeping `subMarkupPct` as the schema/API name is a
   footgun. Use neutral names such as `materialProfitPct` / `installProfitPct` plus `profitPctMode`,
   or be very explicit that the same field stores either markup or margin depending on mode.

6. **The company rate library needs an explicit matching/fallback policy.**
   `FinishLibraryItem` and `RateCatalogEntry` exist, but `ProjectFinish` has no link back to the
   library and confirm/save flows do not seed from the catalog yet. Before building v5, define how an
   extracted finish maps to a default rate: exact company+code match first, then optional type/category
   fallback, then "needs rate" warning. Also decide whether a later library update should affect
   existing bid defaults on re-sync or only new bids.

7. **The Sheet should remain the canonical calculator, with the app mirroring it under test.**
   Put the margin <-> markup conversion formulas in the Sheet because the Sheet is the bid engine and
   estimator-facing artifact. The app should mirror those formulas in `lib/estimate.ts` for preview,
   and the test-sync script should keep reading back the known total/profit cells from a real Sheet.
   Avoid inventing one formula in the app and a similar-but-not-identical formula in Sheets.

## Recommended Next Step

Write the v5 math contract first before coding: define the new hidden fields, rename/replace
`installMode` and `furnishType`, specify library seeding and "needs rate" warnings, and add a small
truth table for `elite_furnishes`, `owner_furnishes`, each tax mode, and markup-vs-margin conversion.
Once that table is stable, update `claude/sheet-template.md`, then implement schema/app/sheet-builder
changes against that contract.
