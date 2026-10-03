import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(
  supabase: SupabaseClient,
  input: {
    eventId?: string | null;
    actor: "agent" | "human" | "system";
    action: string;
    outcome: string;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.rpc("write_audit_log", {
    p_event_id: input.eventId ?? null,
    p_actor: input.actor,
    p_action: input.action,
    p_outcome: input.outcome,
    p_detail: input.detail ?? {},
  });
  if (error) console.error("[audit]", error.message);
}
