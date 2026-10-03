"use server";

import { applyToEvent } from "@/lib/cohost";
import { createClient } from "@/lib/supabase/server";

export async function applyToPostedEvent(eventId: string, note: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "Sign in to continue." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Sign in to continue." };
  return applyToEvent(supabase, eventId, note);
}
