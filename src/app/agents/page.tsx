import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyBlock } from "@/components/copy-block";
import { MCP_TOOL_LIST } from "@/lib/mcp/tools";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connect your agent · Cherry Pick" };

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/agents");

  const endpoint = `${siteUrl()}/api/mcp`;
  const claudeCode = `claude mcp add --transport http cherry-pick ${endpoint}`;
  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        "cherry-pick": { type: "http", url: endpoint },
      },
    },
    null,
    2,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connect your agent</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Claude Code, Claude Desktop, or Cursor sign in as you. The agent asks for your company and
          the events you care about, then you can create an event or browse events other companies posted and apply to co-host. Hosts approve or reject those applications.
          Sending, confirming, and publishing stop at an approval link you open in the browser.
        </p>
      </div>

      <CopyBlock label="Endpoint" value={endpoint} />
      <CopyBlock label="Claude Code" value={claudeCode} />
      <CopyBlock label="Claude Desktop" value={claudeDesktop} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Tools</h2>
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
          {MCP_TOOL_LIST.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <span className="font-medium">{tool.name}</span>
              <span className="text-zinc-600 dark:text-zinc-400">{tool.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The first connection opens a consent screen. If your client cannot do OAuth,{" "}
        <Link href="/settings/agents" className="underline">
          create a personal token
        </Link>{" "}
        and send it as <code>Authorization: Bearer</code>.
      </p>
    </main>
  );
}
