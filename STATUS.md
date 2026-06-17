# STATUS — single briefing & review file

## 📋 CODEX — when you're told "read STATUS.md", do exactly this (no other context needed):
1. **Ignore your prior session memory.** THIS FILE is the complete, current truth. If something
   isn't in this file, it is not current.
2. **Review** the proposal in the **"Current review focus"** section below, checking it against the
   latest committed code (`git log --oneline -8`).
3. **Write your review** — findings + one recommended next step — into **`CODEX_REVIEW.md`**
   (overwrite that file; it only ever holds the current review). **Do NOT edit STATUS.md.**

That's the whole job. You do not need anything else.

> ⛔ **Removed / out of scope — do NOT review or bring up:** NOLA permit data, SAM.gov lead-sourcing
> (deleted), and lead-generation/prospecting in general. Abandoned side-quest, not part of the product.

## What Beelite is
A commercial flooring **takeoff & estimating** app. Upload plans → AI reads the finish schedule →
review/confirm finishes → set rates → enter a room-level takeoff → get a bid. The Google Sheet is
the authoritative bid calculator; the app is the capture/review/sync layer.
Stack: Next.js + Supabase (Postgres + storage) + Prisma + Anthropic API + Google Sheets.

---

## How we work (the loop)
1. **Claude** drives — writes code, updates this file.
2. **You tell Codex to review** → Codex reads THIS file + the latest commits, appends its review in
   the **Codex review** section below (current round only).
3. **You tell Claude "read STATUS"** → Claude responds, then executes.
4. Claude clears resolved reviews so this file stays a clean snapshot. History lives in git.

**Latest commits:** run `git log --oneline -8`. Review against the committed code, not memory.

---

## Where we are — full plan→bid loop works in-app ✅
| # | Step | State |
|---|---|---|
| 1 | Google Sheet bid-engine template (`claude/sheet-template.md` v4) | ☑ built + verified $15,205.54 |
| 2 | Prisma schema → Supabase | ☑ pushed (session pooler) |
| 3 | Project creation (home ledger + `/projects/new`) | ☑ |
| 4 | PDF upload + **page-targeting** (scan every page → Pages screen → tag → preview) | ☑ scan finds schedule pages free (gym pp 4/7/33) |
| 5 | AI finish extraction in app — **targeted** (only tagged pages, `pdf-lib` split) + `/finishes` review/confirm + `Extraction` log | ☑ ~$0.06–0.18/bid |
| 6 | Rates per finish (`/rates`) | ☑ |
| 7 | Room-level takeoff (`/takeoff`) | ☑ |
| 8 | In-app bid preview (`/estimate`, `lib/estimate.ts` mirrors the Sheet math) | ☑ |
| 9 | Google OAuth connect (`GoogleConnection`, `/api/auth/google[/callback]`, home status card) | ☑ connected |
| 9b | **Sync → Google Sheet** — creates a fresh Bid Engine sheet per bid in the user's Drive + re-sync | ☑ verified $15,205.54 via OAuth create |
| 10 | Visual polish | ☐ (last) |

**Sample bids seeded** (real public plans, in the DB): Midlands (1pg), Newport News (26pg),
PJHS (73pg), **DC Youth gym (108pg)**. Files in `samples/` (gitignored).

---

## Recently shipped — page-targeting (Codex-reviewed, built as agreed)
Scan every page on upload → `PlanSheet` per page (scanScore/scanSignals/suggestedSheetType, separate
from human-confirmed sheetType) → **Pages screen** (`/projects/[id]/pages`): list + suggested tags +
on-demand preview (`/api/preview`) → tag → **targeted extraction** on only tagged pages (`pdf-lib`
split, one Claude call). Verified: gym 108pg renders previews; scan pre-flags pp 4/7/33.

## Codex review of the implementation → ADDRESSED (commit `f1db7be`)
Fixed: #1 correction-log bug (confirmFinishes updates the exact extraction; one extraction per
document, stale cleared) · #2 multi-document routing (explicit `?doc=`) · #3 tag default
(non-suggestions stay untagged) · #5 rescan action + buttons · #6 finish-code regex (1–2 digits) +
a stateful-regex bug. Deferred: #4 preview caching (fine for demo).

