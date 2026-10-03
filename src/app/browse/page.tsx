import { redirect } from "next/navigation";
import { InviteStatusBadge, isInviteStatus } from "@/components/events/invite-status";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Events from other companies</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Apply to co-host. The host approves or rejects the application.
        </p>
      </div>

      {"error" in result ? (
        <p role="alert" className="text-sm text-red-600">
          {result.error}
        </p>
      ) : result.events.length === 0 ? (
        <p className="text-sm text-zinc-500">No upcoming events from other companies.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.events.map((event) => {
            const status = event.application_status && isInviteStatus(event.application_status)
              ? event.application_status
              : null;
            return (
              <li
                key={event.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-zinc-500">
                      {event.host_name ? `Hosted by ${event.host_name}` : "Hosted by another company"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {event.city} · {event.dates_flexible ? "Flexible, " : ""}
                      {formatDate(event.date_start, event.timezone)} – {formatDate(event.date_end, event.timezone)}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {event.topic} · {event.format} · {event.guest_count} guests
                    </p>
                  </div>
                  {status && <InviteStatusBadge status={status} />}
                </div>
                {status ? (
                  <p className="text-sm text-zinc-500">
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
