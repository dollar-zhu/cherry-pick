"use server";

import { createClient } from "@/lib/supabase/server";
import { buildFlier, type FlierActionResult, type FlierRequest } from "@/lib/flier/generate";

export type { FlierActionResult, FlierRequest };

/**
 * Generates the next flier version for an event the signed-in user hosts.
 * The background comes from Nano Banana; the text is set by renderFlier, so it is
 * always spelled right. If the image model fails, the vibe's gradient is used instead.
 */
export async function generateFlier(eventId: string, request: FlierRequest): Promise<FlierActionResult> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { status: "error", message: "Sign in to continue." };
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    if (!auth?.claims.sub) return { status: "error", message: "Sign in to continue." };
    return await buildFlier(supabase, eventId, request);
  } catch (error) {
    // e.g. an invalid events.timezone in Intl; return a result so the panel never hangs.
    console.error("[generateFlier]", error);
    return { status: "error", message: "Could not make the flier. Please try again." };
  }
}
