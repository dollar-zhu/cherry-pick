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
import { FlierPanel } from "@/components/events/flier-panel";
import { flierFileName, loadLatestFlier } from "@/lib/flier/store";

// Flier generation (a server action on this page) waits on the image model.
export const maxDuration = 60;

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
    if (row.status === "accepted") awaitingDecision.push(invite);
  }

  const latestFlier = await loadLatestFlier(supabase, id, flierFileName(event.title));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>

      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <dt className="text-zinc-500">Topic</dt>
        <dd>{event.topic}</dd>
        <dt className="text-zinc-500">Goal</dt>
        <dd>{event.goal}</dd>
        <dt className="text-zinc-500">Format</dt>
        <dd>{event.format}</dd>
        <dt className="text-zinc-500">City</dt>
        <dd>{event.city}</dd>
        <dt className="text-zinc-500">When</dt>
        <dd>
          {dateFormat.format(new Date(event.date_start))} –{" "}
          {dateFormat.format(new Date(event.date_end))}
        </dd>
        {event.dates_flexible && (
          <>
            <dt className="text-zinc-500">Weekdays</dt>
            <dd>{event.allowed_weekdays ? formatWeekdays(event.allowed_weekdays) : "Any"} (flexible dates)</dd>
          </>
        )}
        <dt className="text-zinc-500">Venue</dt>
        <dd>
          {event.needs_venue
            ? `A partner provides it${event.required_amenities.length ? `; must have ${event.required_amenities.join(", ")}` : ""}`
            : "Not needed"}
        </dd>
        <dt className="text-zinc-500">Guests</dt>
        <dd>{event.guest_count}</dd>
        <dt className="text-zinc-500">Budget cap</dt>
        <dd>{formatBudget(event.budget_cap_cents, event.currency, "en")}</dd>
      </dl>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Co-host matches</h2>
          <FindMatchesButton eventId={id} />
        </div>
        {candidateError ? (
          <p role="alert" className="text-sm text-red-600">
            Saved matches could not be loaded. Reload the page or click Find matches.
          </p>
        ) : (
          <MatchesTable rows={candidates} eventId={id} inviteStatus={inviteStatus} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Invites</h2>
        {inviteError ? (
          <p role="alert" className="text-sm text-red-600">
            Could not load invites.
          </p>
        ) : (
          <InviteList rows={invites} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Approval queue</h2>
        {inviteError ? (
          <p role="alert" className="text-sm text-red-600">
            Could not load invites.
          </p>
        ) : (
          <ApprovalQueue rows={awaitingDecision} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Flier</h2>
        <FlierPanel eventId={id} initial={latestFlier.flier} loadError={latestFlier.error} />
      </section>
    </main>
  );
}
