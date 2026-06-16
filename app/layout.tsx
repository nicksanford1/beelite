import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beelite",
  description: "Commercial flooring takeoff & estimating",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* `children` is whatever page is being shown right now */}
      <body>{children}</body>
    </html>
  );
}
