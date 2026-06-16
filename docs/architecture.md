# Beelite Estimator — Architecture & Build Breakdown

Companion to [`v1-plan.md`](./v1-plan.md). That doc = *what* we build and why.
This doc = *how* it's wired: stack, the Sheet contract, schema, API calls, prompts, storage.

**Guiding principle:** Google Sheets is the **bid engine**; the app is the
**capture / review / sync layer**. The Sheet template drives the product design — so it comes first.

---

## The one end-to-end flow ⭐ (the whole product)

Everything else is detail on these steps. Each row = a user action → what the app does → where it lands.

| # | User action | App does | Lands in |
|---|---|---|---|
| 1 | Create project | Copies the Sheet template (Drive API); saves `sheetId` | new Google Sheet |
| 2 | Upload plan PDF | Stores file; lists its pages | `Document`, `PlanSheet` |
| 3 | Tag the finish-schedule page | Marks `sheetType` | `PlanSheet` |
| 4 | Click "Read schedule" | AI extracts finishes (code/unit/category/inScope/confidence) | `Extraction` (log) |
| 5 | Confirm/edit finishes | Saves finishes + generates default rates | `ProjectFinish`, rates |
| 6 | Enter takeoff quantities (room-level, dropdowns) | Saves rows + status | `TakeoffLine` |
| 7 | Set scope checklist + bid settings | Saves choices | `ProjectScopeItem`, `EstimateSettings` |
| 8 | Click "Sync" | Writes hidden tabs (stable order) | `App_Finishes/Takeoff/Scope/Rates/Settings` |
| 9 | *(automatic)* | Sheet formulas compute | `Estimate`, `Summary` (Bid Total + warnings) |
| 10 | Estimator edits `override` cells in `Rates` | Total updates live; resync keeps overrides | visible `Rates` |

The **"aha"** is steps 8→10: the app fills the bid, the estimator tweaks a rate/quote in the Sheet
they trust, the total moves instantly, and resync never erases their edit.

---

## 0. The AI stack (dev vs product)

| Layer | Tool | Runs where |
|---|---|---|
| Coding assistant | Claude Code + skills/subagents | Dev only — never ships |
| Product AI | **Anthropic API** via `@anthropic-ai/sdk` | In the server |
| Agentic loops | Claude Agent SDK | Not in V1 (V2+, for autonomous multi-sheet takeoff) |

V1 extraction = **one structured (tool-use) API call**, not an agent.

---

## 1. System architecture

```
[Browser — the flooring company]
      │
      ▼
[Next.js app  (repo root)]
   app/            ← UI: capture / review screens
   app/api/        ← server routes
      │      │            │              │
      ▼      ▼            ▼              ▼
 [Postgres] [File store] [Anthropic API] [Google Sheets/Drive API]
  (Supabase) (Supabase     (extraction)    (the bid engine — math lives here)
             storage)
```

The DB holds the app's working data. **The Sheet holds the bid math and the final number.**

---

## 2. Tech stack

- **Framework:** Next.js + TypeScript. **DB:** Postgres via **Supabase** (auth + storage too).
- **ORM:** Prisma. **AI:** `@anthropic-ai/sdk`. **PDF:** `pdfjs-dist` (render pages + text layer).
- **Google:** `googleapis` (Sheets + Drive). **Hosting:** Vercel + Supabase (free tiers cover the demo).

