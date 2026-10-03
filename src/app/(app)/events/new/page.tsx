import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Intake } from "@/components/assistant/intake";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New event · Cherry Pick" };

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Plan an event</h1>
      <Intake />
    </main>
  );
}
