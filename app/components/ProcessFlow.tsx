"use client";

import { useEffect, useRef, useState } from "react";

type Step = { title: string; body: string; icon: React.ReactNode };

// When the grid scrolls into view, reveal the steps one at a time on a
// timer — each step pops in, then its connector flows to the next.
export default function ProcessFlow({
  steps,
  interval = 600,
}: {
  steps: Step[];
  interval?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let timer: ReturnType<typeof setInterval> | undefined;
    const play = () => {
      if (reduce) {
        setShown(steps.length);
        return;
      }
      setShown(1);
      let i = 1;
      timer = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= steps.length && timer) clearInterval(timer);
      }, interval);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [steps.length, interval]);

  return (
    <div ref={ref} className="procgrid">
      {steps.map((s, i) => (
        <div className={`pstep${i < shown ? " is-shown" : ""}`} key={s.title}>
          <span className="pstep__icon">{s.icon}</span>
          {/* Connector flows into the next step as it reveals */}
          {i < steps.length - 1 && <span className="pstep__link" aria-hidden="true" />}
          <h3 className="pstep__title">{s.title}</h3>
          <p className="pstep__body">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
