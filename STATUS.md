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
| 4 | PDF upload | ☑ (page tagging = the proposal below) |
| 5 | AI finish extraction in app (`lib/anthropic.ts`, `/finishes` review/confirm, `Extraction` log) | ☑ ~$0.06/page |
| 6 | Rates per finish (`/rates`) | ☑ |
| 7 | Room-level takeoff (`/takeoff`) | ☑ |
| 8 | In-app bid preview (`/estimate`, `lib/estimate.ts` mirrors the Sheet math) | ☑ |
| 9 | Sync → Google Sheet `App_*` tabs | ☐ needs Google auth decision |
| 10 | Visual polish | ☐ (last) |

**Sample bids seeded** (real public plans, in the DB): Midlands (1pg), Newport News (26pg),
PJHS (73pg), **DC Youth gym (108pg)**. Files in `samples/` (gitignored).

---

## Current review focus → PROPOSAL: "Pages" screen + page-targeting
**Problem:** extraction currently sends the *whole* PDF to Claude. Fine for 1pg (~$0.06); a 108pg
set is ~$1–2 and unreliable (schedule buried on pp 4/7/33).

**Proposal:**
1. **On upload, scan every page** locally ($0; already proven — found NN p4/p20, gym p4/p7/p33).
   Create a `PlanSheet` per page storing pageNumber, detected sheet title, **scanScore + scanSignals
   (JSON)**, suggested `sheetType`. (Store everything, so we can backtrack a missed/wrong finish.)
2. **Pages screen:** list every page + detected title + a *suggested* tag badge; dropdown to set tag
   (finish_schedule / finish_plan / floor_plan / specs / ignore); render a page preview **on demand**
   (not 108 thumbnails upfront).
3. **"Read finishes"** runs extraction on ONLY pages tagged `finish_schedule` — split via `pdf-lib`,
   send to Claude (~$0.06–0.18). Multiple schedule pages → extract + merge.
4. Edge: scanned PDFs (no text layer) → page-image/OCR fallback later; spec-section finishes → scan catches.

**Schema add:** `PlanSheet.scanScore Float?`, `PlanSheet.scanSignals Json?`.

**For Codex — weigh in on:** list-vs-thumbnail Pages screen · the scan heuristic (keywords +
finish-code density) · the per-page storage model · auto-extract vs **suggest-and-confirm** (Claude
leans suggest-and-confirm: human glances + taps the schedule page on a money document).
(2015-era plans are fine — finish-schedule format, CSI 09 06 00, is unchanged.)

**Deferred — Sheet sync (step 9):** service account can't create/copy Sheets on personal Gmail.
Options: OAuth (user connects Google), Workspace Shared Drive, or reuse one pre-shared Sheet for the
demo. Decide before building sync. ⚠ Don't build `drive.files.copy` with the current service account.

---

## Codex's review goes in `CODEX_REVIEW.md`, NOT here
This file is Claude's briefing. Codex writes its review to **`CODEX_REVIEW.md`** (overwrite it).
Claude reads that file when the user says the review is done.
