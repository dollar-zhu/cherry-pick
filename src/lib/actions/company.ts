"use server";

import { redirect } from "next/navigation";
import { CompanyProfile, readCompanyForm } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export type CompanyFormState = {
  error: string | null;
  values: Partial<CompanyProfile> | null;
};

export async function saveCompany(
  _previous: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const values = readCompanyForm(formData);
  const parsed = CompanyProfile.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, values };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") redirect("/login");

  const { error } = await supabase.from("profiles").upsert(
    {
      ...parsed.data,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "We couldn’t save your company profile. Please try again.", values };

  redirect("/");
}
