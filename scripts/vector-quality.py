#!/usr/bin/env python3
"""
Vector-quality pre-screen for flooring plan PDFs.

Implements the §6 "Vector-Quality Score" signals from
docs/plans/active/vector-first-measurement.md — the first gate of that research plan:
decide whether a plan page is clean vector (worth deterministic geometry), mixed
(geometry + vision), or raster/flattened (needs OCR/segmentation/manual tracing)
BEFORE attempting any measurement.

This does NOT measure square footage and does NOT polygonize. It only answers
"is this page usable vector data?" — which §3 of the plan stresses is NOT the same
as "looks crisp." A visually clean PDF can still be outlined text / flattened layers.

Requires PyMuPDF:  pip3 install PyMuPDF
Usage:             python3 scripts/vector-quality.py <path-to.pdf> [more.pdf ...]

Signals reported per page:
  paths   number of vector drawing paths (page.get_drawings()) — real CAD geometry
  words   positioned text tokens — room labels/finish codes are machine-readable only
          if this is high; ~0 on a "plan" page means text was outlined or rasterized
  imgs    embedded raster images
  rast%   share of page area covered by raster images (high = scan/flattened)
  scale   a printed scale note was found (e.g. 1/8" = 1'-0") — needed for real-world area
  route   vector | mixed | raster, per the plan's §4 routing

Routing thresholds are deliberately simple and are meant to be tuned from experiment
evidence (plan §6), not trusted as final.
"""
import sys
import re
import fitz  # PyMuPDF

# Printed drawing-scale notes: 1/8" = 1'-0", 3/16"=1', SCALE:, etc.
SCALE_PAT = re.compile(
    r"""(1/\d{1,2}|3/\d{1,2}|\d{1,2})\s*["”']?\s*=\s*1'?\s*-?\s*0?["”']?|SCALE\s*[:=]""",
    re.I,
)


def route(paths: int, nwords: int, rcov: float) -> str:
    """Plan §4 routing — vector / mixed / raster."""
    if rcov > 0.55 and paths < 300:
        return "raster"
    if paths > 800 and rcov < 0.2 and nwords > 30:
        return "vector"
    return "mixed"


def probe(path: str) -> None:
    doc = fitz.open(path)
    print(f"\n{path.split('/')[-1]}  ·  {doc.page_count} pages")
    print(f"{'pg':>3} {'paths':>6} {'words':>6} {'imgs':>5} {'rast%':>6} {'scale':>5} {'route':>6}  hint")
    plan_pages = 0
    vector_plan_pages = 0
    routes = {"vector": 0, "mixed": 0, "raster": 0}
    for i in range(doc.page_count):
        p = doc[i]
        area = abs(p.rect.width * p.rect.height) or 1.0
        paths = len(p.get_drawings())
        nwords = len(p.get_text("words"))
        info = p.get_image_info()
        imgs = len(info)
        rcov = (
            min(1.0, sum(abs(r["bbox"][2] - r["bbox"][0]) * abs(r["bbox"][3] - r["bbox"][1]) for r in info) / area)
            if info
            else 0.0
        )
        U = p.get_text("text").upper()
        has_scale = bool(SCALE_PAT.search(U))
        is_plan = ("FLOOR PLAN" in U) or ("FINISH PLAN" in U) or (" PLAN" in U and paths > 500)
        r = route(paths, nwords, rcov)
        routes[r] += 1
        if is_plan:
            plan_pages += 1
            if r == "vector":
                vector_plan_pages += 1
        if is_plan or paths > 1500 or imgs > 0:
            hint = ("FLOOR/FINISH PLAN" if is_plan else "") + (" raster!" if r == "raster" else "")
            print(f"{i+1:>3} {paths:>6} {nwords:>6} {imgs:>5} {rcov*100:>5.0f}% {('yes' if has_scale else '-'):>5} {r:>6}  {hint}")
    print(f"\n  routes: {routes}  ·  plan pages: {plan_pages} (clean-vector: {vector_plan_pages})")
    verdict = (
        "GOOD vector sample" if vector_plan_pages >= max(1, plan_pages // 2)
        else "MIXED — geometry may need vision assist" if plan_pages
        else "NO obvious plan pages — inspect manually"
    )
    print(f"  pre-screen verdict: {verdict}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python3 scripts/vector-quality.py <pdf> [pdf ...]")
        sys.exit(1)
    for path in sys.argv[1:]:
        probe(path)
