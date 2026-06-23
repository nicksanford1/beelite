"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// The measuring rule: a fixed left rail whose ticks track which block you're scrolled into and jump
// you to any block on click. The live bid price is pinned at the foot — the one number that follows
// you down the page. Replaces tab-hopping: the whole bid is one scroll, the rail is just where-you-are.
export type RailSection = {
  id: string;
  label: string;
  note: string;
  state: "done" | "active" | "todo" | "blocked";
};

export function WorkspaceRail({
  projectName,
  projectMeta,
  sections,
  bidPrice,
  profit,
  focus,
}: {
  projectName: string;
  projectMeta: string;
  sections: RailSection[];
  bidPrice: string;
  profit: string | null;
  focus?: string; // section id to scroll to on first load (e.g. straight from project creation)
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const didFocus = useRef(false);

  // Land on the requested block once, smoothly, after the page paints (used right after creation so the
  // estimator starts at Finishes, not the top).
  useEffect(() => {
    if (didFocus.current || !focus) return;
    didFocus.current = true;
    const el = document.getElementById(focus);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus]);

  // Scroll-spy: the block whose top most recently crossed the upper third of the viewport is "active".
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <>
      <Link href="/" className="ws-back">← All bids</Link>
      <div className="ws-proj">
        <div className="ws-proj-name">{projectName}</div>
        <div className="ws-proj-meta">{projectMeta}</div>
      </div>

      <nav className="rule" aria-label="Bid sections">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={jump(s.id)}
            className="rule-step"
            data-state={s.state}
            aria-current={s.id === active ? "true" : undefined}
          >
            <span className="rule-tick">{s.state === "done" ? "✓" : "◆"}</span>
            <span>
              <span className="rule-label">{s.label}</span>
              <span className="rule-note">{s.note}</span>
            </span>
          </a>
        ))}
      </nav>

      <div className="ws-readout">
        <div className="ws-readout-label">Bid price</div>
        <div className="ws-readout-figure">{bidPrice}</div>
        {profit && <div className="ws-readout-sub">profit {profit}</div>}
      </div>
    </>
  );
}
