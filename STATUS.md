# STATUS — the handoff file (read this first)

This single file is how **You ⇄ Claude ⇄ Codex** work together. Anyone reading it should know
exactly where we are and what to do next.

## How this works (the loop)
1. **Claude** drives — writes code/specs, then updates **Where we are** + **Claude proposes next** below.
2. **You tell Codex to review.** Codex reads this file + the latest commit, then **writes its take in
   the "Codex review" section** below (append; don't edit Claude's sections). Codex should: (a) review
   the files in *Review focus*, (b) give its own recommendation for the next step.
3. **You tell Claude to read this file.** Claude responds with what it thinks of Codex's notes.
4. **You decide.** Claude executes, then updates this file again. Repeat.

**Rules:** review against the **committed code** (latest commit below), not memory · keep entries
short · one source of truth per concern (see `CLAUDE.md`) · the whole product = the end-to-end flow
at the top of `docs/architecture.md`.

**Latest commit:** `5af3acd`

---

## Where we are
**Step 1 done ✅ (Sheet bid engine built + verified $15,205.54). Step 2 — Prisma schema next.**

| # | Step | State | Needs |
|---|---|---|---|
| 1 | Google Sheet template (from `claude/sheet-template.md` v4) | ☑ done — built via `scripts/build-sheet-template.ts`, verified | — |
| 2 | Prisma schema matching the sheet | ◑ written, not validated/pushed | Supabase |
| 3 | Project creation + Sheet copy | ☐ | Google service account |
| 4 | PDF upload + page tagging | ☐ | — |
| 5 | AI finish extraction | ☐ | Anthropic key |
| 6 | Confirm finishes + generate `App_Rates` | ☐ | — |
| 7 | Manual takeoff table | ☐ | — |
| 8 | Sync button → write `App_*` tabs | ☐ | Google service account |

---

## Claude proposes next
Step 1 done — Sheet bid engine built + verified ($15,205.54), owned by you, populated by the
service account. Template id: `1WNZncwQZqEa7p64rLq6GVlMm2DUhMeCLw6H3QoVao3U`.

1. **You:** open the Sheet, sanity-check it, try editing a `Rates` override to see the total move.
2. **You:** create a Supabase project (free) for the database; have the Anthropic key handy.
3. **Claude:** validate the schema (`prisma generate`) + push to Supabase (finishes step 2).
4. **Claude:** step 3 — project creation + Sheet copy.

⚠ **Known issue for the sync step (3 & 8):** the same service-account storage limit means the app
**can't *copy* the template** on personal Gmail either. The per-project Sheet creation will need a
different auth path — OAuth (user connects their Google) or a Workspace Shared Drive. Decide before
building step 3. (Populating a pre-shared sheet works fine; *creating/copying* is the blocked part.)

## Review focus (for Codex, this round)
- `prisma/schema.prisma` vs `claude/sheet-template.md` v4 — field names/types match exactly?
- End-to-end flow (top of `docs/architecture.md`) — any product step missing or out of order?
- Sanity-check "Claude proposes next" — agree with the order, or is there a better next move?

## Out of scope
UI/screens, sync code, Sheet formula correctness (reviewed through v4).

---

## Codex review
*(Codex: append your review + your recommended next step here. Don't edit sections above.)*

— pending first review —

### Codex review — 2026-06-16
Reviewed `STATUS.md`, latest commits, `claude/sheet-template.md` v4, `docs/architecture.md`,
and `prisma/schema.prisma`. Static review only; no validation/setup should be treated as completed.

Findings / notes:
- `STATUS.md` is stale on commit tracking: it says latest commit is `d16b6b0`, but current `HEAD`
  is `900042f` (`Make STATUS.md the You/Claude/Codex handoff protocol`). Update that each handoff.
- Sheet v4 and the actual Prisma schema are mostly aligned on the locked fields: `App_Rates`,
  `installAmount`, `furnishType`, `subMarkupPct`, `taxMode`, and `location` are represented.
- `App_Settings.notes` maps to `Project.notes`, not `EstimateSettings`. That's fine, but document
  that mapping so nobody expects every App_Settings value to live in `EstimateSettings`.
- Add `@@unique([projectId, code])` on `ProjectFinish`. The Sheet assumes unique finish codes per
  project, and duplicate codes create confusing rollups even though Summary warns later.
- Consider Prisma defaults for V1 workflow fields: `TakeoffLine.source @default("manual")`,
  `TakeoffLine.status @default("draft")`, `ProjectFinish.installMode @default("pending")`,
  `ProjectFinish.wastePct @default(0)`, and `ProjectFinish.furnishType @default("furnish_and_sub")`.
  This matches the product flow and reduces boilerplate in early forms.
- When AI confirms finishes before real rates are known, required fields like `materialCost` and
  `wastePct` need safe defaults. Make that explicit in the confirm-finishes step.
- `docs/architecture.md` still includes a schema snippet with `users User[]` and `adhesiveRule`,
  which do not match the current committed Prisma schema. Either update the snippet or make it clear
  the real source is `prisma/schema.prisma`.
- There is an untracked `.claude/` directory in the working tree. Ignore if local-only; commit or
  remove intentionally if it is meant to be part of the repo.

Recommended next step:
1. Do a tiny schema/docs cleanup pass first: update the stale commit in `STATUS.md`, add the
   project-finish uniqueness/defaults, and align the architecture schema snippet with the real Prisma
   schema.
2. Then validate the schema when the user explicitly asks for execution/setup.
3. In parallel or next, build/verify the actual Google Sheet template from v4, because the app now
   has a clear contract to follow.

---

## Open questions
1. Adhesive/extras — Estimate columns now or defer past V1?
2. Per-line overrides on `Estimate` (overrides currently live only in `Rates`)?
3. Mixed markup modes (one `pricingMode` toggles both material & sub)?
