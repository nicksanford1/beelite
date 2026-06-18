> ⛔ **SUPERSEDED** — folded into [`estimator-plan.md`](estimator-plan.md), the controlling plan (2026-06-18). Its accepted changes are now in that doc. Kept for history; do not act on this doc.

# Codex final estimator proposal

Date: 2026-06-18

This is my final recommendation after reading `docs/final-proposal.md` and
`docs/estimator-plan.md`.

## Final call

Use `docs/estimator-plan.md` as the controlling build plan.

`docs/final-proposal.md` is directionally right: the work should be split into a
sourcing agent and an estimator/eval agent. But it locks a few things too early.
The safer plan is:

1. Close the estimator reliability gate.
2. Source only a small curated batch.
3. Run real plans through the real app.
4. Save human corrections as the answer key.
5. Build scoring around those failures.
6. Scale batch processing only after the estimator is measurable.

In plain terms: we are not building an autonomous estimating agent yet. We are
building a repeatable plan-reading pipeline with explicit inputs, outputs,
human correction, and metrics.

## What we are actually building

The system has three connected loops.

### 1. Source loop

Find real plan sets and get them into the product.

```
NOLA permits
  -> saved candidate
  -> portal document scrape
  -> local manifest + PDFs
  -> curated keep/skip decision
  -> Project + Document
```

This loop creates supply. It should not flood the app with hundreds of projects
yet. It should produce small, useful batches.

### 2. Read loop

Read only the relevant pages, then let the user correct the result.

```
Project + Document
  -> ingest once
  -> per-page text + page image artifacts
  -> human tags finish/source pages
  -> AI reads only tagged pages
  -> finishes appear in /finishes
  -> human corrects
  -> corrected JSON is saved
```

This loop is the product core. It must be boring, reliable, and visible when it
fails.

### 3. Learn loop

Use the corrected reads to make the pipeline better.

```
corrected extractions
  -> golden set
  -> eval script
  -> score prompt/model/input changes
  -> keep only changes that improve the full set
```

This loop is how we avoid guessing. No prompt, model, or preprocessing change
counts as better until it improves the golden set without obvious regressions.

## Changes I would make to the existing proposals

### Change 1: Do not call the reliability gate done yet

Per-page ingest exists, and that is the right architecture. But the gate is not
closed until one real plan proves:

- only tagged page artifacts are sent to Anthropic,
- the UI shows a real error on failure,
- a timeout prevents hanging,
- fenced JSON / stray prose parsing is hardened,
- zero-finish reads save as explicit empty results,
- human corrections cannot be lost,
- the temporary diag route is removed.

Nothing meaningful can be measured while the read path can hang or silently
fail.

### Change 2: Do not lock Sonnet or Opus yet

Current code is using Opus 4.8 for extraction. Some docs assume Sonnet cost and
latency. Treat model choice as an experiment, not a belief.

Default for Phase 1: keep the current model so the first batch has fewer moving
parts.

Phase 3 experiment: run the same golden set on Opus and Sonnet, then compare:

- finish precision and recall,
- false positives,
- empty-read correctness,
- cost,
- latency,
- human correction rate.

If Sonnet is close enough, move down. If Opus is materially better, keep it only
where it earns the cost.

### Change 3: Make page image the v1 source of truth

For finish schedules, layout matters. Tables, legends, tags, and sheet context
can get scrambled in text extraction.

For v1 extraction, send the page image as the canonical source. Include extracted
page text as supporting context when it is small and useful. Later, test a
text-only path for notes-heavy pages if the golden set proves it is accurate
enough.

Never send the full PDF to the model.

### Change 4: Keep scanner guessing out of the critical path

For v1, the user tags the pages. Scanner suggestions can exist later, but they
must be scored as page-targeting precision/recall before they drive automation.

Bad page selection creates bad extraction, and then the extractor gets blamed
for missing data it never saw.

### Change 5: Promote page artifacts before scaling

Using `scanSignals` as a prototype storage spot is fine for proving the path.
Before batch scale, page artifacts should become first-class data:

- document id,
- page number,
- extracted text,
- rendered image path,
- ingest timestamp,
- render/extract status.

That gives sourcing, extraction, UI, and eval a clean shared contract.

## Two-agent ownership

The two-agent split is correct, but the contract needs to be strict.

### Agent A: Sourcing, intake, and scoring

Owns:

- `scripts/nola-*`,
- NOLA document scraping,
- local manifests,
- curated first batch,
- intake script that creates `Project` + `Document`,
- eval/scoring scripts,
- metrics and insight notes.

Does not own:

- extraction prompts,
- Anthropic call behavior,
- finish read logic,
- `/finishes` correction UX.

Agent A's output is a small batch of real, ingested projects plus later score
reports.

### Agent B: Estimator core

Owns:

- `lib/ingest.ts`,
- `lib/anthropic.ts`,
- extraction prompts,
- `readSchedule`,
- `/finishes`,
- correction save path,
- model/input experiments.

Does not own:

- scraping logic,
- permit triage UI,
- bulk source selection,
- scoring harness results.

Agent B's output is reliable extraction plus corrected reads that become ground
truth.

## The agent handoff contract

The handoff should be data, not vibes.

Agent A gives Agent B:

- `data/nola/<permit>/manifest.json`,
- the kept plan PDFs,
- permit/address metadata,
- keep/skip notes,
- created `Project` + `Document` ids after intake.

Agent B gives Agent A:

- extraction output,
- `Extraction.corrected` JSON,
- failure-mode note per plan,
- model/input/cost metadata.

Both agents use the same database schema and do not change shared schemas
without agreeing first.

## Implementation order

### Phase 0: close reliability

This is the immediate next step.

- Verify one real plan end to end.
- Confirm reads use tagged page artifacts only.
- Add timeout and visible error state if missing.
- Harden model-output parsing.
- Save explicit empty extractions.
- Make correction saves durable.
- Remove `app/api/diag/route.ts`.
- Update `STATUS.md` once verified.

### Phase 1: curate five real plans

Agent A should source five varied plans:

- retail fit-out,
- office TI,
- restaurant,
- school/public or institutional,
- one messy/large plan set.

Five good plans are better than fifty unlabeled ones.

### Phase 2: run, correct, and write failure notes

For each plan:

1. Ingest the document.
2. Tag the relevant pages manually.
3. Run extraction.
4. Correct finishes in the app.
5. Save a short failure-mode note.

The goal is to learn where the read breaks.

### Phase 3: build the golden set and scoring

Turn the corrected five plans into the first golden set.

Score:

- page-targeting precision/recall,
- finish-code precision/recall,
- material/type/category/unit correctness,
- false positives,
- empty-read correctness,
- cost and latency,
- human correction rate.

Do not make takeoff quantity automation the first eval target. Finish extraction
is the bounded problem to solve first.

### Phase 4: run controlled experiments

Change one thing at a time:

- prompt,
- page image vs text vs hybrid input,
- Opus vs Sonnet,
- parsing/normalization,
- page-selection rules.

Re-run the whole golden set after every change.

### Phase 5: batch assist

Only after scoring exists, let the sourcing pipeline feed more plans.

Batch results should be triaged:

- high confidence and page agreement: lower review priority,
- low confidence or disagreement: human review,
- no finish source found: explicit empty/no-schedule classification.

Batching should create more golden-set candidates, not replace review.

## Next thing to do

Close Phase 0, then run the first five-plan batch.

The project does not need more architecture work before that. It needs one
verified read path, one small real corpus, and one correction loop that never
loses data.
