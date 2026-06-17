import Image from "next/image";
import Reveal from "./Reveal";
import ParallaxBg from "./ParallaxBg";
import type { ServiceItem } from "./serviceContent";

export const ServiceBtn = ({
  label,
  variant,
  className = "",
}: {
  label: string;
  variant: "red" | "dark";
  className?: string;
}) => (
  <a
    href="#contact"
    className={`btn ${variant === "red" ? "btn--solid" : "btn--dark"} btn--service ${className}`}
  >
    {label}
  </a>
);

// Heading whose text rises out of a mask, with an optional drawing underline.
export const MaskedHeading = ({
  text,
  headingClass,
  underline = false,
}: {
  text: string;
  headingClass: string;
  underline?: boolean;
}) => (
  <h2 className={headingClass}>
    <span className="mask-line">
      <span className="mask-line__text">{text}</span>
    </span>
    {underline && <span className="opt-now__underline" aria-hidden="true" />}
  </h2>
);

// Alternating image / text rows; every other row on a full-bleed red panel.
// `anchored` sets section IDs for nav links (use on only one section per page
// to avoid duplicate IDs).
export function NowServices({
  items,
  anchored = false,
}: {
  items: ServiceItem[];
  anchored?: boolean;
}) {
  return (
    <section className="services opt-now" aria-label="Our services">
      {items.map((s, i) => {
        const red = i % 2 === 1;
        return (
          <article
            key={s.id}
            id={anchored ? s.id : undefined}
            className={`srow${i % 2 === 1 ? " srow--reverse" : ""}${
              red ? " opt-now__row--red" : ""
            }`}
          >
            <Reveal
              className={`srow__media reveal-media${red ? " reveal-media--h" : ""}`}
            >
              <Image
                src={s.img}
                alt={s.alt}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                quality={85}
                style={{ objectFit: "cover" }}
              />
            </Reveal>
            <Reveal className="srow__content reveal">
              <MaskedHeading text={s.head} headingClass="opt-now__heading" underline />
              <p className="opt-now__sub reveal-item">{s.sub}</p>
              <p className="srow__body opt-now__body reveal-item">{s.body}</p>
              <ServiceBtn label={s.btn} variant={red ? "dark" : "red"} className="reveal-item" />
            </Reveal>
          </article>
        );
      })}
    </section>
  );
}

// Full-bleed rows with a transform-based parallax image and centered copy.
export function ParallaxServices({
  items,
  anchored = false,
}: {
  items: ServiceItem[];
  anchored?: boolean;
}) {
  return (
    <section className="opt-parallax" aria-label="Our services">
      {items.map((s) => (
        <article key={s.id} id={anchored ? s.id : undefined} className="opt-parallax__row">
          <ParallaxBg src={s.img} alt={s.alt} />
          <div className="opt-parallax__scrim" />
          <div className="opt-parallax__content">
            <Reveal className="opt-parallax__panel reveal">
              <MaskedHeading text={s.head} headingClass="opt-parallax__title" />
              <p className="opt-parallax__sub reveal-item">{s.sub}</p>
              <p className="opt-body reveal-item">{s.body}</p>
              <ServiceBtn label={s.btn} variant="red" className="reveal-item" />
            </Reveal>
          </div>
        </article>
      ))}
    </section>
  );
}
