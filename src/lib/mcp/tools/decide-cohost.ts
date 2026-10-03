import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { decideCohost } from "@/lib/cohost";
import { callerFrom } from "@/lib/mcp/caller";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const decideCohostTool = {
  name: "decide_cohost",
  description:
    "Approve or reject one co-host application on the signed-in host's event. Call only after the user explicitly names that company and says approve or reject.",
  schema: {
    applicationId: z.string().uuid().describe("Invite id from review_applications"),
    approve: z.boolean().describe("True to approve, false to reject"),
  },
  async run(
    args: { applicationId: string; approve: boolean },
    extra: { authInfo?: AuthInfo },
  ): Promise<ToolResponse> {
    const { supabase } = callerFrom(extra);
    const result = await decideCohost(supabase, args.applicationId, args.approve);
    if ("error" in result) {
      return toolFailed(result.error, ["Do not say the decision was saved."]);
    }
    const verb = result.status === "approved" ? "Approved" : "Rejected";
    return toolSuccess(`${verb} the co-host application.`, {
      resourceId: args.applicationId,
      data: { applicationId: args.applicationId, status: result.status },
    });
  },
};
