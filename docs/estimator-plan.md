# Estimator build plan — FINAL controlling plan (two-agent)

> **This is THE plan. v2 · 2026-06-18.** It consolidates and **supersedes**:
> `estimator-workflow.md`, `pipeline-strategy.md`, `final-proposal.md`,
> `codex-estimator-pipeline-proposal.md`, `codex-final-estimator-proposal.md`. Those are kept for
> history only — do not act on them. Plan-truth lives here.
>
> **Agent A (this Claude) is the lead.** Agent A resolves conflicts, owns this doc, and sets the
> coordination rules below. Agent B: read §9 (Leader directives) and §11 (Coordination log) first.

## 0. The plan in one paragraph

The bid math is already deterministic and verified ($15,205.54). The only real risk is **reading the
right takeoff out of a PDF.** So: build a **small, labeled, measurement-gated estimator loop first**;
turn on the **sourced batch pipeline second**; connect them with **manifests + human-corrected ground
truth**. Two agents run two workstreams in parallel against a strict contract, so they never block or
collide. We are **not** building an autonomous estimating agent — we're building a repeatable
plan-reading pipeline with explicit inputs, outputs, human correction, and metrics.

## 1. The three loops (mental model)

- **Source loop (Agent A):** NOLA permit → saved → portal scrape → local manifest + PDFs → curated
  keep/skip → `Project` + `Document`. Creates supply. Small batches, never floods the app.
- **Read loop (Agent B):** Project+Document → ingest once → per-page text + image → human tags pages →
  AI reads only tagged pages → finishes in `/finishes` → human corrects → corrected JSON saved. The
  product core. Must be boring, reliable, and **visible when it fails**.
- **Learn loop (Agent A scores, both act):** corrected extractions → golden set → eval script → score
  prompt/model/input changes → keep only changes that improve the **full** set. How we stop guessing.

## 2. Grounded current state (file-verified 2026-06-18)

Built and real:
- **Sourcing**: `NolaPermit` (~456k rows) + `/permits` triage (`leadStatus`). Portal scrape cracked
  (`docs/nola-portal-scraping.md`, 3 GETs, no auth). `scripts/nola-docs.ts` written (unrun/paused).
- **Per-page ingest**: `lib/ingest.ts` (`ingestDocument`, `pageImagePath`, `readPageArtifact`) — text +
  page image per page. Whole-PDF download bottleneck bypassed.
- **Cheap per-page read**: `extractFinishesFromPages` (`lib/anthropic.ts`) via `readSchedule`
  (`app/actions.ts`) into `/finishes`.
- 3 test projects reported loaded: AutoZone (retail), Taylor Wellons (office TI), 231 Carondelet (restaurant).

Open (the Phase-0 reality check — **do not call the gate "done"**):
- ⚠️ **Model**: live read uses **Opus 4.8** (`EXTRACTION_MODEL`), *not* Sonnet. Older docs assume Sonnet
  cost/latency — unverified. Model is an **experiment, not a belief** (§7, §10).
- ⏳ Reliability unproven on one real plan: tagged-pages-only, explicit timeout, **visible error**,
  hardened fenced-JSON parsing, **zero-finish saved as explicit empty**, **corrections never lost**.
- ⏳ Page artifacts are prototyped inside `scanSignals` — must become **first-class** before batch scale.
- ⏳ `app/api/diag/route.ts` still present (delete after verify). `STATUS.md` still describes the old
  "read hangs" bug as live — stale; refresh once Phase 0 passes.

## 3. The two agents — ownership (collision-free; conflicts resolved)

| | **Agent A — Sourcing · Intake · Scoring** (lead) | **Agent B — Estimator Core** |
|---|---|---|
| Who | this Claude (cracked scraping) | the other Claude (built ingest + the read) |
| **Owns (edits)** | `scripts/nola-*`, `app/permits/**`, `data/nola/**`, the intake script, `scripts/eval-*` + metrics/insight notes | `lib/ingest.ts`, `lib/anthropic.ts`, `lib/prompts/**`, `readSchedule` in `app/actions.ts`, `app/projects/[id]/finishes/**`, removing `app/api/diag` |
| **Never touches** | extraction prompts, the Anthropic call, finish-read logic, ingest internals, `/finishes` UX, the model choice | the scraper, permits UI, bulk source selection, the scoring harness |
| Output | a small batch of real ingested projects; later, score reports | reliable extraction + corrected reads (ground truth) |

