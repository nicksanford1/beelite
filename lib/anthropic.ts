import Anthropic from "@anthropic-ai/sdk";
import { FINISH_SCHEDULE_PROMPT } from "./prompts/finish-schedule";

// Recommended default model (best accuracy). Tier down later if cost matters.
export const EXTRACTION_MODEL = "claude-opus-4-8";

// Wide on purpose: the model picks the closest category, and may use unknown_flooring_related / other
// when unsure rather than being forced into a narrow box (then the user decides scope on /finishes).
export type FinishCategory =
  | "resilient" | "rubber" | "lvt_lvp" | "vct" | "carpet" | "tile" | "turf" | "sheet_vinyl"
  | "epoxy" | "polished_concrete" | "sealed_concrete" | "wood" | "laminate"
  | "base" | "transition" | "stair" | "prep" | "moisture_mitigation" | "adhesive" | "accessory"
  | "unknown_flooring_related" | "other";

export type ExtractedFinish = {
  code: string;
  application?: "floor" | "base" | "transition" | "stair" | "accessory" | "other";
  type: string;
  description: string;
  unit: "SF" | "LF" | "EA" | "SY" | "other";
  category: FinishCategory;
  includedInFlooringScope: boolean; // canonical scope flag downstream; model returns "inScope"
  reason: string;
  confidence: number;
  sourcePage?: string; // where in the set it was found (e.g. "A2.4")
  // richer, optional — captured when present, never required
  manufacturer?: string;
  product?: string;
  color?: string;
  size?: string;
  thickness?: string;
  needsReview?: boolean; // model unsure this belongs in flooring scope → user verifies
  sourceText?: string;
  notes?: string;
};

