"use client";

import { useState, useEffect } from "react";

export type PlanPageView = {
  pageNumber: number;
  imageUrl: string | null;
  sheet: string; // sheet number from the title block, e.g. "A3.1" ("" if none read yet)
  title: string; // sheet title, e.g. "INTERIOR DETAILS"
  isEvidence: boolean;
};

// Lightweight plan review: a large preview of the selected page, a labeled thumbnail strip, and an
// informational page list. Each page is labeled by its sheet number + title (read from the title
// block). A fullscreen mode blows the preview up to fill the viewport (Esc / arrows to navigate).
export function PlansReview({ pages, initialPage }: { pages: PlanPageView[]; initialPage?: number }) {
  const [sel, setSel] = useState(initialPage ?? pages[0]?.pageNumber ?? 1);
  const [fs, setFs] = useState(false);
  const current = pages.find((p) => p.pageNumber === sel) ?? pages[0];
  const idx = pages.findIndex((p) => p.pageNumber === sel);
  const go = (d: number) => {
    const next = pages[idx + d];
    if (next) setSel(next.pageNumber);
  };
  const label = (p: PlanPageView) => (p.sheet ? p.sheet : `Page ${p.pageNumber}`);

  // In fullscreen: lock body scroll and wire keyboard nav (Esc to exit, ←/→ to page).
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFs(false);
      else if (e.key === "ArrowLeft") setSel((s) => pages[pages.findIndex((p) => p.pageNumber === s) - 1]?.pageNumber ?? s);
      else if (e.key === "ArrowRight") setSel((s) => pages[pages.findIndex((p) => p.pageNumber === s) + 1]?.pageNumber ?? s);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fs, pages]);

  if (!pages.length) return null;

  const thumbs = (
    <div className="pl-thumbs">
      {pages.map((p) => (
        <button
          key={p.pageNumber}
          type="button"
          className={`pl-thumb${p.pageNumber === sel ? " pl-thumb-active" : ""}`}
          onClick={() => setSel(p.pageNumber)}
          title={p.title ? `${label(p)} · ${p.title}` : label(p)}
        >
          <span className="pl-thumb-img">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={label(p)} />
            ) : (
              <span className="pl-thumb-n">{p.pageNumber}</span>
            )}
            {p.isEvidence && <span className="pl-thumb-evi" title="Used for finish read">●</span>}
          </span>
          <span className="pl-thumb-cap">
            <span className="pl-thumb-sheet">{label(p)}</span>
            {p.title && <span className="pl-thumb-title">{p.title}</span>}
          </span>
        </button>
      ))}
    </div>
  );

  const preview = (
    <div className="pl-preview">
      <div className="pl-preview-head">
        <span className="pl-preview-sheet">{current?.sheet || `Page ${current?.pageNumber}`}</span>
        {current?.title && <span className="pl-preview-title">{current.title}</span>}
        {current?.isEvidence && <span className="pl-preview-evi">Used for finish read</span>}
        <button type="button" className="btn pl-fs-btn" onClick={() => setFs((v) => !v)}>
          {fs ? "Exit fullscreen ✕" : "⛶ Fullscreen"}
        </button>
      </div>
      {current?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.imageUrl} alt={label(current)} className="pl-preview-img" />
      ) : (
        <div className="pl-preview-empty">Page image still processing…</div>
      )}
      <div className="pl-preview-bar">
        <button type="button" className="btn" onClick={() => go(-1)} disabled={idx <= 0}>← Prev</button>
        <span className="pl-counter">Page {sel} of {pages.length}</span>
        <button type="button" className="btn" onClick={() => go(1)} disabled={idx >= pages.length - 1}>Next →</button>
      </div>
    </div>
  );

  // Fullscreen: fixed overlay with the preview filling the viewport and the labeled strip beneath it.
  if (fs) {
    return (
      <div className="pl-fs" role="dialog" aria-modal="true">
        {preview}
        {thumbs}
      </div>
    );
  }

  return (
    <div className="pl-review">
      {preview}
      {thumbs}

      <table className="pl-list">
        <thead>
          <tr><th>Page</th><th>Sheet</th><th>Title</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.pageNumber} className={p.pageNumber === sel ? "pl-row-active" : ""} onClick={() => setSel(p.pageNumber)}>
              <td className="pl-pg">{p.pageNumber}</td>
              <td className="pl-sheet">{p.sheet || <span className="pl-muted">—</span>}</td>
              <td>{p.title || <span className="pl-muted">—</span>}</td>
              <td>{p.isEvidence ? <span className="pl-evi">Used for finish read</span> : <span className="pl-muted">Available</span>}</td>
              <td>{p.imageUrl && <a className="pl-view" href={p.imageUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
