import { redirect } from "next/navigation";
import { requireAuthenticatedUser, hasCompanyProfile } from "@/lib/auth";
import { ProfileForm } from "@/app/(app)/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();
  if (await hasCompanyProfile(user.id)) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tell us about your company</h1>
        <p className="text-sm text-muted-foreground">
          Help other companies understand who you are and find the right partners for your events.
        </p>
      </div>
      <ProfileForm initial={null} />
    </main>
  );
}
