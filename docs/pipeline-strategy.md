> ⛔ **SUPERSEDED** — folded into [`estimator-plan.md`](estimator-plan.md), the controlling plan (2026-06-18). Kept for history; do not act on this doc.

# Pipeline strategy — where we are + how to accelerate

Status + recommended engineering loop, for team review (Claude + the scraping agent + owner).
Second opinions welcome — append a `## Second opinion` section, don't overwrite.

---

## Where we are (2026-06-17)

**Estimating core (plan → bid):**
- ✅ **Ingest built + proven** (`lib/ingest.ts`): opens a PDF once, stores per-page **text** (DB) + a
  **page image** (`plans/{projectId}/{docId}/pages/NNNN.jpg`). No guessing. Tested on AutoZone p13/14.
- ✅ **Cheap per-page read built + proven** (`extractFinishesFromPages` + `readSchedule`): sends only
  the **tagged pages' image** to Claude → finishes. **~1,800 tokens, ~2¢, ~18s** vs the old
  whole-PDF path (227K tokens / $0.68 / minutes). Robust to fenced JSON.
- Older whole-PDF read is now bypassed; download bottleneck sidestepped.
- 3 real test projects loaded: AutoZone (retail), Taylor Wellons (office TI), 231 Carondelet (restaurant).

**Sourcing (find jobs + plans):**
- ✅ `NolaPermit` table (~456k permits) + `/permits` triage UI (`leadStatus: new|saved|dismissed`).
- ✅ **Document scraping cracked** (`docs/nola-portal-scraping.md`): 3 GETs per permit, no auth, pulls
  the actual plan PDFs. Keep/drop heuristic for plans-vs-paperwork. **Acquisition is now bulk + free.**
- ⏳ `scripts/nola-docs.ts` (the scraper) not built yet; auto-intake of scraped PDFs not wired yet.

**The shift:** getting plans is no longer the bottleneck. The new bottlenecks are **(1) processing at
scale** and **(2) measuring quality** so we know when the automated read can be trusted without a human.

---

## Recommended engineering loop — my opinion

**Is the "lab" the best way? Half. Keep it, but it's only one of two tiers.** A hand-run lab (one
folder per plan, careful manual ground-truth) is the right tool for *learning* — but it does not scale
to hundreds of scraped plans. So: **two tiers, and they feed each other.**

### Tier 1 — Batch pipeline (throughput, automated)
Runs over many saved leads with no human per plan:
```
saved lead → scrape plan PDFs → storage → Project+Document → ingest (text+images)
          → scanner SUGGESTS candidate schedule pages (never auto-decides)
          → Claude (Sonnet vision) reads tagged/suggested pages → finishes
          → log result + automated quality signals
```
Automated quality signals (so we don't manually review every one):
- model **confidence** per finish,
- **cross-check**: did the page the model read also score high on the free text-scan (schedule keywords / code density)? agreement = trust,
- **flag for review** when confidence low or signals disagree.

### Tier 2 — Deep lab (quality + learning, small N ≈ 10–20)
The careful work, on a curated set:
- I produce a **manual ground-truth** read (terminal tools, no API),
- compare against the **Sonnet API** read (the A-vs-B we discussed),
- mine **insights** (what conventions break us, is SF/takeoff feasible, where prompts fail),
- these plans become the **regression test / answer key** for Tier 1.

**How they feed each other:** Tier 2's answer key tells us Tier 1's real accuracy. As accuracy proves
out, Tier 1 needs less human review. The ultimate ground truth is **the estimator confirming a bid in
the app** — every confirmation is a free, gold-standard data point that flows back into the answer key.

### Why this over "just the lab" or "just batch"
- Just-lab → doesn't scale, you learn slowly, the scraping breakthrough is wasted.
- Just-batch → you ship an automated reader you can't trust, with no measure of when it's wrong.
- Both → throughput *and* a trust metric. The lab is the microscope; the batch is the factory; the
  answer key is the QA gauge connecting them.

---

## Acceleration plan (sequenced)

1. **Build the scraper** `scripts/nola-docs.ts` (the recipe in `nola-portal-scraping.md`): saved leads
   → `data/nola/<permitNum>/` + `manifest.json` (record ALL docs, keep the plan set). Idempotent.
2. **Auto-intake**: kept PDFs → Supabase storage → create `Project` + `Document` (mirror the app upload
   path). One scraped lead = one project, ready to ingest.
3. **Pick the first batch** (10–20 saved leads, varied: office / retail / restaurant / medical / school)
   so the lab sees real variety, not 20 of the same.
4. **Ingest** the batch (the background-job version of `lib/ingest.ts`).
5. **Run both tiers** on that batch: Tier 1 auto-read + Tier 2 deep lab on each → build the answer key.
6. **Read the insights** (`INSIGHTS.md`) and adjust the system before scaling to the next 50.

---

## Exploration tracks (watch while going through volume)
- **Square-footage / takeoff feasibility** — do these plans carry room schedules / area tables the model
  could read? If yes on enough plans, auto-takeoff may be closer than we think. Log per plan.
- **Model tier** — Sonnet is the default (cheap, proven). Spot-check Opus on a few hard plans: does
  paying more actually change the answer? Data, not assumption.
- **Image vs text read** — vision is the default (layout-accurate). Note plans where text-only would've
  sufficed (cheaper) — informs a future cost optimization.
- **Scanner-as-suggester** — measure how often the free text-scan's top-ranked page == the real schedule
  page. If high, it earns back its place as a (non-deciding) suggester.

---

## Open decisions (for the second opinion)
1. **Lab structure** — `lab/plans/<slug>/` with `pages.md / tags.md / A-sonnet.json / B-manual.md /
   compare.md`, plus `lab/LOG.md` + `lab/INSIGHTS.md`. Good, or better shape?
2. **Where intake lives** — a batch script now, or wait for the proper upload UI? (Lean: batch script
   now — the UI can come later and reuse the same `Project+Document` creation.)
3. **Trust threshold** — what confidence / cross-check agreement lets a Tier-1 read skip human review?
4. **Politeness/scale** — throttle + per-file size cap when scraping many leads (the scraping doc flags
   10–25 MB plan sets).
