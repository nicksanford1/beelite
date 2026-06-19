# Takeoff Measurement Plan

Status: proposal
Owner: product owner
Issue: pending
Created: 2026-06-19
Last verified: 2026-06-19

This proposes a design for the quantity problem. It is not approved or implemented. If adopted,
durable behavior moves into `docs/architecture.md` and this plan is archived after merge.

---

## 0. Why this doc exists

Today the app reads **what** the finishes are and then a human types the **quantities** by hand in
`components/takeoff-editor.tsx` (a plain number grid). The single most labor-intensive, error-prone,
and *valuable* part of a flooring bid — counting the square footage off the plans — gets zero help.

This doc proposes how we help with that, the end-user experience, and the technical design. It is
deliberately honest about what AI can and can't be trusted to do today.

---

## 1. The problem is three problems

"Estimate the SF" is really three stacked sub-problems with very different difficulty and trust:

1. **Scale** — feet-per-pixel on each sheet. Gates everything; nothing is measurable without it.
2. **Area** — turning plan geometry into net floor area per region. The hard one.
3. **Finish assignment** — which floor finish covers each measured region. Often the real blocker
   (a set can have perfect geometry and *no* floor finish specified — see the Lake Shore set, which
   scheduled wall + ceiling finishes but no flooring).

We solve all three, in that order, behind one screen.

### The non-negotiable: every quantity is traceable

CLAUDE.md's north star is a *"traceable room-level takeoff."* An estimator will not bill from a bare
"3,447 SF." The unit of work is therefore **not a number** — it's a region drawn on a specific sheet
at a known scale, that you can click to see exactly what produced the number:

```
Measurement = {
  page (which sheet), scaleFtPerPx, polygon[{x,y}…],
  netAreaSF, finishCode, source: manual | ai | schedule, status
}
```

AI output and human tracing live in the **same** structure. AI just pre-fills `polygon` and sets
`source: ai`; a human confirm flips it to `manual`/approved. This is the existing
"AI proposes, human confirms, corrections are logged" pattern, applied to geometry.

---

## 2. End-user experience (the interface)

New step in the workflow ladder, between **Finishes** and **Rates**: **Takeoff → "Measure".**
It replaces the blind number grid; the grid becomes the *review table* fed by measurements.