Server-only env: `ANTHROPIC_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `DATABASE_URL`. Never in client code.

---

## 3. The Sheet Template Contract  ⭐ (the heart of V1)

The Sheet is split into **hidden app-owned tabs** (app writes, humans never touch) and
**visible human-facing tabs** (formulas pull from the hidden tabs; humans edit overrides).

> Full, build-ready version with every formula lives in [`../claude/sheet-template.md`](../claude/sheet-template.md).

### Hidden, app-owned tabs (`App_*`) — app overwrites freely
| Tab | Columns the app writes |
|---|---|
| `App_Finishes` | code, type, description, unit, category, inScope |
| `App_Takeoff` | sheet, area, finishCode, qty, unit, status |
| `App_Scope` | label, mode, allowance |
| `App_Rates` | code, materialCost, installMode, installAmount, wastePct, cartonSize, furnishType |
| `App_Settings` | projectName, gc, location, bidDate, pricingMode, pct, subMarkupPct, taxPct, taxMode, freight, notes |

### Visible tabs — formulas only; humans may edit override columns
| Tab | Pulls from | Computes / holds |
|---|---|---|
| `Summary` | others | project meta + Bid Total + **warnings** (pending subs, missing/duplicate/unknown codes, needs-review) |
| `Estimate` | `App_Finishes`, `App_Takeoff`, `Rates` | order qty (`=qty*(1+waste)`), carton round (`=CEILING`), material/sub-install/line totals, split markup (`pct`/`subMarkupPct`), tax (`taxMode`), Bid Total. Turnkey → material $0 |
| `Rates` | `App_Rates` | per field: **default** (from `App_Rates`) · **override** (estimator) · **effective** (override if set, else default). `Estimate` reads *effective* |
| `Assumptions` | `App_Scope` | auto-drafted lines (col A) + manual notes (col C, estimator-editable) |

### The contract rules
- **App MAY** overwrite any `App_*` tab on every sync; it writes `App_Rates` rows in a **stable
  order and never reorders/deletes them**, so visible `Rates` override cells stay aligned.
- **App MUST NEVER** write to visible tabs or to human override/notes columns.
- **Math lives in the Sheet** (visible `Estimate` + `Rates`), not the app. One source of truth → no drift.
- Estimator edits rates/overrides in the Sheet; the app does **not** read those back in V1.

### Named ranges the app targets
`app_finishes`, `app_takeoff`, `app_scope`, `app_rates`, `app_settings` — all on hidden tabs.
Variable-row tabs auto-extend their formula columns (or the app inserts rows and copies formulas down).

### Sync model
One-way, app → Sheet. On project create: copy the template (`drive.files.copy`).
On each step: `spreadsheets.values.batchUpdate` writes the `App_*` ranges. No read-back in V1.

---

## 4. Database schema

The DB stores **inputs and review state** — *not* computed bid totals (those live in the Sheet).
Two tiers (company / project) + the **`Extraction` correction log** that powers training later.

```prisma
// ── Company / reusable ───────────────────────────────
model Company {
  id        String @id @default(cuid())
  name      String
  users     User[]
  finishes  FinishLibraryItem[]
  rates     RateCatalogEntry[]
  scopeTpl  ScopeTemplateItem[]
  projects  Project[]
}

model FinishLibraryItem {
  id          String @id @default(cuid())
  companyId   String
  code        String      // "LVT-1"
  type        String
  description String
  unit        String      // SF | LF | EA | SY
  category    String      // floor | base | transition | wall | other
  rate        RateCatalogEntry?
  @@unique([companyId, code])
}

model RateCatalogEntry {
  id            String @id @default(cuid())
  companyId     String
  finishId      String @unique
  materialCost  Float
  installAmount Float?       // $/unit if unit_rate; lump sum if sub_quote/turnkey
  installMode   String      // unit_rate | sub_quote | pending
  wastePct      Float
  cartonSize    Float?
  furnishType   String @default("furnish_and_sub")  // furnish_and_sub | turnkey_sub
  adhesiveRule  String?
}

model ScopeTemplateItem {
  id          String @id @default(cuid())
  companyId   String
  label       String
  defaultMode String      // included | excluded | pending
}

// ── Project / per bid ────────────────────────────────
model Project {
  id         String @id @default(cuid())
  companyId  String
  name       String
  bidDate    DateTime?
  gc         String?
  location   String?
  notes      String?
  status     String  @default("draft")   // label only
  sheetId    String?                      // Google Sheet id (after template copy)
  documents  Document[]
  finishes   ProjectFinish[]
  scopeItems ProjectScopeItem[]
  takeoff    TakeoffLine[]
  settings   EstimateSettings?
}

