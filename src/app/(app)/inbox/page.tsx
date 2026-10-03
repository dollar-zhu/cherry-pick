import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { InviteStatusBadge, isInviteStatus } from "@/components/events/invite-status";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../login/actions";
import { RespondForm } from "./respond-form";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const inboxRow = z.object({
  id: z.string().uuid(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
  event_title: z.string(),
  event_city: z.string(),
  event_topic: z.string(),
  event_date_start: z.string(),
});

export default async function InboxPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!profile) redirect("/profile");

  const { data: rows, error } = await supabase.rpc("my_invites");
  if (error) console.error("[inbox]", error);
  const invites = (Array.isArray(rows) ? rows : [])
    .flatMap((row) => {
      const parsed = inboxRow.safeParse(row);
      if (!parsed.success || !isInviteStatus(parsed.data.status)) return [];
      return [
        {
          id: parsed.data.id,
          status: parsed.data.status,
          note: parsed.data.note,
          title: parsed.data.event_title,
          city: parsed.data.event_city,
          topic: parsed.data.event_topic,
          when: dateFormat.format(new Date(parsed.data.event_date_start)),
          createdAt: parsed.data.created_at,
        },
      ];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-2xl font-semibold tracking-tight">
          Cherry Pick
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/profile" className="underline-offset-4 hover:underline">
            {profile.name}
          </Link>
          <form action={signOut}>
            <button className="text-zinc-500 underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      <h1 className="text-lg font-semibold">Inbox</h1>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          Could not load invites.
        </p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-zinc-500">No invites yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{invite.title}</p>
                  <p className="text-sm text-zinc-500">
                    {invite.city} · {invite.when}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{invite.topic}</p>
                </div>
                <InviteStatusBadge status={invite.status} />
              </div>
              {invite.note && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Your note: {invite.note}</p>
              )}
              {invite.status === "pending" && <RespondForm inviteId={invite.id} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
