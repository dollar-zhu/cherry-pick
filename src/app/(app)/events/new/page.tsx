import type { Metadata } from "next";
import { connection } from "next/server";
import { Thread } from "@/components/assistant/thread";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New event · Cherry Pick" };

export default async function NewEventPage() {
  const signedIn = await isSignedIn();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Plan an event</h1>
      {signedIn ? <Thread /> : <p className="text-zinc-500">Sign in to plan an event.</p>}
    </main>
  );
}

async function isSignedIn() {
  await connection(); // per-request auth check; never prerender
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims.sub);
}
