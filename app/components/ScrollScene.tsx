"use client";

import { useEffect, useRef } from "react";

// Sets a CSS custom property --p (0 → 1) on its root element based on how far
// the element has travelled through the viewport: 0 when its center is at the
// bottom edge, 0.5 when centered, 1 when its center reaches the top. Effects in
// CSS read var(--p) to drive brightness / position / opacity as you scroll.
// JS-driven (rAF) so it works everywhere, not just browsers with CSS
// scroll-timelines.
export default function ScrollScene({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2;
      const p = Math.min(1, Math.max(0, 1 - center / vh));
      el.style.setProperty("--p", p.toFixed(3));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
