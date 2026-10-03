import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { missingProfileFields } from "@/lib/contracts";
import { callerFrom } from "@/lib/mcp/caller";
import { toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const whoamiTool = {
  name: "whoami",
  description:
    "Return the signed-in company, which profile fields are still missing, and whether they can host or partner. Call this first.",
  schema: {},
  async run(_args: Record<string, never>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase, userId } = callerFrom(extra);
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, description, city, audience, topics, website_url, has_venue, is_seeking_partners")
      .eq("user_id", userId)
      .maybeSingle();

    const missing = missingProfileFields(profile);
    if (!profile || missing.length > 0) {
      return toolSuccess(profile ? `${profile.name} still needs a few company details.` : "Signed in, with no company profile yet.", {
        nextActions: [`Ask for ${missing.join(", ")}, then call save_company_profile.`],
        data: { userId, profile, missing, profileComplete: false },
      });
    }

    const roles = {
      host: true,
      partner: Boolean(profile.is_seeking_partners),
      hasVenue: Boolean(profile.has_venue),
    };

    return toolSuccess(`${profile.name} in ${profile.city}.`, {
      data: { userId, profile, roles, missing: [], profileComplete: true },
      nextActions: ["Ask whether they want to create an event or browse events posted by other companies."],
    });
  },
};
