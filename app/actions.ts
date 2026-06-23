"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan, downloadPlan, deletePlanPrefix } from "@/lib/storage";
import { extractFinishSchedule, extractFinishesFromPages, extractProjectInfo, type ExtractedFinish, type FinishAssignment, type ProjectInfo } from "@/lib/anthropic";
import { scanPdf, extractPages, renderPage } from "@/lib/pdf";
import { readPageArtifact, ingestDocument } from "@/lib/ingest";
import { markFinishReadProcessing } from "@/lib/finish-read";
import { getAuthedClient } from "@/lib/google";
import { createBidSpreadsheet, updateBidData, readEngineVersion, isCurrentEngine } from "@/lib/sheet-builder";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
};

type RateFields = {
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

// Single source of truth for rate hygiene (Codex lib #2): never negative; owner-furnished material → 0.
function normalizeRate<T extends RateFields>(r: T): T {
  const owner = r.materialSource === "owner_furnishes";
  const nn = (n: number) => Math.max(0, Number(n) || 0);
  return {
    ...r,
    materialSource: owner ? "owner_furnishes" : "elite_furnishes",
    materialUnitCost: owner ? 0 : nn(r.materialUnitCost),
    installRate: nn(r.installRate),
    wastePct: nn(r.wastePct),
    cartonSize: r.cartonSize == null ? null : nn(r.cartonSize),
  };
}

// Effective needs-rate predicate — must match lib/estimate.ts (Codex lib #1). Only complete rates publish.
function rateIsComplete(r: RateFields): boolean {
  return r.materialSource === "owner_furnishes"
    ? r.installRate > 0
    : r.materialUnitCost > 0 && r.installRate > 0;
}

export async function createProject(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return; // name is required; the form enforces it too

  const company = await getOrCreateDefaultCompany();
  const bidDateRaw = str(formData.get("bidDate"));

  await db.project.create({
    data: {
      companyId: company.id,
      name,
      gc: str(formData.get("gc")),
      location: str(formData.get("location")),
      bidDate: bidDateRaw ? new Date(bidDateRaw) : null,
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/");
  redirect("/");
}

// Upload-first intake: the file is posted to this server action, which stores it, reads the cover for
// project details, and creates the document. The cover read overlaps the upload so the review screen
// fills in quickly. (Server-side upload works fine here; only Vercel's ~4.5MB serverless body limit
// would need a browser-direct upload — revisit that at deploy time.)
export async function analyzeUpload(formData: FormData): Promise<{
  projectId?: string;
  documentId?: string;
  error?: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose a PDF." };
  const bytes = Buffer.from(await file.arrayBuffer());

  // Fast path: create the project, store the file, create the document — then return immediately so the
  // review form appears with its (blank) fields. The cover read runs as a SEPARATE call
  // (readProjectDetails) that streams the details in; the slow finish read is fired by the wizard too.
  const company = await getOrCreateDefaultCompany();
  const project = await db.project.create({
    data: { companyId: company.id, name: file.name.replace(/\.pdf$/i, "") },
  });
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${project.id}/${Date.now()}-${safeName}`;
  await uploadPlan(path, bytes, file.type || "application/pdf");
  const doc = await db.document.create({ data: { projectId: project.id, fileUrl: path, originalFilename: file.name } });

  return { projectId: project.id, documentId: doc.id };
}

// Second call: read the cover sheet and fill in the project details. Kept separate from analyzeUpload so
// the review form shows instantly (blank) and these stream in ~a couple seconds later. Uses Haiku — a
// cover-sheet extraction is simple, and speed is the point here.
export async function readProjectDetails(documentId: string): Promise<{ info?: Partial<ProjectInfo>; error?: string }> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Upload not found." };
  try {
    const bytes = await downloadPlan(doc.fileUrl);
    const cover = await renderPage(bytes, 1, 1.8, "image/jpeg");
    const { info } = await extractProjectInfo(cover.toString("base64"));
    await db.project.update({
      where: { id: doc.projectId },
      data: {
        name: info.name || undefined,
        gc: info.contractor || null,
        location: info.address || null,
        projectType: info.useType || null,
        owner: info.owner || null,
        architect: info.architect || null,
        squareFeet: info.squareFeet || null,
        projectNumber: info.projectNumber || null,
        issueDate: info.issueDate || null,
        notes: info.scope || null,
      },
    });
    return { info };
  } catch (e) {
    console.error("[readProjectDetails] cover read failed:", e);
    return { error: "Couldn't read the cover sheet — fill the details in manually." };
  }
}

// Save the user's confirmed/edited project details, then go to the project.
export async function confirmProject(projectId: string, formData: FormData) {
  const bidDateRaw = str(formData.get("bidDate"));
  await db.project.update({
    where: { id: projectId },
    data: {
      name: str(formData.get("name")) ?? "Untitled bid",
      gc: str(formData.get("gc")),
      location: str(formData.get("location")),
      projectType: str(formData.get("projectType")),
      architect: str(formData.get("architect")),
      estimator: str(formData.get("estimator")),
      bidDate: bidDateRaw ? new Date(bidDateRaw) : null,
      notes: str(formData.get("notes")),
    },
  });

  // The Google Sheet is created in the BACKGROUND so this redirect is instant: the Overview mounts a
  // SheetSyncRunner that fires /api/sync once if the project has no sheet yet. syncBidToSheet is
  // idempotent + best-effort, so a missed/duplicate fire is harmless. The finish read was already
  // kicked off at upload time; the workspace's FinishReadRunner polls for its result.
  revalidatePath("/");
  redirect(`/projects/${projectId}?focus=finishes`);
}

// Save a manually-entered sheet number + title for a plan page (the Plans list is editable so the
// estimator can fill in labels the AI read left blank).
export async function savePlanLabel(planSheetId: string, sheet: string, title: string) {
  await db.planSheet.update({
    where: { id: planSheetId },
    data: { sheetNumber: sheet.trim() || null, sheetTitle: title.trim() || null },
  });
}

export async function uploadDocument(projectId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${Date.now()}-${safeName}`;
  await uploadPlan(path, bytes, file.type || "application/pdf");

  const doc = await db.document.create({ data: { projectId, fileUrl: path, originalFilename: file.name } });

  // Ingest every page → per-page text + page image (no scanner, no guessing). Reuses the bytes we
  // already have so it doesn't re-download. This is what makes the uploaded plan readable.
  try {
    await ingestDocument(doc.id, { bytes });
  } catch (e) {
    console.error("ingest failed:", e);
  }

  revalidatePath(`/projects/${projectId}`);
}

// Save the human-confirmed page tags from the Pages screen. Stays on the page.
export async function saveSheetTags(projectId: string, tags: { id: string; sheetType: string }[]) {
  await Promise.all(
    tags.map((t) => db.planSheet.update({ where: { id: t.id }, data: { sheetType: t.sheetType } }))
  );
  revalidatePath(`/projects/${projectId}/pages`);
  revalidatePath(`/projects/${projectId}`);
}

// Read finishes from ONLY the pages tagged finish_schedule, using each page's small stored artifact
// (image preferred, text fallback) — never the whole PDF. Fails loudly to /finishes?err=… instead of
// hanging or silently resetting; a zero-finish read is saved as an explicit empty extraction.
export async function readSchedule(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { pages: true } });
  if (!doc) return;
  const projectId = doc.projectId;

  const schedulePages = doc.pages
    .filter((p) => p.sheetType === "finish_schedule")
    .sort((a, b) => a.pageNumber - b.pageNumber);
  if (!schedulePages.length) redirect(`/projects/${projectId}/finishes?err=untagged`);

  const pageNums = schedulePages.map((p) => p.pageNumber);
  let errCode: string | null = null;

  try {
    const pageInputs = await Promise.all(
      schedulePages.map(async (pg) => {
        const art = readPageArtifact(pg.scanSignals);
        let imageB64: string | null = null;
        if (art?.imagePath) {
          try {
            imageB64 = (await downloadPlan(art.imagePath)).toString("base64");
          } catch {
            imageB64 = null;
          }
        }
        return { imageB64, text: art?.text ?? null };
      })
    );

    if (!pageInputs.some((p) => p.imageB64 || p.text)) {
      errCode = "not_ingested"; // tagged pages haven't been ingested into per-page artifacts yet
    } else {
      const { finishes, model } = await extractFinishesFromPages(pageInputs);
      // exactly ONE extraction per document, on the primary (lowest-page) tagged sheet.
      // Saved even when finishes is empty → an explicit "read ran, found nothing" result.
      const primary = schedulePages[0];
      await db.extraction.deleteMany({ where: { planSheet: { documentId, id: { not: primary.id } } } });
      const confidence = finishes.map((f) => ({ code: f.code, confidence: f.confidence }));
      await db.extraction.upsert({
        where: { planSheetId: primary.id },
        create: { planSheetId: primary.id, model, rawOutput: { finishes, sourcePages: pageNums }, confidence },
        update: { model, rawOutput: { finishes, sourcePages: pageNums }, confidence, corrected: undefined },
      });
    }
  } catch (e) {
    console.error("[readSchedule] failed:", e);
    errCode = "read_failed";
  }

  if (errCode) redirect(`/projects/${projectId}/finishes?err=${errCode}`);
  revalidatePath(`/projects/${projectId}/finishes`);
  redirect(`/projects/${projectId}/finishes`);
}

// Mark a bid as passed / not-a-fit (e.g. no finish schedule, no flooring scope). Keeps the record +
// the reason rather than deleting, so it informs lead triage.
export async function passProject(projectId: string, formData: FormData) {
  const reason = str(formData.get("reason")) ?? "Not a fit";
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { notes: true } });
  await db.project.update({
    where: { id: projectId },
    data: { status: "passed", notes: [`Passed: ${reason}`, proj?.notes].filter(Boolean).join(" · ") },
  });
  revalidatePath("/");
  redirect("/");
}

