import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = claims?.sub;

  if (error || typeof id !== "string") return null;

  return {
    id,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
}

export async function hasCompanyProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load company profile: ${error.message}`);
  return data !== null;
}

export async function getPostAuthPath(userId: string) {
  return (await hasCompanyProfile(userId)) ? "/" : "/onboarding";
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}
