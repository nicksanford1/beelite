> ⛔ **SUPERSEDED** — folded into [`estimator-plan.md`](estimator-plan.md), the controlling plan (2026-06-18). Kept for history; do not act on this doc.

# Codex proposal - estimator pipeline strategy

Date: 2026-06-17

## My decision

Use `docs/estimator-workflow.md` as the controlling strategy, and fold the useful parts of
`docs/pipeline-strategy.md` into it.

In plain terms: **do not let the batch/source pipeline drive the estimator work yet.** Use NOLA and
batch scraping to find real plans, but keep the estimator loop small, labeled, and measurement-gated
until we know exactly where the extraction fails.

The better near-term plan is:

1. Fix the read pipeline reliability.
2. Run 5-10 real plans through the app.
3. Hand-correct them in the product.
4. Turn those corrections into the first golden set.
5. Only then scale the batch pipeline.

## Why

`pipeline-strategy.md` is right about the long-term system: two tiers are needed.

- Tier 1: batch throughput over lots of sourced plans.
- Tier 2: deep lab / answer key for quality.

But it is too easy to overbuild Tier 1 before the estimator is measurable. If we scrape and process
hundreds of plans now, we mostly create an unlabeled pile. That feels like progress but does not tell
us whether the estimator is getting better.

`estimator-workflow.md` is stronger for the next phase because it forces discipline:

- small bounded batches,
- human-gated labels,
- one variable changed at a time,
- scoring by pipeline stage instead of vibes,
- correction data captured through the real app.

That is the right control loop for an AI extraction product.

## Proposed operating model

Run two workstreams, but with a clear contract between them.

### Workstream A - sourcing pipeline

Owner: separate sourcing/NOLA agent.

Job:

- Find candidate permits.
- Scrape document lists and plan PDFs.
- Keep a local manifest per permit.
- Mark likely plan sets vs paperwork.
- Hand off a small selected batch to the estimator pipeline.

Output:

- `data/nola/<permit>/manifest.json`
- plan PDFs
- basic metadata: permit, address, building type if known, file names, keep/skip suggestion

Rule:

This workstream may collect volume, but it should not auto-feed hundreds of projects into the app yet.
It feeds curated batches.

### Workstream B - estimator pipeline

Owner: estimating core thread.

Job:

- Ingest selected PDFs into normal `Project`/`Document` records.
- Persist per-page text and page images at upload/ingest.
- Let the user tag relevant pages.
- Run extraction only on tagged pages.
- Human-correct finishes in `/finishes`.
- Store corrected output as ground truth.
- Score future runs against that ground truth.

Output:

- confirmed `Extraction.corrected` JSON
- per-plan notes on failure mode
- metrics by stage
- prompt/preprocessing/model decisions backed by those metrics

Rule:

No estimator change counts as an improvement until it beats the golden set without obvious regressions.

## Immediate sequence

### Phase 0 - reliability gate

Finish the plan-read re-architecture first.

- Stop downloading the whole PDF at read time.
- Persist per-page text and image artifacts during ingest.
- Send only tagged page artifacts to Claude.
- Strip fenced JSON / harden parsing.
- Add explicit timeout and visible errors.
- Save explicit zero-finish extractions.
- Remove `app/api/diag/route.ts` after verification.

This must happen before any eval/batch work. A hanging pipeline cannot be measured.

### Phase 1 - first small batch

Pick 5 real plans, not 50.

The batch should be varied:

- retail fit-out,
- office TI,
- restaurant,
- school/public,
- one messy/large plan set.

For each:

1. Ingest pages.
2. Human tag the relevant finish/source pages.
3. Run the extractor.
4. Correct the finish list in the app.
5. Record the failure mode.

The goal is not automation yet. The goal is to learn where the pipeline breaks.

### Phase 2 - golden set and scoring

Promote the first corrected plans into a golden set.

Measure:

- page-targeting recall: did we tag/read the right pages?
- finish code precision/recall,
- type/category/unit correctness,
- false positives from notes/details,
- empty-read correctness,
- cost and latency per extraction,
- human correction rate.

Do not start with quantity/takeoff automation as the primary metric. Finish extraction is the bounded
problem to solve first.

### Phase 3 - controlled iteration

Change one thing at a time:

- prompt,
- page input mode: text vs image,
- model: Sonnet vs Opus,
- page selection rules,
- parsing/normalization.

Then rerun the golden set.

If a change only improves one plan but breaks another, it is not an improvement.

### Phase 4 - batch assist

Once the golden set is stable, let Tier 1 process more plans automatically.

Batch output should be triaged by confidence and cross-checks:

- high-confidence, schedule-page agreement: lower review priority,
- low-confidence or disagreement: needs human review,
- no finish source found: classify as empty/no schedule, not failure.

Batch can then create more candidates for the golden set.

## Architecture recommendation

Keep the product pipeline narrow and deterministic around the AI call:

```
source PDF
  -> page ingest once
  -> page text + page image artifacts
  -> human page tags
  -> tagged page extraction
  -> human correction
  -> golden/eval data
```

Avoid building an autonomous "agent" for estimation right now. This should be a repeatable pipeline
with explicit inputs, outputs, logs, and correction data. Claude Code skills/agents can help develop
and inspect the system, but the shipped product should stay a controlled pipeline.

## What not to do yet

- Do not auto-ingest hundreds of NOLA permits into projects.
- Do not optimize model choice before the input artifacts and parser are reliable.
- Do not send whole plan PDFs to Claude.
- Do not chase automatic takeoff quantities before finish extraction is scored.
- Do not treat unreviewed model output as training/eval truth.

## Final call

`estimator-workflow.md` is the better immediate strategy.

`pipeline-strategy.md` is still valuable, but as the scaling layer after the estimator loop has a
golden set and metrics. The combined plan is: **small labeled estimator loop first, sourced batch
pipeline second, with both connected by explicit manifests and correction data.**
