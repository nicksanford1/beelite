import Image from "next/image";
import HeroSlideshow from "./components/HeroSlideshow";
import { NowServices, ParallaxServices } from "./components/ServiceSections";
import { Capabilities, WhyBand } from "./components/Capabilities";
import { AboutOverlay } from "./components/AboutLayouts";
import { QuoteCentered } from "./components/QuoteSections";
import Footer from "./components/Footer";
import { CONTENT_A, CONTENT_B } from "./components/serviceContent";

// Homepage services:
//  - "Now" alternating-rows section uses the scope-forward copy.
//  - "Parallax" section mixes copy: flooring scope-forward, fitness "favorites".
const PARALLAX_MIX = [CONTENT_B[0], CONTENT_A[1]];

const NAV = [
  { label: "Home", href: "#top" },
  { label: "Flooring Installation", href: "#flooring" },
  { label: "Fitness Equipment", href: "#fitness" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Page() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Elite Installation Services — home">
          <Image
            src="/logo.png"
            alt="Elite Installation Services"
            width={600}
            height={255}
            priority
            className="brand__logo"
          />
        </a>

        <nav className="nav" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="nav__link">
              {item.label}
            </a>
          ))}
        </nav>

        <a href="#contact" className="btn btn--solid btn--sm nav__quote">
          Get a quote
        </a>

        <button className="hamburger" aria-label="Open menu" type="button">
          <span /><span /><span />
        </button>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <HeroSlideshow />
        </section>

        <NowServices items={CONTENT_B} anchored />

        <ParallaxServices items={PARALLAX_MIX} />

        <Capabilities />

        <WhyBand />

        <AboutOverlay />

        <QuoteCentered decor="blueprint" />
      </main>

      <Footer />
    </>
  );
}
