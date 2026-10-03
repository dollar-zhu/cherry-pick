/**
 * Response envelope every MCP tool returns (SUP-17): a status the caller can
 * branch on, a one-line summary for humans and models, and what to do next.
 */
export type ToolStatus = "success" | "pending_approval" | "blocked" | "failed";

export type ToolResponse<T = undefined> = {
  status: ToolStatus;
  summary: string;
  nextActions: string[];
  approvalRequired?: { action: string; reason: string; creditCost: number };
  data?: T;
};
