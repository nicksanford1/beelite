# Archived Process Snapshot

Status: archived
Captured: 2026-06-19
Archived: 2026-06-19

This was a point-in-time review aid and is not authoritative. Use `docs/architecture.md` and the code
for implemented behavior.

This documents the **current, real** behavior of the upload → read → price flow as implemented in
code (not the plan, not the spec — what the code on disk does right now). Written so GPT can review
the prompts, the "when do we get what" sequence, and the gaps before we build the Overview screen.

Source of truth for this doc: `app/actions.ts`, `lib/anthropic.ts`, `lib/prompts/finish-schedule.ts`,
`lib/ingest.ts`, `lib/bid-status.ts`, `prisma/schema.prisma`.

---

## 1. The whole flow, in order

```
New Bid → upload PDF
   │
   ├─ (A) AI CALL #1: cover read  ........ extractProjectInfo()  [opus, IMAGE of page 1]
   │        → project name/address/architect/etc.
   ├─ create Project + Document rows, upload PDF to storage
   ├─ (background, no AI) ingestDocument() ... render every page to a small JPEG + pull text layer
   │
   ▼
Review Details (wizard step 2) → user edits → confirmProject()
   ├─ save edited fields
   └─ (best-effort) syncBidToSheet() → create the Google Sheet now
   │
   ▼
Project page → "Read Finishes"
   ├─ (B) AI CALL #2: finish read ........ readFinishesGuarded()  [sonnet, WHOLE PDF via signed URL]
   │        → {status: found|possible|not_found, finishes[], evidencePages[], reason}
   │        → saved as Extraction.rawOutput on page-1 PlanSheet
   │
   ▼
/finishes → user reviews/corrects → confirmFinishes()
   ├─ save Extraction.corrected (the correction log = training data)
   └─ create ProjectFinish rows (seed rates from company library by code)
   │
   ▼
Takeoff (quantities) → Rates → Scope → Settings → Sync to Google Sheet
```

**There are only 3 AI calls in the whole app, and only the first two are on the live path.**

---

## 2. The AI calls (the only places we call Claude)

### AI CALL #1 — Cover read (`extractProjectInfo`)
- **When:** the moment a PDF is uploaded (`analyzeUpload` in `app/actions.ts`).
- **Model:** `claude-opus-4-8`.
- **Input:** **page 1 only**, rendered locally to a JPEG (`renderPage(bytes, 1, 1.3, "image/jpeg")`) and
  sent as an **image**. We do NOT send the PDF or the text layer here.
- **Prompt** (`PROJECT_INFO_PROMPT`, in `lib/anthropic.ts`):
  > This is the title / cover sheet of a commercial construction plan set. From its title block and
  > drawing-list index, extract the project metadata. Use "" (or []) for anything not shown — NEVER
  > invent. Return ONLY a JSON object … shaped exactly:
  > `{"name","address","owner","architect","contractor","scope","useType","squareFeet","projectNumber","issueDate","finishSheets":[]}`
  > … finishSheets: sheet numbers in the drawing index whose titles mention FINISH / FINISH SCHEDULE /
  > FINISH PLAN (e.g. ["A2.4"]). [] if none are listed.
- **Returns** (`ProjectInfo`): `name, address, owner, architect, contractor, scope, useType,
  squareFeet, projectNumber, issueDate, finishSheets[]`.
- **What we PERSIST from it** (at upload, in `analyzeUpload`):
  | ProjectInfo field | Saved to | 
  |---|---|
  | name | `Project.name` (fallback: filename) |
  | contractor | `Project.gc` |
  | address | `Project.location` |
  | useType | `Project.projectType` |
  | scope, squareFeet, architect | concatenated into `Project.notes` |
- **What we DROP (not persisted):** `owner`, `projectNumber`, `issueDate`, **`finishSheets[]`**.
  `finishSheets` is shown in the wizard UI as a hint but **never written to the DB**.
- At **confirmProject** (after the user edits the form): we save
  `name, gc, location, projectType, architect, estimator, bidDate, notes`. `architect` becomes a real
  column here; `estimator` is hard-coded to "Nick" in the UI.

### AI CALL #2 — Finish read (`readFinishesGuarded`) — the "Read Finishes" button
- **When:** user clicks Read Finishes (`readWholeDoc` in `app/actions.ts`).
- **Model:** `claude-sonnet-4-6` (default; whole-doc is token-heavy).
- **Input:** the **whole PDF**, as a **signed URL** — Anthropic fetches the file itself; our server never
  re-downloads the big file.
- **Prompt** (`GUARDED_PROMPT` + `FINISH_SCHEDULE_PROMPT`): a guarded, 3-state read.
  - STEP 1 DETECT whether a real flooring finish schedule/legend/spec exists.
  - STEP 2 EXTRACT only if it exists; record `sourcePage` per finish.
  - HARD RULES: never scrape wall sections / assemblies / structural / gypsum / insulation / slab /
    subfloor unless explicitly a flooring finish; if none exists return `not_found` + empty.
  - STATUS: `found` | `possible` | `not_found`.
