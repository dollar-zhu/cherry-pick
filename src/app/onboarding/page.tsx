import { redirect } from "next/navigation";
import { requireAuthenticatedUser, hasCompanyProfile } from "@/lib/auth";
import { ProfileForm } from "@/app/(app)/profile/profile-form";
import { pageTitle } from "@/components/styles";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();
  if (await hasCompanyProfile(user.id)) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 pt-12 sm:px-6">
      <div className="space-y-2">
        <h1 className={pageTitle}>Tell us about your company</h1>
        <p className="text-sm text-muted-foreground">
          Help other companies understand who you are and find the right partners for your events.
        </p>
      </div>
      <ProfileForm initial={null} />
    </main>
  );
}
