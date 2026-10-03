import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventIntent } from "@/lib/intent";

export type InsertEventResult = { id: string } | { error: string };

/**
 * Inserts a confirmed intent. Idempotent per (owner, tool call id): a retry
 * returns the event that the first call created. Shared by the Confirm button
 * and the MCP `create_event_intent` tool.
 */
export async function insertEvent(
  supabase: SupabaseClient,
  userId: string,
  intent: EventIntent,
  toolCallId: string,
): Promise<InsertEventResult> {
  const { data, error } = await supabase
    .from("events")
    .insert({ ...intent, owner_id: userId, source_tool_call_id: toolCallId })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const existing = await supabase
      .from("events")
      .select("id")
      .eq("owner_id", userId)
      .eq("source_tool_call_id", toolCallId)
      .single();
    const id = existing.data?.id as string | undefined;
    if (id) return { id };
    return { error: "Could not create the event. Please try again." };
  }

  if (error || !data?.id) {
    console.error("[insertEvent]", error);
    return { error: "Could not create the event. Please try again." };
  }

  return { id: data.id as string };
}
