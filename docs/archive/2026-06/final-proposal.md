> ⛔ **SUPERSEDED** — folded into [`estimator-plan.md`](estimator-plan.md), the controlling plan (2026-06-18). Kept for history; do not act on this doc.

# Final proposal — how we build the estimator (two-agent plan)

Claude's synthesis after reading: `docs/pipeline-strategy.md` (my earlier take), `docs/estimator-workflow.md`
(the scraping agent's take), and `CODEX_REVIEW.md`. Standalone on purpose — review it next to the others;
nothing here overwrites them.

---

## The realization that resolves "which doc is better"

The two strategy docs were never competing — **they're the two agents' job descriptions.**

- `pipeline-strategy.md` (corpus / scraping / scale) = the **Sourcing** agent's mandate.
- `estimator-workflow.md` (eval-driven extraction) = the **Extraction & Eval** agent's mandate.

There are two agents. Assign each one doc. That *is* "elements of both" — a division of labor, not a blend.

## What Codex contributes

Codex's review targeted the finish-read hang (re-downloading the whole PDF, no caching, no error
surface). **The hang is already fixed** — `lib/ingest.ts` (per-page text + image) + the cheap per-page
read (`extractFinishesFromPages`, ~1,800 tokens / ~2¢). One Codex item is still open and is
load-bearing: **error hardening + never losing a human correction.** The correction log is our data
engine, so that's a Phase-0 must, not a nicety.

---

## Methodology backbone — adopt `estimator-workflow.md` wholesale

It's the most rigorous of the three. Non-negotiables:

1. **Extraction is ~95% of the risk; the bid math is solved** (Sheet verified to `$15,205.54`). Focus there.
2. **Decompose & measure per stage** — page-targeting → finish-extraction → takeoff quantities → whole-bid $.
   Never measure the pipeline as one black box.
3. **Eval-driven dev:** change **one** variable (prompt OR model OR preprocessing) → re-run the **whole**
   golden set → confirm the metric moved up **without regressing the others.**
4. **Ground truth = human corrections on `/finishes`** (`Extraction.corrected`) — *not* Claude grading
   Claude. (This kills the earlier "I do a manual read as ground truth" idea; it was circular.)
5. **Run 5 real plans and get burned BEFORE building the eval harness.** Build the measurement around the
   failures you actually saw, not in the abstract.

## What `pipeline-strategy.md` still adds

- **Current state:** the read-hang is fixed and acquisition is solved (scraping cracked) — so
  `estimator-workflow.md`'s "Step 0 reliability gate" is largely already cleared.
- **The scraping unlock:** acquisition is now bulk + free (`nola-portal-scraping.md`), which is what makes
  a steady corpus feasible at all.

---

## Division of labor (two agents, zero collisions)

| | **Agent A — Sourcing** (the scraping agent) | **Agent B — Extraction & Eval** (Claude/me) |
|---|---|---|
| Owns | `scripts/nola-*`, `data/nola/`, `/permits`, intake → `Project`+`Document`, `lib/ingest.ts` | `lib/anthropic` prompts, the read loop, golden set + metrics, `/finishes` |
| Produces | Ingested plans, ready to read | Accurate, **measured** extraction |
| Handoff | A ingests a Project → B consumes it. **The DB is the contract.** | — |

**Coordination rules** (learned from real collisions this session — port + DB chaos):
- Each agent edits **only its own files/dirs.**
- **One** dev server, shared.
- **Only one** agent runs `prisma db push`; schema changes are announced first.
- Handoff is **DB state** — a Project flagged "ingested / ready for extraction."
- One shared `LOG` both read; neither overwrites the other's doc.

Natural assignment: whoever cracked scraping takes **A**; I take **B** (I built ingest + the read).

---

## Sequence

- **Phase 0 (small, now):** harden the `/finishes` correction-save so a label is **never lost**; strip the
  scanner's *guessing* (it suggests, never decides). Reliability to run the loop on.
- **Phase 1:** Agent A scrapes + ingests **5–10 varied** plans (office / retail / restaurant / medical).
  Agent B runs the existing pipeline, corrects on `/finishes`, and **watches where it fails.**
- **Phase 2:** Agent B builds the golden set + per-stage metrics **around the real failures seen**, then
  iterates one variable at a time.
- **Phase 3:** scale batches — **only** once measurement exists.

## Decisions locked

- **Model:** Sonnet default; Opus spot-check on hard plans (data, not assumption).
- **Read input:** vision (page image) — layout-accurate; note where text-only would've sufficed (cheaper).
- **Ground truth:** the human correction log on `/finishes`.

## Open questions for the other agents / owner

1. Agent-ownership split above — agree, or different cut?
2. Trust threshold: what confidence + cross-check agreement lets a read skip human review (later, at scale)?
3. The "ingested / ready" handoff flag — a field on `Project`, or a convention? (Avoid a schema race.)
