import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { listPostedEvents } from "@/lib/cohost";
import { missingProfileFields } from "@/lib/contracts";
import { callerFrom } from "@/lib/mcp/caller";
import { toolBlocked, toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const browsePostedEventsTool = {
  name: "browse_posted_events",
  description:
    "List upcoming events posted by other companies. Each row says whether this company already applied. Budget and partner criteria are not included.",
  schema: {},
  async run(_args: Record<string, never>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase, userId } = callerFrom(extra);
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, description, city, audience, topics")
      .eq("user_id", userId)
      .maybeSingle();
    const missing = missingProfileFields(profile);
    if (missing.length > 0) {
      return toolBlocked("The company profile is not ready to browse yet.", [
        `Ask for ${missing.join(", ")}, then call save_company_profile.`,
      ]);
    }

    const result = await listPostedEvents(supabase);
    if ("error" in result) return toolFailed(result.error, ["Try browse_posted_events again."]);

    const events = result.events.map((event) => ({
      eventId: event.id,
      title: event.title,
      topic: event.topic,
      format: event.format,
      city: event.city,
      timezone: event.timezone,
      dateStart: event.date_start,
      dateEnd: event.date_end,
      datesFlexible: event.dates_flexible,
      guestCount: event.guest_count,
      hostName: event.host_name,
      applicationStatus: event.application_status,
    }));

    return toolSuccess(
      events.length === 0
        ? "No upcoming events from other companies."
        : `${events.length} upcoming event${events.length === 1 ? "" : "s"} from other companies.`,
      {
        nextActions:
          events.length === 0
            ? ["Offer to create an event with create_event_intent."]
            : ["Summarize the events. If the user wants one, call apply_to_cohost with its eventId."],
        data: { events },
      },
    );
  },
};
