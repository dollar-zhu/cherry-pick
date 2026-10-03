import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Used only to look up a personal agent token and mint
 * a user session. Tool calls never receive this client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
