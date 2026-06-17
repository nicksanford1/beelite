"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan, downloadPlan } from "@/lib/storage";
import { extractFinishSchedule, type ExtractedFinish } from "@/lib/anthropic";
import { scanPdf, extractPages } from "@/lib/pdf";
import { getAuthedClient } from "@/lib/google";
import { createBidSpreadsheet, updateBidData, readEngineVersion, isCurrentEngine } from "@/lib/sheet-builder";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
};

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

export async function uploadDocument(projectId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${Date.now()}-${safeName}`;
  await uploadPlan(path, bytes, file.type || "application/pdf");

  const doc = await db.document.create({ data: { projectId, fileUrl: path } });

  // scan every page → one PlanSheet per page (suggested tag + signals); human confirms later
  try {
    const scans = await scanPdf(bytes);
    if (scans.length) {
      await db.planSheet.createMany({
        data: scans.map((s) => ({
          documentId: doc.id,
          pageNumber: s.pageNumber,
          sheetNumber: s.sheetNumber,
          sheetTitle: s.sheetTitle,
          suggestedSheetType: s.suggestedSheetType,
          scanScore: s.score,
          scanSignals: s.signals as object,
        })),
      });
    }
  } catch (e) {
    console.error("page scan failed:", e);
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

// Read finishes from ONLY the pages tagged finish_schedule (targeted extraction).
export async function readSchedule(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { pages: true } });
  if (!doc) return;

  const schedulePages = doc.pages
    .filter((p) => p.sheetType === "finish_schedule")
    .sort((a, b) => a.pageNumber - b.pageNumber);
  if (!schedulePages.length) return; // nothing tagged — UI guides the user to tag first

  const pageNums = schedulePages.map((p) => p.pageNumber);
  const bytes = await downloadPlan(doc.fileUrl);
  const subPdf = await extractPages(bytes, pageNums); // just the tagged pages
  const { finishes, model } = await extractFinishSchedule(subPdf.toString("base64"));

  // exactly ONE extraction per document, on the primary (lowest-page) tagged sheet.
  const primary = schedulePages[0];
  await db.extraction.deleteMany({ where: { planSheet: { documentId, id: { not: primary.id } } } });
  const confidence = finishes.map((f) => ({ code: f.code, confidence: f.confidence }));
  await db.extraction.upsert({
    where: { planSheetId: primary.id },
    create: { planSheetId: primary.id, model, rawOutput: { finishes, sourcePages: pageNums }, confidence },
    update: { model, rawOutput: { finishes, sourcePages: pageNums }, confidence, corrected: undefined },
  });

  revalidatePath(`/projects/${doc.projectId}/finishes`);
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
export async function confirmFinishes(projectId: string, planSheetId: string, finishes: ExtractedFinish[]) {
  await db.extraction
    .update({ where: { planSheetId }, data: { corrected: { finishes } } })
    .catch(() => {});

  const project = await db.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
  const lib = project
    ? await db.finishLibraryItem.findMany({ where: { companyId: project.companyId }, include: { rate: true } })
    : [];
  const libByCode = new Map(lib.map((l) => [l.code, l]));

  // Merge by code so a re-confirm can't wipe per-bid rates (Codex v5 #3, contract §8 "snapshot, not live"):
  // existing codes keep their rates (descriptive fields refresh); new codes seed from the library; gone codes drop.
  const existing = await db.projectFinish.findMany({ where: { projectId } });
  const existingCodes = new Set(existing.map((e) => e.code));
  const incomingCodes = new Set(finishes.map((f) => f.code));

  await db.projectFinish.deleteMany({ where: { projectId, code: { notIn: [...incomingCodes] } } });

  await Promise.all(
    finishes.map((f) => {
      const desc = { type: f.type, description: f.description ?? "", unit: f.unit, category: f.category, inScope: f.includedInFlooringScope };
      if (existingCodes.has(f.code)) {
        // keep rate fields untouched; only refresh the descriptive columns
        return db.projectFinish.update({ where: { projectId_code: { projectId, code: f.code } }, data: desc });
      }
      const r = libByCode.get(f.code)?.rate;
      const seed = r
        ? {
            materialUnitCost: r.materialUnitCost,
            installRate: r.installRate,
            wastePct: r.wastePct,
            cartonSize: r.cartonSize,
            materialSource: r.materialSource,
            rateStatus: "seeded",
            libraryItemId: libByCode.get(f.code)!.id,
          }
        : { rateStatus: "needs_rate" };
      return db.projectFinish.create({ data: { projectId, code: f.code, ...desc, ...seed } });
    })
  );

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

type RateInput = {
  id: string;
  materialUnitCost: number;
  installRate: number;
  wastePct: number;
  cartonSize: number | null;
  materialSource: string;
};

export async function saveRates(projectId: string, rates: RateInput[]) {
  await Promise.all(
    rates.map((r) =>
      db.projectFinish.update({
        where: { id: r.id },
        data: {
          materialUnitCost: r.materialUnitCost,
          installRate: r.installRate,
          wastePct: r.wastePct,
          cartonSize: r.cartonSize,
          materialSource: r.materialSource,
          rateStatus: "manual",
        },
      })
    )
  );
  revalidatePath(`/projects/${projectId}/estimate`);
  redirect(`/projects/${projectId}/estimate`);
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

