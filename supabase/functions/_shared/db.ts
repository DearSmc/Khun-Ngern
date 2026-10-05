// Database client for backend functions. Uses the service role key, so it bypasses row level
// security: every query must still be scoped by group_id (PRD §6 Scoping).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
