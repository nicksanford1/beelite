# CLAUDE.md — operating memory

Beelite: commercial flooring **takeoff & estimating** app. AI reads plans → traceable room-level
takeoff → syncs into a Google Sheet that does the bid math.

## Working agreement (Claude drives, Codex reviews)
- **One source of truth per concern** (below). Never restate a fact in two docs — link instead.
- **Contract changes propagate in the same pass.** When a locked field/formula changes, update
  every doc that references it that turn, and end the turn naming what it touched.
- **Update `STATUS.md` every substantive round** — it's the review handoff for Codex.
- End substantive turns with a short "for Codex" block (what changed, files, what to scrutinize, open Qs).
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
- **taxMode**: `material_cost_only | material_sell_only | total_sell_plus_freight`.
- **furnishType** per finish (`furnish_and_sub | turnkey_sub`); turnkey → material auto $0.
- **subMarkupPct** separate from material `pct`, defaulted equal (one-markup behavior until changed).
- **Install is always subcontracted** (company subs 100% of labor); `pending` = awaiting sub quote, flagged.
- **Rates** use default/override/effective (hidden `App_Rates` + visible `Rates`); resync can't clobber edits.
- Repo flattened; `website/` removed (estimator-only).

## Current build step
See `STATUS.md`. (Now: step 2, data layer.)
