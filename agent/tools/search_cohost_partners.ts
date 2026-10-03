import { randomUUID } from "node:crypto";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { defaultDeps } from "../../src/lib/partners/search";
import { runSearchCohostPartners, SEARCH_COST_CREDITS } from "../../src/lib/partners/run";
import { createPartnerStore } from "../../src/lib/partners/store";
import { createAdminClient } from "../../src/lib/supabase/admin";

export default defineTool({
  description:
    "Find 5-10 communities that could co-host one of the user's events. Searches the web from the " +
    `event's topic, city, format and partner criteria, and returns ranked candidates with evidence. ` +
    `Costs ${SEARCH_COST_CREDITS} credits, charged only when candidates are found.`,
  inputSchema: z.object({ eventId: z.string().uuid() }),
  label: { start: () => "Search for co-host partners" },
  async execute({ eventId }, ctx) {
    // Only Supabase-authenticated callers own events; see agent/channels/eve.ts.
    const auth = ctx.session.auth.current;
    if (auth?.authenticator !== "supabase" || !auth.principalId) {
      return {
        status: "blocked" as const,
        summary: "Sign in to search for co-host partners.",
        nextActions: ["Sign in, then try again."],
      };
    }

    return runSearchCohostPartners({
      eventId,
      userId: auth.principalId,
      // Stable across eve step replays of this call, so a retry never charges twice.
      // Session id + call id: call ids alone are not guaranteed unique across sessions.
      searchId: ctx.callId ? `${ctx.session.id}:${ctx.callId}` : randomUUID(),
      store: createPartnerStore(createAdminClient()),
      deps: defaultDeps(ctx.abortSignal),
    });
  },
});
