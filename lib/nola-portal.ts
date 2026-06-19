/**
 * Shared NOLA OneStop permit-portal helpers — the `Redirect → PrmtView → GetDocument` recipe.
 * Used by scripts/nola-docs.ts (batch scrape of saved leads) and scripts/nola-peek.ts (quick
 * single-permit look). See docs/runbooks/nola-portal.md for the full write-up.
 *
 * No auth, no cookies, no POST: parse the ref out of a permit's link, GET the permit page, regex the
 * inline document list, GET each document by DocID. Keep this the single source of the keep/drop
 * heuristic and the fetch/backoff behavior so the two scripts can't drift apart.
 */

export const HOST = "https://onestopapp.nola.gov";
export const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

// Keep drawing/plan PDFs; drop the paperwork (permits, receipts, contracts, approvals, etc.).
// NOTE: names are normalized (underscores → spaces) before testing, so "WELLONS_CD SET" matches \bcd\b.
// (RCC) is the city's plan-review stamp on the filename — the single most reliable "this is a
// reviewed drawing set" signal; almost nothing but real plans carries it.
export const KEEP =
  /\b(rcc|drawing|drawings|plan|plans|arch|architect|mep|floor|structural|elev|detail|schedule|cd|cd ?set|construction doc\w*|submittal|permit set|bid ?set|interiors?|filing|sealed|stamped|schematic)\b|a-?\d/i;
export const DROP =
  /\b(receipt|building permit|contract|act of sale|articles|approval|license|authoriz|classification|fire marshal|insurance|invoice|affidavit|recorded|organization)\b/i;

export type PortalDoc = { docId: string; name: string; date: string | null };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** OneStop link → ref code (== the SearchString token). */
export function refFromLink(link: string | null): string | null {
  if (!link) return null;
  const m = /SearchString=([A-Za-z0-9]+)/i.exec(link);
  return m ? m[1] : null;
}

/** True if a string looks like a portal ref code (alphanumeric, no dashes — not a PermitNum). */
export function looksLikeRef(s: string): boolean {
  return /^[A-Za-z0-9]{4,12}$/.test(s) && !s.includes("-");
}

/** Safe filesystem name: strip path separators / odd chars, collapse whitespace. */
export function safe(name: string): string {
  return (
    name
      .replace(/&amp;/g, "&")
      .replace(/[\/\\]+/g, "-")
      .replace(/[^a-zA-Z0-9 ._()&,-]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || "file"
  );
}

/** Parse the permit page HTML → every document (filename, date, DocID) in its list. */
export function parseDocs(html: string): PortalDoc[] {
  const out: PortalDoc[] = [];
  const re = /<li>\s*([\s\S]*?)\s*<a\b[^>]*onclick=['"]?DocRedirect\((\d+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let text = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    // trailing " (M/D/YYYY)" is the upload date, not part of the filename
    const dm = /\s*\((\d{1,2}\/\d{1,2}\/\d{4})\)\s*$/.exec(text);
    const date = dm ? dm[1] : null;
    if (dm) text = text.slice(0, dm.index).trim();
    out.push({ docId: m[2], name: text, date });
  }
  return out;
}

/** Whether a document is a plan we keep (vs paperwork we skip). */
export function isPlan(name: string): boolean {
  const norm = name.replace(/_+/g, " "); // "WELLONS_CD SET" → "WELLONS CD SET" so \bcd\b matches
  return KEEP.test(norm) && !DROP.test(norm);
}

/** Thrown when the portal signals a long cooldown — stop the run rather than sleep/hammer. */
export class Cooldown extends Error {
  constructor(public secs: number) {
    super(`portal cooldown ${secs}s`);
  }
}

/** GET with backoff on HTTP 429. Caps each wait at 60s; bails on a long cooldown. */
export async function getWithRetry(url: string, tries = 4): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429) return res;
    const ra = Number(res.headers.get("retry-after")) || 0; // seconds
    if (ra > 120) throw new Cooldown(ra); // hard cooldown (e.g. 3600s) — don't block/hammer, stop
    const wait = Math.min(ra * 1000 || 4000 * 2 ** i, 60_000); // cap 60s
    console.log(`     · 429 — backing off ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }
  return null;
}

export async function fetchText(url: string): Promise<string> {
  const res = await getWithRetry(url);
  if (!res || !res.ok) throw new Error(`GET ${url} → HTTP ${res?.status ?? "retry-exhausted"}`);
  return res.text();
}

/** Fetch the permit page and return its parsed document list. */
export async function listPermitDocs(ref: string): Promise<PortalDoc[]> {
  return parseDocs(await fetchText(`${HOST}/PrmtView.aspx?ref=${ref}`));
}

/** Download a document by DocID. Returns the buffer, or null if it isn't a PDF. */
export async function fetchDoc(docId: string): Promise<Buffer | null> {
  const res = await getWithRetry(`${HOST}/GetDocument.aspx?DocID=${docId}`);
  if (!res || !res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // Their Content-Type is the buggy "application/application/pdf"; trust the magic bytes instead.
  return buf.subarray(0, 5).toString("latin1") === "%PDF-" ? buf : null;
}
