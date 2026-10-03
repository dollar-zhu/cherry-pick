import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { IncomingApplications } from "@/components/events/incoming-applications";
import { listApplications } from "@/lib/cohost";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // The (app) layout already sends signed-out users and users with no profile away.
  const supabase = await createClient();
  // RLS returns only the signed-in user's events.
  const [{ data: events }, applications] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, city, date_start, timezone")
      .order("date_start", { ascending: true }),
    listApplications(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      {"error" in applications ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load applications.
        </p>
      ) : (
        <IncomingApplications rows={applications.applications} />
      )}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <Link
          href="/events/new"
          className={buttonVariants()}
        >
          Plan an event
        </Link>
      </div>
      {events && events.length > 0 ? (
        <ul className="glass rounded-lg divide-y divide-border">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium">{event.title}</span>
                <span className="shrink-0 text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">
          No events yet. Plan one, and we will find partner companies for it.
        </p>
      )}
    </main>
  );
}
