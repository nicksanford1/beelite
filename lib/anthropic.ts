import Anthropic from "@anthropic-ai/sdk";
import { FINISH_SCHEDULE_PROMPT } from "./prompts/finish-schedule";

// Recommended default model (best accuracy). Tier down later if cost matters.
export const EXTRACTION_MODEL = "claude-opus-4-8";

export type ExtractedFinish = {
  code: string;
  type: string;
  description: string;
  unit: "SF" | "LF" | "EA" | "SY" | "other";
  category: "floor" | "base" | "transition" | "wall" | "other";
  includedInFlooringScope: boolean;
  reason: string;
  confidence: number;
  sourcePage?: string; // where in the set it was found (e.g. "A2.4" or "Page 2")
};

// Structured-output JSON schema (no min/max — not supported by structured outputs).
const FINISH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    finishes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          unit: { type: "string", enum: ["SF", "LF", "EA", "SY", "other"] },
          category: { type: "string", enum: ["floor", "base", "transition", "wall", "other"] },
          includedInFlooringScope: { type: "boolean" },
          reason: { type: "string" },
          confidence: { type: "number" },
        },
        required: [
          "code", "type", "description", "unit", "category",
          "includedInFlooringScope", "reason", "confidence",
        ],
      },
    },
  },
  required: ["finishes"],
} as const;

function client() {
  // Bounded timeout so a stalled read fails loudly instead of hanging the /finishes button.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
}

/** Hand the PDF (a finish-schedule page) to Claude; get back structured finishes. */
export async function extractFinishSchedule(pdfBase64: string) {
  const res = await client().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: FINISH_SCHEDULE_PROMPT },
        ],
      },
    ],
    // @ts-expect-error output_config is newer than the installed SDK types
    output_config: { format: { type: "json_schema", schema: FINISH_SCHEMA } },
  });

  const textBlock = res.content.find((b) => b.type === "text") as { text: string } | undefined;
  const parsed = textBlock ? (JSON.parse(textBlock.text) as { finishes: ExtractedFinish[] }) : { finishes: [] };
  return { finishes: parsed.finishes, model: res.model, usage: res.usage };
}

// Pull the JSON object out of a model reply, tolerating ```json fences or stray prose.
function parseFinishes(raw: string): ExtractedFinish[] {
  let body = raw.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) body = fenced[1].trim();
  else {
    const brace = body.indexOf("{");
    if (brace > 0) body = body.slice(brace);
  }
  try {
    const obj = JSON.parse(body) as { finishes?: ExtractedFinish[]; legendEntries?: ExtractedFinish[] };
    return obj.finishes ?? obj.legendEntries ?? [];
  } catch {
    return [];
  }
}

const JSON_SHAPE = `\n\nReturn ONLY a JSON object (no prose, no markdown fences) shaped exactly:
{"finishes":[{"code":"","type":"","description":"","unit":"SF|LF|EA|SY|other","category":"floor|base|transition|wall|other","includedInFlooringScope":true,"reason":"","confidence":0}]}`;

/**
 * Cheap per-page read: hand Claude the tagged pages' small stored artifacts (page image preferred,
 * page text fallback) — NOT the whole PDF. Robust to fenced output. This is the v2 read path.
 */
export async function extractFinishesFromPages(
  pages: Array<{ imageB64?: string | null; text?: string | null }>
) {
  const content: unknown[] = [];
  for (const pg of pages) {
    if (pg.imageB64) {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: pg.imageB64 } });
    } else if (pg.text) {
      content.push({ type: "text", text: `--- PAGE TEXT ---\n${pg.text}` });
    }
  }
  content.push({ type: "text", text: FINISH_SCHEDULE_PROMPT + JSON_SHAPE });

  const res = await client().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 8000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: content as any }],
  });
  const textBlock = res.content.find((b) => b.type === "text") as { text: string } | undefined;
  const finishes = parseFinishes(textBlock?.text ?? "");
  return { finishes, model: res.model, usage: res.usage };
}

export type ScheduleStatus = "found" | "possible" | "not_found";
export type FinishReadResult = {
  status: ScheduleStatus;
  confidence: number;
  reason: string;
  evidencePages: string[];
  finishes: ExtractedFinish[];
};

