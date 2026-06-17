"use client";

import { useState } from "react";
import Image from "next/image";
import Reveal from "./Reveal";

const Logo = ({ center = false }: { center?: boolean }) => (
  <Image
    src="/logo.png"
    alt="Elite Installation Services"
    width={460}
    height={196}
    className={`quote__logo${center ? " quote__logo--center" : ""}`}
  />
);

const SERVICES = ["Flooring installation", "Fitness equipment", "Both"];
const TIMELINES = ["As soon as possible", "1–3 months", "Flexible"];

type Errors = { name?: string; email?: string; service?: string };

function QuoteFields() {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next: Errors = {};
    const email = String(f.get("email") || "");
    if (!String(f.get("name") || "").trim())
      next.name = "Enter your name so we know who to reach.";
    if (!email.trim()) next.email = "Add an email so we can reply.";
    else if (!/.+@.+\..+/.test(email)) next.email = "That email doesn't look right.";
    if (!String(f.get("service") || ""))
      next.service = "Pick a service so we route it to the right crew.";
    setErrors(next);
    if (Object.keys(next).length === 0) setDone(true);
  }

  if (done) {
    return (
      <div className="qdone" role="status">
        <p className="qdone__title">Quote requested.</p>
        <p className="qdone__body">
          Thanks — we'll get back to you within one business day.
        </p>
        <button type="button" className="btn btn--ghost btn--service" onClick={() => setDone(false)}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="qform" onSubmit={onSubmit} noValidate>
      <div className="qrow">
        <label className="qfield">
          <span className="qfield__label">Name</span>
          <input
            name="name"
            type="text"
            className="qfield__input"
            aria-invalid={!!errors.name}
            autoComplete="name"
          />
          {errors.name && <span className="qfield__error">{errors.name}</span>}
        </label>
        <label className="qfield">
          <span className="qfield__label">Company</span>
          <input name="company" type="text" className="qfield__input" autoComplete="organization" />
        </label>
      </div>

      <div className="qrow">
        <label className="qfield">
          <span className="qfield__label">Email</span>
          <input
            name="email"
            type="email"
            className="qfield__input"
            aria-invalid={!!errors.email}
            autoComplete="email"
          />
          {errors.email && <span className="qfield__error">{errors.email}</span>}
        </label>
        <label className="qfield">
          <span className="qfield__label">Phone</span>
          <input name="phone" type="tel" className="qfield__input" autoComplete="tel" />
        </label>
      </div>

      <div className="qrow">
        <label className="qfield">
          <span className="qfield__label">Service needed</span>
          <select name="service" className="qfield__input" aria-invalid={!!errors.service} defaultValue="">
            <option value="" disabled>Select a service</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.service && <span className="qfield__error">{errors.service}</span>}
        </label>
        <label className="qfield">
          <span className="qfield__label">Project location</span>
          <input name="state" type="text" className="qfield__input" placeholder="State" />
        </label>
      </div>

      <label className="qfield">
        <span className="qfield__label">Timeline</span>
        <select name="timeline" className="qfield__input" defaultValue="">
          <option value="" disabled>When do you need it?</option>
          {TIMELINES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="qfield">
        <span className="qfield__label">Project details</span>
        <textarea name="details" rows={4} className="qfield__input qfield__textarea" />
      </label>

      <button type="submit" className="btn btn--solid btn--service">Request a quote</button>
      <p className="qform__note">We reply within one business day. No obligation.</p>
    </form>
  );
}

function QuoteDecor({ kind }: { kind: string }) {
  switch (kind) {
    case "court":
      return (
        <div className="qdecor qdecor--court" aria-hidden="true">
          <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
            <circle className="qcourt__arc" cx="650" cy="110" r="200" />
            <line x1="-20" y1="468" x2="820" y2="468" />
            <line x1="250" y1="-20" x2="250" y2="620" />
            <rect x="250" y="208" width="180" height="184" />
          </svg>
        </div>
      );
    case "plate":
      return (
        <div className="qdecor qdecor--plate" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <circle className="qplate__ring" cx="200" cy="200" r="178" />
            <circle className="qplate__hub" cx="200" cy="200" r="46" />
            <text className="qplate__num" x="200" y="150">45</text>
          </svg>
        </div>
      );
    case "blueprint":
      return (
        <div className="qdecor qdecor--blueprint" aria-hidden="true">
          <div className="qdim">
            <span className="qdim__tick" />
            <span className="qdim__rule" />
            <span className="qdim__label">Installed to spec · 48&prime;-0&Prime;</span>
            <span className="qdim__rule" />
            <span className="qdim__tick" />
          </div>
        </div>
      );
    case "laser":
      return (
        <div className="qdecor qdecor--laser" aria-hidden="true">
          <span className="qlaser" />
        </div>
      );
    case "contours":
      return (
        <div className="qdecor qdecor--contours" aria-hidden="true">
          <span className="qcontours__ping" />
          <span className="qcontours__pin" />
        </div>
      );
    case "tile":
    default:
      return <div className={`qdecor qdecor--${kind}`} aria-hidden="true" />;
  }
}

const PitchAside = () => (
  <div className="quote__aside">
    <Logo />
    <h2 className="quote__title">Request a quote</h2>
    <p className="quote__lede">
      Tell us about the project and we'll get you a fast, accurate number — with a
      local crew lined up to do the work.
    </p>
    <ul className="quote__contacts">
      <li><span className="quote__ck">Call</span> (555) 123-4567</li>
      <li><span className="quote__ck">Email</span> quotes@eliteinstallation.com</li>
      <li><span className="quote__ck">Hours</span> Mon–Fri · Crews nationwide</li>
    </ul>
    <span className="quote__rule" aria-hidden="true" />
  </div>
);

// A — two column: pitch + contact on the left, form card on the right
export function QuoteTwoCol({ tag }: { tag?: string }) {
  return (
    <section className="quote quote--two" aria-label="Request a quote">
      {tag && <span className="cmp-tag">{tag}</span>}
      <Reveal className="quote__inner quote__inner--two reveal">
        <div className="reveal-item"><PitchAside /></div>
        <div className="qcard reveal-item"><QuoteFields /></div>
      </Reveal>
    </section>
  );
}

// B — centered single column
export function QuoteCentered({
  tag,
  glow,
  decor,
  gridColor,
  anchored = true,
}: {
  tag?: string;
  glow?: string;
  decor?: string;
  gridColor?: string;
  anchored?: boolean;
}) {
  return (
    <section
      id={anchored ? "contact" : undefined}
      className={`quote quote--center${glow ? ` quote--${glow}` : ""}${decor ? ` quote--${decor}` : ""}${gridColor ? ` quote--grid-${gridColor}` : ""}`}
      aria-label="Request a quote"
    >
      {tag && <span className="cmp-tag">{tag}</span>}
      {decor && <QuoteDecor kind={decor} />}
      <Reveal className="quote__inner quote__inner--center reveal">
        <div className="reveal-item"><Logo center /></div>
        <h2 className="quote__title reveal-item">Request a quote</h2>
        <p className="quote__lede quote__lede--center reveal-item">
          Tell us about the project and we'll get you a fast, accurate number — with a
          local crew lined up to do the work.
        </p>
        <div className="qcard qcard--center reveal-item"><QuoteFields /></div>
      </Reveal>
    </section>
  );
}
