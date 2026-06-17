"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveSheetTags, readSchedule } from "@/app/actions";

type Page = {
  id: string;
  pageNumber: number;
  sheetNumber: string | null;
  sheetTitle: string | null;
  suggestedSheetType: string | null;
  scanScore: number | null;
  sheetType: string;
};

const TYPES = [
  { key: "finish_schedule", label: "Finish schedule" },
  { key: "floor_plan", label: "Floor plan" },
  { key: "specs", label: "Specs" },
  { key: "ignore", label: "Ignore" },
];

// Render one page to a canvas in the browser (crisp + fast, even on dense drawings) when it nears view.
// `zoom` is a max-height in vh — at ~82 the whole sheet fits the screen; higher zooms in.
function PageCanvas({ pdf, pageNumber, zoom }: { pdf: any; pageNumber: number; zoom: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "rendering" | "done" | "error">("idle");

  useEffect(() => {
    if (!pdf) return;
    const el = wrapRef.current;
    if (!el) return;
    let rendered = false;
    let busy = false;

    const render = async () => {
      if (rendered || busy) return;
      busy = true;
      try {
        setState("rendering");
        const page = await pdf.getPage(pageNumber);
        const containerWidth = el.clientWidth || 1000;
        const base = page.getViewport({ scale: 1 });
        // Oversample ~2.4x display width so pinch/browser zoom stays crisp (cap to bound memory).
        const targetWidth = Math.min(containerWidth * 2.4, 3400);
        const scale = Math.max(0.4, Math.min(targetWidth / base.width, 3.2));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        rendered = true;
        setState("done");
      } catch {
        setState("error");
      } finally {
        busy = false;
      }
    };

    const free = () => {
      if (!rendered) return;
      const c = canvasRef.current;
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      rendered = false;
      setState("idle");
    };

    // Render pages near the viewport; free the ones that scroll far away so big sets stay light.
    const io = new IntersectionObserver(
      (entries) => (entries[0].isIntersecting ? render() : free()),
      { rootMargin: "1400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pdf, pageNumber]);

  return (
    <div
      ref={wrapRef}
      style={{ minHeight: 240, background: "#fbfbfa", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 8 }}
    >
      {state !== "done" && (
        <span className="card-meta mono">{state === "error" ? `Page ${pageNumber} — couldn’t render` : `Page ${pageNumber}…`}</span>
      )}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: "100%",
          maxHeight: `${zoom}vh`,
          width: "auto",
          height: "auto",
          borderRadius: 6,
          display: state === "done" ? "block" : "none",
          margin: "0 auto",
        }}
      />
    </div>
  );
}

export function PlansViewer({ projectId, documentId, initial }: { projectId: string; documentId: string; initial: Page[] }) {
  const [tags, setTags] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initial.map((p) => [
        p.id,
        p.sheetType !== "untagged"
          ? p.sheetType
          : p.suggestedSheetType && p.suggestedSheetType !== "other"
            ? p.suggestedSheetType
            : "untagged",
      ])
    )
  );
  const [pdf, setPdf] = useState<any>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(82); // max-height vh: 82 ≈ whole sheet fits the screen
  const [readPending, startRead] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({ url: `/api/plan-pdf?doc=${documentId}`, disableRange: true, disableStream: true }).promise;
        if (!cancelled) setPdf(doc);
      } catch (e: unknown) {
        if (!cancelled) setLoadErr((e as Error)?.message ?? "Could not load the PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const tagged = Object.values(tags).filter((v) => v === "finish_schedule").length;
  const setTag = (id: string, key: string) => setTags((t) => ({ ...t, [id]: t[id] === key ? "untagged" : key }));
  const tagList = () => initial.map((p) => ({ id: p.id, sheetType: tags[p.id] }));
  const read = () =>
    startRead(async () => {
      await saveSheetTags(projectId, tagList());
      await readSchedule(documentId);
    });

  const suggestions = initial.filter((p) => p.suggestedSheetType === "finish_schedule");

  return (
    <div>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 5, background: "var(--bg)",
          padding: "12px 0", marginBottom: 18, borderBottom: "1px solid var(--border)",
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}
      >
        <button className="btn btn-primary" disabled={readPending || tagged === 0} onClick={read}>
          {readPending ? "Reading…" : `Read finishes from ${tagged} page${tagged === 1 ? "" : "s"}`}
        </button>
        <span className="card-meta">
          {!pdf && !loadErr ? "Loading the plan…" : tagged === 0 ? "Scroll the set and tag the finish-schedule page." : `${tagged} tagged`}
        </span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button className="btn mono" title="Zoom out" style={{ padding: "4px 11px", fontSize: 15 }} onClick={() => setZoom((z) => Math.max(40, z - 18))}>−</button>
          <button className="btn" title="Fit page to screen" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => setZoom(82)}>Fit</button>
          <button className="btn mono" title="Zoom in" style={{ padding: "4px 11px", fontSize: 15 }} onClick={() => setZoom((z) => Math.min(320, z + 25))}>+</button>
        </span>
        {suggestions.length > 0 && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="card-meta">Jump to likely:</span>
            {suggestions.map((p) => (
              <a key={p.id} href={`#page-${p.pageNumber}`} className="btn mono" style={{ padding: "4px 10px", fontSize: 13 }}>
                pg {p.pageNumber}
              </a>
            ))}
          </span>
        )}
      </div>

      {loadErr && <p className="hint" style={{ color: "#b45309" }}>⚠ {loadErr}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {initial.map((p) => {
          const suggested = p.suggestedSheetType === "finish_schedule";
          const tag = tags[p.id];
          const isSchedule = tag === "finish_schedule";
          return (
            <div
              key={p.id}
              id={`page-${p.pageNumber}`}
              className="card"
              style={{
                display: "block", padding: 14, scrollMarginTop: 80,
                borderLeft: isSchedule ? "4px solid var(--marking)" : suggested ? "4px solid var(--marking-soft)" : "4px solid transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <strong className="mono" style={{ fontSize: 15 }}>Page {p.pageNumber}</strong>
                  {isSchedule && <span style={{ fontSize: 12.5, color: "var(--marking)", fontWeight: 600 }}>tagged: finish schedule</span>}
                  {!isSchedule && suggested && <span style={{ fontSize: 12.5, color: "var(--marking)", fontWeight: 600 }}>likely a finish schedule</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTag(p.id, t.key)}
                      className="btn"
                      style={{ padding: "5px 11px", fontSize: 13, ...(tag === t.key ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}) }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <PageCanvas pdf={pdf} pageNumber={p.pageNumber} zoom={zoom} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
