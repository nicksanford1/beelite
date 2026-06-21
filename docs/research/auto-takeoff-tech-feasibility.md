# Research: Auto-takeoff technical feasibility (build vs buy, data, GPUs, accuracy)

_Deep-research report · ? agents · saved for the project. Vendor/marketing claims flagged where unverified._

## Bottom line

For bid-grade flooring takeoff (room-level area error under ~2-5%), no fully-automated approach is reliably bid-grade today: the evidence consistently shows that usable accuracy requires human review/correction, and even the leading commercial vendors sell their "bid-ready" output as a human-in-the-loop service, not pure AI. The strongest BUILD path is a hybrid: parse vector/CAD PDF geometry directly (PyMuPDF get_drawings()) for clean vector plans — exact and traceable when it works, but unreliable at auto-grouping paths into closed room polygons — and fall back to foundation-model few-shot segmentation (SAM + an LLM, e.g. the GMFS approach needing only ~5 labeled examples) for raster/scanned plans, rather than training a custom segmentation network (which needs hundreds-to-thousands of annotated plans, e.g. CubiCasa5K's 5,000 expert-polygon-annotated plans) or a geometry VLM (FloorplanVLM required a 2M-pair dataset and 32x H200 GPUs and was trained on residential, not commercial, plans). Custom instance segmentation (YOLOv8-seg/Mask R-CNN) tops out around ~90% detection mAP — fine for detection, far short of 2-5% area precision. For a small, cost-conscious subcontractor, the most defensible recommendation is to seriously evaluate BUY options: Beam AI/iBeam (DIY AI-only ~$16K/yr; human-reviewed "Done For You" bid-ready in 24-72h) and Togal.AI (independent-ish study found within 5% of On-Screen Takeoff, but only after manual adjustments) before committing to a build. Across both build and buy, penny-precise bid output realistically still requires an estimator's confirmation step.

## Findings (with confidence + sources)

### [high] No fully-automated approach reaches bid-grade (2-5%) area accuracy without human correction; even vendors treat human review as necessary for bid-ready output.
Beam AI sells a 'Done For You (AI + Human in the loop)' tier delivering 'bid-ready, human-reviewed takeoffs and estimates in 24-72 hours' — the vendor labels the human-reviewed tier (not the AI-only tier) as bid-ready. An independent-leaning academic study (March 2025) found Togal.AI stayed within a 5% margin vs On-Screen Takeoff for most quantity classifications, but the primary text shows this was achieved 'with manual adjustments.' Research-grade segmentation also notes SAM masks 'split objects between two masks' and 'are not rectangular,' i.e., not penny-precise. Convergent conclusion: bid-grade output requires a human confirmation step regardless of build-vs-buy.

Sources: <https://www.ibeam.ai/pricing> · <https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff> · <https://www.sciencedirect.com/science/article/pii/S2772991524000562>
_verification: 3-0 / 3-0 / 2-1_

### [high] Direct vector/CAD PDF parsing (PyMuPDF get_drawings()) gives exact, traceable geometry for clean vector plans, but reliably grouping extracted paths into closed room polygons is not determinable from the extracted data alone.
page.get_drawings() returns vector graphics as a list of path dicts with draw-command tuples for lines ('l'), rectangles ('re'), quads ('qu'), and Bezier curves ('c'), plus bounding rect and rendering order (seqno) — enabling exact, traceable measurement. But the same primary source states it 'may still be unclear (and programmatically impossible to determine) which paths belong together and actually are part of a larger figure.' Corroborated by US Patent US11392736B2 (room borders 'may be inferred by a human viewer' but 'a computer may not have these capabilities' without added heuristics: polygon offsetting 50-100mm to close gaps, Boolean merges, layer filtering) and CAD-to-boundary sources noting failures on incomplete walls/overlapping elements. Mitigations exist (cluster_drawings(), extended hierarchy) but auto-grouping remains a documented, significant limitation. Best for clean vector PDFs; degrades on messy/scanned input.

Sources: <https://artifex.com/blog/extracting-and-creating-vector-graphics-in-a-pdf-using-python-pymupdf>
_verification: 3-0 / 2-1_

### [high] Foundation-model few-shot segmentation (SAM + an LLM, e.g. GMFS) can segment rooms/doors in raster floor plans with only ~5 labeled examples — drastically less labeled data than custom-trained segmentation models.
GMFS (GPT-integrated Multi-object Few-shot SAM), published Dec 2024 in Elsevier's Developments in the Built Environment, combines SAM (masks via similarity maps + cluster-based point-sampling prompts) with GPT-4 (mask classification) to segment rooms and doors in 2D raster floor plans 'using only five reference samples,' explicitly addressing the limitation that conventional deep learning 'often require[s] extensive annotated datasets.' This is the most promising raster/scanned-PDF fallback path: near-zero labeling cost, no custom segmentation network to train. Caveat: 'usable' here means segmentation/accessibility-analysis quality (mIoU ~82), NOT penny-precise area; masks can be non-rectangular and split objects, so it still feeds a human-correction step rather than producing bid-grade area directly.

Sources: <https://www.sciencedirect.com/science/article/pii/S2772991524000562>
_verification: 3-0 / 2-1_

### [high] Training a custom specialized floor-plan recognition model realistically needs thousands of expert-annotated plans (order of magnitude).
CubiCasa5K, the field's flagship dataset, contains 5,000 floor plans manually annotated by trained humans as polygons (per-image SVG) across over 80 object categories, selected and reviewed from ~15,000 mostly Finnish images, with a 2-stage QA protocol; single-image annotation took 5-120 minutes. It was 'over five times larger' than the previously largest dataset (Liu et al. 2017, ~815-870 images). This sets the labeled-data order of magnitude for custom floor-plan models at thousands of annotated plans — a large effort. Caveat: CubiCasa is residential Finnish real-estate plans, so a commercial-construction takeoff tool would likely need its own domain-specific labeled data; transfer learning could reduce the count below 5K but not to the single-digit level of few-shot foundation-model approaches.

Sources: <https://arxiv.org/pdf/1904.01920> · <https://ar5iv.labs.arxiv.org/html/1904.01920>
_verification: 3-0 / 3-0_

### [high] Custom instance segmentation (YOLOv8-seg / Mask R-CNN) trained on ~1,500 images reaches ~90%+ detection mAP, but detection mAP is not area precision and falls short of 2-5% bid-grade area error.
On ~1,500 annotated images, YOLOv8 outperformed Mask R-CNN at instance segmentation: mAP@0.5 0.939 vs 0.902, precision 0.93 vs 0.85, recall 0.97 vs 0.88 (single-class). This indicates a custom YOLOv8-seg can reach ~90%+ detection accuracy. Important hedge: the benchmark is apple-orchard green-fruit segmentation, not floor plans, and detection mAP/precision/recall do not measure square-footage error — so this is a directional inference about the ceiling of custom segmentation, not a floor-plan-specific area-accuracy result. Detection-grade ≠ bid-grade area.

Sources: <https://arxiv.org/pdf/2312.07935>
_verification: 3-0_

### [high] The VLM-for-geometry route (training a model to output structured floor-plan geometry) is far beyond a small subcontractor's build budget and was demonstrated on residential, not commercial, data.
FloorplanVLM (arXiv 2602.06507, Feb 2026) required a 2-million-pair dataset (Floorplan-2M, drawn from >20M raw vector floorplans) plus a 300K high-fidelity subset, trained on 32x H200 GPUs (SFT + GRPO). The data originated from 'an industrial interior design platform' with residential examples (bedroom, kitchen, 'Manhattan-style apartments', homeowner-name PII) — no commercial building types. Caveat flagged: this is the cost to TRAIN a geometry VLM from scratch, not to consume an API or do a small fine-tune; the directional conclusion (don't train your own geometry VLM) is sound, and the residential data means reported accuracy (92.52% external-wall IoU on its own benchmark) does not directly transfer to commercial flooring takeoff.

Sources: <https://arxiv.org/html/2602.06507v1> · <https://arxiv.org/abs/2602.06507>
_verification: 2-1 / 3-0_

### [medium] Commercial buy-not-build options exist and should be evaluated before building: Beam AI/iBeam (~$16K/yr AI-only DIY; human-reviewed DFY) and Togal.AI.
Beam AI (iBeam) lists a '$16K/year — DIY (AI Only)' tier explicitly covering Flooring (plus Electrical, Finishes, Painting), and a vendor blog corroborates mid-tier trade licenses at $16K-$18K; a separate 'Done For You (AI + Human in the loop)' tier delivers bid-ready takeoffs in 24-72h. Togal.AI was found within a 5% margin of On-Screen Takeoff for most classifications (after manual adjustments) in a March 2025 study. Confidence is medium because: pricing is list/'typically falls in' and varies by negotiated bid capacity; the Togal study's 'independence' is weak (Togal's CEO is also CIO of seed-funder Coastal Construction; study hosted on Togal's site); and real-world reviews (r/estimators) report ~60-85% accuracy on complex/scanned plans needing heavy correction. Still, these are concrete options a cost-conscious subcontractor should price against build cost.

Sources: <https://www.ibeam.ai/pricing> · <https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff>
_verification: 2-1 / 3-0 / 2-1_

### [high] Several SAM-based and segmentation research results target inputs/objectives that do NOT transfer to PDF-based, area-precise takeoff.
FloorSAM applies SAM to top-down density maps derived from 3D LiDAR point clouds (not vector/raster PDFs), so its pipeline does not fit a PDF-takeoff tool lacking 3D scans. A separate raster-segmentation paper (arXiv 2408.01526) targets 3D digital-twin reconstruction (noise reduction for an accurate 3D model) and reports only pixel-level metrics (mean F1 0.86, mean IoU 0.76 on CubiCasa), with no floor-area/square-footage accuracy metric — so its results cannot be claimed as bid-grade for flooring. These scope mismatches mean impressive-sounding SAM/segmentation papers should not be over-weighted for the takeoff use case.

Sources: <https://arxiv.org/abs/2509.15750> · <https://arxiv.org/html/2509.15750v1> · <https://arxiv.org/html/2408.01526v1>
_verification: 3-0 / 3-0 / 3-0_
