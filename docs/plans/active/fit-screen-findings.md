# Fit Screen — the gate that comes BEFORE measurement

Status: experiment notes (for Codex review)
Owner: Claude (implementer)
Created: 2026-06-19
Related: [`vector-first-measurement.md`](vector-first-measurement.md) · [`vector-quality-findings.md`](vector-quality-findings.md)

## The finding (one line)

Before asking *"can we measure this plan set?"* we must first ask *"is there a flooring takeoff in
it at all?"* — and that question is only answerable by **looking at the finish schedule**, not by any
text-layer or vector-geometry statistic.

## Why this matters / what changed

`vector-first-measurement.md` routes every page by **vector quality** (vector / mixed / raster). That
is the right gate for *measurability*. But measurability is wasted if the set has no flooring scope.
My first pass graded a set as a "GOOD vector sample" when it was actually **not a usable flooring
lead at all**. The vector probe cannot see that — only viewing the schedule can.

So the pipeline needs an earlier gate:

```text
permit / plan set
      |
      v
[ GATE 0: FIT SCREEN ]   <-- NEW. is there a flooring takeoff here?
      |
      |-- not a fit  -> stop. don't measure.
      `-- fit         -> [ GATE 1: vector-quality pre-screen ] -> measurement experiment
```

## The fit criteria

A set is a FIT for a flooring takeoff only if all four hold:

1. **Flooring in scope** — new/replacement floors, not MEP-only, not "match existing" with no spec.
2. **Finish schedule with a FLOOR column** — rooms mapped to floor finishes (LVP, ceramic tile,
   carpet, etc.). *This is the decisive, make-or-break signal.*
3. **A measurable architectural floor plan** — dimensioned rooms you can take SF from.
4. **Worth bidding** — enough SF to matter.

Criterion 2 is the one that requires human/vision review and the one that killed an otherwise-clean
set below.

## Case studies (2 permits, viewed page-by-page)

### ❌ 26-14856-RNVN — 1555 Poydras Ste 2000 (Taylor Wellons, office TI) — NOT A FIT

- Vector-quality probe said "GOOD vector sample, 13 plan pages." Looked great on paper.
- Reality on viewing: **no Finish Schedule and no Finish Plan in the drawing index** (A000 → only
  Cover, Life Safety, Demo, Construction Plan, RCP, Power/Device).
- Finishes are **"match existing"**: *"ALL NEW INTERIOR FINISHES, INCLUDING… FLOORING, BASE… SHALL
  MATCH EXISTING ADJACENT TENANT SUITE."*
- Also: the probe's "13 plan pages" was inflated ~3× — most were MEP sheets titled "…FLOOR PLAN –
  HVAC / FIRE PROTECTION / LIGHTING." Only ~1 architectural floor plan (A201).
- **Verdict:** measurable geometry, but the finish side is not in the documents → cannot complete a
  takeoff from the PDFs. Not a fit. (Common pattern in tenant-improvement work.)

### ✅ 26-02467-NEWC — 1938-40 Annette (new duplex) — STRONG FIT

- Ground-up two-story duplex, ~2,148 SF, two units.
- **A6.1 "Interior Elevations and Schedules" carries a fully-populated FINISHES SCHEDULE with a FLOOR
  column:**
  - Vinyl plank: living/dining, kitchen, bedrooms, hall, closets.
  - Ceramic tile: baths, laundry.
- Room **marks on the schedule (101, 102…) match the room-number tags on the A2.1 floor plan** →
  traceable room → finish chain (exactly the association `vector-first-measurement.md` §8 wants).
- Only two finish types, clean labels → an easy, high-confidence takeoff.
- **Verdict:** fit, and a good one.

Same fit screen, opposite outcomes. The deciding evidence in both cases was the finish-schedule
sheet — invisible to path-counting.

## Implications for the vector-first plan

1. **Add a Gate-0 fit screen** ahead of vector-quality routing. Cheap: it mostly needs the drawing
   index (is a Finish Schedule/Finish Plan listed?) and that schedule sheet (is the FLOOR column
   populated, or is it "match existing"?).
2. **"Match existing" is a first-class no-fit outcome** — flag it explicitly; it's common in TI/reno
   permits and means the finish data lives off-document (site visit / GC).
3. **A general vision model is well-suited to the fit screen** (read index, classify the schedule
   sheet, detect a populated FLOOR column) — a good, low-risk first use of AI per §8, separate from
   any geometry work.
4. **Don't trust title text alone** to count plan pages — "FLOOR PLAN" appears on HVAC/FP/electrical
   sheets. Page classification needs more than a keyword.

## What I'd want Codex to weigh in on

- Should the fit screen be its own service step, or folded into page classification?
- Is "finish schedule present + FLOOR column populated" the right decisive signal, or are there fit
  patterns it misses (e.g. flooring called out only in plan notes, or a separate finish-plan sheet)?
- How to represent a "partial fit" (measurable but finishes off-document, like Taylor Wellons) so it
  isn't silently dropped — these may still be leads worth a manual call.

## Caveat

This is 2 permits. The pattern (schedule presence decides fit) is strong but needs the rest of the
sample set before it's a rule. Screening of #3 (Benson Tower) and #4 (4040 Canal) is pending.
