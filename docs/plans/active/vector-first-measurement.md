# Vector-First Flooring Measurement Research Plan

Status: proposal
Owner: product owner
Issue: pending
Created: 2026-06-19
Last verified: 2026-06-19
Related plan: `takeoff-measurement.md`

## 1. Purpose

Determine whether commercial flooring square footage can be derived primarily from vector PDF
geometry before investing in custom model training.

This is a research proposal, not an approved production architecture. The first deliverable is an
experiment and evidence report, not a complete takeoff feature.

## 2. Core Hypothesis

If most uploaded floor plans contain usable vector paths and positioned text, a deterministic
geometry pipeline may recover much of the measurable floor area. General vision-language models can
assist with plan semantics, while custom training is deferred until repeated failure modes show
exactly what must be learned.

The intended priority is:

```text
vector geometry first
    -> general AI for semantic assistance
    -> human correction and evidence collection
    -> custom training only when justified by measured failures
```

## 3. Important Constraint

A visually crisp PDF is not necessarily useful vector data. A vector PDF may still contain:

- disconnected or duplicated line segments;
- walls mixed with furniture, dimensions, grids, and annotations;
- text converted into outlines;
- missing or flattened drawing layers;
- hatches without semantic labels;
- clipping paths and reusable drawing objects;
- small endpoint gaps that prevent closed polygons;
- different scales or detail viewports on one page.

PDF page coordinates also do not automatically establish real building scale. Printed scale notes,
known dimensions, scale bars, or explicit user calibration are still required.

## 4. Proposed Routing

Every page receives a vector-quality assessment before measurement:

```text
uploaded PDF page
       |
       v
vector-quality analysis
       |
       |-- high-quality vector -> deterministic geometry pipeline
       |-- mixed vector/raster  -> geometry plus vision assistance
       `-- raster/flattened     -> segmentation or manual fallback
```

This allows the product to optimize for vector plans without pretending every page has the same
internal structure.

## 5. Proposed Vector Pipeline

```text
PDF page
  -> extract paths, line segments, curves, hatches, clipping regions, images, and positioned text
  -> normalize page coordinates into one canonical coordinate system
  -> classify or remove obvious annotations, dimensions, furniture, and non-floor geometry
  -> snap endpoints within a measured tolerance
  -> construct a line/geometry graph
  -> polygonize candidate closed regions
  -> associate positioned room labels with candidate polygons
  -> determine or confirm drawing scale
  -> calculate deterministic polygon area
  -> associate finish codes using plans, legends, and schedules
  -> present candidate regions for human review and correction
  -> save approved geometry and correction evidence
```

## 6. Vector-Quality Score

The experiment should calculate a diagnostic score and retain its component evidence rather than
returning an unexplained single confidence number.

Candidate signals:

- number and density of vector drawing operations;
- percentage of the page covered by raster images;
- amount of positioned text versus outlined text;
- presence of optional content groups/layers;
- percentage of paths that are already closed;
- distribution of endpoint gaps;
- duplicate/overlapping line density;
- presence of reusable form objects and clipping paths;
- number of plausible closed regions after snapping;
- availability of printed dimensions or scale indicators.

The routing thresholds must be chosen from experiment results, not guessed in advance.

## 7. Deterministic Responsibilities

Regular geometry code should own:

- PDF primitive extraction and coordinate normalization;
- scale calibration math;
- endpoint snapping with explicit tolerances;
- polygon creation and validity checks;
- polygon union, intersection, and subtraction;
- holes, columns, shafts, islands, and excluded regions;
- area calculation and unit conversion;
- mapping positioned text into candidate regions;
- storing source geometry and calculation provenance;
- recomputing quantities after a human correction.

No model should be trusted to produce an untraceable final square-foot number.

## 8. AI Responsibilities

A general vision-language or classification model may assist with:

- identifying floor-plan, finish-plan, schedule, legend, and detail pages;
- distinguishing walls from furniture and annotation linework;
- identifying room labels, dimensions, scale notes, hatches, and finish codes;
- connecting a finish legend or schedule to candidate floor regions;
- ranking candidate polygons as measurable floor, exterior space, shaft, stair, or unknown;
- explaining low-confidence regions that require human review.

Model output is a proposal with evidence and confidence. Geometry code calculates the area, and the
estimator approves or corrects it.

## 9. Possible Technical Shape

The existing Next.js application can remain the product and review interface. A separate Python
research/service layer is a reasonable starting point because of its PDF and geometry ecosystem.

Potential experiment components:

```text
Next.js / TypeScript
  -> upload and storage
  -> job request
  -> candidate-region review UI
  -> approved takeoff records

