import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Only for trusted backend code that has
 * already authenticated the caller and scopes every query to that user.
 * Never import from client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