// ── Whole-PDF guarded finish read ────────────────────────────
// The read itself (markFinishReadProcessing + runGuardedRead) lives in lib/finish-read.ts so the
// maxDuration API route can run it as its own request. Manual "Read Finishes" / "Re-read" buttons mark
// the read "processing" and land on /finishes; the page's FinishReadRunner kicks the route and polls.
export async function readWholeDoc(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { projectId: true } });
  if (!doc) return;
  await markFinishReadProcessing(documentId);
  revalidatePath(`/projects/${doc.projectId}/finishes`);
  revalidatePath(`/projects/${doc.projectId}`);
  redirect(`/projects/${doc.projectId}/finishes`);
}

/** Rescan an existing document's pages (recovery if upload-time scan failed/changed). Resets tags. */
export async function rescanDocument(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  const bytes = await downloadPlan(doc.fileUrl);
  const scans = await scanPdf(bytes);
  await db.planSheet.deleteMany({ where: { documentId } }); // cascades extractions
  if (scans.length) {
    await db.planSheet.createMany({
      data: scans.map((s) => ({
        documentId, pageNumber: s.pageNumber, sheetNumber: s.sheetNumber, sheetTitle: s.sheetTitle,
        suggestedSheetType: s.suggestedSheetType, scanScore: s.score, scanSignals: s.signals as object,
      })),
    });
  }
  revalidatePath(`/projects/${doc.projectId}/pages`);
  revalidatePath(`/projects/${doc.projectId}`);
}

