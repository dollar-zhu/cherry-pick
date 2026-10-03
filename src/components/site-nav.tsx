import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
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
        { href: "/inbox", label: "Inbox", badge: waiting },
        { href: "/agents", label: "Agents" },
        { href: "/profile", label: profile?.name ?? "Profile" },
      ];
    }
  }

  return (
    <header className="sticky top-3 z-10 px-4">
      <nav
        aria-label="Main"
        className="glass mx-auto flex w-full max-w-5xl items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 font-sans text-sm"
      >
        <Link href="/" aria-label="cherrypick home" className="shrink-0">
          <Logo height={20} />
        </Link>
        {items && (
          <>
            <div className="mx-auto">
              <NavLinks items={items} />
            </div>
            <Link href="/events/new" className={buttonVariants({ variant: "brand", size: "sm" })}>
              + New event
            </Link>
            <form action={signOut}>
              <button className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                Sign out
              </button>
            </form>
          </>
        )}
      </nav>
    </header>
  );
}
