/**
 * First-pass finish read on a PAGE SUBSET (not the whole set) — cheap, focused verification.
 *   npx tsx --env-file=.env scripts/test-read.ts "<pdf>" "14,15,16,17"
 */
import { readFileSync } from "fs";
import { extractPages } from "@/lib/pdf";
import { readFinishesGuarded } from "@/lib/anthropic";

async function main() {
  const path = process.argv[2];
  const pages = (process.argv[3] ?? "14,15,16,17").split(",").map(Number);
  const modelArg = process.argv[4] || "claude-sonnet-4-6";
  const bytes = readFileSync(path);
  const subset = await extractPages(bytes, pages);
  console.log(`Sending pages ${pages.join(", ")} only — ${(subset.length / 1e6).toFixed(1)}MB — to ${modelArg}…\n`);

  const { result, usage, model } = await readFinishesGuarded(subset, modelArg);
  const inTok = (usage as any)?.input_tokens ?? 0;
  const outTok = (usage as any)?.output_tokens ?? 0;
  const rate = modelArg.includes("opus") ? [5, 25] : [3, 15];
  console.log(`model ${model} · in ${inTok} tok · out ${outTok} tok · ~$${((inTok * rate[0] + outTok * rate[1]) / 1e6).toFixed(3)}`);
  console.log(`status: ${result.status}  (confidence ${result.confidence})`);

  console.log(`\nFINISHES (${result.finishes.length}):`);
  for (const f of result.finishes)
    console.log(`  ${f.code.padEnd(10)} ${(f.application ?? "").padEnd(11)} ${(f.unit ?? "").padEnd(5)} scope=${f.includedInFlooringScope} · ${f.description}`);

  console.log(`\nASSIGNMENTS (${result.assignments.length}):`);
  for (const a of result.assignments)
    console.log(`  ${(a.level ?? "").padEnd(4)} ${(a.roomNumber ?? "").padEnd(6)} ${(a.roomName ?? "").padEnd(16)} → ${a.finishCode}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
