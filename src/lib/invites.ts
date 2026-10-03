import { cache } from "react";
import { z } from "zod";
import { isInviteStatus, type InviteStatus } from "@/components/events/invite-status";
import { createClient } from "@/lib/supabase/server";

const inboxRow = z.object({
  id: z.string().uuid(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
  requested_by: z.enum(["host", "partner"]).default("host"),
  event_title: z.string(),
  event_city: z.string(),
  event_topic: z.string(),
  event_date_start: z.string(),
  event_date_end: z.string(),
  event_timezone: z.string(),
  event_dates_flexible: z.boolean(),
  host_name: z.string().nullable(),
});

export type InboxInvite = {
  id: string;
  status: InviteStatus;
  note: string | null;
  title: string;
  city: string;
  topic: string;
  dateStart: string;
  dateEnd: string;
  timezone: string;
  datesFlexible: boolean;
  host: string | null;
  /** "partner" when your company applied, "host" when the host invited you. */
  requestedBy: "host" | "partner";
  createdAt: string;
};

/** An invite from a host that this company has not answered yet. */
export const needsReply = (invite: InboxInvite) => invite.status === "pending" && invite.requestedBy === "host";

/**
 * Invites sent to the signed-in user's company, newest first.
 * Cached per request: the top bar and the page share one call.
 */
export const loadInbox = cache(async () => {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("my_invites");
  if (error) console.error("[inbox]", error);
  const invites: InboxInvite[] = (Array.isArray(rows) ? rows : [])
    .flatMap((row) => {
      const parsed = inboxRow.safeParse(row);
      if (!parsed.success || !isInviteStatus(parsed.data.status)) return [];
      const r = parsed.data;
      return [
        {
          id: r.id,
          status: parsed.data.status as InviteStatus,
          note: r.note,
          title: r.event_title,
          city: r.event_city,
          topic: r.event_topic,
          dateStart: r.event_date_start,
          dateEnd: r.event_date_end,
          timezone: r.event_timezone,
          datesFlexible: r.event_dates_flexible,
          host: r.host_name,
          requestedBy: r.requested_by,
          createdAt: r.created_at,
        },
      ];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { invites, error };
});

/** The signed-in company's name. Cached per request like loadInbox. */
export const loadCompanyName = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;
  const { data } = await supabase.from("profiles").select("name").eq("user_id", auth.claims.sub).maybeSingle();
  return data?.name ?? null;
});
