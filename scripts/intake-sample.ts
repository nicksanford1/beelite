/**
 * Create a Project from a local PDF exactly like the upload wizard does — store the file, read the
 * cover for details, ingest page images, and run the finish read — so it appears fully populated in
 * the UI without a browser upload. Runs as its own process, keeping the heavy ingest off the dev server.
 *
 *   npx tsx scripts/intake-sample.ts samples/nn-campus.pdf
 */
process.loadEnvFile(".env");
import { readFileSync } from "fs";
import { basename } from "path";
import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { uploadPlan } from "@/lib/storage";
import { ingestDocument } from "@/lib/ingest";
import { runGuardedRead } from "@/lib/finish-read";
import { renderPage } from "@/lib/pdf";
import { extractProjectInfo } from "@/lib/anthropic";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error("usage: intake-sample.ts <pdf>");
  const bytes = readFileSync(pdfPath);
  const fileName = basename(pdfPath);

  const company = await getOrCreateDefaultCompany();
  const project = await db.project.create({
    data: { companyId: company.id, name: fileName.replace(/\.pdf$/i, "") },
  });
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${project.id}/${Date.now()}-${safe}`;
  await uploadPlan(path, bytes, "application/pdf");
  const doc = await db.document.create({
    data: { projectId: project.id, fileUrl: path, originalFilename: fileName },
  });
  console.log(`project ${project.id} · doc ${doc.id}`);

  // Cover read → project details (same as readProjectDetails).
  try {
    const cover = await renderPage(bytes, 1, 1.8, "image/jpeg");
    const { info } = await extractProjectInfo(cover.toString("base64"));
    await db.project.update({
      where: { id: project.id },
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
    console.log(`cover read: ${info.name ?? "(no name)"} · ${info.address ?? "(no address)"}`);
  } catch (e) {
    console.error("cover read failed:", (e as Error).message);
  }

  // Finish read first (the thing we want to see), then ingest the page images for the Plans viewer.
  console.log("finish read…");
  await runGuardedRead(doc.id);
  const ext = await db.planSheet.findFirst({
    where: { documentId: doc.id, extraction: { isNot: null } },
    include: { extraction: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (ext?.extraction?.rawOutput ?? {}) as any;
  const finishes = raw.finishes ?? [];
  console.log(`read status=${raw.status} model=${ext?.extraction?.model} finishes=${finishes.length}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log("codes:", finishes.map((f: any) => `${f.code}${f.includedInFlooringScope === false ? "(out)" : ""}`).join(", "));
  console.log("evidence pages:", JSON.stringify(raw.evidencePages ?? []));

  console.log("ingesting page images…");
  const ing = await ingestDocument(doc.id, { bytes });
  console.log("ingest:", JSON.stringify(ing));

  console.log(`\nOPEN → http://localhost:3000/projects/${project.id}?focus=finishes`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
