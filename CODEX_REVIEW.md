# Codex Review — v5 Implementation

Reviewed `STATUS.md` against latest committed code:
`5583d84`, `684692f`, `0f0f7d5`, `4ce25ba`, `84273ae`, `2999022`, `caf684c`, `a465d53`.
Static review only; no build/tests run.

## Findings

1. **Existing synced bids can keep old Sheet formulas while receiving v5 inputs.**
   `syncBidToSheet` reuses any saved `project.sheetId` and calls `updateBidData`
   (`app/actions.ts:297-302`). `updateBidData` only clears/rewrites `App_*` values and explicitly
   leaves formulas/formats untouched (`lib/sheet-builder.ts:327-339`). The verified v5 test only
   covers fresh Sheet creation (`scripts/test-sync.ts:45-54`). Since v5 changed the hidden input
   shape and visible formulas, any bid that already has a pre-v5 Sheet id can silently sync v5 data
   into a v4 workbook and produce wrong bid totals. Add a Sheet engine version check/sentinel and
   recreate or rebuild the workbook when the saved sheet is not v5. For the current demo DB, clearing
   old `Project.sheetId` values is the quick one-time fix.

2. **Invalid profit percentages are accepted, and invalid cases diverge between app and Sheet.**
   `saveSettings` accepts any parsed number (`app/actions.ts:238-249`), and the estimate inputs have
   no `min`/`max` guard (`app/projects/[id]/estimate/page.tsx:147-151`). The app clamps negative
   markup/margin back to cost and only warns for margin `>= 1` (`lib/estimate.ts:56-60`,
   `lib/estimate.ts:131-134`). The Sheet formulas only blank out margin `>= 1`, and negative values
   flow directly into sell formulas (`lib/sheet-builder.ts:94-95`); the Summary checks do not flag
   invalid pricing settings (`lib/sheet-builder.ts:140-146`). Example: margin `1.0` makes the app show
   sell-at-cost with a warning, but the Sheet blanks `O/P`, causing much lower sell/profit. Enforce
   `pct >= 0` always and `pct < 1` in margin mode in the server action, mirror it in the UI, and add
   a Sheet-facing warning/check so bad settings cannot produce a bid number.

3. **Re-confirming finishes breaks the intended rate snapshot/manual override semantics.**
   The UI explicitly allows re-confirming a previously confirmed extraction
   (`app/projects/[id]/finishes/page.tsx:70-72`, `components/finish-review.tsx:74-79`). The action
   then deletes every `ProjectFinish`, pulls the current company library again, and recreates rows
   (`app/actions.ts:139-170`). That means a later correction pass can wipe manual per-bid rates and
   retroactively pick up library edits, which conflicts with the contract's "snapshot, not live" rule.
   Merge by code instead: preserve existing per-bid rate fields for unchanged codes, seed only new
   codes from the library, and make any "reset rates from library" behavior explicit.

4. **Formula tabs only calculate the first 60 in-scope finishes.**
   `N = 60` drives the fill-down formulas for `Rates!B:Q` and `Estimate!B:S`
   (`lib/sheet-builder.ts:8`, `lib/sheet-builder.ts:233-236`). `Rates!A2` and `Estimate!A2` can spill
   more than 60 codes, but rows after 61 will not have cost/sell/rate-status formulas, so a larger
   finish schedule can be partially visible while undercounted in the bid. Either fill a much larger
   bounded range, generate rows from the actual finish count, or use array formulas for the computed
   columns.

## Checks That Look Correct

- The normal valid-input cost -> sell -> profit math in `lib/estimate.ts` matches the v5 contract:
  order quantity uses waste/carton, install uses approved quantity, owner-furnished material costs
  and sells at zero, freight/tax stay outside profit.
- `Estimate!S` uses the effective Sheet rate columns (`J/K` plus material source `E`), so Sheet-side
  rate overrides clear the Sheet's `needs_rate` warning as intended.
- `confirmFinishes` does use a company-scoped exact code match and does not auto-price from
  type/category fallback suggestions.
- `formattingRequests()` ranges line up with the current v5 layout; I do not see an off-by-one in the
  Summary money/percent block, Estimate `J:R` money block, bid block `V1:V16`, or Rates override
  shading.

## Recommended Next Step

Fix the re-sync/versioning path first, then add server-side numeric validation for pricing settings
and rates. After that, run two regressions: fresh v5 Sheet create still returns `$15,205.54`, and an
old/pre-v5 `sheetId` either rebuilds or is replaced instead of being updated in place.
