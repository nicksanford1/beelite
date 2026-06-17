import { QuoteCentered } from "../components/QuoteSections";

export const metadata = {
  title: "Quote grid color options",
  robots: { index: false, follow: false },
};

const VARIANTS = [
  { tag: "White (current)", gridColor: undefined },
  { tag: "Bright white", gridColor: "bright" },
  { tag: "Red", gridColor: "red" },
  { tag: "Blueprint blue", gridColor: "blue" },
  { tag: "Amber", gridColor: "amber" },
  { tag: "Green", gridColor: "green" },
];

export default function QuoteGridOptionsPage() {
  return (
    <main style={{ background: "var(--ink)" }}>
      {VARIANTS.map((v) => (
        <QuoteCentered
          key={v.tag}
          tag={v.tag}
          decor="blueprint"
          gridColor={v.gridColor}
          anchored={false}
        />
      ))}
    </main>
  );
}
