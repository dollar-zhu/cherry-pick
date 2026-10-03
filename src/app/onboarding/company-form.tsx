"use client";

import { useActionState } from "react";
import type { CompanyProfile } from "@/lib/company";
import { saveCompany } from "@/lib/actions/company";

const input = "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10";
const label = "flex flex-col gap-2 text-sm font-medium";

export function CompanyForm() {
  const [state, action, pending] = useActionState(saveCompany, {
    error: null,
    values: null as Partial<CompanyProfile> | null,
  });
  const values = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={label}>
        Company name
        <input className={input} name="name" required maxLength={120} autoComplete="organization" placeholder="Acme" defaultValue={values.name} />
      </label>
      <label className={label}>
        What does your company do?
        <textarea className={`${input} min-h-28 resize-y`} name="description" required maxLength={2000} placeholder="A short description of your company and what you’re building." defaultValue={values.description} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          Website <span className="font-normal text-muted-foreground">Optional</span>
          <input className={input} name="website_url" type="text" inputMode="url" maxLength={2048} placeholder="yourcompany.com" defaultValue={values.website_url ?? ""} />
        </label>
        <label className={label}>
          City
          <input className={input} name="city" required maxLength={120} autoComplete="address-level2" placeholder="San Francisco" defaultValue={values.city} />
        </label>
      </div>
      <label className={label}>
        Who is your audience?
        <input className={input} name="audience" required maxLength={500} placeholder="Early-stage founders and product teams" defaultValue={values.audience} />
      </label>
      <label className={label}>
        Topics <span className="font-normal text-muted-foreground">Separate with commas</span>
        <input className={input} name="topics" maxLength={820} placeholder="AI, design, startups" defaultValue={values.topics?.join(", ")} />
      </label>

      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Your profile is visible to all signed-in companies.
      </p>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving profile…" : "Create company profile"}
      </button>
    </form>
  );
}
