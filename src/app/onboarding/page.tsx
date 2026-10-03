import { redirect } from "next/navigation";
import { requireAuthenticatedUser, hasCompanyProfile } from "@/lib/auth";
import { CompanyForm } from "./company-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();
  if (await hasCompanyProfile(user.id)) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Get started</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tell us about your company</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Help other companies understand who you are and find the right partners for your events.
          </p>
        </div>
        <CompanyForm />
      </div>
    </main>
  );
}