## Recently shipped — Google Sheet sync (Phase 2)
Chose **OAuth** (user connects their Google; `drive.file` scope) over service account — a SA on
personal Gmail has zero Drive quota and can't create files. Flow: `/estimate` → "Sync to Google
Sheet" (`SyncSheetButton`) → `syncBidToSheet` action → `getAuthedClient()` → `createBidSpreadsheet()`
in `lib/sheet-builder.ts` builds a fresh 9-tab Bid Engine sheet in the user's Drive, pushes the bid's
inputs into the hidden `App_*` tabs, saves `project.sheetId`. Re-sync → `updateBidData()` (clears +
rewrites `App_*`, formula tabs untouched). `lib/sheet-builder.ts` is the verified template structure
(`scripts/build-sheet-template.ts`) refactored into reusable create/update fns — **same formulas**.
Proven end-to-end: `tsx --env-file=.env scripts/test-sync.ts` created a real sheet via OAuth and read
back **$15,205.54** (then deleted it).

## Current review focus → UX / IA REDESIGN PROPOSAL (not built)
The loop works, but the **information architecture is wrong**: every tool is a flat sibling screen and
`/projects/[id]` is a dumping ground, so it feels "jumbled / split poorly / unbearable" (user). Plan
previews are unusably tiny; page sheet-number labels confuse (Midlands shows "GAA106", not the expected
sheet). **Structure problem first, paint second. Codex: review the structure below.** No math/data changes.

### Core change — a guided project WORKSPACE (not a pile of screens)
Replace the flat detail page + sibling links with a **two-pane workspace**:
- **Left rail (persistent):** project header (name · GC · due) → a **pipeline stepper** with per-stage
  status (① Plans ② Finishes ③ Rates ④ Takeoff ⑤ Scope ⑥ Bid; each shows done / pending / blocked, e.g.
  "3 need rates") → a **live bid summary** (price + profit) → Sync-to-Sheet.
- **Right pane:** the active stage — one focused job, room to breathe.
Makes "where am I / what's next / what's blocking the bid" obvious — the thing missing now.