- **Returns** (`FinishReadResult`): `status, confidence, reason, evidencePages[], finishes[]`.
- **What we PERSIST:** one `Extraction` row on the **page-1 PlanSheet**, with
  `rawOutput = { status, confidence, reason, evidencePages, finishes, whole: true }`.
  (This is the key field the Overview's "Finish Schedule" row should read.)

### AI CALL #3 — Per-page finish read (`extractFinishesFromPages`) — NOT on the live path
- Older path (`readSchedule`) that reads only pages a human **tagged** `finish_schedule`, using each
  page's stored image/text. Model `claude-opus-4-8`. We moved away from page-tagging (user: "don't want
  the scanner to gaslight pages"), so the live button is `readWholeDoc` (#2). `extractFinishSchedule`
  (single PDF page, structured-output) also exists but is effectively unused.

---

## 3. Ingest (no AI) — what we capture per page

`ingestDocument` (fired in the background right after upload; reused from the upload bytes):
- For **every page**: extract the **text layer** + render a **small JPEG** (scale 1.1) and upload it to
  storage at `plans/{projectId}/{documentId}/pages/NNNN.jpg`.
- Store per page in `PlanSheet.scanSignals = { text, imagePath }`. **No scoring, no page-type
  guessing** — the scanner was deliberately stripped.
- So after ingest we have: a `PlanSheet` row per page (with text + image), and `doc` page count.

---

## 4. What is actually stored in the DB (the real schema)

- **Project:** `name, bidDate, gc, location, projectType, architect, estimator, leadSource,
  internalBidNum, notes, status (default "draft"), sheetId, createdAt`. (Relations: documents,
  finishes, scopeItems, takeoff, settings.) — **No `updatedAt`.**
- **Document:** `fileUrl`, pages[]. — **No upload timestamp / filename column** (filename only lives
  inside `fileUrl`).
- **PlanSheet:** `pageNumber, sheetNumber, sheetTitle, sheetType (human tag: untagged|finish_schedule|…),
  suggestedSheetType, scanScore, scanSignals {text, imagePath}, extraction`.
- **Extraction:** `model, rawOutput (the finish-read result), corrected (human-confirmed finishes),
  confidence`. One per document (on page-1 sheet).
- **ProjectFinish** (created at confirmFinishes): `code, type, description, unit, category, inScope,
  materialUnitCost, installRate, wastePct, cartonSize, materialSource, rateStatus, libraryItemId`.
- **TakeoffLine, ProjectScopeItem, EstimateSettings** — quantities, scope, pricing knobs.

## 5. How we know "where the bid is" today (`deriveBidStatus`)

Currently a **coarse 5-state**, derived purely from what rows exist (no stored status flags):
```
passed      → status === "passed"
synced      → sheetId present
no_plans    → 0 documents
pricing     → ≥1 confirmed ProjectFinish
reading     → otherwise ("plans uploaded, finishes not confirmed yet")
```
This is NOT the granular ladder (plans → finishes → takeoff → rates → scope → sheet → bid) the Overview
spec describes. We can derive that ladder from row-presence, but it isn't built yet.

---

## 6. Reconciliation with the Overview spec — what we have vs what's missing

The Overview spec assumes a bunch of saved fields/flags. Here's the honest state:

| Overview wants | Do we have it? | Notes / what's needed |
|---|---|---|
| Project name, address, type, architect, bid due, estimator | ✅ stored | On `Project`. |
| City / State (separate) | ❌ | We store one `location` string (full address), not split. |
| Owner | ⚠️ in notes only | Cover read gets it; we dump it into `notes`, not a column. |
| Square footage | ⚠️ in notes only | Same — in `notes`, not a column. |
| Plan date / issue date | ❌ | Cover read gets `issueDate`; **not persisted**. |
| Project number | ❌ | Cover read gets it; **not persisted**. |
| "Last updated" | ❌ | No `updatedAt` on Project. |
| Plan file name | ⚠️ | Only inside `Document.fileUrl`; no clean column. |
| Uploaded-at timestamp | ❌ | `Document` has no timestamp column. |
| Page count | ✅ derivable | Count `PlanSheet` rows (after ingest) or PDF numPages. |
| **Finish Schedule status** (not read / found / possible / not found) | ✅ | `Extraction.rawOutput.status`; **"not read yet" = no Extraction row exists.** This is the one that matters most and we have it. |
| Drawing index found / which page | ⚠️ | Cover read returns `finishSheets[]` but we **don't persist it**. Would need to save it. |
| Floor plan pages / spec pages | ❌ | Not stored, and detecting them needs the page-scanner/guessing we **intentionally removed**. Can't populate without re-introducing guessing. |
| Project-details "status: found" flag | ⚠️ derive | No explicit flag; infer from "cover read ran / fields present". |
| Workflow ladder + next action | ⚠️ derive | Derivable from row-presence; only the coarse 5-state exists today. |

### Bottom line for GPT
- **Overview needs no new AI call** — agreed. Everything it shows is (or can be) derived from saved rows.
- The **finish-schedule status row works today** (3-state, never says "not found" until Read Finishes runs).
- To match the full spec we'd need to **persist a few cover-read fields we currently throw away**
  (`owner, squareFeet, projectNumber, issueDate, finishSheets`) and **add timestamps** (`Project.updatedAt`,
  a `Document` created-at), plus a small `getProjectOverview(projectId)` that derives the workflow
  ladder + next action from row-presence.
- The **floor-plan/spec-page findings rows can't be honestly populated** without bringing back the
  page-type guesser we removed — recommend dropping those rows (or labeling them "not analyzed").

---

## Open questions for review
1. Should we persist the dropped cover-read fields (owner/sqft/projectNumber/issueDate/finishSheets) as
   real `Project` columns, or keep stuffing non-core ones into `notes`?
2. Do we want explicit workflow status flags on `Project`, or keep deriving state from row-presence
   (current approach — less to keep in sync, but no audit trail of "when")?
3. Drop the floor-plan/spec-page Overview rows (no guessing), or accept a lightweight scan just for
   those hints?
