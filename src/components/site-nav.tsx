import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { NavLinks, type NavItem } from "./nav-links";

/** Top bar on every screen. Signed out, it shows only the name. */
export async function SiteNav() {
  let items: NavItem[] | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    if (auth?.claims) {
      const [{ data: profile }, { data: invites }] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", auth.claims.sub).maybeSingle(),
        supabase.rpc("my_invites"),
      ]);
      const waiting = Array.isArray(invites)
        ? invites.filter((invite: { status: string }) => invite.status === "pending").length
        : 0;
      items = [
        { href: "/", label: "Events" },
        { href: "/browse", label: "Browse" },
        { href: "/events/new", label: "Plan an event" },
        { href: "/inbox", label: "Inbox", badge: waiting },
        { href: "/agents", label: "Agents" },
        { href: "/profile", label: profile?.name ?? "Profile" },
      ];
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3 font-sans text-sm"
      >
        <Link href="/" className="text-base font-semibold tracking-tight">
          Cherry Pick
        </Link>
        {items && (
          <div className="flex flex-wrap items-center gap-1">
            <NavLinks items={items} />
            <form action={signOut}>
              <button className="rounded-full px-3 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100">
                Sign out
              </button>
            </form>
          </div>
        )}
      </nav>
    </header>
  );
}
