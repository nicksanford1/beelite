// Creates the private "plans" storage bucket in Supabase. Run once: npx tsx scripts/setup-storage.ts
process.loadEnvFile(".env");
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data: existing } = await sb.storage.getBucket("plans");
  if (existing) {
    console.log("bucket 'plans' already exists");
    return;
  }
  const { error } = await sb.storage.createBucket("plans", { public: false, fileSizeLimit: "50MB" });
  console.log(error ? "error: " + error.message : "created bucket 'plans'");
}
main();
