import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { approveUrl } from "@/lib/approvals";
import { callerFrom } from "@/lib/mcp/caller";
import { toolBlocked, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const getApprovalStatusTool = {
  name: "get_approval_status",
  description: "Read an approval request. Poll this after the human opens the approve link.",
  schema: {
    approvalId: z.string().uuid().describe("Approval id returned with pending_approval"),
  },
  async run(args: { approvalId: string }, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase } = callerFrom(extra);
    const { data } = await supabase
      .from("approvals")
      .select("id, event_id, action, exact_scope, credits, status, requested_by, decided_at, result, created_at")
      .eq("id", args.approvalId)
      .maybeSingle();

    if (!data) return toolBlocked("Approval not found.");

    const status = data.status as string;
    const nextActions =
      status === "pending"
        ? [`Waiting on the human at ${approveUrl(data.id as string)}.`]
        : status === "approved"
          ? ["Approved. The action runs when its tool is connected."]
          : status === "executed"
            ? ["The action has run. Continue from the result."]
            : ["The human rejected this. Revise the scope before asking again."];

    return toolSuccess(`Approval ${data.action} is ${status}.`, {
      resourceId: data.id as string,
      nextActions,
      data: {
        ...data,
        eventId: data.event_id,
        approveUrl: approveUrl(data.id as string),
      },
    });
  },
};
