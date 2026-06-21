export type ServiceItem = {
  id: string;
  head: string;
  sub: string;
  body: string;
  btn: string;
  img: string;
  alt: string;
};

const ALT = {
  flooring: "Custom athletic flooring installed in a commercial fitness space",
  fitness: "Strength equipment professionally assembled and installed in a gym",
};

// Direction 1 — "favorites": punchy, benefit subheadline.
export const CONTENT_A: ServiceItem[] = [
  {
    id: "flooring",
    head: "Commercial Flooring Installation",
    sub: "Precision Flooring. Reliable Results.",
    body: "Whether it's a fitness center, retail space, healthcare facility, or commercial property, our team installs flooring systems built to perform and made to last.",
    btn: "View Flooring Services",
    img: "/hero/hero-1.jpg",
    alt: ALT.flooring,
  },
  {
    id: "fitness",
    head: "Fitness Equipment Assembly & Installation",
    sub: "From Delivery to Ready for Use",
    body: "We handle the assembly, placement, and installation of fitness equipment so your facility is ready for members, trainers, and staff from day one.",
    btn: "View Fitness Services",
    img: "/site/service-fitness.jpg",
    alt: ALT.fitness,
  },
];

// Direction 2 — "scope-forward": positions Elite as a larger contractor.
export const CONTENT_B: ServiceItem[] = [
  {
    id: "flooring",
    head: "Commercial Flooring Installation",
    sub: "Built for Fitness, Retail, Healthcare & Commercial Spaces",
    body: "From preparation through installation, our team delivers high-performance flooring systems with the quality, consistency, and responsiveness your project requires.",
    btn: "View Flooring Services",
    img: "/hero/hero-1.jpg",
    alt: ALT.flooring,
  },
  {
    id: "fitness",
    head: "Fitness Equipment Assembly & Installation",
    sub: "From Delivery to Ready for Use",
    body: "Our team assembles, installs, and positions fitness equipment efficiently, helping facilities stay on schedule and ready for opening day.",
    btn: "View Fitness Services",
    img: "/site/service-fitness.jpg",
    alt: ALT.fitness,
  },
];
