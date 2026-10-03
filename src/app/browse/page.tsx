import { redirect } from "next/navigation";
import { CoverPill, EventCover, cardGrid } from "@/components/event-card";
import { InviteStatusBadge, isInviteStatus } from "@/components/events/invite-status";
import { pageTitle } from "@/components/styles";
import { listPostedEvents } from "@/lib/cohost";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

const formatDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

export default async function BrowsePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login?next=/browse");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/browse");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const result = await listPostedEvents(supabase);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-24 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={pageTitle}>Browse events</h1>
        <p className="text-ink-2">Events from other companies. Apply to co-host, and the host approves or rejects.</p>
      </header>

      {"error" in result ? (
        <p role="alert" className="text-sm text-brand">
          {result.error}
        </p>
      ) : result.events.length === 0 ? (
        <p className="reveal text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>
          No upcoming events from other companies yet.
        </p>
      ) : (
        <ul className={cardGrid}>
          {result.events.map((event, index) => {
            const status = event.application_status && isInviteStatus(event.application_status)
              ? event.application_status
              : null;
            return (
              <li
                key={event.id}
                className="reveal flex min-w-0 flex-col gap-3"
                style={{ "--i": index + 1 } as React.CSSProperties}
              >
                <EventCover
                  tone={index}
                  date={event.date_start}
                  timezone={event.timezone}
                  badge={status ? <InviteStatusBadge status={status} /> : <CoverPill>{event.guest_count} guests</CoverPill>}
                />
                <div className="flex flex-col gap-0.5 px-0.5">
                  <h2 className="font-medium text-ink">{event.title}</h2>
                  <p className="text-sm text-ink-2">
                    {event.host_name ? `Hosted by ${event.host_name}` : "Hosted by another company"}
                  </p>
                  <p className="text-sm text-ink-2">
                    {event.city} · {event.dates_flexible ? "Flexible, " : ""}
                    {formatDate(event.date_start, event.timezone)}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {event.topic} · {event.format}
                  </p>
                </div>
                {status === "pending" ? (
                  <a href="/inbox" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
                    The host invited you. Reply in your inbox.
                  </a>
                ) : status ? (
                  <p className="text-sm text-ink-2">
                    {status === "applied" ? "Waiting on the host." : "You already have a request for this event."}
                  </p>
                ) : (
                  <ApplyForm eventId={event.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
