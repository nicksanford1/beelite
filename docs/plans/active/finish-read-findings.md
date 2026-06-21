# Finish-Read & Takeoff AI — Field Findings

Status: field findings (accumulating; for Codex review before any contract change)
Owner: Claude (implementer) + product owner
Created: 2026-06-21
Last verified: 2026-06-21
Related: [`fit-screen-findings.md`](fit-screen-findings.md) · [`takeoff-measurement.md`](takeoff-measurement.md)
Touches (do NOT change yet): `lib/anthropic.ts` (`GUARDED_PROMPT`, `FinishReadResult`),
`lib/overview.ts` (workflow states), the Finishes/Plans screens.

## 0. Why this doc exists

We are running **real permitted plan sets** through the app by hand to learn what the finish-read AI
call must actually handle — *before* rewriting the extraction contract. The goal is an evidence log,
not a redesign. Each set we examine becomes a case study below. When the pattern is confirmed across
enough sets, we propose the contract change, Codex reviews **this doc**, then we implement and test.

Methodology per run: pick the architectural sheets, view them page-by-page, record (a) how the floor
finish is actually specified, (b) where the area/quantity data lives, (c) what our **current** read
would do, and (d) what it **should** do. No code changes until the pattern repeats.

## 1. The core finding (so far)

Our current read is **schedule-only and is told to ignore notes.** `GUARDED_PROMPT` in
`lib/anthropic.ts` detects a "finish schedule / room finish schedule / finish legend / finish plan /
material schedule" and includes this hard rule:

> "Do not invent finishes from sections, assemblies, details, or **general notes**."

But real sets often specify flooring **as a note**, not a schedule. When they do, our read returns
`not_found`, and `lib/overview.ts` routes `not_found → "add manually or pass"` — i.e. **a clean,
biddable job gets flagged as a no-fit by our own prompt.** This is a false negative, not a model error.

## 2. Case studies

| Permit | Type | How floor finish is specified | Area/qty data | Current read verdict | Correct verdict |
|---|---|---|---|---|---|
| 26-02467-NEWC (duplex) | small res | **Finish schedule** (LVT + tile), room marks match plan | from plans | ✅ `found` | found |
| 26-14856-RNVN (Taylor Wellons, office TI) | TI | **"Match existing"** — finishes off-document | n/a | `not_found` → pass | **partial fit** (lead, manual follow-up) — not the same as "nothing" |
| 25-33633-NEWC (3800 Texas, 50-unit MF) | new MF | **Plan note:** "ALL INTERIOR FLOOR FINISHES TO BE LVT THROUGHOUT UNLESS NOTED" — no schedule | **LS-102 occupant-load** has per-room gross SF | ❌ `not_found` → pass (WRONG) | **found** — LVT throughout + tile exceptions |

### 25-33633-NEWC detail (the trigger for this doc)

- 3-story, 41,462 SF, ~33 units, two repeating types (A = 1-BR, B = 2-BR, + ADA variants).
- Floor finish = **LVT throughout** (plan note #3 on the enlarged plans A101.1 / unit plans A401/A403),
  tile in wet areas via "unless noted."
- No finish schedule sheet. The only sheet titled "Finish Schedule" (A201) is **exterior siding**.
- Per-room gross SF is tabulated on the **Life Safety occupant-load sheet (LS-102)** — not an arch sheet.
- Verified page map (combined 39-page arch set): p3 LS-102 (area table) · p8/p11/p14 overall floor
  plans L1/L2/L3 · p9–10/12–13/15–16 enlarged plan halves (carry the LVT note) · p24 A401 Unit Type A ·
  p26 A403 Unit Type B. (Page map saved with the project; see its notes.)

## 3. What the AI call should call out (proposed — NOT yet implemented)

Reframe the read from *"is there a finish schedule?"* to *"how is the flooring specified?"*

1. **`finishSource` classification** — `schedule | plan_note | unit_type_note | match_existing | none`.
   `not_found`/`none` fires ONLY when there is genuinely no flooring info. "Finish is in a note" is a
   first-class `found`.
2. **Capture blanket + per-unit-type notes** as finishes (the thing the current prompt forbids).
3. **Default + exceptions** — capture "LVT throughout" AND the "unless noted" exceptions (tile in
   bath/laundry). Both, or the scope is wrong.
4. **Unit types + counts** — multifamily is bid as *Type A × N, Type B × M*, not room-by-room.
5. **Area data from non-arch sheets** — occupant-load / area schedules are candidate quantities; flag
   as **gross** (includes walls) so it is a cross-check, not a billable number.

## 4. Process changes implied (before / during / after the run)

- **Before (Gate-0 fit screen):** must read **notes**, not just schedules — else it makes the same
  false-negative call before we spend tokens. ("Match existing" stays a distinct *partial-fit* outcome.)
- **During (the read):** broaden prompt + output schema per §3.
- **After (`lib/overview.ts`):** stop auto-routing `not_found → pass`. Split into *truly nothing*
  (pass candidate) · *finish-in-notes* (proceed) · *match-existing* (partial fit, manual follow-up).
- **Screens:** Finishes/Plans need to show finish-source + the default/exception split, and (later)
  surface occupant-load SF as candidate takeoff quantities.

## 5. Floor / room taxonomy to bake into the prompt (market reality)

- **Floors:** LVT/LVP (dominant in MF), ceramic/porcelain **tile** (bath, laundry), **carpet**
  (bedrooms, sometimes), VCT, sealed/polished concrete + epoxy (corridor, back-of-house, trash/mech),
  walk-off mat at entries. (Existing `FinishCategory` enum already covers these.)
- **Room buckets that drive finish:** unit interiors (by type) · **wet rooms** (bath/laundry/kitchen —
  the "unless noted" exceptions) · **common areas** (corridor, leasing/office, mail, trash, elec/mech,
  stairs, breezeway — often a different finish or out of scope).

## 6. Open questions for Codex

1. Is `finishSource` the right classifier, or do we miss patterns (e.g. finish keyed only in spec
   division 09, or split between a plan note and a partial schedule)?
2. How aggressively should the read trust a blanket note vs. flag `needsReview`? (penny-precise bids)
3. Should occupant-load/area extraction be the **same** call or a **separate** one? (token cost vs.
   coupling.)
4. Unit-type detection: model-extracted, or human-confirmed from the plan index? (accuracy vs. effort)
5. What's the right `overview.ts` state machine once `not_found` splits three ways?

## 7. Sample queue (run these next, same method, before changing code)

- [ ] Benson Tower (from fit-screen-findings.md, pending)
- [ ] 4040 Canal (pending)
- [ ] 1–2 more TI/reno permits (to pressure-test "match existing" vs "partial fit")
- [ ] 1–2 more ground-up MF (to confirm "LVT-throughout note" is the MF norm)

## 8. Calibration rule (owner directive)

Each plan set is a **data point**, not a conclusion. Do NOT let one set rewrite the worldview — we have
barely begun. Record what each set *shows* and how many more we'd need before acting; keep adjusting the
hypothesis, but do not change the AI contract / `overview.ts` / process off n=1–2.

**Sample threshold before confirming a pattern (and before any code/contract change):** ~10–12 sets
across building types, with **at least 2–3 per type** (multifamily, hotel, healthcare, office-TI, retail,
TI/reno). Mirrors `vector-first-measurement.md` §11. The §2 table tracks progress toward this.

Decision gate: only after the sample threshold is met AND the pattern repeats do we draft the
`lib/anthropic.ts` contract change + `overview.ts` states for Codex review, then implement + test.
