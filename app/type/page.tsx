import Image from "next/image";
import {
  Archivo,
  Oswald,
  Space_Grotesk,
  Roboto_Slab,
  Inter,
} from "next/font/google";
import "./type.css";

export const metadata = {
  title: "Typography options",
  robots: { index: false, follow: false },
};

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800"] });
const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], weight: ["600", "700", "800"] });

const DIRECTIONS = [
  {
    tag: "Current",
    display: archivo,
    caps: true,
    img: "/hero-1.jpg",
    // subheadline treatment
    sub: inter,
    subColor: "var(--red)",
    subCaps: true,
  },
  {
    tag: "A",
    display: oswald,
    caps: true,
    img: "/service-flooring.jpg",
    sub: oswald,
    subColor: "#ffffff",
    subCaps: true,
  },
  {
    tag: "B",
    display: spaceGrotesk,
    caps: false,
    img: "/service-fitness.jpg",
    sub: spaceGrotesk,
    subColor: "var(--red-coral)",
    subCaps: false,
  },
  {
    tag: "C",
    display: robotoSlab,
    caps: false,
    img: "/hero-2.jpg",
    sub: robotoSlab,
    subColor: "#e7e9ec",
    subCaps: false,
  },
];

export default function TypePage() {
  return (
    <main className="typ-page">
      {DIRECTIONS.map((d) => (
        <section key={d.tag} className="typ-block">
          <div className="typ-bg" aria-hidden="true">
            <Image src={d.img} alt="" fill sizes="100vw" quality={85} priority={d.tag === "Current"} />
            <div className="typ-scrim" />
          </div>

          <span className="typ-tag">{d.tag}</span>

          <div className="typ-inner">
            <h2 className={`typ-headline ${d.caps ? "typ-headline--caps" : ""} ${d.display.className}`}>
              <span className="typ-headline__text">Commercial Flooring Installation</span>
              <span className="typ-rule" aria-hidden="true" />
            </h2>

            <p
              className={`typ-sub ${d.subCaps ? "typ-sub--caps" : ""} ${d.sub.className}`}
              style={{ color: d.subColor }}
            >
              Precision Flooring. Reliable Results.
            </p>

            <p className={`typ-lede ${inter.className}`}>
              Precision flooring and fitness-equipment installation — local crews,
              nationwide coverage, every job installed to spec and finished on schedule.
            </p>

            <a href="#" className={`btn btn--solid btn--service ${inter.className}`}>
              Get a quote
            </a>
          </div>
        </section>
      ))}
    </main>
  );
}
