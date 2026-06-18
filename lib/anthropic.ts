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
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
