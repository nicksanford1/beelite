"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan, downloadPlan } from "@/lib/storage";
import { extractFinishSchedule, type ExtractedFinish } from "@/lib/anthropic";
import { scanPdf, extractPages } from "@/lib/pdf";
import { getAuthedClient } from "@/lib/google";
import { createBidSpreadsheet, updateBidData } from "@/lib/sheet-builder";
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

  await db.projectFinish.deleteMany({ where: { projectId } });
  await db.projectFinish.createMany({
    data: finishes.map((f) => {
      const seed = libByCode.get(f.code);
      const r = seed?.rate;
      const base = {
        projectId,
        code: f.code,
        type: f.type,
        description: f.description ?? "",
        unit: f.unit,
        category: f.category,
        inScope: f.includedInFlooringScope,
      };
      return r // exact-match-or-needs-rate (v5 contract §8)
        ? {
            ...base,
            materialUnitCost: r.materialUnitCost,
            installRate: r.installRate,
            wastePct: r.wastePct,
            cartonSize: r.cartonSize,
            materialSource: r.materialSource,
            rateStatus: "seeded",
            libraryItemId: seed!.id,
          }
        : { ...base, rateStatus: "needs_rate" };
    }),
    skipDuplicates: true,
  });

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
  const data = {
    profitPctMode: String(formData.get("profitPctMode") ?? "margin"),
    materialProfitPct: num("materialProfitPct", 0.25),
    installProfitPct: num("installProfitPct", 0.3),
    taxPct: num("taxPct", 0),
    taxMode: String(formData.get("taxMode") ?? "total_sell_plus_freight"),
    freight: num("freight", 0),
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
    // Re-use the bid's sheet if it still exists; otherwise create a fresh one.
    if (project.sheetId) {
      try {
        await updateBidData(sheets, project.sheetId, bid);
        const url = `https://docs.google.com/spreadsheets/d/${project.sheetId}/edit`;
        revalidatePath(`/projects/${projectId}/estimate`);
        return { ok: true, url, created: false };
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

