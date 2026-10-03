import { redirect } from "next/navigation";
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile ? "Edit company profile" : "Tell us about your company"}
      </h1>
      <ProfileForm initial={profile} />
    </main>
  );
}
