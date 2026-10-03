import type { SupabaseClient } from "@supabase/supabase-js";
import { pendingApproval, toolFailed, type ToolResponse } from "@/lib/tool-response";
import { siteUrl } from "@/lib/site";

export type ApprovalExecutor = (ctx: {
  supabase: SupabaseClient;
  approval: ApprovalRecord;
}) => Promise<Record<string, unknown>>;

export type ApprovalRecord = {
  id: string;
  user_id: string;
  event_id: string | null;
  action: string;
  exact_scope: Record<string, unknown>;
  credits: number | null;
  status: "pending" | "approved" | "rejected" | "executed";
  requested_by: "agent" | "human";
  decided_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
};

const executors = new Map<string, ApprovalExecutor>();

/** Feature tools register the function that runs after a human approves. */
export function registerApprovalExecutor(action: string, execute: ApprovalExecutor) {
  executors.set(action, execute);
}

export function approveUrl(approvalId: string) {
  return `${siteUrl()}/approvals/${approvalId}`;
}

export async function requestApproval(
  supabase: SupabaseClient,
  input: {
    eventId?: string | null;
    action: string;
    exactScope: Record<string, unknown>;
    credits?: number | null;
    requestedBy?: "agent" | "human";
    summary: string;
  },
): Promise<ToolResponse> {
  const { data, error } = await supabase
    .from("approvals")
    .insert({
      event_id: input.eventId ?? null,
      action: input.action,
      exact_scope: input.exactScope,
      credits: input.credits ?? null,
      requested_by: input.requestedBy ?? "agent",
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[requestApproval]", error);
    return toolFailed("Could not open an approval request.");
  }

  const id = data.id as string;
  return pendingApproval({
    approvalId: id,
    action: input.action,
    exactScope: input.exactScope,
    estimatedCredits: input.credits ?? undefined,
    approveUrl: approveUrl(id),
    summary: input.summary,
  });
}

export async function runApprovedAction(
  supabase: SupabaseClient,
  approval: ApprovalRecord,
): Promise<{ error?: string }> {
  const execute = executors.get(approval.action);
  if (!execute) return {};

  try {
    const result = await execute({ supabase, approval });
    const { error } = await supabase.rpc("complete_approval", {
      p_id: approval.id,
      p_result: result,
    });
    if (error) return { error: "The action was approved but could not be marked executed." };
    return {};
  } catch (err) {
    console.error("[runApprovedAction]", err);
    return { error: "The action was approved but running it failed." };
  }
}
