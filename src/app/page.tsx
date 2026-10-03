import Link from "next/link";
import { redirect } from "next/navigation";
import { CoverPill, EventCard, cardGrid } from "@/components/event-card";
import { InviteStatusBadge } from "@/components/events/invite-status";
import { pageTitle } from "@/components/ui";
import { loadInbox } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

const isPast = (end: string) => new Date(end).getTime() < Date.now();

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!profile) redirect("/profile");

  // RLS returns only the signed-in user's events.
  const [{ data: events }, inbox] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, topic, city, date_start, date_end, timezone")
      .order("date_start", { ascending: true }),
    loadInbox(supabase),
  ]);

  const eventList = events ?? [];
  // Invites that need an answer come first.
  const invites = [...inbox.invites]
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
    .slice(0, 4);
  const waiting = inbox.invites.filter((invite) => invite.status === "pending").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pb-24 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={`${pageTitle} [overflow-wrap:anywhere]`}>{profile.name}</h1>
        <p className="text-ink-2">
          {plural(eventList.length, "event")} planned
          {waiting > 0 && (
            <>
              {" · "}
              <Link href="/inbox" className="whitespace-nowrap font-medium text-accent underline-offset-4 hover:underline">
                {plural(waiting, "invite")} waiting for you
              </Link>
            </>
          )}
        </p>
      </header>

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
          <p role="alert" className="text-sm text-accent">
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
                  invite.status === "pending" ? (
                    <CoverPill>
                      <span aria-hidden className="mr-1.5 size-1.5 rounded-full bg-accent" />
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
