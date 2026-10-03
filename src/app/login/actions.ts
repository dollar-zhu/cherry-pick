"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function authenticate(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  if (formData.get("mode") === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.session) return "Check your email to confirm the account, then sign in.";
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
  }

  redirect(safeNext(formData.get("next")) ?? "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
