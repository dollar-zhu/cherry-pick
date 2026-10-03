import type { SupabaseClient } from "@supabase/supabase-js";
import { Profile } from "@/lib/contracts";

export type UpsertProfileResult = { profile: Profile } | { error: string };

/** Saves the signed-in company's profile. Shared by the profile form and the MCP tool. */
export async function upsertCompanyProfile(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<UpsertProfileResult> {
  const parsed = Profile.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "profile";
    return { error: `${field}: ${issue?.message ?? "Invalid profile."}` };
  }

  const { error } = await supabase.from("profiles").upsert(
    { ...parsed.data, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[upsertCompanyProfile]", error);
    return { error: "Could not save the company profile." };
  }
  return { profile: parsed.data };
}
