import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { listApplications } from "@/lib/cohost";
import { callerFrom } from "@/lib/mcp/caller";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const reviewApplicationsTool = {
  name: "review_applications",
  description:
    "List co-host applications and accepted invites waiting on the signed-in host. Status applied means the company asked to join. Status accepted means they accepted a host invite.",
  schema: {},
  async run(_args: Record<string, never>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase, userId } = callerFrom(extra);
    const result = await listApplications(supabase, userId);
    if ("error" in result) return toolFailed(result.error, ["Try review_applications again."]);

    return toolSuccess(
      result.applications.length === 0
        ? "No applications are waiting."
        : `${result.applications.length} application${result.applications.length === 1 ? "" : "s"} waiting on you.`,
      {
        nextActions:
          result.applications.length === 0
            ? ["Nothing to approve. Offer to browse events or create one."]
            : [
                "Summarize each company, event, and note. Ask the user which one to approve or reject, then call decide_cohost.",
              ],
        data: { applications: result.applications },
      },
    );
  },
};
