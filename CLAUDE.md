# CLAUDE.md — operating memory

Beelite: commercial flooring **takeoff & estimating** app. AI reads plans → traceable room-level
takeoff → syncs into a Google Sheet that does the bid math.

## Working agreement (Claude drives, Codex reviews)
- **One source of truth per concern** (below). Never restate a fact in two docs — link instead.
- **Contract changes propagate in the same pass.** When a locked field/formula changes, update
  every doc that references it that turn, and end the turn naming what it touched.
- **Review loop via two files:** `STATUS.md` = Claude's briefing (Codex reads it; it opens with
  explicit "Codex, do this" instructions). `CODEX_REVIEW.md` = Codex's output (Codex overwrites it).
  Keep STATUS.md a clean current-round snapshot. When the user says **Codex is done / "read it"**,
  read `CODEX_REVIEW.md` and respond. Don't make the user relay Codex's notes by hand.
- Flag prerequisites/risks proactively.

## Source-of-truth map
| Concern | Owns it |
|---|---|
| Product (what/why/scope) | `docs/v1-plan.md` |
| Technical wiring (stack, schema, sync, prompts) | `docs/architecture.md` |
| The Google Sheet bid engine (tabs, formulas, fields) | `claude/sheet-template.md` (v4) |
| Where we are / review handoff | `STATUS.md` |

## Stack & conventions
- Next.js (App Router) + TypeScript · Postgres via Supabase · Prisma · Anthropic API · Google Sheets/Drive.
- Repo is **flattened** (app at root, no subfolder).
- `page.tsx` = screen, `route.ts` = API endpoint. Brains in `lib/`, not screens.
- Naming: routes kebab-case · components PascalCase · lib kebab-case · Prisma models PascalCase · env SCREAMING_SNAKE.

## Architecture in one line
Google Sheets is the **bid engine**; the app is the **capture / review / sync** layer. App writes
only hidden `App_*` tabs (stable order, no reorder/delete); visible tabs are formulas + estimator
`override` columns. DB stores inputs, not computed totals.

## Key decisions (newest first)
- **v5 pricing model** (`claude/v5-math-contract.md`): bid is **cost → profit → price**. Install is
  always a per-unit sub rate; `materialSource` = `elite_furnishes | owner_furnishes` (owner → material $0).
  Removed `installMode=pending` and `furnishType=turnkey_sub`. Verified: v4 dummy bid still = $15,205.54.
- **Profit lens** `profitPctMode` = `markup | margin` (default margin); `materialProfitPct` +
  `installProfitPct` (renamed from `pct`/`subMarkupPct`). Summary shows profit $, blended markup %, margin %.
  Profit excludes freight + tax. Margin guarded `0 ≤ pct < 1`.
- **needs_rate** from EFFECTIVE rates (override clears it); company rate library seeds new bids
  (exact `company+code` match, snapshot-at-confirm, override wins; no auto-price from "similar").
- **taxMode**: `material_cost_only | material_sell_only | total_sell_plus_freight` (unchanged).
- **Rates** use default/override/effective (hidden `App_Rates` + visible `Rates`); resync can't clobber edits.
- **Google Sheet sync** via OAuth (`drive.file`): one Sheet per bid, app is the master index.
- Repo flattened; `website/` removed (estimator-only).

## Current build step
See `STATUS.md`. (Now: v5 pricing redesign built + verified; Sheet formatted as a bid statement.)
