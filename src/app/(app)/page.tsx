import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // The (app) layout already sends signed-out users and users with no profile away.
  const supabase = await createClient();
  // RLS returns only the signed-in user's events.
  const { data: events } = await supabase
    .from("events")
    .select("id, title, city, date_start, timezone")
    .order("date_start", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <Link
          href="/events/new"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black"
        >
          Plan an event
        </Link>
      </div>
      {events && events.length > 0 ? (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="font-medium">{event.title}</span>
                <span className="shrink-0 text-zinc-500">
                  {event.city} ·{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: event.timezone }).format(
                    new Date(event.date_start),
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          No events yet. Plan one, and we will find partner companies for it.
        </p>
      )}
    </main>
  );
}
