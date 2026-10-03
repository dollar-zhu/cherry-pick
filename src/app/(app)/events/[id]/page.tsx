import { notFound } from "next/navigation";
import { z } from "zod";
import { formatBudget } from "@/lib/intent";
import { formatWeekdays } from "@/lib/matching-constraints";
import { createClient } from "@/lib/supabase/server";
import { FindMatchesButton } from "./find-matches-button";
import { MatchesTable, type MatchRow } from "@/components/events/matches-table";
import { ApprovalQueue, type ApprovalRow } from "@/components/events/approval-queue";
import { InviteList, type InviteListRow } from "@/components/events/invite-list";
import { isInviteStatus, type InviteStatus } from "@/components/events/invite-status";
import { pageTitle } from "@/components/styles";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  // RLS limits rows to the signed-in owner, so other users' events 404.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, topic, goal, format, city, timezone, date_start, date_end, guest_count, budget_cap_cents, currency, dates_flexible, allowed_weekdays, needs_venue, required_amenities")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();
  // Show the event in its own time zone, not the server's.
  const dateFormat = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  });

  const { data: candidateRows, error: candidateError } = await supabase
    .from("event_candidates")
    .select("id, profile_id, score, reasons, open_questions, profiles(name, city, is_demo)")
    .eq("event_id", id)
    .order("score", { ascending: false, nullsFirst: false });

  const candidates: MatchRow[] = (candidateRows ?? []).map((row) => {
    // Supabase returns a to-one join as an object; cast through unknown to satisfy TS.
    const profile = row.profiles as unknown as { name: string; city: string; is_demo: boolean } | null;
    return {
      id: row.id as string,
      profileId: row.profile_id as string,
      profileName: profile?.name ?? "Unknown",
      profileCity: profile?.city ?? "",
      isDemo: profile?.is_demo ?? false,
      score: row.score == null ? null : Number(row.score),
      reasons: (row.reasons as string[]) ?? [],
      openQuestions: (row.open_questions as string[]) ?? [],
    };
  });

  const { data: inviteRows, error: inviteError } = await supabase
    .from("invites")
    .select("id, profile_id, status, note, profiles(name, is_demo)")
    .eq("event_id", id)
    .order("created_at", { ascending: false });
  if (inviteError) console.error("[event invites]", inviteError);

  const invites: InviteListRow[] = [];
  const awaitingDecision: ApprovalRow[] = [];
  const inviteStatus: Record<string, InviteStatus> = {};
  for (const row of inviteRows ?? []) {
    if (!isInviteStatus(row.status)) continue;
    const profile = row.profiles as unknown as { name: string; is_demo: boolean } | null;
    const invite: InviteListRow = {
      id: row.id as string,
      profileName: profile?.name ?? "Unknown",
      isDemo: profile?.is_demo ?? false,
      status: row.status,
      note: (row.note as string | null) ?? null,
    };
    invites.push(invite);
    inviteStatus[row.profile_id as string] = row.status;
    if (row.status === "accepted" || row.status === "applied") awaitingDecision.push(invite);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 pb-24 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={`${pageTitle} [overflow-wrap:anywhere]`}>{event.title}</h1>
        <p className="text-ink-2">
          {event.city} · {dateFormat.format(new Date(event.date_start))}
        </p>
      </header>

      <dl
        className="reveal grid grid-cols-1 gap-x-4 gap-y-1 rounded-3xl border border-rule bg-card p-5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-y-3 sm:p-8 [&>dd]:mb-2 sm:[&>dd]:mb-0"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <dt className="text-ink-2">Topic</dt>
        <dd>{event.topic}</dd>
        <dt className="text-ink-2">Goal</dt>
        <dd>{event.goal}</dd>
        <dt className="text-ink-2">Format</dt>
        <dd>{event.format}</dd>
        <dt className="text-ink-2">City</dt>
        <dd>{event.city}</dd>
        <dt className="text-ink-2">When</dt>
        <dd>
          {dateFormat.format(new Date(event.date_start))} –{" "}
          {dateFormat.format(new Date(event.date_end))}
        </dd>
        {event.dates_flexible && (
          <>
            <dt className="text-ink-2">Weekdays</dt>
            <dd>{event.allowed_weekdays ? formatWeekdays(event.allowed_weekdays) : "Any"} (flexible dates)</dd>
          </>
        )}
        <dt className="text-ink-2">Venue</dt>
        <dd>
          {event.needs_venue
            ? `A partner provides it${event.required_amenities.length ? `; must have ${event.required_amenities.join(", ")}` : ""}`
            : "Not needed"}
        </dd>
        <dt className="text-ink-2">Guests</dt>
        <dd>{event.guest_count}</dd>
        <dt className="text-ink-2">Budget cap</dt>
        <dd>{formatBudget(event.budget_cap_cents, event.currency, "en")}</dd>
      </dl>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-2xl tracking-[-0.01em]">Co-host matches</h2>
          <FindMatchesButton eventId={id} />
        </div>
        {candidateError ? (
          <p role="alert" className="text-sm text-brand">
            Saved matches could not be loaded. Reload the page or click Find matches.
          </p>
        ) : (
          <MatchesTable rows={candidates} eventId={id} inviteStatus={inviteStatus} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-[-0.01em]">Invites</h2>
        {inviteError ? (
          <p role="alert" className="text-sm text-brand">
            Could not load invites.
          </p>
        ) : (
          <InviteList rows={invites} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-[-0.01em]">Approval queue</h2>
        {inviteError ? (
          <p role="alert" className="text-sm text-brand">
            Could not load invites.
          </p>
        ) : (
          <ApprovalQueue rows={awaitingDecision} />
        )}
      </section>
    </main>
  );
}
