import Image from "next/image";

const LINKS = [
  { label: "Home", href: "#top" },
  { label: "Flooring Installation", href: "#flooring" },
  { label: "Fitness Equipment", href: "#fitness" },
  { label: "About", href: "#about" },
  { label: "Contact Us", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="footer" aria-label="Site footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <Image
            src="/logo.png"
            alt="Elite Installation Services"
            width={600}
            height={255}
            className="footer__logo"
          />
          <p className="footer__tagline">Professional Assembly &amp; Installation</p>
          <p className="footer__services">
            Flooring <span className="footer__sep">|</span> Fitness Equipment
          </p>
        </div>

        <nav className="footer__col" aria-label="Quick links">
          <p className="footer__heading">Quick Links</p>
          <ul className="footer__list">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <p className="footer__heading">Get in touch</p>
          <a href="tel:+18173304097" className="footer__contact">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.4.55 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 11 11 0 0 0 .55 3.4 1 1 0 0 1-.24 1z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            (817) 330-4097
          </a>
          <a href="mailto:scheduling@eliteinstall.net" className="footer__contact footer__contact--email">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 7l8 5.5L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            scheduling@eliteinstall.net
          </a>
          <a
            href="https://instagram.com/eliteinstallation"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__ig"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
            </svg>
            Follow on Instagram
          </a>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="footer__bottominner">
          <p className="footer__copy">© 2026 Elite Installation Services. All rights reserved.</p>
          <p className="footer__fineprint">Commercial flooring &amp; fitness equipment · Nationwide</p>
        </div>
      </div>
    </footer>
  );
}
