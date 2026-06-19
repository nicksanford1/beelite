# Finish-Read Evaluation Notes

Status: active
Owner: product owner
Last verified: 2026-06-19

Running log of what the finish-read gets right/wrong on real plans. Gather several, THEN change the
prompt once (one variable at a time). Don't tweak per-plan.

---

## Plan 1 — AutoZone (idk), p14 "A-5.1 Finish Notes and Details" (image read, Opus 4.8)

**Source page:** the INTERIOR FINISH LEGEND lives on the **notes/details sheet (A-5.1)**, NOT the
"Finish Floor Plan" (A-5). Takeaway: tag the *legend/notes/schedule* sheet; the floor plan has no codes.
(Confirmed: p13 floor plan = 0 finishes; p14 legend = all of them.)

**What it got right (11 finishes):**
- Descriptions are richer than they looked in the UI — e.g.
  - `VT` = `12"x12" vinyl tile, Armstrong Imperial #51899 (cool white)`
  - `VB` = `4" vinyl base, Armstrong (V4860 jet black) or Flexco (black)`
  - `TR-1` = `Neoprene reducer strip, color: black, ref 7/A-5.1`
- Scope classification correct: VT/VB/TR-1/SC in-scope (flooring); FRP/paint/CG out-of-scope.

**Bugs / gaps found:**
1. **[FIXED — UI]** The `/finishes` table had **no Description column** (rendered only `type`). The rich
   descriptions were stored but invisible — which made the extraction *look* shallow. Added a Description
   column to `components/finish-review.tsx`. (This was the real cause of "didn't give us enough detail.")
2. **[extraction]** `FRP-B` description truncated: `"...wall covering, color"` with no color value. Either
   the legend value was blank/illegible, or the model stopped early. → watch for incomplete descriptions;
   prompt could require a value or an explicit "(not specified)".
3. **[scope/coverage]** The page also carries **FLOOR PREPARATION NOTES** + **FLOOR TILE NOTES**
   (substrate, moisture, leveling, install method) that affect cost/scope but aren't legend rows and
   weren't captured. Candidate for a *separate* notes/assumptions capture later — not finish rows.
4. **[data shape — opportunity]** Description is one free-text string. Splitting into
   size / material / manufacturer / model / color would make rate-matching cleaner (e.g. "12x12" as its
   own field). Defer until we've seen more plans.

---

## Plan 2 — 4141 Bienville "Gallo Office Renovation", p4 A201 floor plan (image read, Opus 4.8)

**No finish schedule exists.** It's a *renovation*: finishes are (a) a blanket note "NEW FLOOR, CEILING
AND PAINT FINISHES TO MATCH EXISTING," and (b) **floor-plan keynotes P1–P22**. So the "tag the legend
sheet" model doesn't apply — the finish source is the floor plan's callouts. Tagged p4 and read it.

**What it got right:**
- Found the real flooring from a callout: `P1` = "carpet tile; Kinetex Flash Azul" (floor, in-scope) +
  `P2` = carpet tile around floor outlet. Real product name captured.
- **Scope flag did the heavy lifting:** of 22 keynotes, only P1/P2 marked `includedInFlooringScope:true`;
  the other 20 (outlets, doors, partitions, glass, hardware) flagged out. Filtering to in-scope yields
  the correct flooring.
- "Match existing" finishes (ceiling tile, paint) captured as descriptions.

**Bugs / gaps found:**
1. **[over-extraction]** On a callout plan, the model grabbed **all 22 construction keynotes** as
   "finishes," using the keynote numbers (P1–P22) as `code`. Most aren't finishes at all. It leaned on
   the scope flag to sort them — works, but noisy. Prompt could say: extract only floor/base/wall/ceiling
   **finish materials**, not every construction note.
2. **[code field misuse]** P1–P22 are keynote numbers, not finish codes. Callout-style plans have no
   finish codes — `code` ends up being the note number. May need a "no formal code" path.
3. **[plan-type variation]** Confirms Codex's point: not every plan has a schedule. Need to handle
   (a) legend/schedule plans (AutoZone) AND (b) keynote/"match-existing" renovation plans (this one).

## Emerging pattern (2 plans in)
- **Plan type drives everything.** Legend plans → clean coded finishes; renovation/keynote plans →
  over-extraction filtered by scope flag.
- **The `includedInFlooringScope` flag is the MVP** — it rescues noisy reads. Keep leaning on it.
- **Leading prompt-tweak candidates** (don't apply yet — get 1 more plan first):
  (a) "extract only finish *materials*, not every construction keynote";
  (b) require a value for cut-off descriptions (or "(not specified)");
  (c) allow code = "" when the plan has no finish codes.
