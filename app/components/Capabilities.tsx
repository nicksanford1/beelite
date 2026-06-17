import Reveal from "./Reveal";

const CHAIN = [
  {
    title: "Warehousing",
    body: "We receive and store your product until the site is ready.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 10l9-5 9 5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M7 20v-6h10v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Equipment Trucking",
    body: "We move it from warehouse to site on our own schedule.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 6h11v9H3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 9h4l3 3v3h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="7" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.5" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "Assembly & Installation",
    body: "Trained crews install every piece to spec, floor-ready.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.2l-6 6 2.1 2.1 6-6a3.5 3.5 0 0 0 4.2-4.6l-2.1 2.1-1.6-1.6 2-2.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Relocation Services",
    body: "Moving or reconfiguring? We de-install, transport, and reinstall.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8h12l-3-3M20 16H8l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function Capabilities() {
  return (
    <section className="caps" aria-label="Our services">
      <Reveal className="caps__head reveal">
        <p className="section-eyebrow reveal-item">Full-service</p>
        <h2 className="caps__title reveal-item">
          Nationwide, professional assembly &amp; installation services
        </h2>
        <p className="caps__intro reveal-item">
          We handle the whole chain — from the loading dock to the finished floor.
        </p>
      </Reveal>

      <Reveal className="caps__chain reveal">
        <span className="caps__line" aria-hidden="true" />
        {CHAIN.map((c) => (
          <div className="capnode reveal-item" key={c.title}>
            <span className="capnode__dot">{c.icon}</span>
            <h3 className="capnode__title">{c.title}</h3>
            <p className="capnode__body">{c.body}</p>
          </div>
        ))}
      </Reveal>

      <Reveal className="caps__wl">
        <span className="caps__wl-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h7l9 9-7 7-9-9V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
          </svg>
        </span>
        <div className="caps__wl-text">
          <p className="caps__wl-eyebrow">Also offered</p>
          <h3 className="caps__wl-title">White-Label Installs</h3>
          <p className="caps__wl-body">
            Your brand, our crews — dealers and manufacturers run our teams as their own.
          </p>
        </div>
        <a href="#contact" className="btn btn--solid btn--service">Talk to us</a>
      </Reveal>
    </section>
  );
}

const WHY = [
  {
    title: "Eliminate Travel Costs",
    body: "Skip the travel costs of sending installers to your customer's location — we use technicians local to the area.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "Stay on Schedule",
    body: "With local installers, inevitable product-delivery delays no longer throw a major wrench into the installation schedule.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v5.2l3.4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Provide Quality Service",
    body: "Quality assembly and installation work, delivered through solid training and efficient, repeatable processes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.6-3 8.1-7 9-4-.9-7-4.4-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 11.8l2 2 4.2-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function WhyBand() {
  return (
    <section className="why" aria-label="Why Elite">
      <Reveal className="why__head reveal">
        <p className="section-eyebrow reveal-item">The Elite advantage</p>
      </Reveal>
      <Reveal className="why__grid reveal">
        {WHY.map((b) => (
          <div key={b.title} className="bcard reveal-item">
            <span className="bcard__icon">{b.icon}</span>
            <h3 className="bcard__title">{b.title}</h3>
            <p className="bcard__body">{b.body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
