import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { missingProfileFields } from "@/lib/contracts";
import { callerFrom } from "@/lib/mcp/caller";
import { cityIlikePattern, rankCohosts, type CohostCompany } from "@/lib/matching-constraints";
import { toolBlocked, toolSuccess, type ToolResponse } from "@/lib/tool-response";

type InviteRow = {
  id: string;
  status: string;
  event_title: string;
  event_city: string;
  event_topic: string;
  event_date_start: string;
  host_name: string | null;
};

export const browseCohostOpportunitiesTool = {
  name: "browse_cohost_opportunities",
  description:
    "List cohosting opportunities for the signed-in company: invites already sent to them, and other companies in their city that are looking for partners, closest topics first.",
  schema: {},
  async run(_args: Record<string, never>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase, userId } = callerFrom(extra);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, description, city, audience, topics")
      .eq("user_id", userId)
      .maybeSingle();

    const missing = missingProfileFields(profile);
    if (missing.length > 0) {
      return toolBlocked("The company profile is not ready to browse yet.", [
        `Ask for ${missing.join(", ")}, then call save_company_profile.`,
      ]);
    }

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, name, city, description, audience, topics, has_venue, is_seeking_partners")
      .eq("is_seeking_partners", true)
      .ilike("city", cityIlikePattern(profile!.city))
      .order("name");
    if (error) {
      console.error("[browse_cohost_opportunities]", error);
      return toolBlocked("Could not load companies in this city.");
    }

    const companies: CohostCompany[] = (rows ?? [])
      .filter((row) => row.id !== profile!.id)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        city: row.city as string,
        audience: (row.audience as string) ?? "",
        topics: (row.topics as string[]) ?? [],
        description: (row.description as string) ?? "",
        hasVenue: Boolean(row.has_venue),
      }));
    const ranked = rankCohosts((profile!.topics as string[]) ?? [], companies);

    const { data: invites, error: inviteError } = await supabase.rpc("my_invites");
    if (inviteError) console.error("[browse_cohost_opportunities invites]", inviteError);
    const openInvites = ((invites ?? []) as InviteRow[]).filter((invite) =>
      invite.status === "pending" || invite.status === "accepted",
    );

    const summary = [
      openInvites.length
        ? `${openInvites.length} open invite${openInvites.length === 1 ? "" : "s"}`
        : "No open invites",
      `${ranked.length} compan${ranked.length === 1 ? "y" : "ies"} in ${profile!.city} looking for partners`,
    ].join(". ") + ".";

    return toolSuccess(summary, {
      nextActions: [
        "Summarize the closest companies and any invites, then ask which path they want.",
        "To host instead, collect an event brief and call create_event_intent.",
      ],
      data: {
        city: profile!.city,
        invites: openInvites.map((invite) => ({
          id: invite.id,
          status: invite.status,
          eventTitle: invite.event_title,
          eventCity: invite.event_city,
          topic: invite.event_topic,
          when: invite.event_date_start,
          hostName: invite.host_name,
        })),
        companies: ranked.map((company) => ({
          id: company.id,
          name: company.name,
          city: company.city,
          audience: company.audience,
          topics: company.topics,
          sharedTopics: company.sharedTopics,
          hasVenue: company.hasVenue,
          description: company.description,
        })),
      },
    });
  },
};
