/**
 * Scrape plan PDFs from the NOLA OneStop permit portal for triaged leads.
 *
 * For each permit (default: NolaPermit rows with leadStatus="saved"), resolve its portal link to the
 * permit's ref code, fetch the permit page, parse the inline document list, and download the
 * plan-shaped PDFs into data/nola/<permitNum>/ alongside a manifest.json listing EVERY document found
 * (kept or skipped) so nothing is silently lost. See docs/runbooks/nola-portal.md for the full recipe.
 *
 *   npm run nola:docs
 *   tsx --env-file=.env scripts/nola-docs.ts --permit=25-19247-RNVS
 *   tsx --env-file=.env scripts/nola-docs.ts --status=saved --max=10 --keep=all --force
 *
 * Flags (all optional):
 *   --status   triage status to scrape           (default "saved"; use "new"/"dismissed"/"all")
 *   --permit   scrape one permit by PermitNum     (overrides --status)
 *   --keep     "plans" or "all"                    (default "plans" — drawings only, skip paperwork)
 *   --max      stop after this many permits        (default: all)
 *   --force    re-scrape even if manifest exists   (default: skip already-done permits)
 *
 * Idempotent: a permit whose folder already has manifest.json is skipped unless --force.
 */
process.loadEnvFile(".env");
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  HOST,
  Cooldown,
  fetchDoc,
  fetchText,
  isPlan,
  parseDocs,
  refFromLink,
  safe,
  sleep,
  type PortalDoc,
} from "../lib/nola-portal";

const db = new PrismaClient();
const ROOT = join(process.cwd(), "data", "nola");
const THROTTLE_MS = 1200; // polite gap between permits (portal 429s under fast bursts)

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

type Doc = PortalDoc & { kept: boolean; bytes?: number; saved?: string };

async function main() {
  const keepMode = arg("keep", "plans"); // plans | all
  const max = Number(arg("max", "0")) || Infinity;
  const force = hasFlag("force");
  const listOnly = hasFlag("list"); // inventory the doc list only, download nothing (cheap / portal-gentle)
  const permitArg = arg("permit", "");
  const permitsArg = arg("permits", ""); // comma-separated PermitNums
  const fromFile = arg("from", ""); // JSON file: array of PermitNums or {permitNum} objects (e.g. data/nola-candidates.json)
  const status = arg("status", "saved");

  const fromList: string[] = fromFile
    ? (JSON.parse(readFileSync(fromFile, "utf8")) as Array<string | { permitNum?: string }>)
        .map((r) => (typeof r === "string" ? r : r.permitNum ?? ""))
        .filter(Boolean)
    : [];
  const permitList = fromList.length
    ? fromList
    : permitsArg
      ? permitsArg.split(",").map((s) => s.trim()).filter(Boolean)
      : permitArg
        ? [permitArg]
        : [];
  const permits = permitList.length
    ? await db.nolaPermit.findMany({ where: { permitNum: { in: permitList } } })
    : await db.nolaPermit.findMany({
        where: status === "all" ? {} : { leadStatus: status },
        orderBy: { issueDate: { sort: "desc", nulls: "last" } },
      });

  console.log(
    `NOLA docs · ${permitList.length ? `${permitList.length} permit(s)` : `status="${status}"`} · keep=${keepMode}` +
      (listOnly ? " · LIST-ONLY (no downloads)" : "") +
      (max !== Infinity ? ` · max ${max}` : "") +
      ` · ${permits.length} found`,
  );
  mkdirSync(ROOT, { recursive: true });

  let done = 0,
    skipped = 0,
    files = 0,
    bytes = 0;

  for (const p of permits) {
    if (done >= max) break;
    const ref = refFromLink(p.link);
    const dir = join(ROOT, safe(p.permitNum));
    if (existsSync(join(dir, "manifest.json")) && !force) {
      skipped++;
      continue;
    }
    if (!ref) {
      console.log(`  ⚠ ${p.permitNum}: no ref code in link — skipped`);
      skipped++;
      continue;
    }

    let docs: Omit<Doc, "kept">[] = [];
    try {
      await sleep(THROTTLE_MS); // polite gap between permits
      const html = await fetchText(`${HOST}/PrmtView.aspx?ref=${ref}`);
      docs = parseDocs(html);
    } catch (e) {
      if (e instanceof Cooldown) {
        console.log(`  ⛔ portal cooldown (${e.secs}s) — stopping. Re-run later to continue.`);
        break;
      }
      console.log(`  ⚠ ${p.permitNum}: ${(e as Error).message}`);
      skipped++;
      continue;
    }

    const classified: Doc[] = docs.map((d) => ({
      ...d,
      kept: keepMode === "all" ? true : isPlan(d.name),
    }));
    const kept = classified.filter((d) => d.kept);
    const maxFiles = Number(arg("maxfiles", "0")) || Infinity; // per-permit cap so one lead can't eat disk/portal
    const toGet = listOnly ? [] : kept.slice(0, maxFiles); // list mode: inventory only
    if (!listOnly && kept.length > maxFiles)
      console.log(`     · ${p.permitNum}: ${kept.length} plan docs → capping at ${maxFiles} (--maxfiles)`);

    mkdirSync(dir, { recursive: true });
    const used = new Set<string>();
    for (const d of toGet) {
      await sleep(600); // gap between file downloads (back-to-back big PDFs trip the limit)
      const buf = await fetchDoc(d.docId).catch(() => null);
      if (!buf) {
        console.log(`     · ${d.docId} ${d.name.slice(0, 50)} — not a PDF / failed`);
        continue;
      }
      let fname = safe(d.name);
      if (!/\.pdf$/i.test(fname)) fname += ".pdf";
      if (used.has(fname.toLowerCase())) fname = `${d.docId}_${fname}`; // dedupe by DocID
      used.add(fname.toLowerCase());
      writeFileSync(join(dir, fname), buf);
      d.bytes = buf.length;
      d.saved = fname;
      files++;
      bytes += buf.length;
    }

    const manifest = {
      permitNum: p.permitNum,
      ref,
      address: [p.originalAddress1, p.originalZip].filter(Boolean).join(", ") || null,
      permitType: p.permitType,
      description: p.description,
      portal: `${HOST}/PrmtView.aspx?ref=${ref}`,
      scrapedKeep: keepMode,
      docCount: classified.length,
      keptCount: classified.filter((d) => d.kept).length,
      documents: classified, // ALL docs, kept + skipped, with DocIDs so any can be pulled later
    };
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    done++;
    const planLikely = classified.filter((d) => d.kept).length;
    const savedN = classified.filter((d) => d.saved).length;
    console.log(
      `  [${done}] ${p.permitNum} · ${classified.length} docs, ` +
        `${listOnly ? `${planLikely} plan-likely` : `${savedN} plan PDF(s) saved`} · ${p.description?.slice(0, 46) ?? ""}`,
    );
  }

  const mb = (bytes / 1e6).toFixed(1);
  console.log(`Done. ${done} permit(s) scraped, ${skipped} skipped. ${files} PDF(s), ${mb} MB → ${ROOT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
