// Render a PDF page to PNG so it's easy to view. Usage:
//   npx tsx scripts/render-pdf.ts samples/midlands-A701.pdf [out.png] [scale] [page]
import { readFileSync, writeFileSync } from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

async function main() {
  const input = process.argv[2] ?? "samples/midlands-A701.pdf";
  const out = process.argv[3] ?? input.replace(/\.pdf$/i, ".png");
  const scale = Number(process.argv[4] ?? 2.5);
  const pageNum = Number(process.argv[5] ?? 1);

  const data = new Uint8Array(readFileSync(input));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  // white background (PDFs are transparent)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`wrote ${out}  (${canvas.width}x${canvas.height})`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
