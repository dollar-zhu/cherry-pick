import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { applyToEvent } from "@/lib/cohost";
import { callerFrom } from "@/lib/mcp/caller";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const applyToCohostTool = {
  name: "apply_to_cohost",
  description:
    "Apply to co-host an event another company posted. Call only after the user picks that event. An optional note goes to the host.",
  schema: {
    eventId: z.string().uuid().describe("Event id from browse_posted_events"),
    note: z.string().max(500).optional().describe("Optional note for the host"),
  },
  async run(
    args: { eventId: string; note?: string },
    extra: { authInfo?: AuthInfo },
  ): Promise<ToolResponse> {
    const { supabase } = callerFrom(extra);
    const result = await applyToEvent(supabase, args.eventId, args.note ?? "");
    if ("error" in result) {
      return toolFailed(result.error, ["Tell the user what went wrong. Do not say the application was sent."]);
    }
    return toolSuccess("Applied to co-host this event. The host can approve or reject it.", {
      resourceId: result.applicationId,
      nextActions: ["Tell the user the host still has to decide."],
      data: { eventId: args.eventId, applicationId: result.applicationId, status: "applied" },
    });
  },
};
