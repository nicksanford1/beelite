# Beelite Estimator — V1 Plan

**V1 promise:** "Upload your plans, we read your finish schedule, you do a traceable
room-by-room takeoff, and it all lands in a **Google Sheet you already know how to use** —
where your formulas, rates, and final bid live."

## The core idea (read this first)

**Google Sheets is the bid engine. The app is the capture / review / sync layer.**

The estimator already trusts Sheets — their formulas, markup, tax, final number live there.
We don't replace that. The app does the tedious part Sheets can't: **read the plans, organize
finishes, run a traceable room-level takeoff, and push it all into the Sheet.** The Sheet stays
the place they price and finalize.

Three things make V1 a *product*, not a nicer spreadsheet:
1. **AI reads the finish schedule** off the PDF and pre-fills finishes.
2. **The app syncs everything into a pre-built Google Sheet** (their familiar workspace), safely.
3. **Room-level takeoff that rolls up** — every total traces back to where it came from.

Everything AI- or formula-produced is **overrideable**. The human is always in control.

---

## How the app and the Sheet split the work

| The app owns (capture/review) | The Google Sheet owns (bid engine) |
|---|---|
| Plan upload + page tagging | Final pricing & **all bid math** (formulas) |
| AI finish-schedule extraction | Markup / margin, tax, freight, bid total |
| Room-level takeoff + status | Rate edits the estimator wants to make live |
| Scope checklist | The deliverable the GC receives |
| One-way **sync** into the Sheet | Manual overrides & notes |

The app keeps a lightweight **preview** of numbers, but the Sheet is the **authoritative
calculator** — so there's no two-sources-of-truth drift. (See `architecture.md` → Sheet Template Contract.)

---

## Company Catalog vs. Project

- **Company layer (reused every bid):** Finish Library, Rate Catalog, Scope template.
  Enough lives in the app to pre-fill a new project; rates are *also* written into the Sheet's
  **Rates/Catalog tab** so the estimator can tweak pricing where they're comfortable.
- **Project layer (one bid):** copies of the above, locally overrideable.

