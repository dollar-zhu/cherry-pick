import Link from "next/link";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!profile) redirect("/profile");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cherry Pick</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/profile" className="underline-offset-4 hover:underline">
            {profile.name}
          </Link>
          <form action={signOut}>
            <button className="text-zinc-500 underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
      </header>
      <Chat />
    </main>
  );
}
