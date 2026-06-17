import { createClient } from "@supabase/supabase-js";

export const PLANS_BUCKET = "plans";

/** Admin Supabase client (service key) — server-only. */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function uploadPlan(path: string, bytes: Buffer | Uint8Array, contentType = "application/pdf") {
  const { error } = await supabaseAdmin().storage.from(PLANS_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Time-limited link to a stored (private) plan. */
export async function signedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabaseAdmin().storage.from(PLANS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
