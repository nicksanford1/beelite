/**
 * Render one page (or a cropped region) of a plan PDF to JPEG so it can be viewed. Demo-prep tooling.
 *   npx tsx scripts/render-page.ts "<pdf>" <page> [scale] [out] [cropX,Y,W,H as 0-1 fractions]
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "fs";

async function main() {
  const [path, pageStr, scaleStr, out, crop] = process.argv.slice(2);
  if (!path || !pageStr) { console.error("usage: render-page.ts <pdf> <page> [scale] [out] [x,y,w,h]"); process.exit(1); }
  const page = Number(pageStr);
  const scale = scaleStr ? Number(scaleStr) : 2.2;
  const outPath = out || `/tmp/plan-p${page}.jpg`;
  const bytes = readFileSync(path);

  const { createCanvas } = await import("@napi-rs/canvas");
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise;
  const pg = await doc.getPage(page);
  const viewport = pg.getViewport({ scale });
  const full = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = full.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, full.width, full.height);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pg.render({ canvasContext: ctx, viewport, canvas: full } as any).promise;

  let outCanvas = full;
  if (crop) {
    const [x, y, w, h] = crop.split(",").map(Number);
    const sx = Math.floor(x * full.width), sy = Math.floor(y * full.height);
    const sw = Math.floor(w * full.width), sh = Math.floor(h * full.height);
    const c = createCanvas(sw, sh);
    c.getContext("2d").drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    outCanvas = c;
  }
  const img = outCanvas.toBuffer("image/jpeg", 90);
  writeFileSync(outPath, img);
  console.log(`${outPath}  (${(img.length / 1e6).toFixed(1)}MB, ${outCanvas.width}x${outCanvas.height})`);
  await doc.destroy();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
