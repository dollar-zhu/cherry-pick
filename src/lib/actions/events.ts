"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { intentSchema } from "@/lib/intent";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  intent: intentSchema,
  toolCallId: z.string().min(1).max(200),
});

export type CreateEventResult = { error: string };

/**
 * Creates an event from a confirmed intent. Re-validates everything: the
 * client-supplied intent is untrusted. Idempotent per tool call, so a double
 * click or retry lands on the same event instead of creating a second one.
 */
export async function createEvent(input: unknown): Promise<CreateEventResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "The event details are invalid. Ask the assistant to fix them." };
  const { intent, toolCallId } = parsed.data;

  if (Date.parse(intent.date_start) <= Date.now()) {
    return { error: "The event must start in the future." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "Sign in to create an event." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { error: "Sign in to create an event." };

  const { data, error } = await supabase
    .from("events")
    .insert({ ...intent, owner_id: userId, source_tool_call_id: toolCallId })
    .select("id")
    .single();

  let eventId = data?.id as string | undefined;

  if (error?.code === "23505") {
    // Already confirmed: reuse the existing event.
    const existing = await supabase
      .from("events")
      .select("id")
      .eq("owner_id", userId)
      .eq("source_tool_call_id", toolCallId)
      .single();
    eventId = existing.data?.id as string | undefined;
  } else if (error) {
    console.error("[createEvent]", error);
    return { error: "Could not create the event. Please try again." };
  }

  if (!eventId) return { error: "Could not create the event. Please try again." };
  redirect(`/events/${eventId}`);
}
