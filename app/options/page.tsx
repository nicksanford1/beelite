import { CONTENT_A, CONTENT_B } from "../components/serviceContent";
import { NowServices, ParallaxServices } from "../components/ServiceSections";
import "./options.css";

export const metadata = {
  title: "Services section — content directions",
  robots: { index: false, follow: false },
};

export default function OptionsPage() {
  return (
    <main className="opt-page">
      <div className="opt-block">
        <span className="opt-tag">Now · 1 — favorites</span>
        <NowServices items={CONTENT_A} />
      </div>
      <div className="opt-block">
        <span className="opt-tag">Now · 2 — scope-forward</span>
        <NowServices items={CONTENT_B} />
      </div>
      <div className="opt-block">
        <span className="opt-tag">Parallax · 1 — favorites</span>
        <ParallaxServices items={CONTENT_A} />
      </div>
      <div className="opt-block">
        <span className="opt-tag">Parallax · 2 — scope-forward</span>
        <ParallaxServices items={CONTENT_B} />
      </div>
    </main>
  );
}
