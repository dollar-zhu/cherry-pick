import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { Profile } from "@/lib/contracts";
import { callerFrom } from "@/lib/mcp/caller";
import { upsertCompanyProfile } from "@/lib/profile";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

function profileFields() {
  let current: z.ZodTypeAny = Profile;
  while (current instanceof z.ZodEffects) current = current.innerType();
  if (!(current instanceof z.ZodObject)) throw new Error("Profile schema is not an object.");
  return current.shape;
}

export const saveCompanyProfileTool = {
  name: "save_company_profile",
  description:
    "Save the signed-in company's profile. Call only after the user has given the name, description, city, audience, and at least one topic. " +
    "Topics are the events and subjects they want. Set has_venue false and venue fields null unless they offer a venue.",
  schema: profileFields(),
  async run(args: Record<string, unknown>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase, userId } = callerFrom(extra);
    const result = await upsertCompanyProfile(supabase, userId, args);
    if ("error" in result) {
      return toolFailed(result.error, ["Ask the user for the field that failed, then call save_company_profile again."]);
    }
    return toolSuccess(`Saved ${result.profile.name} in ${result.profile.city}.`, {
      nextActions: [
        "Ask whether they want to create an event or browse events posted by other companies.",
      ],
      data: { profile: result.profile },
    });
  },
};
