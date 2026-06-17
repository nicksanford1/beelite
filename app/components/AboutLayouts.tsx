import Image from "next/image";
import Reveal from "./Reveal";
import StatCounter from "./StatCounter";
import {
  ABOUT_TITLE,
  ABOUT_BODY,
  ABOUT_IMG,
  ABOUT_ALT,
  ABOUT_STATS,
} from "./aboutContent";

const TitleLines = ({ className }: { className: string }) => (
  <h2 className={className}>
    {ABOUT_TITLE.map((line) => (
      <span className="mask-line" key={line}>
        <span className="mask-line__text">{line}</span>
      </span>
    ))}
  </h2>
);

const Stat = ({ to, label, cls }: { to: number; label: string; cls: string }) => (
  <div className={`${cls} reveal-item`}>
    <StatCounter to={to} />
    <span className={`${cls}__label`}>{label}</span>
  </div>
);

/* A — Split: image one side, copy + stats the other (current) */
export function AboutSplit() {
  return (
    <section id="about" className="about" aria-label="About Elite Installation Services">
      <Reveal className="about__media reveal-media">
        <Image src={ABOUT_IMG} alt={ABOUT_ALT} fill sizes="(max-width: 900px) 100vw, 50vw" quality={85} />
      </Reveal>
      <div className="about__content">
        <Reveal className="about__intro reveal">
          <TitleLines className="about__title" />
          <p className="about__body reveal-item">{ABOUT_BODY}</p>
        </Reveal>
        <Reveal className="about__stats reveal">
          {ABOUT_STATS.map((s) => (
            <Stat key={s.label} to={s.to} label={s.label} cls="astat" />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* B — Overlay: full-bleed image, copy + stats over a scrim */
export function AboutOverlay() {
  return (
    <section id="about" className="aboutov" aria-label="About Elite Installation Services">
      <div className="aboutov__bg" aria-hidden="true">
        <Image src={ABOUT_IMG} alt="" fill sizes="100vw" quality={85} />
        <div className="aboutov__scrim" />
      </div>
      <div className="aboutov__inner">
        <Reveal className="aboutov__intro reveal">
          <TitleLines className="aboutov__title" />
          <p className="aboutov__body reveal-item">{ABOUT_BODY}</p>
        </Reveal>
        <Reveal className="aboutov__stats reveal">
          {ABOUT_STATS.map((s) => (
            <Stat key={s.label} to={s.to} label={s.label} cls="ovstat" />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* C — Banner: tall image banner with headline, copy + stats below */
export function AboutBanner() {
  return (
    <section id="about" className="aboutbn" aria-label="About Elite Installation Services">
      <div className="aboutbn__banner">
        <Image src={ABOUT_IMG} alt={ABOUT_ALT} fill sizes="100vw" quality={85} />
        <div className="aboutbn__scrim" />
        <Reveal className="aboutbn__bannercopy reveal">
          <TitleLines className="aboutbn__title" />
        </Reveal>
      </div>
      <div className="aboutbn__body-wrap">
        <Reveal className="aboutbn__lead reveal">
          <p className="aboutbn__body reveal-item">{ABOUT_BODY}</p>
        </Reveal>
        <Reveal className="aboutbn__stats reveal">
          {ABOUT_STATS.map((s) => (
            <Stat key={s.label} to={s.to} label={s.label} cls="bnstat" />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
