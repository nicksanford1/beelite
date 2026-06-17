"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan, downloadPlan } from "@/lib/storage";
import { extractFinishSchedule, type ExtractedFinish } from "@/lib/anthropic";
import { scanPdf } from "@/lib/pdf";
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

// Read a plan's finish schedule with AI → store raw output → go review it.
export async function readSchedule(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const bytes = await downloadPlan(doc.fileUrl);
  const { finishes, model } = await extractFinishSchedule(bytes.toString("base64"));

  // one finish-schedule marker per document (page-level tagging is V2)
  const sheet =
    (await db.planSheet.findFirst({ where: { documentId, sheetType: "finish_schedule" } })) ??
    (await db.planSheet.create({
      data: { documentId, pageNumber: 1, sheetType: "finish_schedule" },
    }));

  const confidence = finishes.map((f) => ({ code: f.code, confidence: f.confidence }));
  await db.extraction.upsert({
    where: { planSheetId: sheet.id },
    create: { planSheetId: sheet.id, model, rawOutput: { finishes }, confidence },
    update: { model, rawOutput: { finishes }, confidence, corrected: undefined },
  });

  revalidatePath(`/projects/${doc.projectId}/finishes`);
  redirect(`/projects/${doc.projectId}/finishes`);
}

// Confirm/correct the reviewed finishes → save ProjectFinish + log the correction.
export async function confirmFinishes(projectId: string, finishes: ExtractedFinish[]) {
  const sheet = await db.planSheet.findFirst({
    where: { document: { projectId }, sheetType: "finish_schedule" },
    orderBy: { id: "desc" },
  });
  if (sheet) {
    await db.extraction
      .update({ where: { planSheetId: sheet.id }, data: { corrected: { finishes } } })
      .catch(() => {});
  }

  await db.projectFinish.deleteMany({ where: { projectId } });
  await db.projectFinish.createMany({
    data: finishes.map((f) => ({
      projectId,
      code: f.code,
      type: f.type,
      description: f.description ?? "",
      unit: f.unit,
      category: f.category,
      inScope: f.includedInFlooringScope,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

type RateInput = {
  id: string;
  materialCost: number;
  installMode: string;
  installAmount: number | null;
  wastePct: number;
  cartonSize: number | null;
  furnishType: string;
};

export async function saveRates(projectId: string, rates: RateInput[]) {
  await Promise.all(
    rates.map((r) =>
      db.projectFinish.update({
        where: { id: r.id },
        data: {
          materialCost: r.materialCost,
          installMode: r.installMode,
          installAmount: r.installAmount,
          wastePct: r.wastePct,
          cartonSize: r.cartonSize,
          furnishType: r.furnishType,
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
    pricingMode: String(formData.get("pricingMode") ?? "markup"),
    pct: num("pct", 0.15),
    subMarkupPct: num("subMarkupPct", 0.15),
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

