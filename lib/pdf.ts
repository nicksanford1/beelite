import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PageScan = {
  pageNumber: number;
  sheetNumber: string | null;
  sheetTitle: string | null;
  score: number; // 0..1 finish-schedule likelihood
  signals: Record<string, unknown>;
  suggestedSheetType: string; // finish_schedule | finish_plan | floor_plan | specs | other
};

const FINISH_CODE = /\b(?:LVT|CPT|VCT|CT|RB|PT|RES|SC|WB|EPX|PC|VWC|WD|QT)-?\d\b/gi;
const SHEET_NUM = /\b([A-Z]{1,2}-?\d{3}(?:\.\d+)?)\b/g; // A-601, A601, FS-101…

/** Score one page's text for "is this a finish schedule?" */
export function scorePage(pageNumber: number, text: string): PageScan {
  const U = text.toUpperCase();

  const titleHit = /FINISH\s+(SCHEDULE|LEGEND|MATERIAL|PLAN)/.test(U) || /ROOM\s+FINISH/.test(U);
  const csiHit = /\b09\s?06\s?00\b/.test(U) || /SCHEDULE\s+FOR\s+FINISHES/.test(U);
  const codeCount = (text.match(FINISH_CODE) || []).length;

  // negative signals — pages that have finish-ish words but aren't the schedule
  const negative =
    /COVER\s+SHEET|SHEET\s+INDEX|DRAWING\s+INDEX|TABLE\s+OF\s+CONTENTS|TITLE\s+SHEET|BID\s+FORM|PROPOSAL\s+FORM|INSTRUCTIONS?\s+TO\s+BIDDERS|PREVAILING\s+WAGE|PAYROLL/.test(U);

  let score = 0;
  if (titleHit && /FINISH\s+(SCHEDULE|LEGEND|MATERIAL)/.test(U)) score += 0.6;
  if (csiHit) score += 0.3;
  score += Math.min(codeCount / 8, 1) * 0.35; // density
  if (negative) score *= 0.2; // dampen forms/indexes
  score = Math.max(0, Math.min(1, score));

  // best-effort sheet number + title
  const sheetNumber = (U.match(SHEET_NUM) || []).find((s) => !FINISH_CODE.test(s)) ?? null;
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

/** Extract each page's text and score it. */
export async function scanPdf(bytes: Buffer): Promise<PageScan[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages: PageScan[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = (tc.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" ");
    pages.push(scorePage(i, text));
  }
  return pages;
}
