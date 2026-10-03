"use server";

import { redirect } from "next/navigation";
import { Profile, readProfileForm } from "@/lib/contracts";
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

  const parsed = Profile.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(".") || "profile"}: ${issue.message}`, values };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { ...parsed.data, user_id: auth.claims.sub, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return { error: error.message, values };

  redirect("/");
}
