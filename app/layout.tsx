import type { Metadata, Viewport } from "next";
import { Archivo, Oswald, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

// Hero headline only.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hero",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const SITE_URL = "https://eliteinstallation.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Elite Installation Services — Nationwide Commercial Flooring Experts",
    template: "%s · Elite Installation Services",
  },
  description:
    "Nationwide commercial flooring installation crews for fitness, retail, healthcare, education, and commercial projects. Precise installs, scheduled to open on time.",
  keywords: [
    "commercial flooring installation",
    "nationwide flooring contractor",
    "gym flooring installation",
    "retail flooring",
    "healthcare flooring",
    "rubber flooring crews",
    "epoxy flooring",
  ],
  applicationName: "Elite Installation Services",
  authors: [{ name: "Elite Installation Services" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Elite Installation Services",
    title: "Nationwide Commercial Flooring Experts",
    description:
      "Installation crews for fitness, retail, healthcare, education, and commercial projects — installed precise, on schedule.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Elite Installation Services — Nationwide Commercial Flooring Experts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite Installation Services — Commercial Flooring Experts",
    description:
      "Nationwide installation crews for commercial flooring. Precise results, on schedule.",
    images: ["/og.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "construction",
};

export const viewport: Viewport = {
  themeColor: "#0C0D0F",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "GeneralContractor",
  name: "Elite Installation Services",
  description:
    "Nationwide commercial flooring installation crews for fitness, retail, healthcare, education, and commercial projects.",
  url: SITE_URL,
  areaServed: { "@type": "Country", name: "United States" },
  knowsAbout: [
    "Commercial flooring installation",
    "Rubber and gym flooring",
    "Resilient and LVT flooring",
    "Epoxy and resin systems",
  ],
  makesOffer: {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: "Commercial Flooring Installation",
      serviceType: "Flooring installation",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${oswald.variable} ${inter.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
