import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { hasCompanyProfile, requireAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The root layout already renders SiteNav; this layout only guards the routes.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  if (!(await hasCompanyProfile(user.id))) redirect("/onboarding");
  return children;
}