// Guarded read: the model must PROVE a flooring finish schedule exists before extracting, and must
// return "not_found" (empty) rather than scraping wall sections / assemblies / structural materials.
const GUARDED_PROMPT = `You are a commercial flooring estimator's assistant reading a FULL construction
plan set (PDF, many pages).

STEP 1 — DETECT. Determine whether this set actually contains a flooring FINISH SCHEDULE, ROOM FINISH
SCHEDULE, FINISH LEGEND, FINISH PLAN, or flooring MATERIAL SCHEDULE / flooring specification.

STEP 2 — EXTRACT only if such a schedule/legend/spec exists. For each finish, record the sheet/page it
came from in "sourcePage".

HARD RULES — do not break these:
- Extract a finish ONLY if it is explicitly listed as a floor finish, room finish, finish code, material
  schedule item, or flooring spec. If you cannot point to where it was listed as a flooring finish, DO
  NOT include it.
- NEVER extract construction assemblies, wall sections, structural materials, gypsum board, insulation,
  framing, sheathing, concrete slab, subfloor, roof/wall components, siding, or general building
  materials — UNLESS explicitly listed as a flooring finish item in a finish schedule.
- If there is NO usable flooring finish schedule/legend/spec, return status "not_found" and an EMPTY
  finishes array. An empty result is the CORRECT answer when none exists. Do not invent finishes from
  sections, assemblies, details, or general notes.

STATUS field:
- "found": a clear flooring finish schedule/legend/spec exists; you extracted from it.
- "possible": there are pages that may contain flooring info but no clean schedule. List those pages in
  evidence_pages; finishes may be empty or low-confidence.
- "not_found": no flooring finish schedule/legend/spec anywhere in this set.

${FINISH_SCHEDULE_PROMPT}

Return ONLY a JSON object (no prose, no markdown fences) shaped exactly:
{"finish_schedule_status":"found|possible|not_found","confidence":0.0,"reason":"one sentence","evidence_pages":["A2.4"],"finishes":[{"code":"","type":"","description":"","unit":"SF|LF|EA|SY|other","category":"floor|base|transition|wall|other","includedInFlooringScope":true,"reason":"","confidence":0,"sourcePage":""}]}`;

function stripToJson(raw: string): string {
  let body = raw.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const brace = body.indexOf("{");
  if (brace > 0) body = body.slice(brace);
  return body;
}

/**
 * Guarded whole-document read: Anthropic fetches the PDF by URL (our server never downloads it). Returns
 * a 3-state result (found / possible / not_found) so "no schedule" is an explicit, correct answer — not
 * out-of-scope noise. No page tagging. Defaults to Sonnet (whole-doc is token-heavy).
 */
export async function readFinishesGuarded(pdfUrl: string, model = "claude-sonnet-4-6") {
  const res = await client().messages.create({
    model,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          { type: "document", source: { type: "url", url: pdfUrl } },
          { type: "text", text: GUARDED_PROMPT },
        ] as any,
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text") as { text: string } | undefined;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(stripToJson(textBlock?.text ?? "{}"));
  } catch {
    parsed = {};
  }
  const statusRaw = String(parsed.finish_schedule_status ?? "").toLowerCase();
  const status: ScheduleStatus = statusRaw === "found" || statusRaw === "possible" ? (statusRaw as ScheduleStatus) : "not_found";
  const result: FinishReadResult = {
    status,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    evidencePages: Array.isArray(parsed.evidence_pages) ? parsed.evidence_pages.map(String) : [],
    finishes: Array.isArray(parsed.finishes) ? (parsed.finishes as ExtractedFinish[]) : [],
  };
  return { result, model: res.model, usage: res.usage };
}

export type ProjectInfo = {
  name: string;
  address: string;
  owner: string;
  architect: string;
  contractor: string;
  scope: string;
  useType: string;
  squareFeet: string;
  projectNumber: string;
  issueDate: string;
  finishSheets: string[]; // drawing-index sheet numbers likely holding finishes (hint, verify later)
};

const PROJECT_INFO_PROMPT = `This is the title / cover sheet of a commercial construction plan set. From its
title block and drawing-list index, extract the project metadata. Use "" (or [] ) for anything not shown —
NEVER invent. Return ONLY a JSON object, no prose, no markdown fences, shaped exactly:
{"name":"","address":"","owner":"","architect":"","contractor":"","scope":"","useType":"","squareFeet":"","projectNumber":"","issueDate":"","finishSheets":[]}
- name: the project name. address: full street address. owner/architect/contractor: firm or person.
- scope: one-line description of the work. useType: occupancy/use group. squareFeet: GSF if printed.
- projectNumber + issueDate: from the title block.
- finishSheets: sheet numbers in the drawing index whose titles mention FINISH / FINISH SCHEDULE /
  FINISH PLAN (e.g. ["A2.4"]). [] if none are listed.`;

/** Read just the cover/title sheet → structured project metadata (for the upload→confirm flow). */
export async function extractProjectInfo(coverImageB64: string) {
  const res = await client().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: coverImageB64 } },
          { type: "text", text: PROJECT_INFO_PROMPT },
        ] as any,
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text") as { text: string } | undefined;
  let body = (textBlock?.text ?? "").trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) body = fenced[1].trim();
  else {
    const brace = body.indexOf("{");
    if (brace > 0) body = body.slice(brace);
  }
  let info: Partial<ProjectInfo> = {};
  try {
    info = JSON.parse(body);
  } catch {
    info = {};
  }
  return { info, model: res.model, usage: res.usage };
}
