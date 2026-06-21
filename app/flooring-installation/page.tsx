import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import Footer from "../components/Footer";
import ServiceHero from "../components/ServiceHero";
import Reveal from "../components/Reveal";
import ProcessFlow from "../components/ProcessFlow";
import { QuoteCentered } from "../components/QuoteSections";

const SERVE = [
  { label: "Commercial Offices", img: "/site/hero-3.jpg" },
  { label: "Fitness Centers", img: "/site/service-fitness.jpg" },
  { label: "Retail Spaces", img: "/site/service-flooring.jpg" },
];

const DIFF = [
  "Cost-Effective Deployments",
  "Efficient Project Management",
  "Local Expertise, Nationwide Reach",
  "Product Warehousing",
  "Reliable, High-Quality Installations",
];

const Check = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const metadata = {
  title: "Flooring Installation",
  description:
    "Nationwide commercial flooring installation — local crews, full logistics, and a precise final-mile process for fitness, retail, and commercial spaces.",
  alternates: { canonical: "/flooring-installation" },
};

const PROCESS = [
  {
    title: "Set Requirements & Schedule Installation",
    body: "Define project needs and schedule, ensuring a tailored plan for a seamless flooring installation experience.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Truck Materials from Your Warehouse (or Ours!) to Project Site",
    body: "Efficiently transport materials, minimizing delays and ensuring all components arrive securely at the project site.",
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
    title: "Confirm Installation Details with Customer",
    body: "Verify details with the customer to guarantee alignment, fostering clear communication for a successful installation process.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5h16v11H9l-4 3v-3H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 10l2 2 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Stage Materials in Assigned Project Space",
    body: "Organize and prepare project space, optimizing efficiency for a smooth installation process.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="13" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="8" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Install Flooring",
    body: "Install flooring in designated spaces, prioritizing craftsmanship and stability for lasting performance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.2l-6 6 2.1 2.1 6-6a3.5 3.5 0 0 0 4.2-4.6l-2.1 2.1-1.6-1.6 2-2.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Final Check of Work & Requirements",
    body: "Conduct a thorough check, ensuring all work meets requirements and standards before finalizing the installation.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="4" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 3.5h6V7H9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 13l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Report Back to Customer Upon Completion",
    body: "Communicate completion details promptly, providing transparency and customer assurance for a successful flooring installation project.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 3L3 11l7 2.8L13 21l8-18z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M21 3L10 13.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function FlooringPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <ServiceHero
          titleLines={["Nationwide, Commercial", "Flooring Installers"]}
          lede="We install commercial, fitness, and retail flooring with precision — built for durability and safety, and finished on schedule so your space is ready for business."
          attrs={["Skilled technicians", "Logistics support", "Thorough communication", "Experience & commitment"]}
          img="/scraped-images/Flooring-Installation-for-Fitness-Centers-2.jpg"
        />

        {/* Final Mile Services — spec-board process */}
        <section className="procsec" aria-label="Our process">
          <Reveal className="procsec__head reveal">
            <h2 className="procsec__title reveal-item">Final Mile Services</h2>
            <p className="procsec__intro reveal-item">
              Our meticulous process delivers elite precision from the initial planning stages
              to the finishing touches — a flawless, reliable flooring installation experience
              for every client.
            </p>
          </Reveal>

          <ProcessFlow steps={PROCESS} interval={880} />
        </section>

        {/* Proudly serving */}
        <section className="serve" aria-label="Proudly serving">
          <Reveal className="serve__head reveal">
            <p className="section-eyebrow reveal-item">Proudly serving</p>
            <h2 className="serve__title reveal-item">Spaces we install</h2>
          </Reveal>
          <Reveal className="serve__grid reveal">
            {SERVE.map((s) => (
              <article className="servetile reveal-item" key={s.label}>
                <Image src={s.img} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" quality={85} />
                <div className="servetile__scrim" />
                <h3 className="servetile__label">{s.label}</h3>
              </article>
            ))}
          </Reveal>
        </section>

        {/* The Elite difference */}
        <section className="diff" aria-label="The Elite difference">
          <div className="diff__grid">
            <Reveal className="diff__text reveal">
              <p className="section-eyebrow reveal-item">The Elite difference</p>
              <h2 className="diff__title reveal-item">
                Elevating your experience in commercial flooring installation
              </h2>
              <p className="diff__body reveal-item">
                Our dedication to excellence sets us apart — unmatched expertise,
                professionalism, and flexibility across commercial, fitness, and retail
                flooring. A nationwide network of skilled installers delivers cost-effective,
                precise results from the first plan through final installation.
              </p>
            </Reveal>
            <Reveal className="diff__list reveal">
              {DIFF.map((d) => (
                <div className="diffitem reveal-item" key={d}>
                  <span className="diffitem__check">{Check}</span>
                  <span className="diffitem__label">{d}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Request a quote */}
        <QuoteCentered decor="blueprint" theme="lightcard" kicker="for Flooring Installation Services" />
      </main>

      <Footer />
    </>
  );
}