### The screen

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Takeoff — measure                              [ Sheet A1.2 ▾ ]  page 3/6  │
├──────────────────────────────────────────────┬────────────────────────────┤
│                                                │  SCALE                     │
│                                                │  ● Calibrated 1/8"=1'-0"    │
│         (rendered plan sheet — pan/zoom)       │    via 44'-0" dim · redo    │
│                                                │ ─────────────────────────  │
│      ▢ traced regions shown as colored         │  REGIONS on this sheet     │
│        polygons with their SF label            │  ▣ Classroom 11   220 SF   │
│                                                │     finish: LVT-1   ✎      │
│                                                │  ▣ Kitchenette    427 SF   │
│                                                │     finish: VCT-1   ⚠ no   │
│      ┌─ Classroom 12 ─┐                        │ ─────────────────────────  │
│      │     301 SF      │  ← live area while    │  TOOLS                     │
│      └────────────────┘     drawing            │  [Calibrate] [Trace +]     │
│                                                │  [Rectangle] [Subtract −]  │
│                                                │  [AI: detect rooms]        │
├──────────────────────────────────────────────┴────────────────────────────┤
│  ROLLUP (approved): LVT-1 1,210 SF · VCT-1 427 SF · TILE-1 201 SF   [Save]  │
└───────────────────────────────────────────────────────────────────────────┘
```

### The flow, first time on a sheet

1. **Pick the sheet** to measure (floor plan). Pages come from the already-ingested `PlanSheet`
   rows; we render the page large.
2. **Calibrate scale** (once per sheet). App proposes a scale (read from the title block /
   detected dimension). User clicks the two ends of any printed dimension they trust
   (e.g. the "44'-0"" wall) and types its real length → app locks ft/px. Big visible badge so the
   scale is never a mystery. *This is the trust anchor.*
3. **Trace a region.** Click corners around a room (or drag a rectangle); polygon closes; **live SF
   updates as you draw.** Add/subtract for L-shapes, columns, millwork.
4. **Assign a finish** to the region from the project's confirmed finishes (dropdown, same list as
   today). AI can pre-suggest from the room name; human confirms.
5. **Cross-check.** If the sheet has a room/area schedule, show the scheduled SF next to the traced
   SF: `traced 247 · schedule 247 ✓` or `traced 263 · schedule 247 ⚠ +6%`. Catches fat-finger and
   scale errors instantly.
6. **Save** → writes `Measurement` rows and rolls them up into `TakeoffLine` per finish.

### The AI accelerator (layered on top, optional per sheet)

- **"AI: detect rooms"** pre-draws candidate polygons + names + suggested finishes. The user is now
  *correcting* instead of *drawing* — every nudge is logged as training data.
- AI also auto-proposes the calibration (finds a dimension string and its endpoints) so step 2 is
  one confirm click.
- Hard rule in the UI: **no AI number is ever "approved" without a human-confirmable polygon behind
  it.** AI sets `needs_review`; the human approves.

---

## 3. Technical design

### 3.1 Stack hooks (all already present)

| Need | Use what we already have |
|---|---|
| Render a page large for tracing | `lib/pdf.ts renderPage()` + `@napi-rs/canvas` (already renders page JPEGs) |
| Per-page text + image, page list | `lib/ingest.ts` → `PlanSheet.scanSignals = { text, imagePath }` |
| Detect vector vs raster, pull line geometry | `pdfjs-dist` (dependency) exposes page operator list / `getOperatorList()` |
| Read printed scale / dimension strings | the stored text layer; fallback to an Anthropic image read |
| Persist + feed the bid | new `Measurement` model → existing `TakeoffLine` → Sheet sync |

The digitizer canvas is **client-side**: render the page to an image (server, existing path),
overlay an HTML5 canvas / SVG for the polygons. No new heavy dependency required for Tier A.

### 3.2 Data model (new)

```prisma
model Measurement {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  planSheetId  String                       // which sheet/page it was drawn on (trace)
  planSheet    PlanSheet @relation(fields: [planSheetId], references: [id], onDelete: Cascade)
  label        String                       // "Classroom 11"
  finishCode   String?                      // links to ProjectFinish.code (nullable until assigned)
  geometry     Json                         // { polygon:[{x,y}…], holes?:[[…]], unit:"px" }
  scaleFtPerPx Float                        // the scale locked at draw time (trace lives with it)
  netAreaSF    Float                        // computed, stored for traceability
  source       String   @default("traced")  // traced | ai | schedule
  status       String   @default("draft")   // draft | needs_review | approved | excluded
  createdAt    DateTime @default(now())
}
```

Plus, to make calibration repeatable, store the locked scale per sheet:

```prisma
// add to PlanSheet
calibration  Json?    // { ftPerPx, method:"dim"|"printed", refPx, refFt, dimText? }
```

`TakeoffLine` stays the bid-facing rollup (already has `source manual|ai`, `unit`, `status`,
`@@unique`-free). Measurements **roll up** into it per `finishCode` on save — so the Sheet sync and
v5 math contract are untouched. Add `source: "measured"` to TakeoffLine's vocabulary.

### 3.3 The scale math

Calibrate from a known dimension (robust; printed scale is only a fallback):

```
ftPerPx = realFeet / pixelDistance(p1, p2)        // p1,p2 = clicked endpoints of a known dim
```

Store `ftPerPx` on the sheet and snapshot it onto each `Measurement` (a later re-calibration must
not silently change saved quantities — same principle as rate snapshot-at-confirm).

### 3.4 The area math

Polygon area in pixels via the shoelace formula, then convert:

```
areaPx = |Σ (x_i · y_{i+1} − x_{i+1} · y_i)| / 2
netAreaSF = areaPx · ftPerPx²            (subtract holes the same way)
```

Pure, testable, no dependency. Unit test against a known rectangle.

### 3.5 Vector vs raster — decides how far AI automation can go

`pdfjs-dist getOperatorList()` tells us per page whether there's real vector path geometry (CAD
export) or just a scanned raster image:

- **Vector set →** Tier B is on the table: extract wall segments, build a graph, detect enclosed
  rooms → high-accuracy auto-polygons.
- **Raster/scanned set →** vector extraction is out; only manual (Tier A) or vision (Tier C) apply.

**Action item:** run this check across the NOLA permit corpus early to learn the real mix before
investing in Tier B. (We already scrape real permitted sets — that corpus *is* the distribution.)

### 3.6 Where AI plugs in (and where it must not)

| Task | AI role | Trust |
|---|---|---|
| Read printed scale / find dimension endpoints | propose | confirm-one-click |
| Transcribe a room/area schedule (Lake Shore case) | extract | cross-check vs traced |
| Detect rooms → candidate polygons | propose | human nudges; `needs_review` |
| Suggest finish per room (name + schedule) | propose | human confirms |
| **Emit a final billable SF from eyeballing geometry** | **no** | not reliable for penny-precise bids |

Every AI path terminates in a human-confirmable polygon. Corrections (moved vertices, fixed finish)
are the training signal — stored on the `Measurement`, same as the finish-read correction log.

### 3.7 Server actions (mirrors `replaceTakeoff`)

- `saveMeasurements(projectId, planSheetId, measurements[])` — upsert geometry + recompute SF
  server-side (never trust client math for the stored number) + roll up into `TakeoffLine`.
- `calibrateSheet(planSheetId, { refPx, refFt })` — lock ft/px.
- `proposeRooms(planSheetId)` — AI call returning candidate polygons (Tier C) — optional.

---

## 4. Build plan (tiers, honest cost/accuracy)

| Phase | Scope | Accuracy | Why this order |
|---|---|---|---|
| **1. Foundation** | `Measurement` model + server actions + rollup into `TakeoffLine`. No UI yet. | — | Locks the trust path before any UI. |
| **2. Manual digitizer + calibrate** | Page viewer, calibrate tool, polygon/rectangle trace, live SF, finish assign, save. | 100% (human-drawn) | **Ships a real, trustworthy takeoff tool for ANY set.** The floor everything else stands on. |
| **3. Schedule cross-check** | Read room/area schedule when present; show beside traced SF. | catches errors | Cheap — reuses the finish-read pattern. |
| **4. AI auto-calibrate + room detect** | Propose scale + candidate polygons; human corrects. | medium, improving | Pure accelerator on Phase 2's data model — no rewrite. |
| **5. Vector extraction (if corpus warrants)** | Wall-graph rooms from vector PDFs. | high when vector | Only if §3.5 shows enough vector sets. |

Start at Phase 2 — **not** at AI room detection. Tier A must exist as the fallback for scanned/weird
sets and is the only thing that makes the number billable. AI tiers layer on without a rewrite
because they write the same `Measurement` rows.

---

## 5. Open questions for review

1. **Accuracy bar:** bill-grade (every qty = a confirmed polygon, no raw AI numbers) vs estimate-grade
   (±5–10% AI-first for go/no-go, refined later)? This decides how aggressive Phase 4 can be.
   *Recommendation: bill-grade — it's a flooring bid, and it forces the trustworthy data model anyway.*
2. **Base/perimeter (LF):** flooring bids also need wall base in linear feet. The polygon perimeter
   gives it nearly free — fold into `Measurement` now, or defer?
3. **Multi-page rollup:** a finish spans many sheets (1st + 2nd floor). Rollup is by `finishCode`
   across all measurements — confirm that's the grouping you want vs by-room.
4. **Vector mix:** run the §3.5 check on the permit corpus to decide if Phase 5 is worth it.
```
