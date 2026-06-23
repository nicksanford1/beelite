import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PDFJS_ERRORS_ONLY = 0;

export type PageScan = {
  pageNumber: number;
  sheetNumber: string | null;
  sheetTitle: string | null;
  score: number; // 0..1 finish-schedule likelihood
  signals: Record<string, unknown>;
  suggestedSheetType: string; // finish_schedule | finish_plan | floor_plan | specs | other
};

const FINISH_CODE = /\b(?:LVT|CPT|VCT|CT|RB|PT|RES|SC|WB|EPX|PC|VWC|WD|QT)-?\d{1,2}\b/gi; // LVT-1, CPT-12, RB-01
const SHEET_NUM = /\b([A-Z]{1,2}-?\d{3}(?:\.\d+)?)\b/g; // A-601, A601, FS-101 (3 digits ≠ finish codes)

/** Score one page's text for "is this a finish schedule?" */
export function scorePage(pageNumber: number, text: string): PageScan {
  const U = text.toUpperCase();

  const titleHit = /FINISH\s+(SCHEDULE|LEGEND|MATERIAL|PLAN)/.test(U) || /ROOM\s+FINISH/.test(U);
  const csiHit = /\b09\s?06\s?00\b/.test(U) || /SCHEDULE\s+FOR\s+FINISHES/.test(U);
  const codeCount = (text.match(FINISH_CODE) || []).length;

  // negative signals — pages that have finish-ish words but aren't the schedule.
  // Includes "GENERAL NOTES" et al: notes/spec front-matter that cite finishes/CSI in prose but
  // aren't a schedule table (this is what false-flagged the DC gym's G-02 pages).
  const negative =
    /COVER\s+SHEET|SHEET\s+INDEX|DRAWING\s+INDEX|TABLE\s+OF\s+CONTENTS|TITLE\s+SHEET|BID\s+FORM|PROPOSAL\s+FORM|INSTRUCTIONS?\s+TO\s+BIDDERS|PREVAILING\s+WAGE|PAYROLL|GENERAL\s+NOTES|GENERAL\s+CONDITIONS|GENERAL\s+REQUIREMENTS|GENERAL\s+INFORMATION|CODE\s+ANALYSIS|LIFE\s+SAFETY|ABBREVIATIONS|SHEET\s+NOTES/.test(U);

  const realScheduleTitle = /FINISH\s+(SCHEDULE|LEGEND|MATERIAL)/.test(U) || /ROOM\s+FINISH\s+SCHEDULE/.test(U);
  const isFloorPlan = /FLOOR\s+PLAN/.test(U);

  let score = 0;
  if (titleHit && realScheduleTitle) score += 0.6;
  if (csiHit) score += 0.3;
  score += Math.min(codeCount / 8, 1) * 0.35; // density
  if (negative) score *= 0.2; // dampen forms/indexes/notes
  if (isFloorPlan && !realScheduleTitle) score *= 0.3; // it's a plan (where takeoff happens), not the schedule
  score = Math.max(0, Math.min(1, score));

  // best-effort sheet number + title (SHEET_NUM needs 3 digits, so it won't match finish codes)
  const sheetNumber = (U.match(SHEET_NUM) || [])[0] ?? null;
  const m = U.match(/(ROOM\s+)?FINISH\s+(SCHEDULE|LEGEND|MATERIALS|PLAN)/);
  const sheetTitle = m ? m[0].replace(/\s+/g, " ").trim() : null;

  let suggestedSheetType = "other";
  if (score >= 0.45) suggestedSheetType = "finish_schedule";
  else if (/FINISH\s+PLAN/.test(U)) suggestedSheetType = "finish_plan";
  else if (/FLOOR\s+PLAN/.test(U)) suggestedSheetType = "floor_plan";
  else if (/SECTION\s+09|SPECIFICATION|\bSPECS?\b/.test(U)) suggestedSheetType = "specs";

  return {
    pageNumber,
    sheetNumber,
    sheetTitle,
    score: Math.round(score * 100) / 100,
    signals: { titleHit, csiHit, finishCodes: codeCount, negative },
    suggestedSheetType,
  };
}

/** Build a new PDF containing only the given 1-based page numbers (for targeted extraction). */
export async function extractPages(bytes: Buffer, pageNumbers: number[]): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const idxs = [...new Set(pageNumbers)]
    .map((n) => n - 1)
    .filter((i) => i >= 0 && i < src.getPageCount())
    .sort((a, b) => a - b);
  const copied = await out.copyPages(src, idxs);
  copied.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}

/** Render one page to an image (PNG, or lighter JPEG for previews). */
export async function renderPage(
  bytes: Buffer,
  pageNumber: number,
  scale = 1.5,
  mime: "image/png" | "image/jpeg" = "image/png"
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: PDFJS_ERRORS_ONLY,
  }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      return mime === "image/jpeg" ? canvas.toBuffer("image/jpeg", 88) : canvas.toBuffer("image/png");
    } finally {
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
}

/** Extract each page's text and score it. */
export async function scanPdf(bytes: Buffer): Promise<PageScan[]> {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: PDFJS_ERRORS_ONLY,
  }).promise;
  const pages: PageScan[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const tc = await page.getTextContent();
        const text = (tc.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" ");
        pages.push(scorePage(i, text));
      } finally {
        page.cleanup();
      }
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
