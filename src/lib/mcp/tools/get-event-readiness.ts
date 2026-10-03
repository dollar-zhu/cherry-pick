import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { approveUrl } from "@/lib/approvals";
import { callerFrom } from "@/lib/mcp/caller";
import {
  deriveReadiness,
  emptyInviteCounts,
  eventNotFound,
  type InviteCounts,
} from "@/lib/mcp/readiness";
import { siteUrl } from "@/lib/site";
import type { ToolResponse } from "@/lib/tool-response";

const INVITE_STATUSES = ["pending", "accepted", "applied", "approved", "declined", "rejected"] as const;

export const getEventReadinessTool = {
  name: "get_event_readiness",
  description:
    "Read an event's stage, blockers, pending approvals, credit balance, and what to do next. Derived from table state.",
  schema: {
    eventId: z.string().uuid().describe("Event id"),
  },
  async run(args: { eventId: string }, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { supabase } = callerFrom(extra);
    const { data: event } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", args.eventId)
      .maybeSingle();
    if (!event) return eventNotFound();

    const [{ count: candidateCount }, { data: inviteRows }, { data: approvalRows }, credits] =
      await Promise.all([
        supabase
          .from("event_candidates")
          .select("id", { count: "exact", head: true })
          .eq("event_id", args.eventId),
        supabase.from("invites").select("status").eq("event_id", args.eventId),
        supabase
          .from("approvals")
          .select("id, action")
          .eq("event_id", args.eventId)
          .eq("status", "pending"),
        creditBalance(supabase),
      ]);

    const invites = emptyInviteCounts();
    for (const row of inviteRows ?? []) {
      const status = row.status as keyof InviteCounts;
      if (INVITE_STATUSES.includes(status)) invites[status] += 1;
    }

    return deriveReadiness({
      eventId: event.id as string,
      eventUrl: `${siteUrl()}/events/${event.id}`,
      title: event.title as string,
      candidateCount: candidateCount ?? 0,
      invites,
      pendingApprovals: (approvalRows ?? []).map((row) => ({
        id: row.id as string,
        action: row.action as string,
        approveUrl: approveUrl(row.id as string),
      })),
      credits,
    });
  },
};

async function creditBalance(supabase: ReturnType<typeof callerFrom>["supabase"]) {
  const { data, error } = await supabase.from("credit_ledger").select("amount");
  if (error || !data) return null;
  return data.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}
