import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { Monogram } from "./monogram";
import { NavLinks } from "./nav-links";

/** Top bar on every screen. Signed out, it shows only the name. */
export async function SiteNav() {
  let account: { company: string | null; waiting: number } | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    if (auth?.claims) {
      const [{ data: profile }, { data: invites }] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", auth.claims.sub).maybeSingle(),
        supabase.rpc("my_invites"),
      ]);
      const waiting = Array.isArray(invites)
        ? invites.filter(
            (invite: { status: string; requested_by?: string }) =>
              invite.status === "pending" && invite.requested_by !== "partner",
          ).length
        : 0;
      account = { company: profile?.name ?? null, waiting };
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6"
      >
        <Link href="/" aria-label="Cherry Pick home" className="flex items-center gap-2 whitespace-nowrap text-ink">
          <span aria-hidden className="size-3 rounded-full bg-brand min-[400px]:size-2.5" />
          <span className="hidden font-display text-xl tracking-[-0.01em] min-[400px]:inline">Cherry Pick</span>
        </Link>
        {account && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NavLinks waiting={account.waiting} />
            <button
              type="button"
              popoverTarget="company-menu"
              aria-label="Company menu"
              className="flex items-center gap-2 rounded-full border border-rule bg-card py-1 pl-1 pr-1 text-sm text-ink transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 sm:pr-3"
            >
              <Monogram name={account.company ?? "?"} className="size-8 text-xs" />
              <span className="hidden max-w-40 truncate font-medium sm:inline">
                {account.company ?? "Your company"}
              </span>
            </button>
            <div
              id="company-menu"
              popover="auto"
              className="menu w-60 rounded-2xl border border-rule bg-card p-1.5 text-sm text-ink shadow-[var(--shadow-pop)]"
            >
              <p className="truncate px-3 pb-2 pt-1.5 text-xs text-ink-2">
                {account.company ?? "No company profile yet"}
              </p>
              {/* Plain links: a full load closes the menu and refreshes the invite count. */}
              <a
                href="/profile"
                className="block rounded-xl px-3 py-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
              >
                Edit company profile
              </a>
              <a
                href="/browse"
                className="block rounded-xl px-3 py-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 sm:hidden"
              >
                Browse events
              </a>
              <a
                href="/inbox"
                className="block rounded-xl px-3 py-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
              >
                Inbox
              </a>
              <a
                href="/agents"
                className="block rounded-xl px-3 py-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
              >
                Connect your agent
              </a>
              <form action={signOut} className="mt-1 border-t border-rule pt-1">
                <button className="w-full rounded-xl px-3 py-2 text-left text-ink-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 hover:text-ink">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
