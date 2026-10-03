import { redirect } from "next/navigation";
import { CoverPill, EventCover, cardGrid } from "@/components/event-card";
import { InviteStatusBadge } from "@/components/events/invite-status";
import { pageTitle } from "@/components/styles";
import { loadInbox } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { RespondForm } from "./respond-form";

// The event's own time zone, not the server's.
const formatDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

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

  const { invites, error } = await loadInbox(supabase);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-24 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={pageTitle}>Inbox</h1>
        <p className="text-ink-2">Invites from hosts, and the events you applied to co-host.</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-brand">
          Could not load invites.
        </p>
      ) : invites.length === 0 ? (
        <p className="reveal text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>
          No invites or applications yet. Invites from hosts and your applications to co-host show up here.
        </p>
      ) : (
        <ul className={cardGrid}>
          {invites.map((invite, index) => (
            <li
              key={invite.id}
              id={`invite-${invite.id}`}
              className="reveal flex min-w-0 scroll-mt-24 flex-col gap-3"
              style={{ "--i": index + 1 } as React.CSSProperties}
            >
              <EventCover
                seed={invite.title}
                date={invite.dateStart}
                timezone={invite.timezone}
                badge={
                  invite.status === "pending" && invite.requestedBy === "host" ? (
                    <CoverPill>Waiting for you</CoverPill>
                  ) : (
                    <InviteStatusBadge status={invite.status} />
                  )
                }
              />
              <div className="flex flex-col gap-0.5 px-0.5">
                <h2 className="font-medium text-ink">{invite.title}</h2>
                {invite.host && <p className="text-sm text-ink-2">From {invite.host}</p>}
                <p className="text-sm text-ink-2">
                  {invite.city} · {invite.datesFlexible && "Flexible, "}
                  {formatDate(invite.dateStart, invite.timezone)} – {formatDate(invite.dateEnd, invite.timezone)}
                </p>
                <p className="mt-1 text-sm text-ink">{invite.topic}</p>
              </div>
              {invite.note && (
                <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-2">Your note: {invite.note}</p>
              )}
              {invite.status === "applied" && (
                <p className="text-sm text-ink-2">Waiting on the host.</p>
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
