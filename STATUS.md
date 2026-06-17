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
| 9 | Sync → Google Sheet `App_*` tabs | ☐ needs Google auth decision |
| 10 | Visual polish | ☐ (last) |

**Sample bids seeded** (real public plans, in the DB): Midlands (1pg), Newport News (26pg),
PJHS (73pg), **DC Youth gym (108pg)**. Files in `samples/` (gitignored).

---

## Recently shipped — page-targeting (Codex-reviewed, built as agreed)
Scan every page on upload → `PlanSheet` per page (scanScore/scanSignals/suggestedSheetType, separate
from human-confirmed sheetType) → **Pages screen** (`/projects/[id]/pages`): list + suggested tags +
on-demand preview (`/api/preview`) → tag → **targeted extraction** on only tagged pages (`pdf-lib`
split, one Claude call). Verified: gym 108pg renders previews; scan pre-flags pp 4/7/33.

## Current review focus → the page-targeting IMPLEMENTATION (code review)
You reviewed the *proposal* earlier; now review the *code that was built* (commits `ad0e02b`,
`ca95a28`). Files:
- `lib/pdf.ts` — `scorePage`/`scanPdf` (heuristic), `extractPages` (pdf-lib), `renderPage` (canvas).
- `app/actions.ts` — `uploadDocument` (scans every page → PlanSheet/page), `saveSheetTags`,
  `readSchedule` (targeted: split tagged pages → one Claude call; stores `sourcePages`).
- `components/pages-tagger.tsx` + `app/projects/[id]/pages/page.tsx` — Pages screen.
- `app/api/preview/route.ts` — on-demand page render.
- `app/projects/[id]/finishes/page.tsx` — now finds the PlanSheet that has the extraction.

**Scrutinize:** (a) multi-page schedule handling — `readSchedule` sends all tagged pages in one PDF
and links the `Extraction` to the first page only; is per-page provenance / merge OK or should each
page get its own Extraction? (b) the `/finishes` query (`extraction: { isNot: null }`) correctness;
(c) tag pre-fill (dropdown defaults to suggestion) vs the "keep suggested separate from confirmed"
intent; (d) preview route downloads the whole PDF per request — acceptable, or cache? (e) upload-time
scan latency on a 108pg set inside a server action; (f) scanner robustness (PJHS flagged none — finishes
in spec sections). Note: targeted extraction is wired + compiles but not yet run end-to-end (costs ~18¢).

## Next (no review needed)
- **Step 9 — Google Sheet sync.** Auth choice first: service account can't create/copy Sheets on
  personal Gmail. Options: OAuth · Workspace Shared Drive · reuse one pre-shared Sheet for the demo.
  ⚠ Don't build `drive.files.copy` with the current service account.
- **Step 10 — visual polish** (last).

---

## Codex's review goes in `CODEX_REVIEW.md`, NOT here
This file is Claude's briefing. Codex writes its review to **`CODEX_REVIEW.md`** (overwrite it).
Claude reads that file when the user says the review is done.
