import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revokeAgentToken } from "./actions";
import { IssueTokenForm } from "./issue-token-form";

export const metadata: Metadata = { title: "Agent tokens · Cherry Pick" };

export default async function AgentTokensPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/settings/agents");

  const { data: tokens } = await supabase
    .from("agent_tokens")
    .select("id, name, created_at, revoked_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Agent tokens</h1>
        <p className="text-sm text-muted-foreground">
          Prefer the OAuth consent screen on{" "}
          <Link href="/agents" className="underline">
            Connect your agent
          </Link>
          . A personal token is the fallback: it is stored as a hash, and you can revoke it here.
        </p>
      </div>

      {!process.env.SUPABASE_SECRET_KEY && (
        <p role="alert" className="text-sm text-destructive">
          SUPABASE_SECRET_KEY is not set on the server, so personal tokens will not sign in yet.
        </p>
      )}

      <IssueTokenForm />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Issued tokens</h2>
        {tokens && tokens.length > 0 ? (
          <ul className="glass rounded-lg divide-y divide-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="text-muted-foreground">
                    {token.revoked_at ? "Revoked" : "Active"} ·{" "}
                    {new Date(token.created_at as string).toLocaleDateString("en")}
                  </p>
                </div>
                {!token.revoked_at && (
                  <form action={revokeAgentToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <button className="rounded-full border border-border px-3 py-1 text-xs bg-secondary hover:bg-foreground/10">
                      Revoke
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        )}
      </section>
    </main>
  );
}
