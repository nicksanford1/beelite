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

// Render each page only as it nears the viewport — so a 100-page set doesn't render all at once.
function LazyPage({ documentId, pageNumber }: { documentId: string; pageNumber: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ minHeight: 460, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/preview?doc=${documentId}&page=${pageNumber}`}
          alt={`Page ${pageNumber}`}
          style={{ width: "100%", borderRadius: 8, display: "block" }}
        />
      ) : (
        <span className="card-meta mono">Page {pageNumber}…</span>
      )}
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
  const [readPending, startRead] = useTransition();

  const tagged = Object.values(tags).filter((v) => v === "finish_schedule").length;
  const setTag = (id: string, key: string) => setTags((t) => ({ ...t, [id]: t[id] === key ? "untagged" : key }));
  const tagList = () => initial.map((p) => ({ id: p.id, sheetType: tags[p.id] }));
  const read = () =>
    startRead(async () => {
      await saveSheetTags(projectId, tagList());
      await readSchedule(documentId); // redirects to /finishes
    });

  const suggestions = initial.filter((p) => p.suggestedSheetType === "finish_schedule");

  return (
    <div>
      {/* sticky action bar — always tells you what to do + the way forward */}
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
          {tagged === 0 ? "Scroll the set and tag the finish-schedule page." : `${tagged} page${tagged === 1 ? "" : "s"} tagged`}
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

      {/* every page, big, top to bottom */}
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
                  {p.sheetNumber && <span className="card-meta">sheet {p.sheetNumber} <span style={{ opacity: 0.7 }}>(scanner guess)</span></span>}
                  {suggested && <span style={{ fontSize: 12.5, color: "var(--marking)", fontWeight: 600 }}>likely a finish schedule</span>}
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
              <LazyPage documentId={documentId} pageNumber={p.pageNumber} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