// Confirm/correct the reviewed finishes → save ProjectFinish + log the correction on the EXACT extraction.
// Seeds each finish's rate from the company library (exact code match) → "the ceiling"; no match = needs_rate.
export async function confirmFinishes(
  projectId: string,
  planSheetId: string,
  finishes: ExtractedFinish[],
  assignments: FinishAssignment[]
) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
  const lib = project
    ? await db.finishLibraryItem.findMany({ where: { companyId: project.companyId }, include: { rate: true } })
    : [];
  const libByCode = new Map(lib.map((l) => [l.code, l]));

  // Canonicalize before any write. Compatible duplicates collapse; conflicting applications receive
  // an application suffix. This is a safety net for malformed model output and edited review rows.
  const unique = new Map<string, ExtractedFinish>();
  for (const raw of finishes) {
    let code = raw.code.trim();
    if (!code) continue;
    const previous = unique.get(code);
    if (previous && (previous.unit !== raw.unit || previous.application !== raw.application)) {
      const suffix = String(raw.application ?? raw.unit ?? "other").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      code = `${code}-${suffix}`;
    }
    const current = unique.get(code);
    if (!current || raw.confidence > current.confidence) unique.set(code, { ...raw, code });
  }
  const definitions = [...unique.values()];
  const codes = definitions.map((f) => f.code);

  await db.$transaction(async (tx) => {
    await tx.extraction.update({ where: { planSheetId }, data: { corrected: { finishes: definitions, assignments } } });
    await tx.finishAssignment.deleteMany({ where: { projectId } });
    await tx.projectFinish.deleteMany({
      where: { projectId, code: { notIn: codes.length ? codes : ["__none__"] } },
    });

    const finishIds = new Map<string, string>();
    for (const f of definitions) {
      const desc = {
        type: f.type,
        description: f.description ?? "",
        unit: f.unit,
        category: f.category,
        application: f.application ?? "other",
        inScope: f.includedInFlooringScope,
      };
      const library = libByCode.get(f.code);
      const rate = library?.rate;
      const seed = rate
        ? {
            materialUnitCost: rate.materialUnitCost,
            installRate: rate.installRate,
            wastePct: rate.wastePct,
            cartonSize: rate.cartonSize,
            materialSource: rate.materialSource,
            rateStatus: "seeded",
            libraryItemId: library!.id,
          }
        : { rateStatus: "needs_rate" };
      const saved = await tx.projectFinish.upsert({
        where: { projectId_code: { projectId, code: f.code } },
        create: { projectId, code: f.code, ...desc, ...seed },
        update: desc,
      });
      finishIds.set(f.code, saved.id);
    }

    const assignmentRows = assignments.flatMap((a) => {
      const finishId = finishIds.get(a.finishCode);
      return finishId
        ? [{
            projectId,
            finishId,
            level: a.level ?? null,
            roomNumber: a.roomNumber ?? null,
            roomName: a.roomName ?? null,
            sourceSheet: a.sourcePage ?? null,
            sourceText: a.sourceText ?? null,
            confidence: a.confidence,
            needsReview: a.needsReview,
            notes: a.notes ?? null,
          }]
        : [];
    });
    if (assignmentRows.length) await tx.finishAssignment.createMany({ data: assignmentRows });
  });

  await syncBidToSheet(projectId);
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?focus=pricing`);
}

type RateInput = {
  id: string;
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

export async function saveRates(projectId: string, rates: RateInput[], toLibrary = false) {
  await Promise.all(
    rates.map((r) => {
      const { materialUnitCost, installRate, wastePct, cartonSize, materialSource } = normalizeRate(r);
      return db.projectFinish.update({
        where: { id: r.id },
        data: { materialUnitCost, installRate, wastePct, cartonSize, materialSource, rateStatus: "manual" },
      });
    })
  );
  if (toLibrary) await pushBidRatesToLibrary(projectId); // "learn" — copy these into the company standard rates
  revalidatePath(`/projects/${projectId}/estimate`);
  redirect(`/projects/${projectId}/estimate`);
}

// ── Company rate library (the "standard rates" that seed every new bid) ───────
// Internal: copy a bid's priced, in-scope finishes into the company library (upsert by code).
async function pushBidRatesToLibrary(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { finishes: { where: { inScope: true } } },
  });
  if (!project) return;
  for (const f of project.finishes) {
    const rate = normalizeRate(f);
    if (!rateIsComplete(rate)) continue; // only publish finishes with a usable effective rate (Codex lib #1)
    const item = await db.finishLibraryItem.upsert({
      where: { companyId_code: { companyId: project.companyId, code: f.code } },
      create: { companyId: project.companyId, code: f.code, type: f.type, description: f.description, unit: f.unit, category: f.category },
      update: { type: f.type, description: f.description, unit: f.unit, category: f.category },
    });
    await db.rateCatalogEntry.upsert({
      where: { finishId: item.id },
      create: { companyId: project.companyId, finishId: item.id, materialUnitCost: rate.materialUnitCost, installRate: rate.installRate, wastePct: rate.wastePct, cartonSize: rate.cartonSize, materialSource: rate.materialSource },
      update: { materialUnitCost: rate.materialUnitCost, installRate: rate.installRate, wastePct: rate.wastePct, cartonSize: rate.cartonSize, materialSource: rate.materialSource },
    });
  }
}

type LibraryRow = {
  code: string;
  type: string;
  description: string;
  unit: string;
  category: string;
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

// Direct edit of the standard-rates library from /library. Validates, then delete+upserts atomically.
export async function saveLibrary(rows: LibraryRow[]): Promise<{ error: string } | void> {
  const company = await getOrCreateDefaultCompany();

  // Normalize + validate up front (Codex lib #2, #3): trim codes, drop blanks, reject duplicate codes.
  const clean = rows
    .map((r) => ({ ...normalizeRate(r), code: r.code.trim(), type: r.type.trim(), description: r.description.trim(), unit: r.unit, category: r.category }))
    .filter((r) => r.code);
  const dupes = clean.map((r) => r.code).filter((c, i, a) => a.indexOf(c) !== i);
  if (dupes.length) return { error: `Duplicate finish code(s): ${[...new Set(dupes)].join(", ")}` };

  const codes = clean.map((r) => r.code);
  // Atomic full-replace so a mid-write failure can't leave the library half-deleted (Codex lib #3).
  await db.$transaction(async (tx) => {
    await tx.finishLibraryItem.deleteMany({
      where: { companyId: company.id, code: { notIn: codes.length ? codes : ["__none__"] } },
    });
    for (const r of clean) {
      const item = await tx.finishLibraryItem.upsert({
        where: { companyId_code: { companyId: company.id, code: r.code } },
        create: { companyId: company.id, code: r.code, type: r.type, description: r.description, unit: r.unit, category: r.category },
        update: { type: r.type, description: r.description, unit: r.unit, category: r.category },
      });
      await tx.rateCatalogEntry.upsert({
        where: { finishId: item.id },
        create: { companyId: company.id, finishId: item.id, materialUnitCost: r.materialUnitCost, installRate: r.installRate, wastePct: r.wastePct, cartonSize: r.cartonSize, materialSource: r.materialSource },
        update: { materialUnitCost: r.materialUnitCost, installRate: r.installRate, wastePct: r.wastePct, cartonSize: r.cartonSize, materialSource: r.materialSource },
      });
    }
  });
  revalidatePath("/library");
  redirect("/library");
}

type TakeoffInput = {
  sheet: string | null;
  area: string;
  finishCode: string;
  qty: number;
  unit: string;
  status: string;
};

export async function replaceTakeoff(projectId: string, rows: TakeoffInput[]) {
  await db.takeoffLine.deleteMany({ where: { projectId } });
  if (rows.length) {
    await db.takeoffLine.createMany({
      data: rows
        .filter((r) => r.finishCode && r.qty > 0)
        .map((r) => ({
          projectId,
          sheet: r.sheet,
          area: r.area || "—",
          finishCode: r.finishCode,
          qty: r.qty,
          unit: r.unit,
          status: r.status || "approved",
        })),
    });
  }
  revalidatePath(`/projects/${projectId}/estimate`);
  redirect(`/projects/${projectId}/estimate`);
}

// ── Merged rate + total takeoff (the single-scroll Pricing block) ─────────────
// One row per in-scope finish carries BOTH its rate AND its one total quantity. We write the rate
// fields onto the finish and collapse takeoff to a single approved line per finish (area "—"), which
// is all computeBid reads (estimate.ts: sum approved qty per code). No redirect — the scroll workspace
// saves in place and revalidates so the live bid + line costs refresh under the editor.
type PricingInput = RateFields & { id: string; code: string; unit: string; totalQty: number };

export async function savePricing(projectId: string, rows: PricingInput[], toLibrary = false) {
  await Promise.all(
    rows.map((r) => {
      const { materialUnitCost, installRate, wastePct, cartonSize, materialSource } = normalizeRate(r);
      return db.projectFinish.update({
        where: { id: r.id },
        data: { materialUnitCost, installRate, wastePct, cartonSize, materialSource, rateStatus: "manual" },
      });
    })
  );

  await db.takeoffLine.deleteMany({ where: { projectId } });
  const lines = rows.filter((r) => r.code && r.totalQty > 0);
  if (lines.length) {
    await db.takeoffLine.createMany({
      data: lines.map((r) => ({
        projectId,
        sheet: null,
        area: "—",
        finishCode: r.code,
        qty: r.totalQty,
        unit: r.unit || "SF",
        status: "approved",
      })),
    });
  }

  if (toLibrary) await pushBidRatesToLibrary(projectId);
  // Push the new quantities + rates into the bid's hidden App_* tabs so the Sheet recalculates as the
  // estimator works. Best-effort (syncBidToSheet never throws); the in-app preview is already updated.
  await syncBidToSheet(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  // Remove stored objects (PDFs + page images) first — DB cascade alone leaks them. Best-effort.
  try {
    const removed = await deletePlanPrefix(projectId);
    if (removed) console.log(`deleteProject ${projectId}: removed ${removed} storage object(s)`);
  } catch (e) {
    console.error(`deleteProject ${projectId}: storage cleanup failed (continuing)`, e);
  }
  await db.project.delete({ where: { id: projectId } }); // cascades documents/pages/finishes/takeoff/scope/settings
  revalidatePath("/");
  redirect("/");
}

type ScopeInput = { label: string; mode: string; allowance: number | null };

export async function replaceScope(projectId: string, rows: ScopeInput[]) {
  await db.projectScopeItem.deleteMany({ where: { projectId } });
  const clean = rows.filter((r) => r.label.trim());
  if (clean.length) {
    await db.projectScopeItem.createMany({
      data: clean.map((r) => ({
        projectId,
        label: r.label.trim(),
        mode: r.mode,
        allowance: r.mode === "included" && r.allowance != null ? Math.max(0, r.allowance) : null,
      })),
    });
  }
  revalidatePath(`/projects/${projectId}/estimate`);
  redirect(`/projects/${projectId}/estimate`);
}

export async function saveSettings(projectId: string, formData: FormData) {
  const num = (k: string, d = 0) => {
    const v = parseFloat(String(formData.get(k) ?? ""));
    return Number.isFinite(v) ? v : d;
  };
  const mode = String(formData.get("profitPctMode") ?? "margin");
  // Clamp profit % at the source so the app preview and the Sheet can never diverge (Codex v5 #2):
  // never negative; in margin mode keep below 1 (cap 0.95) so 1/(1-pct) stays finite.
  const clampPct = (k: string, d: number) => {
    const v = Math.max(0, num(k, d));
    return mode === "margin" ? Math.min(v, 0.95) : v;
  };
  const data = {
    profitPctMode: mode,
    materialProfitPct: clampPct("materialProfitPct", 0.25),
    installProfitPct: clampPct("installProfitPct", 0.3),
    taxPct: Math.max(0, num("taxPct", 0)),
    taxMode: String(formData.get("taxMode") ?? "total_sell_plus_freight"),
    freight: Math.max(0, num("freight", 0)),
  };
  await db.estimateSettings.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  revalidatePath(`/projects/${projectId}/estimate`);
  redirect(`/projects/${projectId}/estimate`);
}

/**
 * Push a bid into Google Sheets: first sync creates a fresh Bid Engine sheet in the connected
 * user's Drive and saves its id; later syncs re-push the inputs into that same sheet. Returns the
 * sheet URL (and a status) so the estimate page can show a "Open in Sheets" link.
 */
export async function syncBidToSheet(
  projectId: string
): Promise<{ ok: boolean; url?: string; created?: boolean; error?: string }> {
  const authClient = await getAuthedClient();
  if (!authClient) return { ok: false, error: "Google isn't connected. Connect it from the home page." };

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      finishes: { orderBy: { code: "asc" } },
      finishAssignments: { include: { finish: true }, orderBy: [{ sourceSheet: "asc" }, { roomNumber: "asc" }] },
      takeoff: { orderBy: { area: "asc" } },
      scopeItems: { orderBy: { label: "asc" } },
      settings: true,
    },
  });
  if (!project) return { ok: false, error: "Bid not found." };

  const sheets = google.sheets({ version: "v4", auth: authClient });
  const bid = {
    name: project.name,
    gc: project.gc,
    location: project.location,
    bidDate: project.bidDate,
    notes: project.notes,
    finishes: project.finishes,
    takeoff: project.takeoff,
    scopeItems: project.scopeItems,
    settings: project.settings,
  };

  try {
    // Re-use the bid's sheet only if it still exists AND is the current engine version (Codex v5 #1):
    // a pre-v5 workbook has different hidden columns + formulas, so pushing v5 inputs would miscompute.
    if (project.sheetId) {
      try {
        if (isCurrentEngine(await readEngineVersion(sheets, project.sheetId))) {
          await updateBidData(sheets, project.sheetId, bid);
          const url = `https://docs.google.com/spreadsheets/d/${project.sheetId}/edit`;
          revalidatePath(`/projects/${projectId}/estimate`);
          return { ok: true, url, created: false };
        }
        console.warn("sheet is not v5 (or unreadable) — rebuilding a fresh one");
      } catch (e) {
        // Sheet was deleted/inaccessible — fall through and make a new one.
        console.warn("update existing sheet failed, recreating:", e);
      }
    }

    const { spreadsheetId, url } = await createBidSpreadsheet(sheets, bid);
    await db.project.update({ where: { id: projectId }, data: { sheetId: spreadsheetId } });
    revalidatePath(`/projects/${projectId}/estimate`);
    return { ok: true, url, created: true };
  } catch (e) {
    console.error("syncBidToSheet failed:", e);
    return { ok: false, error: "Couldn't sync to Google Sheets. Try reconnecting Google." };
  }
}