Python geometry service or CLI
  -> PyMuPDF/pdfplumber-style PDF primitive extraction
  -> geometry cleanup and polygonization
  -> Shapely-style Boolean and area operations
  -> optional graph analysis
  -> overlay/debug artifact generation

General multimodal API
  -> page and symbol semantics
  -> scale/dimension suggestions
  -> finish-plan and schedule relationships
```

These libraries are candidates to evaluate, not locked dependencies.

## 10. Candidate API Contract

The research script should eventually be capable of producing a service-shaped response so the
experiment can transition without rewriting its data model.

```json
{
  "documentId": "doc_123",
  "pageNumber": 12,
  "pageSize": { "width": 2592, "height": 1728 },
  "coordinateSystem": "normalized-page",
  "vectorQuality": {
    "route": "vector",
    "score": 0.86,
    "signals": {
      "pathCount": 18422,
      "rasterCoverage": 0.03,
      "positionedTextCount": 612,
      "candidateRegionCount": 31
    }
  },
  "scale": {
    "status": "needs_confirmation",
    "suggestedFeetPerPageUnit": 0.0104167,
    "evidence": "printed scale 1/8 inch = 1 foot"
  },
  "regions": [
    {
      "id": "region_1",
      "polygon": [[0.12, 0.18], [0.31, 0.18], [0.31, 0.36], [0.12, 0.36]],
      "holes": [],
      "roomLabel": "201",
      "finishCode": null,
      "classification": "candidate_floor",
      "confidence": 0.78,
      "evidence": ["closed vector boundary", "room label inside polygon"]
    }
  ]
}
```

Final square footage should remain unset until scale is confirmed.

## 11. First Experiment

Select approximately 10 representative vector-looking plan sets across different architects and
project types. Do not choose only clean examples.

For one or more floor-plan pages from each set:

1. Inventory PDF paths, text objects, images, layers, form objects, and clipping regions.
2. Render a visual overlay of every extracted primitive.
3. Produce separate overlays for positioned text, candidate boundaries, and candidate polygons.
4. Measure endpoint-gap distributions before choosing a snapping tolerance.
5. Attempt line cleanup, graph construction, and polygonization.
6. Compare candidate regions with estimator-recognized rooms/floor areas.
7. Test whether room labels can be associated by spatial containment.
8. Test scale extraction from printed notes and known dimensions.
9. Calculate square footage only after scale is manually confirmed.
10. Record every correction needed and the reason.

The experiment must preserve debug artifacts. A total square-foot number without overlays and
intermediate evidence is not an acceptable result.

## 12. Evaluation Metrics

Measure at page, room/region, finish, and project levels:

- pages correctly routed as vector, mixed, or raster;
- percentage of expected floor regions detected;
- extra/non-floor regions proposed;
- polygon boundary overlap with an expert answer key;
- room-level and finish-level area error;
- scale error and scale-confirmation rate;
- room-label association accuracy;
- finish-code association accuracy;
- number and type of human corrections;
- estimator time per page and per 1,000 SF;
- percentage of approved quantity traceable to source geometry.

Project-level total area alone is insufficient because over- and under-measurements can cancel out.

## 13. Training Decision Gates

Do not train a custom model merely because plans are available. Training becomes justified when the
experiment identifies a repeated, labelable failure that deterministic geometry and prompting cannot
solve reliably.

Possible future training targets:

- wall versus furniture/annotation line classification;
- valid room versus shaft, stair, exterior, or detail-region classification;
- endpoint-gap closure recommendations;
- merge/split recommendations for candidate polygons;
- room-label and dimension detection;
- finish hatch, symbol, and legend association;
- page routing for unusual drawing standards.

Training options should be evaluated separately:

- small classifier on vector/graph features;
- object detection for labels and symbols;
- segmentation for mixed or raster pages;
- VLM LoRA for flooring vocabulary and finish relationships;
- graph model for primitive or region classification.

The model choice follows the measured failure, not the other way around.

## 14. Human Correction as Data

Every approved correction should be representable as structured evidence:

- original candidate geometry;
- corrected geometry;
- merge, split, delete, add, or subtract operation;
- confirmed scale and its evidence;
- confirmed room and finish labels;
- reason for correction;
- reviewer and timestamp;
- extraction/model/algorithm version.

Only reviewed corrections should become training labels. Evaluation projects must remain isolated
from training data at the project level.

## 15. Risks

- The assumption that most customer PDFs have useful vectors may be wrong.
- Different architects and PDF exporters may produce radically different primitive structures.
- Floor boundaries may not exist as explicit closed paths.
- Furniture, dimensions, reflected-ceiling content, and xrefs may overwhelm relevant geometry.
- One sheet may contain multiple viewports or scales.
- Finish boundaries may not match architectural room boundaries.
- Over-aggressive endpoint snapping may create plausible but incorrect rooms.
- A visually convincing overlay may still produce incorrect scale or deductions.
- Client plans may have privacy, contractual, or training-rights restrictions.

## 16. Decision Outcomes

After the experiment, select one direction using evidence:

### Outcome A: vector extraction is strong

Build the product around deterministic vector geometry, manual confirmation, and limited semantic AI.

### Outcome B: vector extraction is useful but incomplete

Build a hybrid vector-plus-vision workflow and train only the recurring classification gaps.

### Outcome C: vector extraction is inconsistent

Keep it as an acceleration path while investing in segmentation/manual tracing as the dependable
fallback.

### Outcome D: correction effort remains too high

Stop or redesign the approach before investing in production infrastructure or large-scale training.

## 17. Proposed Work Sequence

1. Owner selects the representative plan set and defines what counts as acceptable measurement.
2. Claude creates an experiment-only branch and implements primitive inventory plus overlays.
3. Claude adds polygonization, scale calibration, and structured experiment output incrementally.
4. Codex reviews coordinate systems, scale math, geometry assumptions, and evaluation design.
5. The owner and estimator inspect overlays and record corrections.
6. Results are summarized with metrics and failure categories.
7. The owner approves Outcome A, B, C, or D before production implementation or training begins.

## 18. Acceptance Criteria for the Research Phase

- The sample includes multiple architects/project types and at least one difficult plan.
- Every page has a vector-quality report and rendered debug overlays.
- Scale is never silently assumed.
- Candidate polygons can be traced back to source PDF geometry.
- Expert answer keys exist for the evaluated pages.
- Room-level errors and correction time are reported, not only project totals.
- Failure categories are explicit enough to identify possible training targets.
- No production feature or custom training is approved solely from anecdotal examples.

## 19. Open Owner Decisions

1. Which plans are representative enough for the first experiment?
2. What room-level SF error is acceptable before and after human review?
3. How much correction time per page would still make the system valuable?
4. Should multiple scales/viewports on one page be supported in the first experiment?
5. Which deductions must be modeled initially: columns, shafts, stairs, casework, or all?
6. Can customer plans and corrections legally be retained for model training?
7. Is raster fallback part of the first experiment or deliberately deferred?
