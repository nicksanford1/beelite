import Image from "next/image";
import ScrollScene from "../components/ScrollScene";
import "./section-options.css";

export const metadata = {
  title: "Section scroll-animation options",
  robots: { index: false, follow: false },
};

const SCENES = [
  {
    cls: "scene--A",
    tag: "Option A — Image brightens as you scroll in, text drifts up",
  },
  {
    cls: "scene--B",
    tag: "Option B — Deep parallax: photo glides behind the steady text",
  },
  {
    cls: "scene--C",
    tag: "Option C — Assemble: title, subtitle & body converge into place",
  },
  {
    cls: "scene--D",
    tag: "Option D — Focus pull: photo sharpens, then text fades as you pass",
  },
];

export default function SectionOptionsPage() {
  return (
    <main className="scenes">
      <section className="scenes__intro">
        <div>
          <p className="scenes__kicker">Scroll-animation options</p>
          <h1 className="scenes__h1">Scroll down — each section animates differently</h1>
          <p className="scenes__note">
            Same content and photo in all four, so you&rsquo;re only comparing the
            motion. Tell me a letter (or mix ideas).
          </p>
        </div>
      </section>

      {SCENES.map((s) => (
        <section key={s.cls} className={`scene ${s.cls}`}>
          <ScrollScene className="scene__stage">
            <div className="scene__bg">
              <Image
                src="/site/service-flooring.jpg"
                alt=""
                fill
                sizes="100vw"
                quality={85}
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="scene__scrim" />
            <div className="scene__content">
              <span className="scene__tag">{s.tag}</span>
              <h2 className="scene__title">Commercial Flooring Installation</h2>
              <p className="scene__sub">
                Built for Fitness, Retail, Healthcare &amp; Commercial Spaces
              </p>
              <p className="scene__body">
                From preparation through installation, our team delivers
                high-performance flooring systems with the quality, consistency, and
                responsiveness your project requires.
              </p>
              <a href="#" className="btn btn--solid btn--thin scene__btn">
                View Flooring Services
              </a>
            </div>
          </ScrollScene>
        </section>
      ))}
    </main>
  );
}
