> ⛔ **SUPERSEDED** — folded into [`estimator-plan.md`](estimator-plan.md), the controlling plan (2026-06-18). Kept for history; do not act on this doc.

# Engineering workflow — building the estimator

How we build and improve Beelite's takeoff/estimating engine. This is a *process* doc (the "how we
work on the hard part"), distinct from `architecture.md` (the wiring) and `v1-plan.md` (the product).

## The reframe that drives everything

**The bid math is already solved and deterministic.** The Google Sheet computes the bid and is
verified to `$15,205.54` on a known dummy bid. So ~95% of the remaining engineering risk lives in one
place: **getting the right takeoff inputs out of a PDF** (which finishes, which rooms, how much area).

Consequence: we are not building "an app" — the app shell exists. We are building a
**measurement-driven extraction system** with an app wrapped around it. Everything below optimizes for
that.

Two hard rules:

1. **Hard-wall deterministic from probabilistic.** Trust + unit-test the math. *Never* trust the AI —
   always measure it against ground truth.
2. **Decompose the pipeline and measure each stage**, not the whole thing as one black box.

---

## Part A — The corpus pipeline (permits → labeled plans)

The NOLA permit source ([nola-portal-scraping.md](nola-portal-scraping.md)) gives us real, local,
varied commercial plans — the production distribution — plus the ability to hand-label ground truth.
Keep batches small and human-gated.

| # | Stage | What happens | Where |
|---|---|---|---|
| 1 | **Identify** | Pick a bounded batch (start **5–10** saved leads, not 200) | `/permits` triage → `leadStatus=saved` |
| 2 | **Scrape** | Pull doc list + plan PDFs per permit | `scripts/nola-docs.ts` → `data/nola/<permit>/` + `manifest.json` |
| 3 | **Doc-triage** | Which PDFs are real plans vs paperwork | keep/skip heuristic *proposes*, **human confirms** |
| 4 | **Ingest** | Good plans → Supabase storage + `Document`/`PlanSheet` rows | mirrors `app/actions.ts` upload path |
| 5 | **Label** | Hand-verify the *correct* finishes/quantities once | becomes ground truth (`Extraction.corrected`) |

**Discipline:** steps 3 and 5 are human-gated *on purpose*. Don't auto-ingest hundreds of permits —
you'll drown in junk with no labels. Small batches you actually label beat a huge unlabeled pile.

---

## Part B — The build loop (eval-driven development)

```
ingest plan → AI extracts → human reviews/corrects → measure AI vs correction → change ONE thing → re-run the golden set
```

Two assets make this work — **both already exist**, just lean into them:

1. **The golden eval set** — 10–20 hand-labeled plans chosen for *diversity* (building types, schedule
   styles, page counts), not volume. Your regression suite for the AI. Label carefully, once.
2. **The correction log** (`Extraction` table, `corrected` JSON) — every human fix on `/finishes` is a
   new ground-truth label captured for free. The review UI is simultaneously the product *and* the
   data engine. Design so no correction is ever lost.

**The rule that keeps you honest:** change *one* variable (prompt OR model OR preprocessing), then
re-run the whole golden set and confirm the metric moved up *without regressing the others*. Never
"looks better on the one I tried."

---

## Part C — What to measure (decomposed)

| Stage | Metric | Why it's the lever |
|---|---|---|
| **Page targeting** | precision/recall on "is this a finish-schedule page" | cheapest fix, biggest payoff — wrong pages = wrong + expensive extraction |
| **Finish extraction** | finish codes/types correct? (set match vs ground truth) | the bounded, winnable problem — **attack first** |
| **Takeoff quantities** | % of areas within tolerance of ground truth | hardest (measuring off drawings) — keep manual longest |
| **Whole bid** | $ delta vs your hand bid | the number that actually matters |
| **Human-correction rate** | how often a human must fix it | north-star UX metric |
| (ops) | cost per bid, latency | already ~$0.06–0.18/bid; watch it |

---

## Part D — Test pyramid

- **Deterministic unit tests** (cheap, always run, never regress): Sheet math (lock `$15,205.54` as a
  golden), the NOLA doc-list parser, the keep/skip classifier, `lib/estimate.ts`.
- **Golden eval** (the AI suite): extraction vs the labeled corpus, scored, run on every prompt/model
  change.
- **One E2E smoke**: a single real plan → all the way to a synced bid. Catches plumbing breaks.

---

## Recommended sequence

0. **Reliability gate.** If the AI finish-read still hangs (see `STATUS.md` — egress / huge floor-plan
   pages), fix it + add error hardening *first*. You can't run an eval loop on a pipeline that hangs.
1. **Build `nola:docs`** (Part A 1–3) — scrape saved leads to `data/nola/` so you can eyeball real
   plan sets.
2. **Ingest ~5** into the app (Part A 4) as Projects with Documents.
3. **Run the existing pipeline** on those 5, correct on `/finishes`, and *watch where it fails.* That
   tells you which Part C metric to attack first (almost always page-targeting or finishes, not
   quantities).
4. **Then** formalize the golden set + scoring — built around the failure modes you actually saw, not
   in the abstract.

> Don't build the eval harness abstractly. Run 5 real plans through, get burned, *then* build the
> measurement around the failures you saw.
