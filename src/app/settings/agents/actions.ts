"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TokenFormState = { token?: string; error?: string } | null;

export async function createAgentToken(_prev: TokenFormState, formData: FormData): Promise<TokenFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) return { error: "Name the token in 80 characters or fewer." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { error: "Sign in to create a token." };

  const { count } = await supabase
    .from("agent_tokens")
    .select("id", { count: "exact", head: true })
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) return { error: "Revoke an old token first. Ten active tokens is the limit." };

  const token = `cp_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("agent_tokens").insert({
    user_id: auth.claims.sub,
    name,
    token_hash: tokenHash,
  });
  if (error) {
    console.error("[createAgentToken]", error);
    return { error: "Could not create the token." };
  }

  revalidatePath("/settings/agents");
  return { token };
}

export async function revokeAgentToken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) console.error("[revokeAgentToken]", error);
  revalidatePath("/settings/agents");
}
