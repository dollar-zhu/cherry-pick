import { redirect } from "next/navigation";
import { getAuthenticatedUser, getPostAuthPath } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = safeNext(typeof params.next === "string" ? params.next : null);
  const user = await getAuthenticatedUser();
  if (user) redirect(nextPath ?? (await getPostAuthPath(user.id)));

  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-[10vh] pb-[30vh]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-display text-balance">
            Find your next <span className="text-brand-orange">co-host</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in or create an account to get started.
          </p>
        </div>
        <LoginForm nextPath={nextPath ?? undefined} />
      </div>
    </main>
  );
}
