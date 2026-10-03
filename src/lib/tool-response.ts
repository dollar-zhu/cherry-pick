/**
 * Every MCP tool returns this envelope. Consequential tools stop at
 * `pending_approval` and include the exact thing the human must approve.
 */
export type ToolStatus = "success" | "pending_approval" | "blocked" | "failed";

export type ApprovalRequired = {
  approvalId: string;
  action: string;
  exactScope: Record<string, unknown>;
  estimatedCredits?: number;
  approveUrl: string;
};

export type ToolResponse = {
  status: ToolStatus;
  resourceId?: string;
  summary: string;
  nextActions: string[];
  approvalRequired?: ApprovalRequired;
  data?: unknown;
};

export function toolSuccess(summary: string, extra?: Partial<ToolResponse>): ToolResponse {
  return { ...extra, status: "success", summary, nextActions: extra?.nextActions ?? [] };
}

export function toolFailed(summary: string, nextActions: string[] = []): ToolResponse {
  return { status: "failed", summary, nextActions };
}

export function toolBlocked(summary: string, nextActions: string[] = []): ToolResponse {
  return { status: "blocked", summary, nextActions };
}

export function pendingApproval(input: {
  approvalId: string;
  action: string;
  exactScope: Record<string, unknown>;
  estimatedCredits?: number;
  approveUrl: string;
  summary: string;
  nextActions?: string[];
}): ToolResponse {
  return {
    status: "pending_approval",
    resourceId: input.approvalId,
    summary: input.summary,
    nextActions: input.nextActions ?? ["Open the approval link and approve or reject the exact scope."],
    approvalRequired: {
      approvalId: input.approvalId,
      action: input.action,
      exactScope: input.exactScope,
      estimatedCredits: input.estimatedCredits,
      approveUrl: input.approveUrl,
    },
  };
}
