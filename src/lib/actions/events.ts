"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { insertEvent } from "@/lib/events";
import { intentSchema, isPast } from "@/lib/intent";
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

  if (isPast(intent)) {
    return { error: "The event dates are in the past. Ask the assistant to change them." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "Sign in to create an event." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { error: "Sign in to create an event." };

  const result = await insertEvent(supabase, userId, intent, toolCallId);
  if ("error" in result) return result;
  redirect(`/events/${result.id}`);
}
