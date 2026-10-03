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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className="font-display text-5xl tracking-[-0.02em] text-balance">Find your next co‑host</h1>
        <p className="text-ink-2">Sign in or create an account to get started.</p>
      </header>
      <div className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <LoginForm nextPath={nextPath ?? undefined} />
      </div>
    </main>
  );
}
