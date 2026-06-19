/**
 * Quick look at ONE permit's documents — and grab them if you want. The fast, console-first
 * counterpart to the batch scraper (scripts/nola-docs.ts). By default it downloads nothing: it just
 * prints the portal's document list so you can eyeball what's there. See docs/runbooks/nola-portal.md.
 *
 *   npm run nola:peek 25-19247-RNVS              # list docs (no download)
 *   npm run nola:peek B8SKMD                      # a raw portal ref works too
 *   npm run nola:peek 25-19247-RNVS --plans       # download the plan-likely PDFs
 *   npm run nola:peek 25-19247-RNVS --all         # download every document
 *   npm run nola:peek 25-19247-RNVS --get 8400631 # download specific DocID(s), comma-ok
 *
 * Downloads land in data/nola/<permitNum>/ (same place the batch scraper uses).
 */
process.loadEnvFile(".env");
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  HOST,
  fetchDoc,
  isPlan,
  listPermitDocs,
  looksLikeRef,
  refFromLink,
  safe,
  sleep,
  Cooldown,
} from "../lib/nola-portal";

const db = new PrismaClient();
const ROOT = join(process.cwd(), "data", "nola");

const flagVal = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
};
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  // First non-flag arg after the script = permitNum or ref.
  const positional = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!positional) {
    console.error("Usage: npm run nola:peek <permitNum|ref> [--plans | --all | --get <DocID,...>]");
    process.exit(1);
  }

  // Resolve to a ref + a label/folder name. Try the DB by PermitNum; fall back to a raw ref.
  const byNum = await db.nolaPermit.findUnique({ where: { permitNum: positional } });
  const ref = byNum ? refFromLink(byNum.link) : looksLikeRef(positional) ? positional : null;
  const label = byNum?.permitNum ?? positional;
  if (!ref) {
    console.error(
      byNum
        ? `${positional}: permit has no portal link / ref code.`
        : `${positional}: not a known PermitNum and not a valid ref code.`,
    );
    process.exit(1);
  }

  console.log(`\n${label}${byNum?.originalAddress1 ? ` · ${byNum.originalAddress1}` : ""}`);
  console.log(`${HOST}/PrmtView.aspx?ref=${ref}\n`);

  let docs;
  try {
    docs = await listPermitDocs(ref);
  } catch (e) {
    if (e instanceof Cooldown) {
      console.error(`Portal cooldown (${e.secs}s) — try again later.`);
      process.exit(1);
    }
    throw e;
  }

  if (!docs.length) {
    console.log("No documents listed for this permit.");
    process.exit(0);
  }

  // Print the table.
  console.log("  #  Keep  DocID      Date         File");
  docs.forEach((d, i) => {
    const keep = isPlan(d.name) ? "✓   " : "    ";
    console.log(
      `  ${String(i + 1).padStart(2)}  ${keep}  ${d.docId.padEnd(9)}  ${(d.date ?? "").padEnd(11)}  ${d.name}`,
    );
  });
  const planCount = docs.filter((d) => isPlan(d.name)).length;
  console.log(`\n${docs.length} document(s) · ${planCount} look like plans (✓)`);

  // Decide what (if anything) to download.
  const getIds = (flagVal("get") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  let toGet = docs.filter((d) => getIds.includes(d.docId));
  if (getIds.length && toGet.length !== getIds.length) {
    const missing = getIds.filter((id) => !docs.some((d) => d.docId === id));
    console.log(`  ⚠ DocID(s) not on this permit: ${missing.join(", ")}`);
  }
  if (hasFlag("all")) toGet = docs;
  else if (hasFlag("plans")) toGet = docs.filter((d) => isPlan(d.name));

  if (!toGet.length) {
    console.log("\n(no download — add --plans, --all, or --get <DocID> to pull files)");
    process.exit(0);
  }

  const dir = join(ROOT, safe(label));
  mkdirSync(dir, { recursive: true });
  console.log(`\nDownloading ${toGet.length} file(s) → ${dir}`);
  const used = new Set<string>();
  let files = 0,
    bytes = 0;
  for (const d of toGet) {
    await sleep(600); // polite gap between big PDFs
    const buf = await fetchDoc(d.docId).catch(() => null);
    if (!buf) {
      console.log(`  · ${d.docId} ${d.name.slice(0, 50)} — not a PDF / failed`);
      continue;
    }
    let fname = safe(d.name);
    if (!/\.pdf$/i.test(fname)) fname += ".pdf";
    if (used.has(fname.toLowerCase())) fname = `${d.docId}_${fname}`;
    used.add(fname.toLowerCase());
    writeFileSync(join(dir, fname), buf);
    files++;
    bytes += buf.length;
    console.log(`  ✓ ${fname} (${(buf.length / 1e6).toFixed(1)} MB)`);
  }
  console.log(`\nDone. ${files} file(s), ${(bytes / 1e6).toFixed(1)} MB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
