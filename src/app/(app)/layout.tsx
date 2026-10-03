import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { hasCompanyProfile, requireAuthenticatedUser } from "@/lib/auth";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  if (!(await hasCompanyProfile(user.id))) redirect("/onboarding");

  return (
    <>
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight">Cherry Pick</Link>
        <div className="flex items-center gap-3">
          {user.email && <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>}
          <Link
            href="/profile"
            className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
          >
            Profile
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">Sign out</Button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
