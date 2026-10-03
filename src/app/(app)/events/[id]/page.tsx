import { notFound } from "next/navigation";
import { z } from "zod";
import { formatBudget } from "@/lib/intent";
import { formatWeekdays } from "@/lib/matching-constraints";
import { createClient } from "@/lib/supabase/server";
import { FindMatchesButton } from "./find-matches-button";
import { MatchesTable, type MatchRow } from "@/components/events/matches-table";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  // RLS limits rows to the signed-in owner, so other users' events 404.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, topic, goal, format, city, date_start, date_end, guest_count, budget_cap_cents, currency, dates_flexible, allowed_weekdays, needs_venue, required_amenities")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: candidateRows, error: candidateError } = await supabase
    .from("event_candidates")
    .select("id, profile_id, score, reasons, open_questions, profiles(name, city)")
    .eq("event_id", id)
    .order("score", { ascending: false, nullsFirst: false });

  const candidates: MatchRow[] = (candidateRows ?? []).map((row) => {
    // Supabase returns a to-one join as an object; cast through unknown to satisfy TS.
    const profile = row.profiles as unknown as { name: string; city: string } | null;
    return {
      id: row.id as string,
      profileId: row.profile_id as string,
      profileName: profile?.name ?? "Unknown",
      profileCity: profile?.city ?? "",
      score: row.score == null ? null : Number(row.score),
      reasons: (row.reasons as string[]) ?? [],
      openQuestions: (row.open_questions as string[]) ?? [],
    };
  });

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
          <MatchesTable rows={candidates} />
        )}
      </section>
    </main>
  );
}