export type FinishAssignment = {
  finishCode: string;
  level?: string;
  roomNumber?: string;
  roomName?: string;
  sourcePage?: string;
  sourceText?: string;
  confidence: number;
  needsReview: boolean;
  notes?: string;
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

function client(timeoutMs = 90_000) {
  // Bounded timeout so a stalled read fails loudly instead of hanging the /finishes button. Long
  // whole-document reads pass a larger ceiling and stream, so they don't trip the default 90s cap.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: timeoutMs, maxRetries: 1 });
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
export type RoleConfidence = "low" | "medium" | "high";
export type PageRole = { sheets: string[]; confidence: RoleConfidence }; // sheets it observed in this role
// Honest page-role observations from the SAME whole-PDF read (Option C) — Claude reports what it saw,
// each with a confidence. Not a separate scan, not page-tagging. Empty/low when it can't tell.
export type PageRoles = { drawingIndex: PageRole; floorPlans: PageRole; specs: PageRole };
// Per-page sheet label read from each page's title block (sheet number + sheet title), in page order.
export type SheetLabel = { page: number; sheet: string; title: string };
export type FinishReadResult = {
  status: ScheduleStatus;
  confidence: number;
  reason: string;
  evidencePages: string[];
  pageRoles?: PageRoles;
  sheetIndex?: SheetLabel[];
  finishes: ExtractedFinish[];
  assignments: FinishAssignment[];
};

// Guarded read — TRIMMED on purpose. One job: detect the flooring finish schedule and return the UNIQUE
// flooring finishes. No per-page sheet index, no page-role classification, no per-room assignment grind —
// that over-reach bloated the JSON until it truncated and silently failed. Asking for less makes the read
// reliable on any plan set (the demo bar) and far less likely to truncate.
const GUARDED_PROMPT = `You are a commercial flooring estimator's assistant reading a FULL construction
plan set (PDF, many pages).

Your ONE job: find the flooring FINISH SCHEDULE / ROOM FINISH SCHEDULE / FINISH LEGEND / finish callouts
and list the UNIQUE flooring finishes — one row per distinct material that would get one price. The finish
schedule is OFTEN a table in the corner of a floor-plan sheet (e.g. "FINISH SCHEDULE - 1ST FLOOR"), not a
separate sheet — look across ALL pages, including tables on the floor plans.

${FINISH_SCHEDULE_PROMPT}

CATEGORY — pick the closest flooring category; if flooring-related but you can't tell which, use
"unknown_flooring_related" and set inScope=false:
  resilient · rubber · lvt_lvp · vct · carpet · tile · turf · sheet_vinyl · epoxy · polished_concrete ·
  sealed_concrete · wood · laminate · base · transition · stair · prep · moisture_mitigation · adhesive ·
  accessory · unknown_flooring_related · other

ONE ROW PER DISTINCT MATERIAL — never one row per room. Deduplicate the same material across every room
and floor. The description should name the MATERIAL and its PRIMARY USE/LOCATION in plain words (e.g.
"Epoxy resin floor — locker rooms & restrooms"; "Wood athletic floor — gymnasium") — summarize the typical
use, do NOT list every room. If the schedule prints a manufacturer or product/spec reference for the
material, include it in the description. application is
floor|base|transition|stair|accessory|other. unit is SF (area), LF (wall base / transitions), EA, SY
(carpet by the yard), or other. Preserve the printed code (e.g. LVT-1, CT-2); if one printed label is used
for two applications, make stable codes like TILE-FLOOR and TILE-BASE — never append a room number.

ROOM ASSIGNMENTS — separately, in "assignments", list WHERE each finish is used: one row per scheduled
room/area, with finishCode (must exactly match a code in finish_definitions), level (the floor, e.g. "1st"
or "2nd"), roomNumber, roomName, and sourcePage (the sheet the schedule is on, e.g. "A-111"). Keep the
materials deduplicated in finish_definitions; the per-room occurrences go here. Set needsReview=true for any
row you're unsure about. If the schedule lists no room detail, return assignments as [].

WHAT TO LIST vs SKIP — this is the most important rule, and the one that makes the count stable across
reads. List ONLY finishes a FLOORING contractor installs: FLOOR materials, WALL BASE, STAIR finishes, and
floor TRANSITIONS / thresholds. A finish-schedule table usually MIXES these with finishes other trades own
— do NOT return a row for any of these (skip them entirely; omitting them is correct, not an omission):
  • PAINT and wall coatings — codes like PT-*, P-*, and "PT-#" callouts in wall/ceiling columns.
  • CEILING finishes — acoustic ceiling panel/tile and gyp ceiling: ACP-*, ACT-*, GYPCP-*, WFCP-*, any *-CP.
  • WALL-ONLY finishes — wall covering, and WALL TILE / wainscot (e.g. CT-* applied "to 7'-4"" up a wall).
Floor tile IS in scope; wall tile is NOT — use the height/column cue (a tile "to 7'-4"" or in a WALL column
is a wall finish). When unsure whether a row is a floor finish, include it with inScope=false rather than
dropping a real floor material — but never include paint/ceiling, which are never flooring.

KEYED SCHEDULES — some sets use a TWO-PART key: a "finish key" mapping each room to a LETTER (A, B, C…),
and a "finish schedule" mapping each letter to the actual materials. When you see this, RESOLVE each room's
letter to the real material codes (room → key "C" → EPX-1) and put the resolved code in finishCode — never
the bare letter. Only record rooms whose finish you can actually read; flag uncertain ones needsReview=true.
When one key cell packs SEVERAL floor materials (e.g. key D = "VCT-1, VCT-2, VCT-3"), return ONE row per
distinct material in finish_definitions — and use the printed code verbatim (don't normalize "SEALED
CONCRETE" to "SEALED-CONC", or merge "WD-1" with a "WD-1/PT-2" border callout — list the floor material once
as WD-1).

WHERE YOU FOUND IT + WHAT'S PRINTED — for EVERY finish, set sourcePage to the sheet number you read it
from (the schedule sheet, or the floor-plan sheet whose callout names it — e.g. "A102", "A6.1"). This is
how the estimator jumps to the source, so it's required even when there's no clean schedule. If the
drawing prints a manufacturer, product/series, or a gauge/wear-layer/thickness for the material, capture
them in manufacturer / product / thickness — but ONLY when actually printed (leave "" otherwise; never
guess a brand — most schedules are code-only and that's expected). Put any short note that changes how the
finish is priced in notes (e.g. "match existing", "salvage & reinstall existing", "demo existing finish
first", "owner-furnished"). Keep notes terse.

finish_schedule_status:
- "found": a clear flooring finish schedule/legend exists and you extracted its finishes.
- "possible": some pages may have flooring info but there is no clean schedule — list them in evidence_pages.
- "not_found": no flooring finish schedule/legend anywhere — return an EMPTY finish_definitions. An empty
  result is the CORRECT answer when none truly exists. NEVER invent finishes from wall sections, assemblies,
  structural details, or general notes.

Set reason to one sentence on what you found (or what was missing). confidence is 0..1.`;

// Structured-output schema — the API guarantees a valid JSON object in this exact shape, so a long read
// can't come back truncated/malformed and get silently mistaken for "no schedule found".
const GUARDED_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    finish_schedule_status: { type: "string", enum: ["found", "possible", "not_found"] },
    confidence: { type: "number" },
    reason: { type: "string" },
    evidence_pages: { type: "array", items: { type: "string" } },
    finish_definitions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          application: { type: "string", enum: ["floor", "base", "transition", "stair", "accessory", "other"] },
          type: { type: "string" },
          description: { type: "string" },
          unit: { type: "string", enum: ["SF", "LF", "EA", "SY", "other"] },
          category: { type: "string" },
          inScope: { type: "boolean" },
          confidence: { type: "number" },
          sourcePage: { type: "string" }, // sheet where this finish was found (e.g. "A102")
          // Optional — captured ONLY when printed on the drawing; "" when absent (never guessed).
          manufacturer: { type: "string" },
          product: { type: "string" },
          thickness: { type: "string" }, // gauge / wear layer when printed (e.g. "0.080" / "20 mil")
          notes: { type: "string" }, // short pricing-relevant note (e.g. "match existing", "salvage & reinstall")
        },
        required: ["code", "application", "type", "description", "unit", "category", "inScope", "confidence", "sourcePage"],
      },
    },
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          finishCode: { type: "string" },
          level: { type: "string" },
          roomNumber: { type: "string" },
          roomName: { type: "string" },
          sourcePage: { type: "string" },
          confidence: { type: "number" },
          needsReview: { type: "boolean" },
        },
        required: ["finishCode", "level", "roomNumber", "roomName", "sourcePage", "confidence", "needsReview"],
      },
    },
  },
  required: ["finish_schedule_status", "confidence", "reason", "evidence_pages", "finish_definitions", "assignments"],
} as const;

