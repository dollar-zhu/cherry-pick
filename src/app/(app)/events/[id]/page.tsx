import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  // RLS limits rows to the signed-in owner, so other users' events 404.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, topic, goal, format, city, date_start, date_end, guest_count, budget_cap_cents")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
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
          {dateFormat.format(new Date(event.date_start))} – {dateFormat.format(new Date(event.date_end))}
        </dd>
        <dt className="text-zinc-500">Guests</dt>
        <dd>{event.guest_count}</dd>
        <dt className="text-zinc-500">Budget cap</dt>
        <dd>{(event.budget_cap_cents / 100).toFixed(2)}</dd>
      </dl>
    </main>
  );
}
