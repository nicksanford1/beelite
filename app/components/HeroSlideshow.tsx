"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "/hero-1.jpg",
    alt: "Commercial weight-room flooring with custom logo tiles",
    titleTop: "Commercial",
    titleBottom: "Flooring Installation",
    body: "Elevate your commercial, fitness, and retail spaces with Elite Installation Services. Our expert team delivers precision flooring installation — flawless results and top-tier solutions for every project.",
  },
  {
    src: "/hero-2.jpg",
    alt: "High-end fitness facility with full equipment install",
    titleTop: "Fitness Equipment",
    titleBottom: "Assembly & Installation",
    body: "Power up your fitness spaces with Elite Installation Services. Our skilled crews handle flawless assembly and installation of every machine — delivered ready to train.",
  },
];

const INTERVAL = 6000;

export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % SLIDES.length),
      INTERVAL
    );
    return () => clearInterval(id);
  }, []);

  const go = (dir: number) =>
    setActive((i) => (i + dir + SLIDES.length) % SLIDES.length);

  const slide = SLIDES[active];

  return (
    <>
      <div className="hero__bg" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <div
            key={s.src}
            className={`hero__slide${i === active ? " is-active" : ""}`}
          >
            <Image
              src={s.src}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              quality={85}
              style={{ objectFit: "cover" }}
            />
          </div>
        ))}
        <div className="hero__scrim" />
      </div>

      <div className="hero__inner">
        <div className="hero__copy">
          <h1 id="hero-title" className="display">
            <span className="display__swap" key={active}>
              <span className="display__line">
                <span className="display__text">{slide.titleTop}</span>
              </span>
              <span className="display__line">
                <span className="display__text">{slide.titleBottom}</span>
                <span className="display__rule display__rule--red" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p className="lede">
            <span className="lede__swap" key={active}>{slide.body}</span>
          </p>
        </div>

        <div className="cta-row">
          <a href="#contact" className="btn btn--solid">
            Get a quote
          </a>
          <a href="#projects" className="btn btn--ghost">
            View projects
          </a>
        </div>
      </div>

      <button
        type="button"
        className="hero__arrow hero__arrow--prev"
        aria-label="Previous slide"
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="hero__arrow hero__arrow--next"
        aria-label="Next slide"
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