// Normalize one model finish into ExtractedFinish: the model returns "inScope"; downstream uses
// "includedInFlooringScope". Keep the richer optional fields when present. Never throw on a bad row.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeExtracted(f: any): ExtractedFinish {
  const scope = typeof f?.inScope === "boolean" ? f.inScope : f?.includedInFlooringScope;
  const opt = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return {
    code: String(f?.code ?? ""),
    application: (["floor", "base", "transition", "stair", "accessory", "other"].includes(f?.application)
      ? f.application
      : f?.category === "base" || f?.category === "transition" || f?.category === "stair"
        ? f.category
        : f?.unit === "SF" || f?.unit === "SY" ? "floor" : "other") as ExtractedFinish["application"],
    type: String(f?.type ?? ""),
    description: String(f?.description ?? ""),
    unit: (["SF", "LF", "EA", "SY", "other"].includes(f?.unit) ? f.unit : "other") as ExtractedFinish["unit"],
    category: (typeof f?.category === "string" && f.category ? f.category : "other") as FinishCategory,
    includedInFlooringScope: typeof scope === "boolean" ? scope : true,
    reason: String(f?.reason ?? ""),
    confidence: typeof f?.confidence === "number" ? f.confidence : 0,
    sourcePage: opt(f?.sourcePage),
    manufacturer: opt(f?.manufacturer),
    product: opt(f?.product),
    color: opt(f?.color),
    size: opt(f?.size),
    thickness: opt(f?.thickness),
    needsReview: typeof f?.needsReview === "boolean" ? f.needsReview : undefined,
    sourceText: opt(f?.sourceText),
    notes: opt(f?.notes),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAssignment(a: any): FinishAssignment {
  const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    finishCode: String(a?.finishCode ?? "").trim(),
    level: opt(a?.level),
    roomNumber: opt(a?.roomNumber),
    roomName: opt(a?.roomName),
    sourcePage: opt(a?.sourcePage),
    sourceText: opt(a?.sourceText),
    confidence: typeof a?.confidence === "number" ? a.confidence : 0,
    needsReview: a?.needsReview === true,
    notes: opt(a?.notes),
  };
}

function uniqueFinishDefinitions(rows: ExtractedFinish[]): ExtractedFinish[] {
  const unique = new Map<string, ExtractedFinish>();
  for (const row of rows) {
    const code = row.code.trim();
    if (!code) continue;
    const previous = unique.get(code);
    if (!previous) {
      unique.set(code, { ...row, code });
      continue;
    }
    // Same priced identity repeated by the model: retain the strongest definition deterministically.
    if (previous.unit === row.unit && previous.application === row.application) {
      if (row.confidence > previous.confidence) unique.set(code, { ...row, code });
      continue;
    }
    // A printed label used for two applications needs two stable pricing keys, never room suffixes.
    const suffix = String(row.application ?? row.unit ?? "other").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    let candidate = `${code}-${suffix}`;
    let n = 2;
    while (unique.has(candidate)) candidate = `${code}-${suffix}-${n++}`;
    unique.set(candidate, { ...row, code: candidate });
  }
  return [...unique.values()];
}

// Parse the page_roles observations, tolerating a missing/partial object. Returns undefined when absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePageRoles(pr: any): PageRoles | undefined {
  if (!pr || typeof pr !== "object") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (r: any): PageRole => ({
    sheets: Array.isArray(r?.sheets) ? r.sheets.map(String).filter(Boolean) : [],
    confidence: ["low", "medium", "high"].includes(r?.confidence) ? r.confidence : "low",
  });
  return { drawingIndex: role(pr.drawingIndex), floorPlans: role(pr.floorPlans), specs: role(pr.specs) };
}

