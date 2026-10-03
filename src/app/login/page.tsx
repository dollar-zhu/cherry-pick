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
    <main className="flex min-h-svh flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Cherry Pick
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Find your next co-host</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in or create an account to get started.
          </p>
        </div>
        <LoginForm nextPath={nextPath ?? undefined} />
      </div>
    </main>
  );
}
