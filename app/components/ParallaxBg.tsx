"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// Transform-based parallax that works on mobile (background-attachment:
// fixed does not). The image layer is taller than its row and is shifted
// with translate3d as the row passes through the viewport.
export default function ParallaxBg({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    const row = layer?.parentElement;
    if (!layer || !row) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = row.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // -1 (row below viewport) → 0 (centered) → 1 (row above viewport)
      const progress =
        (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const shift = -Math.max(-1, Math.min(1, progress)) * 12; // percent
      layer.style.transform = `translate3d(0, ${shift}%, 0) scale(1.02)`;
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
    <div className="opt-parallax__layer" ref={ref}>
      <Image src={src} alt={alt} fill sizes="100vw" quality={85} style={{ objectFit: "cover" }} />
    </div>
  );
}