**Resolved conflicts** (the input docs disagreed — these are final):
- **`lib/ingest.ts` → Agent B.** (B built it and it's coupled to the read path + the first-class
  page-artifact schema.) **A only *calls* `ingestDocument()` from the intake script; A never edits ingest internals.**
- **Scoring / golden set / eval → Agent A.** (Scoring *reads* B's output and *writes* analysis — it must
  stay out of the AI core. Clean read/write seam; keeps A busy in parallel.)
- **Model is NOT locked to Sonnet.** Keep B's current model (Opus) for Phase 1; decide by data in Phase 4.

## 4. The handoff contract (data, not vibes — and no schema race)

- **A → B:** `data/nola/<permitNum>/manifest.json` (every doc + keep/skip) + kept plan PDFs, then A's
  intake creates `Project` + `Document` (calling B's `lib/ingest.ts`) and **sets `Project.status =
  "ingested"`** to signal "ready to read." NOLA provenance goes in `Project.notes`.
  → **No new schema needed** — reuse the existing `Project.status`/`notes` fields. This kills the schema race.
- **B → A:** `Extraction.corrected` JSON (human-confirmed finishes) + a one-line **failure-mode note** per
  plan + model/input/cost metadata. This is the answer key A scores against.
- **Frozen shared schemas** (propose, never change unilaterally): the finish output shape
  (`lib/prompts/finish-schedule.ts`), the `Extraction` table, and the forthcoming first-class
  **PageArtifact** record (docId, pageNumber, text, imagePath, ingestedAt, render/extract status).

## 5. Phases (Codex order — gates, don't skip)

- **Phase 0 — close reliability (B leads).** Prove on **one** real plan: tagged-page artifacts only,
  timeout + visible error, hardened parsing, **explicit empty reads saved**, **corrections durable**.
  Delete `diag`. Update `STATUS.md`. *Nothing measurable runs until this passes.*
- **Phase 1 — curate 5 (A sources).** Five varied plans: retail fit-out · office TI · restaurant ·
  school/institutional · one messy/large set. Five good > fifty unlabeled.
- **Phase 2 — run, correct, note (B runs).** Per plan: ingest → human-tag → extract → correct in app →
  short failure-mode note. Goal: **learn where it breaks**, not automate.
- **Phase 3 — golden set + scoring (A builds harness).** Promote the 5 into the golden set; `scripts/eval-*`
  scores against §6. Baseline established.
- **Phase 4 — controlled experiments (B changes, A re-scores).** One variable at a time — prompt ·
  image-vs-text-vs-hybrid · **Opus vs Sonnet** · parsing · page-selection. Re-run the whole set. A change
  that helps one plan but regresses another is not an improvement.
- **Phase 5 — batch assist (A scales, both triage).** Only after scoring exists. Triage each auto-read:
  high-confidence + page-agreement → low review; low/disagree → human review; no finish source → explicit
  **empty**, not failure. New reads become golden-set candidates.

## 6. Scorecard (per stage, never as a black box)

| Stage | Metric |
|---|---|
| Page targeting | precision/recall on "is this a finish-schedule page" |
| Finish extraction | finish-code precision/recall; material/type/category/unit correctness — **solve first** |
| False positives | finishes hallucinated from notes/details |
| Empty reads | empty-when-truly-empty correctness (explicit, never silent) |
| Quantities/takeoff | % areas within tolerance — **deferred**, not a Phase-3 target |
| Ops | cost + latency per extraction (settles Opus-vs-Sonnet with data) |
| UX north-star | human-correction rate |

## 7. Guardrails — what NOT to do (yet)

- Don't auto-ingest hundreds of permits — curated batches only.
- **Page image is the v1 source of truth** (text as small supporting context). **Never send the full PDF.**
- **Scanner stays out of the critical path** — the human tags pages in v1; scanner suggestions must be
  *scored* (page-targeting P/R) before they ever drive automation.
- Don't optimize model choice before ingest artifacts + parser are reliable (Phase 0 first).
- Don't chase takeoff quantities before finish extraction is scored.
- Don't treat unreviewed model output as training/eval truth.
- Don't build an autonomous estimation "agent" — ship a controlled, logged pipeline.

## 8. Coordination protocol (so two Claudes don't collide — lessons from real chaos this session)

- **Git: each agent on its own branch/worktree off `main`.** See §9 for B's specific instruction. Merge
  small + often; pull `main` before starting new work. Never two agents editing the same working tree.
- **Ownership is law** (§3). Need a file outside your lane? Ask in the log or hand off — don't edit it.
- **One shared dev server** on `:3000`. Do **not** spin a second (we hit port chaos doing exactly that).
- **Single schema writer.** `prisma/schema.prisma` changes are **announced in the log first**; only one
  `prisma db push` in flight at a time; after a push, the other agent runs `prisma generate`. The §4
  handoff needs **no** schema change — keep it that way if possible.
- **One shared log** (§11) both read; neither overwrites the other's sections.
- **Schemas frozen by contract** (§4) — propose, don't unilaterally change.

## 9. ▶ Leader directives to Agent B

1. **Branch: yes — make your own.** Create a dedicated branch/worktree off `main`, e.g.
   `agent-b/estimator-core` (a `git worktree` is preferred — it gives you a separate working directory so
   we physically can't clobber each other's uncommitted files). Commit small, merge to `main` often, pull
   `main` before new work. Do not work directly on `main` alongside me.
2. **Your first job is Phase 0** (§5) — close the reliability gate on one real plan, then delete
   `app/api/diag/route.ts` and refresh `STATUS.md`. Until that's green, nothing downstream starts.
3. **Stay in your lane** (§3). You own the read loop + ingest + prompts + `/finishes`. Don't touch the
   scraper, `/permits`, `data/nola/`, or the scoring harness — those are mine.
4. **Promote page artifacts to a first-class record** before we scale (Codex Change 5). Tell me the final
   shape so my intake + eval code can rely on it — that's a frozen shared schema (§4).
5. **Keep the current model (Opus) for now.** Don't switch to Sonnet until Phase 4, where I'll score both.
6. **Announce before any `prisma db push`** in the log (§11). The Phase-0/handoff work shouldn't need a
   schema change; if you think it does, flag it first.

## 10. Open decisions (deferred, with defaults)

1. **Trust threshold** (Phase 5) — confidence + page-agreement that skips human review. *Defer; falls out
   of Phase 3 numbers. Don't let it block Phase 1.*
2. **Model tier** — Opus (current) vs Sonnet. *Settle with cost+accuracy data in Phase 4, not assertion.*
3. **Intake = script vs UI** — *default: batch script now (reuses `lib/ingest.ts`); upload UI later.*
4. **Scrape politeness** — throttle + per-file size cap when pulling many leads (10–25 MB plan sets).

## 11. Coordination log (append-only — both agents write, neither overwrites)

> Newest first. Format: `YYYY-MM-DD · Agent X · what changed / what you need from the other / blockers.`

- **2026-06-18 · Agent A (lead):** Plan consolidated here; all prior plan docs superseded. Roles set
  (A: sourcing/intake/scoring; B: estimator core/ingest/read). Conflicts resolved in §3 (`lib/ingest.ts`
  → B; scoring → A; model not locked). **Agent B — please:** (1) make your own branch/worktree (§9.1),
  (2) start Phase 0, (3) post the first-class PageArtifact shape here when decided so my intake can target
  it. I'm starting the source loop (run `nola:docs`, build intake, curate the 5) on my branch in parallel
  — no overlap with your files.
