/**
 * Intake the scraped NOLA corpus (data/nola/) into the app as ready-to-read Projects.
 *
 * Agent A → Agent B hand-off (see docs/estimator-plan.md §4): for each permit folder that has plan
 * PDFs, create one Project + a Document per PDF, push the bytes to Supabase storage, and run B's
 * `ingestDocument` (per-page text + page image). Marks `Project.status = "ingested"` so B can pick it
 * up. NOLA provenance goes in `Project.notes`. The scanner is intentionally NOT run — the human tags
 * pages (Codex Change 4). Idempotent: a permit already intaken (Project exists) is skipped unless --force.
 *
 *   tsx --env-file=.env scripts/nola-intake.ts
 *   tsx --env-file=.env scripts/nola-intake.ts --only=25-19247-RNVS
 *   tsx --env-file=.env scripts/nola-intake.ts --force
 */
process.loadEnvFile(".env");
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { uploadPlan } from "@/lib/storage";
import { ingestDocument } from "@/lib/ingest";
import { getOrCreateDefaultCompany } from "@/lib/company";

const ROOT = join(process.cwd(), "data", "nola");

const arg = (n: string, d: string) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const hasFlag = (n: string) => process.argv.includes(`--${n}`);

type Manifest = {
  permitNum: string;
  permitType?: string | null;
  address?: string | null;
  description?: string | null;
  portal?: string;
};

async function main() {
  if (!existsSync(ROOT)) throw new Error(`No corpus at ${ROOT}. Run nola:docs first.`);
  const force = hasFlag("force");
  const only = arg("only", "");

  const company = await getOrCreateDefaultCompany();

  // Only intake the curated set (leadStatus="saved"). data/nola/ also holds leftover folders from
  // earlier scrape runs / dropped leads — those must NOT be ingested. --only overrides for one permit.
  const savedSet = new Set(
    (await db.nolaPermit.findMany({ where: { leadStatus: "saved" }, select: { permitNum: true } })).map(
      (p) => p.permitNum,
    ),
  );
  const folders = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => (only ? n === only : savedSet.has(n)));

  let projects = 0,
    docs = 0,
    skipped = 0;

  for (const folder of folders) {
    const dir = join(ROOT, folder);
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const m = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    const pdfs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      skipped++;
      continue; // list-only / no plans downloaded → nothing to intake
    }

    const name = `${m.address ?? m.permitNum} (${m.permitNum})`;
    const existing = await db.project.findFirst({ where: { name } });
    if (existing && !force) {
      console.log(`  = ${m.permitNum} already intaken — skip`);
      skipped++;
      continue;
    }

    const notes = [
      `Source: NOLA OneStop permit ${m.permitNum}${m.permitType ? ` (${m.permitType})` : ""}`,
      m.address ? `Address: ${m.address}` : "",
      m.description ? `Scope: ${m.description}` : "",
      m.portal ? `Portal: ${m.portal}` : "",
      `Plans: ${pdfs.join(" · ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const project =
      existing ??
      (await db.project.create({
        data: { companyId: company.id, name, location: m.address ?? null, status: "ingesting", notes },
      }));
    if (!existing) projects++;

    for (const pdf of pdfs) {
      const bytes = readFileSync(join(dir, pdf));
      const safeName = pdf.replace(/[^\w.\-]+/g, "_");
      const path = `${project.id}/${safeName}`;
      try {
        await uploadPlan(path, bytes); // upsert:false — throws if already there (re-run safety)
      } catch {
        /* already uploaded on a prior run — reuse the stored object */
      }
      const doc = await db.document.create({ data: { projectId: project.id, fileUrl: path } });
      const res = await ingestDocument(doc.id);
      docs++;
      console.log(`    ${m.permitNum} · ${pdf.slice(0, 46)} → ${res.pages}pg (${res.textPages} text, ${res.imagesOk} img)`);
    }

    await db.project.update({ where: { id: project.id }, data: { status: "ingested" } });
    console.log(`  ✓ ${m.permitNum} → project ${project.id} · ${pdfs.length} doc(s) ready for review`);
  }

  console.log(`\nDone. ${projects} project(s) created, ${docs} document(s) ingested, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
