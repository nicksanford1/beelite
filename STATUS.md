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

**Latest commit:** run `git log -6 --oneline` (this file's own commit is the newest; review the rest).

---

## Where we are
**Full in-app loop works: plan → AI finishes → rates → takeoff → bid total ✅. Next: bigger plans + page tagging, then Google Sheet sync, then polish.**

| # | Step | State | Needs |
|---|---|---|---|
| 1 | Google Sheet template (from `claude/sheet-template.md` v4) | ☑ done — built + verified $15,205.54 | — |
| 2 | Prisma schema matching the sheet | ☑ done — pushed to Supabase (session pooler) | — |
| 3 | Project creation | ☑ done | — |
| 4 | PDF upload + page tagging | ◑ upload done; page tagging still TODO (needed for big multi-page sets) | — |
| 5 | AI finish extraction (in app) | ☑ done — `lib/anthropic.ts` + `/finishes` review/confirm; `Extraction` correction log captured; ~$0.06/page | — |
| 6 | Rates per finish | ☑ done — `/rates` editor | — |
| 7 | Room-level takeoff | ☑ done — `/takeoff` editor + rollup | — |
| 8 | In-app bid preview | ☑ done — `/estimate` (`lib/estimate.ts` mirrors the Sheet math) | — |
| 9 | Sync → Google Sheet `App_*` tabs | ☐ | Google auth decision |
| 10 | Visual polish pass | ☐ (last) | — |

---

## Claude proposes next
Extraction works in a script ($0.06/page, opus-4-8, structured output). Now make it a product feature:

1. **Claude:** wire extraction into the app — a "Read schedule" action on a tagged PDF →
   `extractFinishSchedule` → review table → confirm/edit → save `ProjectFinish` + log the
   raw vs corrected output in the `Extraction` table (the eval/training asset).
2. **Claude:** page tagging (mark which uploaded page is the finish schedule) so extraction
   targets the right page in multi-page sets.
3. **Claude:** seed `App_Rates` from confirmed finishes (step 6), then takeoff (7) + sync (8).

Note: PDF sent to Claude *natively* (no pre-extract); single structured call (not an agent),
per Anthropic guidance.

**Deferred — Sheet copy** (`*` on step 3): service account can't create/copy sheets on personal
Gmail. Needs OAuth or Workspace Shared Drive, or reuse one pre-shared sheet for the demo. Decide
before wiring per-project sheets. ⚠ Don't build `drive.files.copy` with the current service account.

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

### Codex review — 2026-06-16, latest commit `1903b53`
Reviewed `STATUS.md` against recent commits `a664410..1903b53`, plus the current schema,
architecture summary, Sheet v4 spec, and new Sheet build scripts. Static review only.

Findings / notes:
- `STATUS.md` is stale by one commit: it lists latest commit `5af3acd`, but current `HEAD` is
  `1903b53` (`Update STATUS: step 1 (Sheet bid engine) done; flag sync auth issue`).
- Prior schema review items look addressed: `ProjectFinish` now has `@@unique([projectId, code])`
  and safe defaults; `TakeoffLine` defaults to `manual` / `draft`; architecture now documents that
  `App_Settings` merges `Project` fields with `EstimateSettings`.
- Sheet v4, Prisma, and architecture are aligned enough for Step 2. I don't see a new field mismatch
  that should block schema validation/push.
- The big new blocker is correctly called out in `STATUS`: service-account auth can populate a
  shared Sheet, but cannot create/copy Sheets under personal Gmail storage. Do not build Step 3
  assuming `drive.files.copy` with the current service account will work.
- Decide the Google auth path before coding project creation: OAuth/user-connected Google is the
  likely product path; Workspace Shared Drive is acceptable only if the demo/customer environment
  supports it.
- `scripts/build-sheet-template.ts` is good for proving the bid engine, but it is not idempotent
  against an already-built `SHEET_ID` because it adds fixed sheet IDs/titles. Treat it as "run on a
  blank/shared Sheet" unless later hardened.
- `package.json` no longer includes future-stack deps like Anthropic, Supabase client, or PDF tooling.
  Fine if intentionally deferred, but add them back when starting upload/extraction/storage work.

Recommended next step:
1. Update `STATUS.md` latest commit to `1903b53`.
2. Proceed with Step 2 only: validate/push Prisma once the user explicitly asks to run setup.
3. Before Step 3, make a decision record in `STATUS.md` for Google auth: OAuth vs Shared Drive vs
   temporary manual `SHEET_ID` flow for demo.

---

## Open questions
1. Adhesive/extras — Estimate columns now or defer past V1?
2. Per-line overrides on `Estimate` (overrides currently live only in `Rates`)?
3. Mixed markup modes (one `pricingMode` toggles both material & sub)?
