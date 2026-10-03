"use server";

import { redirect } from "next/navigation";
import { Profile, readProfileForm } from "@/lib/contracts";
import { upsertCompanyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error: string | null; values: Partial<Profile> | null };

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = readProfileForm(formData) as Partial<Profile>;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const saved = await upsertCompanyProfile(supabase, auth.claims.sub, values);
  if ("error" in saved) return { error: saved.error, values };

  redirect("/");
}
