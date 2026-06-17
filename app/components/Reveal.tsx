"use client";

import { useEffect, useRef, useState } from "react";

// Adds `is-in` when the element scrolls into view, once. The actual
// animation (fade/stagger/clip) is defined in CSS by the className you
// pass — this just flips the switch. Reduced-motion shows instantly.
export default function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className}${inView ? " is-in" : ""}`}>
      {children}
    </div>
  );
}