### Project overview = a status dashboard, not a tool dump
`/projects/[id]` becomes: header, the pipeline tracker (what's complete), the running bid total + the real
warnings (needs-rate count, empty takeoff, pages needing review), and 1–2 next-step CTAs. It routes into
the focused stages instead of stacking every tool on one page.

### Stage screens (each its own room)
1. **Plans** — a real viewer: page list w/ thumbnails + scan suggestions on the side, a **large, zoomable**
   page preview (fixes the tiny-blueprint problem), inline tagging, then "read schedule."
2. **Finishes** — AI-read list, confidence, source-page link, confirm.
3. **Rates** — auto-filled from library, needs-rate badges, override.
4. **Takeoff** — room rows grouped by finish, running SF rollup.
5. **Scope** — inclusions / exclusions.
6. **Bid** — the cost→profit→price statement + sync (already the strongest screen).
7. **Standard rates (library)** — company-level, outside a project.

### Specific fixes the user hit
- **Tiny plan previews →** the Plans viewer renders large + zoom; thumbnails are only the index.
- **Confusing sheet labels →** show **Page N** as primary, the scanner's extracted sheet-number as a clearly
  *secondary* "best guess," and let the big visual preview be the source of truth. ("GAA106" = the scanner's
  `SHEET_NUM` regex grabbing the wrong token; surface page # over it, and tighten the regex.)

### Visual direction (build with the frontend-design skill)
Move off the current generic SaaS teal (a default). Ground it in the subject — commercial flooring takeoff:
a precise "measured workspace" feel. **Tabular numerals** for every $ and quantity (estimating is tabular
data), a confident technical display face, an ink-navy base with ONE sharp sparing accent (e.g. surveyor's
orange) + warm paper neutrals, hairline structure over heavy cards. One signature element; the rest quiet.

### Phasing
1. Workspace shell (left-rail stepper + running summary + routing) — the structural win.
2. Plans viewer (big/zoomable) + sheet-label clarity.
3. Restyle each stage into the shell; the visual system (type, color, tabular numerals).
4. Overview dashboard.

## (shipped) V1 FINISHING (scope editor, scanner, dry-run validation)
Closing out V1. **Codex: review against `git log --oneline -10`.** Findings → `CODEX_REVIEW.md`.

- **Scope / exclusions editor** (the last loop gap) — `/projects/[id]/scope` + `components/scope-editor.tsx`
  + `replaceScope` action; suggested common inclusions/exclusions; shown on the bid preview and synced to
  the Sheet's Assumptions. Detail-page nav now: Rates · Takeoff · **Scope** · Bid preview.
- **Scanner precision** (`lib/pdf.ts`) — added GENERAL NOTES / general-conditions / abbreviations to the
  negative signals, and a floor-plan dampener (a plan isn't the schedule). Gym false-positives 3→1
  (remaining page 7 is a floor plan whose title text doesn't extract — that PDF has broken fonts; full
  fix = vision page-classification, V2). Midlands still correctly finds its 1-page schedule.
- **Real-plan dry run** (`scripts/dry-run.ts`, `scripts/seed-library.ts`) — seeded 12 realistic standard
  finishes; ran the **whole loop on a real plan**: Midlands A701 → AI read 9 finishes (0.93–0.97 conf) →
  5/9 auto-filled from library → bid **$45,938 / profit $11,051 / 26.4% margin** → synced v5 Sheet.
  Kept as project **"Midlands A701 (dry run)"**. Gym returned 0 finishes (it's a structural/notes set,
  no schedule) — AI correctly invented nothing. Empty gym dry-run project + sheet cleaned up.

Worth a look: (a) `replaceScope` allowance handling (only for `included`); (b) the scanner negative/
floor-plan regex — any real schedule it could now wrongly dampen? (c) `scripts/dry-run.ts` placeholder
takeoff is clearly labeled (not a real bid).

## Rate library — Codex review ADDRESSED (all 3 findings)
Codex reviewed the library (seeding/re-confirm/owner-furnished/single-company confirmed correct);
3 save-boundary findings, all fixed via one shared helper:
- **#1 learn published incomplete rows** — `pushBidRatesToLibrary` now skips unless `rateIsComplete`
  (same effective predicate as `lib/estimate.ts`): owner → `installRate>0`; elite → `material>0 && install>0`.
- **#2 negative inputs accepted** — `normalizeRate` (shared by `saveRates`/`saveLibrary`/learn) clamps
  all numerics `≥0` and forces owner-furnished material to 0; UI inputs get `min="0"`.
- **#3 destructive non-atomic replace** — `saveLibrary` now validates + **rejects duplicate codes**
  (returns `{error}`, shown in the editor) and runs delete+upserts in a single `$transaction`.
Verified: negatives clamp, owner→0, complete-predicate, and interactive `$transaction` commits on the
Supabase pooler. Build green, typecheck clean.

## (prior) Current review focus → COMPANY RATE LIBRARY (built; review it)
The "standard rates" backbone — so a new bid auto-prices instantly and Elite never waits on a sub.
**Codex: review the library against `git log --oneline -8`.** Findings → `CODEX_REVIEW.md`.

What it does:
- **`/library`** (`app/library/page.tsx` + `components/library-editor.tsx`) — manage the company's
  standard finishes + material/install rates (add/edit/delete rows). Linked from home header.
- **`saveLibrary(rows)`** (`app/actions.ts`) — upserts `FinishLibraryItem` (by `companyId_code`) +
  its 1:1 `RateCatalogEntry`; deletes removed codes (rate cascades).
- **Auto-fill:** `confirmFinishes` already seeds each bid finish from the library on an exact
  `company+code` match (else `needs_rate`) — snapshot at confirm, override wins (v5 contract §8).
- **Learn-as-you-go:** the `/rates` editor has an "Also save to my standard rates" checkbox →
  `saveRates(projectId, rows, toLibrary=true)` → internal `pushBidRatesToLibrary` upserts the bid's
  priced in-scope finishes back into the library.
- Smoke-tested: compound-unique upsert + company-scoped code lookup + cascade delete all verified.
  Build green, typecheck clean.

Worth a close look: (a) `saveLibrary` delete-removed logic (the `notIn` sentinel when rows is empty —
does it ever nuke the whole library unintentionally?); (b) `pushBidRatesToLibrary` skip rule
(`installRate<=0 && materialUnitCost<=0`) — right call for owner-furnished finishes? (c) seeding vs.
"learn" round-trip — any way they fight (e.g. re-confirm after a library edit)? (d) single-company
assumption (`getOrCreateDefaultCompany`) — fine for now?

## v5 implementation — Codex review ADDRESSED (all 4 findings)
Codex reviewed the v5 implementation (CODEX_REVIEW.md) — core math/formatting/seeding confirmed
correct; 4 findings, all fixed:
- **#1 stale-sheet miscompute** — added an engine-version sentinel (`App_Settings!D1 = "beelite-v5"`);
  `syncBidToSheet` reads it and **rebuilds** a fresh Sheet if a saved `sheetId` isn't v5 (instead of
  pushing v5 inputs into a v4 workbook). Old demo `sheetId`s cleared. Verified sentinel reads back.
- **#2 invalid profit %** — `saveSettings` clamps (`pct ≥ 0`; margin mode `≤ 0.95`) at the source so
  app + Sheet can't diverge; UI inputs get `min/max`; Summary gains an "Invalid pricing %" check.
- **#3 re-confirm wiped rates** — `confirmFinishes` now **merges by code**: existing codes keep their
  per-bid rates (descriptive fields refresh), only new codes seed from the library, gone codes drop.
- **#4 60-row cap** — `N` 60 → 200, formatting ranges track `N` (`ROWS_END`).
Re-verified: fresh v5 Sheet still **$15,205.54 / profit $1,771.20**; build green; typecheck clean.

## (prior round) v5 IMPLEMENTATION (built + verified)
The v5 pricing redesign is **built** to `claude/v5-math-contract.md` and **verified**: a real
OAuth-built Sheet **and** `lib/estimate.ts` both reproduce **BID PRICE $15,205.54 / profit $1,771.20 /
15.0% markup / 13.0% margin** (`scripts/test-sync.ts`). **Codex: review the implementation against the
contract** — files below. Findings → `CODEX_REVIEW.md`.

Changed this round:
- **Schema** (`prisma/schema.prisma`, pushed): `ProjectFinish` → `materialUnitCost`, `installRate`,
  `materialSource`, `rateStatus`, `libraryItemId` (dropped `installMode`, renamed from
  `materialCost`/`installAmount`/`furnishType`). `EstimateSettings` → `profitPctMode`,
  `materialProfitPct`, `installProfitPct`. `RateCatalogEntry` matched. *(rate cols reset to defaults
  per the migration rule — demo data.)*
- **`lib/sheet-builder.ts`** — v5 formulas (Rates A–Q, Estimate A–S + bid block U/V, Summary statement,
  checks) + `formattingRequests()` (banner, currency/percent, frozen header, shaded overrides).
- **`lib/estimate.ts`** — v5 mirror (cost→sell→profit, margin guards, blended %, needs_rate).
- **`app/actions.ts`** — `confirmFinishes` seeds rates from the company library (exact match, else
  needs_rate); `saveRates`/`saveSettings` renamed fields.
- **UI** — `rates-editor` (material source + needs-rate badge), `estimate/page` (cost/profit/price
  statement + margin/markup lens), project detail (`bidPrice`).
- **Docs** — `sheet-template.md` → v5, `CLAUDE.md` decisions, `v5-math-contract.md` rev 2.

Worth a close look: (a) Estimate `O`/`P` margin-mode guard formulas (the nested `IF(pct>=1,…)`);
(b) the `effectiveRateStatus` formula in Estimate `S` vs. the app's `needsRate`; (c) library seeding
in `confirmFinishes` — exact-match map, snapshot semantics; (d) `formattingRequests()` grid ranges.

<details><summary>Accepted proposal that produced the contract (context)</summary>

## PROPOSAL: pricing model + bid-statement redesign (NOT built yet)
This is a **design proposal** from a working session with the owner. Nothing here is coded yet.
**Codex: review the model for correctness + risk, and flag anything that breaks the locked Sheet math
(`claude/sheet-template.md` v4) before we build.** It will land as sheet-template **v5** + schema +
`lib/estimate.ts` + `lib/sheet-builder.ts` changes, propagated to `CLAUDE.md` / `docs/v1-plan.md` in
the same pass.

**Context (how Elite actually prices, per the owner):**
- Elite **never waits on a sub quote to bid.** They already know roughly what their subs charge, so
  they bid a **standard install rate** up front and refine later if a real quote arrives.
- The sub does **not** typically furnish material. Elite either **buys the material** (default) or the
  **owner/GC furnishes** it (then Elite's material cost = $0 but it still prices the install).
- The owner is **accounting-driven**: the bid must clearly separate **sub install fee (cost)** from
  **Elite's profit (margin)**, and tie cost → profit → price transparently.

**Proposed changes:**
1. **Kill `installMode = "pending"` and `furnishType = "turnkey_sub"`** as workflow concepts — they
   don't match Elite. Install is **always subbed at a per-unit rate** (overridable). Material furnish
   collapses to two cases: `elite_furnishes` (default, Elite buys) | `owner_furnishes` (material $0).
2. **Company rate library → seeds each new bid.** Tables already exist (`Company` → `RateCatalogEntry`,
   `FinishLibraryItem`) but are **not wired into the bid flow**. Wire them so a new bid auto-fills
   Elite's standard material + install rates = instant, never-wait pricing ("the ceiling"). Per-bid
   override still wins (existing default/override/effective on the `Rates` tab).
3. **Margin shown both ways.** Keep the two existing margins (material `pct`, install `subMarkupPct`).
   Owner enters EITHER a **target margin** (% of price) OR a **markup** (% of cost); the Sheet shows
   the other automatically. ⚠ These are NOT equal: 15% markup = 13% margin; 30% margin = 42.9% markup.
   Default lens = target margin, seeded ~25–30% (not 15). Profit displayed as **$, markup %, margin %**.
4. **Sheet redesign (the 4 visible tabs → v5):**
   - **Summary → a bid statement / proposal page:** header (Elite, GC, date, location); a
     **Cost → Profit → Price** waterfall (material cost+price, install cost+price, freight, job cost,
     Elite profit $/markup%/margin%, tax, BID PRICE); included/excluded scope; assumptions. QA/warning
     flags move to a side block, not the headline.
   - **Estimate → working detail, per line:** material cost, **sub install fee**, line cost,
     **line profit $**, line price. Real currency/percent formatting, bold totals, frozen header,
     helper columns hidden.
   - **Rates →** default/override/effective with override columns highlighted; defaults from the library.
   - **Assumptions →** fold into Summary.
   - Apply real formatting via the Sheets API (fonts, currency/percent, borders, header banner) at build.
5. **Architecture (confirmed, unchanged):** one Sheet per bid; **the app is the master index** (home
   screen lists every bid → link to its Sheet); optionally drop each Sheet in a Drive folder per
   company/year. 50 bids/day is fine — Sheets are self-contained, nothing scans across them. A rollup
   "master dashboard" Sheet (pipeline $, win rate) is a **later** reporting layer, out of scope now.

Codex's review of this proposal (all accepted) is now baked into `claude/v5-math-contract.md`.

</details>

## Next (after the contract is approved)
- Update `claude/sheet-template.md` → v5 from the contract, then schema migration + `lib/estimate.ts`
  + `lib/sheet-builder.ts` + Sheet formatting, propagate to `CLAUDE.md` / `docs/v1-plan.md`.
- Later: Workspace Shared Drive as the production path once Google verification finishes.

---

## Codex's review goes in `CODEX_REVIEW.md`, NOT here
This file is Claude's briefing. Codex writes its review to **`CODEX_REVIEW.md`** (overwrite it).
Claude reads that file when the user says the review is done.
