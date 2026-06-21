d# Grok 4.3 Response: Flooring Takeoff ML Research

Generated: 2026-06-19
Model: `grok-4.3`
Prompt tokens: 749
Completion tokens: 1,835
Total tokens: 3,089
External sources used: 0
API-reported approximate cost: $0.0665

> Note: This is a formatting-normalized transcript of the model's response. Its recommendations,
> product names, hardware requirements, accuracy assumptions, and cost estimates have not been
> verified.

**Example running throughout:** A 5-page commercial office PDF (Project "Oak Plaza - Level 2").
Page 3 is a 24x36 inch floor plan at 1/8"=1'-0" showing 12 rooms (Open Office 201, Conf 202,
Break 203, etc.). Finishes are listed in a schedule on page 2 (CPT-1 carpet, VCT-1 tile). The goal
is accurate net square footage per finish after human review.

## 1. Core technical distinctions (plain English)

- **Vision-Language Model (VLM)**: A single model that ingests an image (or page) plus text and
  outputs text, JSON, or bounding boxes. Example: GPT-4o, LLaVA-1.6, Qwen2-VL. It reasons about
  "what is this room labeled?" but does not output pixel masks by default.
- **LoRA**: Low-Rank Adaptation (Hu et al., 2021, https://arxiv.org/abs/2106.09685). A
  parameter-efficient fine-tuning method that adds small trainable matrices to a frozen base model.
  It does not change architecture; it only changes how cheaply you adapt an existing model.
- **Object detection**: Predicts axis-aligned or rotated boxes plus class labels (YOLOv8/v9/v10,
  RT-DETR). Good for "find the title block" but useless for exact room area.
- **Semantic segmentation**: Every pixel receives one class label (floor vs wall vs text). No
  distinction between two adjacent rooms.
- **Instance segmentation**: Semantic segmentation plus object identity (Mask R-CNN, YOLOv8-seg,
  Segment Anything Model plus prompt). Each room is a separate polygon.
- **Vector-PDF geometry extraction**: Direct parsing of PDF content streams (lines, polylines,
  hatches) using libraries such as pdfplumber, PyMuPDF, or Adobe PDFium. No pixels involved;
  coordinates are in PDF user space.

## 2. Which takeoff sub-problem each can solve

- VLM: page classification, scale detection from text, finish-code lookup, legend reading.
- LoRA: cheap adaptation of any of the above for domain-specific vocabulary ("CPT-1",
  "1/8\"=1'-0\"").
- Object detection: locate title blocks, north arrows, scale bars.
- Semantic segmentation: crude "floor vs everything" mask.
- Instance segmentation: per-room polygons needed for area.
- Vector extraction: exact wall centerlines when the PDF is native vector (rare in architectural
  sets).

## 3-4. End-to-end architecture and PDF flow

```text
Training (offline)
PDF pages -> raster 300 dpi + vector extraction
          |
          v
Human annotation (COCO + scale + finish JSON)
          |
          v
Train: (a) page classifier (VLM or ResNet), (b) scale regressor,
(c) instance seg model (Mask2Former or YOLOv8-seg),
(d) optional LoRA on VLM for finish assignment
          |
          v
Validation on untouched projects

Production inference
Next.js upload -> FastAPI
  |-- pdfplumber (vector) + pdf2image (raster)
  |-- VLM page classifier -> "floor-plan"
  |-- Scale detector (VLM or heuristic on scale bar)
  |-- Instance seg -> polygons
  |-- VLM finish assignment
  `-- Store in Postgres (polygons + metadata)
Human review UI (Next.js) -> corrections -> S3 "feedback" bucket
```

## 5. Deterministic vs AI

Deterministic (code):

- PDF text extraction, page rendering, scale calibration math, polygon area via shoelace plus scale
  factor, finish-code lookup table.
- Any geometric Boolean operations (union of rooms, subtract columns).

AI output only:

- Room instance polygons on raster plans.
- Semantic mapping ("this hatched region = CPT-1").
- Scale value when text is ambiguous.

## 6-7. API exposure and schemas

FastAPI endpoint (GPU service):

```json
POST /v1/segment
{
  "project_id": "oak-plaza-l2",
  "page": 3,
  "image_url": "s3://.../page3.png",
  "scale_pixels_per_foot": 96.0,
  "detected_rooms": ["Open Office 201"]
}
Response:
{
  "polygons": [
    {
      "room_id": "rm-201",
      "class": "floor",
      "finish_code": "CPT-1",
      "confidence": 0.94,
      "geometry": {"type":"Polygon","coordinates":[[[120,340],[890,340]]]},
      "area_px": 124800
    }
  ],
  "scale_confidence": 0.98
}
```

## 8. Pixel to real SF

After scale calibration (pixels per foot = s):

```text
real_sf = polygon_area_px / (s ** 2)
```

Apply standard deductions (columns, door swings) in deterministic post-processing.

## 9-10. Labels and safe feedback loop

COCO-style instance segmentation plus extra JSON:

```json
{"image_id":42,"annotations":[{"id":1,"category_id":1,"segmentation":{"counts":"...","size":[2400,3600]},"area":124800,"bbox":[120,340,770,162],"finish":"CPT-1"}]}
```

Store user corrections as new COCO records only after estimator signs off. Use a `reviewer_id` field
and hold-out set of projects never seen in training.

## 11-12. LoRA vs separate models

LoRA is most useful on the VLM for finish assignment and legend reading. Geometry (instance
segmentation) benefits more from full fine-tuning or training a dedicated Mask2Former/YOLOv8-seg
head. Separate models are currently the safer engineering choice; one giant VLM that also outputs
precise polygons is still research-grade (see Ferret, Shikra, etc.).

## 13. Vector vs raster

Native vector PDFs: parse polylines directly with pdfplumber or ezdxf; run Boolean operations in
shapely. Scanned/raster: must go through segmentation. Hybrid: use vector when available, fall back
to segmentation.

## 14. Data splits

Split at the **project** level (not page level). 70 percent train projects, 15 percent validation,
15 percent test. Never allow pages from the same PDF in more than one split.

## 15. Metrics that matter

- Scale error (inches per foot absolute)
- Mask IoU / Polygon IoU per room
- Room-level area error (percent)
- Finish assignment accuracy
- Human correction time (seconds per 1000 sf)
- Project-level total SF error (percent)

## 16. Cheapest first experiment

Run GPT-4o or Qwen2-VL-72B on 50 raster pages with a structured prompt asking for room polygons
(approximated via bounding boxes plus simple segmentation) and scale. Measure area error against
manual takeoff. Cost: less than $50.

## 17. Phased research plan

1. General multimodal API (GPT-4o / Claude-3.5) - baseline.
2. Vector parsing only (pdfplumber plus shapely) on native PDFs.
3. Off-the-shelf SAM plus GroundingDINO zero-shot.
4. Fine-tuned YOLOv8-seg or Mask2Former on your data.
5. VLM plus LoRA for finish assignment only.
6. Hybrid: vector where possible plus fine-tuned segmentation fallback.

## 18. Risks and realities

Major failure modes: scale misread on handwritten notes, overlapping rooms, revision clouds,
furniture layers. Privacy: construction documents often contain project names, addresses, owner
info. Licensing: many plans are copyrighted; do not train on client data without explicit rights.
GPU: one A100/H100 for training, A10G or L4 for inference (batch size 1-4). Maintenance: model drift
when architects change CAD standards; need continuous annotation pipeline.

## Recommended first experiment

Run the GPT-4o structured-prompt baseline on 50 pages of Oak Plaza-style plans and compute room-level
area error versus human takeoff.

## First dataset to assemble

50-100 fully annotated commercial floor-plan pages (project-level split) with COCO polygons, scale
values, and finish codes.

## Five decisions before implementation

1. Will you support native vector PDFs or only raster?
2. Target human correction time per 1000 sf (sets accuracy bar).
3. Accept occasional cloud GPU inference or require on-prem?
4. Will corrected data be used for future training (legal and pipeline)?
5. Single model vs modular pipeline (affects serving and iteration speed).