function stripToJson(raw: string): string {
  let body = raw.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const brace = body.indexOf("{");
  if (brace > 0) body = body.slice(brace);
  return body;
}

// $/MTok — standard Anthropic tier pricing (estimate for the cost log; verify against current rates).
// $ per million tokens (input / output). Opus 4.8 is $5/$25 — the old $15/$75 here overstated every
// read's cost ~3x in the logs (the actual per-read finish read is ~$0.20, not ~$0.59).
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-opus-4-8": { in: 5, out: 25 },
};

// Log every Claude call's tokens, time, stop reason and estimated cost — so latency/cost are visible
// in the server logs instead of being a black box (run `npm start` and watch the terminal).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logUsage(label: string, res: any, seconds: number) {
  const u = res?.usage ?? {};
  const inT = u.input_tokens ?? 0;
  const outT = u.output_tokens ?? 0;
  const p = PRICE[res?.model] ?? { in: 0, out: 0 };
  const cost = (inT / 1e6) * p.in + (outT / 1e6) * p.out;
  console.log(`[anthropic] ${label} model=${res?.model} in=${inT} out=${outT} tok ${seconds}s stop=${res?.stop_reason} ~$${cost.toFixed(4)}`);
}

/**
 * Guarded whole-document read: Anthropic fetches the PDF by URL (we never download the big file). Uses
 * structured JSON output so the result is always valid + parseable, streams so long reads don't time out,
 * and THROWS on an empty/unparseable response so the caller records "error" (retryable) — never a silent
 * "not_found". Trimmed to finish definitions only. Defaults to Sonnet (whole-doc is token-heavy).
 */
export async function readFinishesGuarded(pdf: string | Buffer, model = "claude-sonnet-4-6") {
  const started = Date.now();
  // Accept a signed URL (Anthropic fetches it — production path) OR raw PDF bytes (base64-inlined).
  // The bytes path lets us send a focused page SUBSET without uploading — cheaper, tighter first reads.
  const source =
    typeof pdf === "string"
      ? { type: "url", url: pdf }
      : { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") };
  const stream = client(600_000).messages.stream({
    model,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          { type: "document", source },
          { type: "text", text: GUARDED_PROMPT },
        ] as any,
      },
    ],
    // @ts-expect-error output_config is newer than the installed SDK types
    output_config: { format: { type: "json_schema", schema: GUARDED_SCHEMA } },
  });
  const res = await stream.finalMessage();
  logUsage("readFinishesGuarded", res, Math.round((Date.now() - started) / 1000));

  const textBlock = res.content.find((b) => b.type === "text") as { text: string } | undefined;
  if (!textBlock?.text) throw new Error("finish read returned no content");
  // Structured output guarantees valid JSON; if it's truncated/unparseable this throws and the caller
  // records an ERROR (retryable) instead of masking it as "no schedule found".
  const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;

  const statusRaw = String(parsed.finish_schedule_status ?? "").toLowerCase();
  const status: ScheduleStatus = statusRaw === "found" || statusRaw === "possible" ? (statusRaw as ScheduleStatus) : "not_found";
  const result: FinishReadResult = {
    status,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    evidencePages: Array.isArray(parsed.evidence_pages) ? parsed.evidence_pages.map(String) : [],
    finishes: uniqueFinishDefinitions(
      Array.isArray(parsed.finish_definitions) ? parsed.finish_definitions.map(normalizeExtracted) : []
    ),
    assignments: Array.isArray(parsed.assignments)
      ? parsed.assignments.map(normalizeAssignment).filter((a) => a.finishCode)
      : [],
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
};

const PROJECT_INFO_PROMPT = `This is the title / cover sheet of a commercial construction plan set. Using ONLY
what is visible on this one page (the title block), extract the project metadata. Use "" for anything
not shown — NEVER invent. Do NOT extract finishes and do NOT classify pages.

Return ONLY a JSON object, no prose, no markdown fences, shaped exactly:
{"name":"","address":"","owner":"","architect":"","contractor":"","scope":"","useType":"","squareFeet":"","projectNumber":"","issueDate":""}
- name/address/owner/architect/contractor: from the title block. scope: one-line work description.
- useType: occupancy/use group. squareFeet: GSF if printed. projectNumber + issueDate: from the title block.`;

/** Read just the cover/title sheet → structured project metadata (for the upload→confirm flow). */
export async function extractProjectInfo(coverImageB64: string) {
  const started = Date.now();
  const res = await client().messages.create({
    model: "claude-sonnet-4-6", // Sonnet reads the (often dense) cover/info sheet reliably; Haiku came back near-empty and wasn't faster
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
  logUsage("extractProjectInfo", res, Math.round((Date.now() - started) / 1000));
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
