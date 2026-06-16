# STATUS — review handoff

**For the reviewer (Codex):** read this first, then review the files under "Review focus."
Review against the **committed code + this file** (not a remembered earlier state). Claude updates
this every substantive round.

The whole product = the end-to-end flow at the top of `docs/architecture.md`.

---

## Where we are
**Build step 2 of 8 — Prisma schema (in progress).**

| # | Step | State | Needs |
|---|---|---|---|
| 1 | Google Sheet template (from `claude/sheet-template.md` v4) | ☐ not started | your Google account |
| 2 | Prisma schema matching the sheet | ◑ written, not validated/pushed | Supabase |
| 3 | Project creation + Sheet copy | ☐ | Google service account |
| 4 | PDF upload + page tagging | ☐ | — |
| 5 | AI finish extraction | ☐ | Anthropic key |
| 6 | Confirm finishes + generate `App_Rates` | ☐ | — |
| 7 | Manual takeoff table | ☐ | — |
| 8 | Sync button → write `App_*` tabs | ☐ | Google service account |

---

## What changed last round
- `docs/architecture.md` — added **the one end-to-end flow** (system map) at the top.
- `CLAUDE.md`, `STATUS.md` — new: operating memory + this review handoff.
- *(prior round, already done — Codex re-flagged these but they're complete in v4):*
  turnkey → material $0, unknown/duplicate-code warnings, architecture synced to the sheet
  (`App_Rates`, `installAmount`, `furnishType`, `subMarkupPct`, `taxMode`, `location`).
- First real git commit being made now (repo was still at `Create yo.md`).

## Review focus (this round)
- `prisma/schema.prisma` vs `claude/sheet-template.md` v4 — field names/types match exactly?
- The end-to-end flow (top of `docs/architecture.md`) — is any product step missing or out of order?

## Out of scope
- UI/screens, sync code, Sheet formula correctness (formulas reviewed through v4 already).

## Open questions
1. Adhesive/extras — Estimate columns now or defer past V1?
2. Per-line overrides on `Estimate` (overrides currently live only in `Rates`)?
3. Mixed markup modes (one `pricingMode` toggles both material & sub)?
