import { redirect } from "next/navigation";
import { decideAuthorization } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id : "";

  if (!authorizationId) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-10 font-sans">
        <h1 className="text-2xl font-semibold tracking-tight">Missing authorization</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Start the connection from your agent again.</p>
      </main>
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-10 font-sans">
        <h1 className="text-2xl font-semibold tracking-tight">Could not authorize</h1>
        <p role="alert" className="text-sm text-red-600">
          {error?.message ?? "This authorization request is invalid or expired."}
        </p>
      </main>
    );
  }

  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Authorize {details.client.name}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This agent will act as you. It can read your events and draft work. Anything that sends or
        publishes still needs your approval.
      </p>
      {params.error === "1" && (
        <p role="alert" className="text-sm text-red-600">
          That decision did not go through. Try again.
        </p>
      )}
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <dt className="text-zinc-500">Client</dt>
        <dd>{details.client.name}</dd>
        <dt className="text-zinc-500">Redirect</dt>
        <dd className="break-all">{details.redirect_uri}</dd>
        {scopes.length > 0 && (
          <>
            <dt className="text-zinc-500">Access</dt>
            <dd>{scopes.join(", ")}</dd>
          </>
        )}
      </dl>
      <form action={decideAuthorization} className="flex gap-2">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button
          name="decision"
          value="approve"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black"
        >
          Approve
        </button>
        <button
          name="decision"
          value="deny"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Deny
        </button>
      </form>
    </main>
  );
}
