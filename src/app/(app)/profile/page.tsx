import { redirect } from "next/navigation";
import { Monogram } from "@/components/monogram";
import { pageTitle } from "@/components/styles";
import type { Profile } from "@/lib/contracts";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", auth.claims.sub)
    .maybeSingle<Profile>();
  // The (app) layout sends users without a profile to /onboarding first.
  if (!profile) redirect("/onboarding");

  const site = profile?.website_url?.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pb-16 pt-12 sm:px-6">
      <header className="reveal flex items-center gap-5">
        <Monogram name={profile.name} className="size-16 text-xl sm:size-20 sm:text-2xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={`${pageTitle} [overflow-wrap:anywhere]`}>{profile.name}</h1>
          <p className="truncate text-ink-2">
            {profile.city}
            {site && (
              <>
                {" · "}
                <a
                  href={profile.website_url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:text-ink hover:underline"
                >
                  {site}
                </a>
              </>
            )}
          </p>
        </div>
      </header>
      <ProfileForm initial={profile} />
    </main>
  );
}
