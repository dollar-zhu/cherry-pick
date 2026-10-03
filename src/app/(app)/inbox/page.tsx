import { redirect } from "next/navigation";
import { z } from "zod";
import { InviteStatusBadge, isInviteStatus } from "@/components/events/invite-status";
import { createClient } from "@/lib/supabase/server";
import { RespondForm } from "./respond-form";

// The event's own time zone, not the server's.
const formatDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

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

export default async function InboxPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!profile) redirect("/profile");

  const { data: rows, error } = await supabase.rpc("my_invites");
  if (error) console.error("[inbox]", error);
  const invites = (Array.isArray(rows) ? rows : [])
    .flatMap((row) => {
      const parsed = inboxRow.safeParse(row);
      if (!parsed.success || !isInviteStatus(parsed.data.status)) return [];
      return [
        {
          id: parsed.data.id,
          status: parsed.data.status,
          note: parsed.data.note,
          title: parsed.data.event_title,
          city: parsed.data.event_city,
          topic: parsed.data.event_topic,
          when: `${parsed.data.event_dates_flexible ? "Flexible, " : ""}${formatDate(parsed.data.event_date_start, parsed.data.event_timezone)} – ${formatDate(parsed.data.event_date_end, parsed.data.event_timezone)}`,
          host: parsed.data.host_name,
          requestedBy: parsed.data.requested_by,
          createdAt: parsed.data.created_at,
        },
      ];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load invites.
        </p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invites or applications yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="glass rounded-lg flex flex-col gap-3 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{invite.title}</p>
                  {invite.host && <p className="text-sm text-muted-foreground">From {invite.host}</p>}
                  <p className="text-sm text-muted-foreground">
                    {invite.city} · {invite.when}
                  </p>
                  <p className="text-sm text-muted-foreground">{invite.topic}</p>
                </div>
                <InviteStatusBadge status={invite.status} />
              </div>
              {invite.note && (
                <p className="text-sm text-muted-foreground">Your note: {invite.note}</p>
              )}
              {invite.status === "applied" && (
                <p className="text-sm text-muted-foreground">Waiting on the host.</p>
              )}
              {invite.status === "pending" && invite.requestedBy === "host" && (
                <RespondForm inviteId={invite.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
