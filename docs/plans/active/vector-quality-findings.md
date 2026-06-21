# Vector-Quality Pre-Screen — Script + First Findings

Status: experiment notes (for review)
Owner: Claude (implementer)
Created: 2026-06-19
Related plan: [`vector-first-measurement.md`](vector-first-measurement.md)
Script: [`../../../scripts/vector-quality.py`](../../../scripts/vector-quality.py)

## What this is

A first, deliberately small step toward the **vector-first measurement** plan. It implements only
the **§6 vector-quality pre-screen** of that plan: for each plan PDF page, decide whether it is clean
**vector** (worth deterministic geometry), **mixed**, or **raster/flattened** — *before* any
measurement is attempted.

It does **not** measure square footage and does **not** polygonize rooms. Per §3 of the plan, a
visually crisp PDF is not necessarily usable vector data, so this only answers "is the data usable?"
— not "what is the area?" That stays unanswered until the polygonization + scale-calibration step
(plan §5, §11), which is the real experiment and is not built here.

## How to run

```bash
pip3 install PyMuPDF
python3 scripts/vector-quality.py "data/nola/<permitNum>/<plan>.pdf"
```

## Signals (PyMuPDF)

| Signal | Source | Why it matters |
|---|---|---|
| `paths` | `page.get_drawings()` | real CAD line/curve geometry; low = likely raster/flattened |
| `words` | `page.get_text("words")` | room labels & finish codes are machine-readable only if high; ~0 on a "plan" page = outlined/rasterized text |
| `imgs` / `rast%` | `page.get_image_info()` | raster coverage; high = scan or flattened export |
| `scale` | regex on page text | a printed drawing scale (`1/8"=1'-0"`); real-world area needs this (plan §48 — PDF units ≠ feet) |
| `route` | thresholds (plan §4) | `vector` / `mixed` / `raster` routing decision |

Thresholds are intentionally simple and meant to be tuned from evidence (plan §6), not trusted as
final. **Open question for review:** are `paths>800 & rast<0.2 & words>30 → vector` reasonable, or
should they be derived per-architect?

## First finding — 26-14856-RNVN (1555 Poydras St Ste 2000, office TI)

Taylor Wellons CD set, `12475_TAYLOR WELLONS_CD SET.pdf`, 15 pages.

```
 pg  paths  words  imgs  rast% scale  route  hint
  1   2545   1249     1     1%   yes vector  FLOOR/FINISH PLAN
  3   9465    229     1     1%   yes vector  FLOOR/FINISH PLAN
  8   2566   2666     5    10%     - vector  FLOOR/FINISH PLAN
  9   6173    669     8    47%   yes  mixed  FLOOR/FINISH PLAN   <- raster-heavy sheet
 12  28670   1670     3     1%   yes vector  FLOOR/FINISH PLAN   <- densest sheet
 ...
  routes: {vector: 13, mixed: 2, raster: 0} · plan pages: 13 (clean-vector: 12)
  pre-screen verdict: GOOD vector sample
```

**Read:** clean CAD vector throughout (2.5k–28.7k paths/page, ~1% raster on all but one), positioned
text is real (1k–3.5k words/page, so labels/codes are extractable), printed scale present on most
plan sheets. One sheet (pg 9) is 47% raster — flagged, not fatal.

**Verdict:** a **good vector sample** for the §11 experiment, and a legitimate office-TI flooring
lead. This permit was intaken as a viewable Project (`/projects/<id>/plans`) so the plan can be
inspected against these signals.

**Honest caveat (plan §3):** passing this pre-screen ≠ measurable. Whether the 28.7k paths on page 12
form *clean closed room polygons* (vs. furniture, dimensions, grids, open endpoint gaps) is exactly
what the polygonization experiment must prove. This script is the gate before that work, not evidence
that geometry recovery will succeed.

## What I'd want Codex to review

1. Are the §4 routing thresholds defensible, or should they be evidence-derived / per-exporter?
2. Is `rast%` from `get_image_info()` bbox-union a fair raster-coverage proxy (it can double-count
   overlapping images)?
3. The `is_plan` heuristic (`"FLOOR PLAN"` in text, or `" PLAN" & paths>500`) — false-positive risk?
4. Does this belong as a Python research script, or should the signal extraction move into the
   Next.js/pdfjs path the app already uses (`lib/pdf.ts`)? Plan §9 suggests a separate Python service.

## Next step (not done here)

Per plan §11: render per-primitive overlays, attempt endpoint snapping + polygonization on one
floor-plan page, and compare candidate regions to an estimator answer key. No square footage until
scale is confirmed.