model Document {                    // one uploaded PDF...
  id        String @id @default(cuid())
  projectId String
  fileUrl   String
  pages     PlanSheet[]            // ...with many sheets/pages inside
}

model PlanSheet {                  // page-level tagging (PDF can be 100 pages)
  id          String @id @default(cuid())
  documentId  String
  pageNumber  Int
  sheetNumber String?             // "A601"
  sheetTitle  String?             // "FINISH SCHEDULE"
  sheetType   String              // finish_schedule | finish_plan | floor_plan | specs | other
  extraction  Extraction?
}

model ProjectFinish {             // copied from library, overrideable; seeds Sheet
  id          String @id @default(cuid())
  projectId   String
  code        String
  type        String
  description String
  unit        String
  category    String
  inScope     Boolean @default(true)
  materialCost Float
  installAmount Float?
  installMode  String
  wastePct     Float
  cartonSize   Float?
  furnishType  String @default("furnish_and_sub")
}

model ProjectScopeItem {
  id        String @id @default(cuid())
  projectId String
  label     String
  mode      String        // included | excluded | pending
  allowance Float?
}

model TakeoffLine {               // room-level — rolls up by finish
  id         String @id @default(cuid())
  projectId  String
  sheet      String?
  area       String
  finishCode String
  qty        Float
  unit       String
  source     String        // manual | ai (V2)
  status     String        // draft | needs_review | approved | excluded
}

model EstimateSettings {          // inputs only; the Sheet computes the bid
  id           String @id @default(cuid())
  projectId    String @unique
  pricingMode  String      // markup | margin
  pct          Float       // material markup/margin
  subMarkupPct Float       // subbed-labor markup (default = pct)
  taxPct       Float?
  taxMode      String @default("total_sell_plus_freight") // material_cost_only | material_sell_only | total_sell_plus_freight
  freight      Float?
}

// ── Correction log (build day 1) ─────────────────────
model Extraction {
  id          String @id @default(cuid())
  planSheetId String @unique
  model       String      // "claude-sonnet-4-6"
  rawOutput   Json        // what the model returned
  corrected   Json?       // what the human confirmed/fixed
  confidence  Json
  createdAt   DateTime @default(now())
}
```

Note there's **no `EstimateLine` with stored totals** — material/install/line/bid totals are
**Sheet formulas**, not DB columns. The DB stores inputs (`TakeoffLine`, `ProjectFinish`,
`EstimateSettings`); the Sheet does the arithmetic.

---

## 5. The extraction pipeline (API calls + prompts)

**Flow (Option C):**
```
1. user clicks "Read schedule" on a PlanSheet tagged finish_schedule
2. server loads the PDF, renders that page → PNG, and pulls its text layer
3. send {image + text} to Claude with a tool/JSON schema → structured rows
4. (optional) verification pass: "here's the image + your rows — check each"
5. save Extraction (rawOutput + confidence)
6. return rows → user confirms (incl. in-scope) → ProjectFinishes
7. on confirm, write Extraction.corrected (the training signal)
8. sync confirmed in-scope finishes → App_Finishes tab
```

**The call (`lib/anthropic.ts`):**
```ts
const res = await anthropic.messages.create({
  model: "claude-sonnet-4-6",          // escalate to opus-4-8 on low confidence
  max_tokens: 2000,
  tools: [{ name: "finish_schedule", input_schema: SCHEMA }],
  tool_choice: { type: "tool", name: "finish_schedule" },
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: png } },
      { type: "text", text: PROMPT + "\n\nExtracted text layer:\n" + textLayer },
    ],
  }],
});
const rows = res.content.find(c => c.type === "tool_use").input.finishes;
```

**The JSON schema (`SCHEMA`):**
```json
{
  "type": "object",
  "properties": {
    "finishes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code":        { "type": "string" },
          "type":        { "type": "string" },
          "description": { "type": "string" },
          "unit":        { "type": "string", "enum": ["SF","LF","EA","SY"] },
          "category":    { "type": "string", "enum": ["floor","base","transition","wall","other"] },
          "includedInFlooringScope": { "type": "boolean" },
          "reason":      { "type": "string" },
          "confidence":  { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["code","type","category","includedInFlooringScope","confidence"]
      }
    }
  },
  "required": ["finishes"]
}
```

**The prompt (`lib/prompts/finish-schedule.ts`):**
```
You are reading a commercial finish schedule from an architectural drawing.
Extract EVERY row, including non-flooring items (paint, wall finishes, ceilings).