Why: contractors reuse the same finishes/rates/scope. Per-project entry means re-typing the
cost book every bid (they quit by job #3). The catalog is also the **flywheel/moat**.

---

## V1 Build

### 1. Project Setup
name · bid date · client/GC · location · notes/exclusions.
On create, the app **copies the Google Sheet template** → a fresh bid sheet for this project.

### 2. Plan Upload + page tagging
Upload PDFs. A plan set is often **one PDF with many sheets**, so tagging is **per page**:
each page gets a sheet number/title and a type — `Floor Plan · Finish Plan · Finish Schedule · Specs · Other`.
(No AI sheet detection in V1 — manual tag. "Tag page 47 as the Finish Schedule.")

### 3. Scope Checklist *(do early — it frames the bid)*
Seeded from the company template. Items: flooring material · waste · wall base · transitions ·
demo · floor prep · adhesive · freight · tax · attic stock · stairs · moisture mitigation ·
alternates · exclusions. Each is **Included · Excluded · Pending** (+ allowance field).
Feeds the auto-drafted Assumptions tab.

### 4. Finish Items — AI-assisted
1. Point at the **page tagged Finish Schedule**.
2. **AI extracts every row** → code / type / description / unit, **plus a category**
   (`floor · base · transition · wall · other`) and **in-scope flag**. Schedules include
   non-flooring (paint, wall finishes) — extract it all, default non-flooring **out of scope**.
3. Low-confidence rows get an **uncertainty flag**, shown next to a crop of the original.
4. User confirms/edits; in-scope finishes flow forward. Confirmed rows can **save to the Finish Library**.

| Code  | Type        | Description        | Unit | Category | In scope |
|-------|-------------|--------------------|------|----------|----------|
| LVT-1 | LVT         | Luxury vinyl tile  | SF   | floor    | ✅       |
| CPT-1 | Carpet tile | Office carpet tile | SF   | floor    | ✅       |
| RB-1  | Rubber base | 4" rubber base     | LF   | base     | ✅       |
| PT-2  | Paint       | Wall paint         | —    | wall     | ❌       |

Fallback: manual entry on poor/scanned plans. **Units are an open enum** (SF, LF, EA, SY…).

### 5. Takeoff Quantities — room/area-level, manual in V1
Granular rows that **roll up by finish** → every total is traceable (and it's the same shape
V2's "draw on PDF" will produce).

| Sheet | Area / Room   | Finish | Qty   | Unit | Status       |
|-------|---------------|--------|-------|------|--------------|
| A101  | Rooms 101–108 | LVT-1  | 1,250 | SF   | approved     |
| A101  | Corridor      | CPT-1  |   900 | SF   | needs review |

- App totals by finish (Σ approved rows). **Granularity optional** — lump row or break out.
- **Per-row status:** `draft · needs review · approved · excluded`. **Sync uses approved by default.**
  Default new rows to `draft`; **one-click bulk-approve**.

**Every takeoff row is two things:** *(a) WHAT* — which room + which finish, and *(b) HOW MUCH* — the SF.
We automate them on different timelines:

| | WHAT (room + finish) | HOW MUCH (the SF) |
|---|---|---|
| **V1** | **Dropdown** for finish (from extracted finishes) + free-type room. No typing codes. | Human types the number (from their takeoff tool or by hand). |
| **V1.5** | **AI pre-builds the rows** — reads the *finish plan*, lists room→finish pairs, user just confirms. | Still typed. |
| **V2** | Same AI suggestions. | **AI/draw measures it** — the real unlock. |

So the only thing typed in V1 is the SF number; the finish is a dropdown, and V1.5 makes the
rooms themselves an AI suggestion you correct rather than enter.

### 6. Assembly defaults (rates)
Each finish carries defaults **from the Rate Catalog** (material cost, waste %, carton/roll size,
adhesive rule). **Install** is its own field: unit rate · lump-sum sub quote · **pending**.
These values seed the Sheet's Rates tab; the math runs there (next).

### 7. Sync → Google Sheet (the bid engine)
The app pushes values into **hidden app-owned tabs** (`App_Finishes`, `App_Takeoff`, `App_Scope`,
`App_Settings`). The **visible tabs pull from those with formulas** and do the work:
- `Order Qty = Qty × (1 + Waste %)`, rounded up to full carton (`CEILING`)
- Material / Install / Line totals
- **Markup vs. Margin**, tax, freight → **Bid Total**

Because the app only writes hidden tabs, **re-syncing never clobbers the estimator's manual
edits** in the visible tabs. The estimator can tweak a rate or waste % in the Sheet and watch it recompute.

### 8. Assumptions / Exclusions
A visible tab **auto-drafted from the Scope Checklist + extra/install modes** ("Moisture mitigation
excluded," "PT install pending," "Quantities based on current drawings"). Editable in the Sheet.

### 9. Status (project-level = labels, not gates)
`Draft → Review → Approved → Exported` as labels. The status that matters is **per-row** (§5).
Artifact = the Google Sheet bid.

---

## V1 Screens
1. Dashboard / Projects
2. Project Detail *(links to its Google Sheet)*
3. Documents *(page-level tagging)*
4. Scope Checklist
5. Finish Items *(AI-extract + category/scope)*
6. Takeoff Quantities *(room-level, status, bulk-approve)*
7. Sync / Sheet Preview
8. **Company Catalog** *(Finish Library + Rate Catalog + Scope template)*

> Note: there's no heavy in-app "Estimate Builder" screen — the estimate lives in the Sheet.
> The app shows a read-only preview and a **Sync** button.

---

## Build order (Sheets-first)
1. **Google Sheet template** — visible tabs, formulas, named ranges.
2. **Hidden `App_*` tabs + named ranges** the app writes to (the Sheet Template Contract).
3. App skeleton + Supabase (DB + storage + auth) + Prisma schema.
4. Project + document upload with **page-level tagging**.
5. **Finish-schedule extraction** (the wow) + correction log.
6. **Sync extracted finishes → Sheet.**
7. Room-level takeoff + status + roll-up.
8. Scope checklist + auto-assumptions.
9. Polish estimate preview / export flow.

Demo-critical path: 1 → 2 → 4 → 5 → 6. Get "upload → AI reads it → it lands in their Google Sheet" working end-to-end first.

---

## What NOT to build in V1
Full AI room detection · PDF measurement / scale calibration · training a custom model ·
two-way Sheet sync · subcontractor bidding portal · every flooring edge case · polished proposals.

---

## V2 — real takeoff assistance
PDF viewer + scale calibration · draw polygons (SF) and lines (LF) · assign finish codes to drawn
areas (same room-level rows as §5) · visual markups · AI spec summary · stronger uncertainty flags ·
optional read-back from the Sheet.

**V2 promise:** "Draw or let AI suggest the areas — measurement gets automated, you just verify."
