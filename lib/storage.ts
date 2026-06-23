import { createClient } from "@supabase/supabase-js";

export const PLANS_BUCKET = "plans";

// The "plans" bucket caps a single upload at 50MB (scripts/setup-storage.ts). Callers that may exceed
// it must route through lib/plan-split.ts uploadPlanSet(); this guard makes a direct oversize upload
// fail LOUD with a typed error instead of Supabase's opaque 413.
export const UPLOAD_BYTE_CAP = 50 * 1024 * 1024;
export class PlanTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`PDF is ${(bytes / 1e6).toFixed(1)}MB — over the ${UPLOAD_BYTE_CAP / 1e6}MB upload cap; split it first (uploadPlanSet).`);
    this.name = "PlanTooLargeError";
  }
}

/** Admin Supabase client (service key) — server-only. */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function uploadPlan(path: string, bytes: Buffer | Uint8Array, contentType = "application/pdf") {
  if (bytes.byteLength > UPLOAD_BYTE_CAP) throw new PlanTooLargeError(bytes.byteLength); // pre-flight: clear error, not a 413
  const { error } = await supabaseAdmin().storage.from(PLANS_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Best-effort: remove every stored object under a project's prefix (source PDFs + per-page images).
 * deleteProject only cascades DB rows, so without this the bucket leaks. Walks folders recursively
 * (Supabase list returns one level; folder entries have id === null). Never throws — a storage hiccup
 * must not block the DB delete.
 */
export async function deletePlanPrefix(projectId: string): Promise<number> {
  const bucket = supabaseAdmin().storage.from(PLANS_BUCKET);
  const collect = async (prefix: string): Promise<string[]> => {
    const { data, error } = await bucket.list(prefix, { limit: 1000 });
    if (error || !data) return [];
    const out: string[] = [];
    for (const e of data) {
      const full = `${prefix}/${e.name}`;
      if (e.id === null) out.push(...(await collect(full))); // a folder → recurse
      else out.push(full);
    }
    return out;
  };
  const paths = await collect(projectId);
  let removed = 0;
  for (let i = 0; i < paths.length; i += 1000) {
    const batch = paths.slice(i, i + 1000);
    const { error } = await bucket.remove(batch);
    if (!error) removed += batch.length;
  }
  return removed;
}

/** Download a stored plan's bytes (for sending to the AI). */
export async function downloadPlan(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(PLANS_BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

/** Time-limited link to a stored (private) plan. */
export async function signedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabaseAdmin().storage.from(PLANS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Server-minted token so the browser can upload a plan straight to storage. This bypasses the Vercel
 * serverless request-body limit (~4.5MB) a server-action upload would hit — the big file never passes
 * through the app process. The browser finishes it with supabase.storage.uploadToSignedUrl(path, token, file).
 */
export async function createSignedUploadUrl(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin().storage.from(PLANS_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}