Rules:
- Extract only what is on the page. Never invent rows, and NEVER guess prices —
  this schedule contains no costs.
- `code` is the abbreviation (LVT-1, CPT-1, RB-1, PT-2…).
- `category`: floor | base | transition | wall | other.
- `includedInFlooringScope`: true for floor/base/transition; false for wall/ceiling/paint/other.
  Put your one-line rationale in `reason`.
- `unit`: SF for area, LF for base/transitions, EA for items like stair treads.
- If a row is ambiguous/hard to read, still return it but lower `confidence`.
- Use the text layer for exact characters; use the image for layout.
```

Store `model` on every Extraction so you can later compare models against ground truth.

---

## 6. Screens (mapped to routes)

| # | Screen | Route | Pulls | Writes |
|---|---|---|---|---|
| 1 | Projects | `/` | Projects | — |
| 2 | Project setup | `/projects/[id]` | Project | Project + **copy Sheet template** |
| 3 | Documents | `…/documents` | PlanSheets | Document, PlanSheet + storage |
| 4 | Scope | `…/scope` | ScopeTemplate | ProjectScopeItem |
| 5 | Finish items | `…/finishes` | Anthropic + Catalog | ProjectFinish, Extraction |
| 6 | Takeoff | `…/takeoff` | ProjectFinishes | TakeoffLine |
| 7 | Sync / preview | `…/sync` | everything | **App_\* tabs in the Sheet** |
| 8 | Catalog | `/catalog` | Company catalog | Library/Rates/Scope |

No in-app estimate calculator — the estimate is the `Estimate` tab in the Sheet.

---

## 7. The flywheel → "training" (when & how)

Ladder, cheapest first — most products never pass step 3:
1. **Prompting** — free, biggest early wins.
2. **Few-shot** — inject 2–3 `Extraction.corrected` examples into the prompt. No training.
3. **Eval set** — run prompt/model against 50 corrected extractions; measure accuracy; compare models.
4. **Fine-tune** — only if a repeated failure survives 1–3 *and* you have lots of data.
   Export corrections → JSONL → fine-tune job → custom model id → swap the `model:` string.

The `Extraction` table is the asset. Build it day 1; defer fine-tuning indefinitely.

---

## 8. Build order (Sheets-first)

1. **Google Sheet template** — visible tabs + formulas (Estimate, Rates, Summary, Assumptions).
2. **Hidden `App_*` tabs + named ranges** — the Sheet Template Contract (§3).
3. App skeleton + Supabase (DB/storage/auth) + Prisma schema (§4).
4. Projects + Documents with **page-level (PlanSheet) tagging**.
5. **Extraction pipeline** (§5) + Extraction correction log.
6. **Sync extracted finishes → `App_Finishes`** (proves the Sheet round-trip).
7. Room-level takeoff + status + roll-up → `App_Takeoff`.
8. Scope checklist → `App_Scope` + auto-drafted Assumptions.
9. Polish sync/preview + Rates seeding.

Demo-critical path = 1 → 2 → 4 → 5 → 6: "upload → AI reads it → it lands in their Google Sheet."
