import Link from "next/link";
import { CoverPill, EventCard, cardGrid } from "@/components/event-card";
import { IncomingApplications } from "@/components/events/incoming-applications";
import { InviteStatusBadge } from "@/components/events/invite-status";
import { pageTitle } from "@/components/styles";
import { listApplications } from "@/lib/cohost";
import { loadInbox } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

const isPast = (end: string) => new Date(end).getTime() < Date.now();

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function Home() {
  // The (app) layout already sends signed-out users and users with no profile away.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub ?? "";

  // RLS returns only the signed-in user's events.
  const [{ data: profile }, { data: events }, inbox, applications] = await Promise.all([
    supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle(),
    supabase
      .from("events")
      .select("id, title, topic, city, date_start, date_end, timezone")
      .order("date_start", { ascending: true }),
    loadInbox(supabase),
    listApplications(supabase, userId),
  ]);

  const eventList = events ?? [];
  const needsReply = (invite: (typeof inbox.invites)[number]) =>
    invite.status === "pending" && invite.requestedBy === "host";
  // Invites that need an answer come first.
  const invites = [...inbox.invites]
    .sort((a, b) => Number(needsReply(b)) - Number(needsReply(a)))
    .slice(0, 4);
  const waiting = inbox.invites.filter(needsReply).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pb-24 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={`${pageTitle} [overflow-wrap:anywhere]`}>{profile?.name ?? "Your company"}</h1>
        <p className="text-ink-2">
          {plural(eventList.length, "event")} planned
          {waiting > 0 && (
            <>
              {" · "}
              <Link href="/inbox" className="whitespace-nowrap font-medium text-brand underline-offset-4 hover:underline">
                {plural(waiting, "invite")} waiting for you
              </Link>
            </>
          )}
        </p>
      </header>

      {"error" in applications ? (
        <p role="alert" className="text-sm text-brand">
          Could not load applications.
        </p>
      ) : (
        <IncomingApplications rows={applications.applications} />
      )}

      <section aria-labelledby="events-heading" className="flex flex-col gap-6">
        <h2 id="events-heading" className="font-display text-2xl tracking-[-0.01em]">
          Your events
        </h2>
        <ul className={cardGrid}>
          {eventList.map((event, index) => (
            <EventCard
              key={event.id}
              index={index + 1}
              href={`/events/${event.id}`}
              title={event.title}
              city={event.city}
              meta={event.topic}
              date={event.date_start}
              timezone={event.timezone}
              badge={isPast(event.date_end) ? <CoverPill>Past</CoverPill> : undefined}
            />
          ))}
          <li className="reveal min-w-0" style={{ "--i": eventList.length + 1 } as React.CSSProperties}>
            <Link
              href="/events/new"
              className="group flex aspect-[3/2] flex-col min-[480px]:aspect-[4/3] items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-2/40 text-ink-2 transition-colors duration-[var(--dur-short)] hover:border-ink hover:text-ink"
            >
              <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-paper-2 text-2xl transition-transform duration-[var(--dur-short)] ease-[var(--ease-out)] group-hover:scale-110"
              >
                +
              </span>
              <span className="text-sm font-medium">
                {eventList.length ? "Plan another event" : "Plan your first event"}
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="inbox-heading" className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="inbox-heading" className="font-display text-2xl tracking-[-0.01em]">
            Inbox
          </h2>
          {inbox.invites.length > 0 && (
            <Link href="/inbox" className="whitespace-nowrap text-sm font-medium text-ink underline-offset-4 hover:underline">
              See all {inbox.invites.length}
            </Link>
          )}
        </div>
        {inbox.error ? (
          <p role="alert" className="text-sm text-brand">
            Could not load invites.
          </p>
        ) : invites.length === 0 ? (
          <p className="text-ink-2">
            No invites yet. When another company asks you to co-host, it shows up here.
          </p>
        ) : (
          <ul className={cardGrid}>
            {invites.map((invite, index) => (
              <EventCard
                key={invite.id}
                index={eventList.length + index + 2}
                href={`/inbox#invite-${invite.id}`}
                title={invite.title}
                city={invite.city}
                meta={invite.host ? `From ${invite.host}` : invite.topic}
                date={invite.dateStart}
                timezone={invite.timezone}
                badge={
                  needsReply(invite) ? (
                    <CoverPill>
                      <span aria-hidden className="mr-1.5 size-1.5 rounded-full bg-brand" />
                      Waiting for you
                    </CoverPill>
                  ) : (
                    <InviteStatusBadge status={invite.status} />
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
