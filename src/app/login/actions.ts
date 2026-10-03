"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getPostAuthPath, isSupabaseConfigured } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { message: string | null; kind: "error" | "success" | null };

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function authenticate(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { message: "Authentication is not configured for this environment.", kind: "error" };
  }

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check your email and password.", kind: "error" };
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const supabase = await createClient();

  if (formData.get("mode") === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { message: error.message, kind: "error" };

    if (!data.session) {
      return {
        message:
          "This Supabase project requires email confirmation. Disable Confirm email in Supabase Auth settings to match this app's sign-up flow.",
        kind: "error",
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { message: "Email or password is incorrect.", kind: "error" };
  }

  const nextPath = safeNext(formData.get("next"));
  if (nextPath) redirect(nextPath);

  const { data: auth, error: claimsError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return { message: "We could not start your session. Please try again.", kind: "error" };
  }

  redirect(await getPostAuthPath(userId));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Unable to sign out: ${error.message}`);
  }

  redirect("/login");
}
