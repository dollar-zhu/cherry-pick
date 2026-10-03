import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Intake } from "@/components/assistant/intake";
import { pageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New event · Cherry Pick" };

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-12 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className={pageTitle}>Plan an event</h1>
        <p className="text-ink-2">
          Type or talk it through. We draft the brief, and you confirm it before we look for partners.
        </p>
      </header>
      <Intake />
    </main>
  );
}
