# Cherry Pick

Next.js 16 app with an [eve](https://eve.dev) agent that runs on the Vercel AI Gateway.

| Integration | Where |
| --- | --- |
| Event-intent chat (assistant-ui + AI SDK) | `src/app/(app)/events/new`, `src/app/api/chat`, `src/components/assistant/`, `src/lib/intent.ts` |
| Co-host partner search (Exa, credit-gated) | `src/lib/partners/`, `agent/tools/search_cohost_partners.ts` |
| Outreach email (approval, suppression, daily limit, credits on delivery) | `src/lib/outreach/`, `src/app/api/agentmail/webhook`, `src/app/unsubscribe`, `src/app/api/unsubscribe` |
| `events` table + RLS | `supabase/migrations/` |
| Supabase auth | `src/lib/supabase/`, `src/proxy.ts`, `agent/channels/eve.ts` |
| eve agent (AI SDK + AI Gateway) | `agent/`, mounted at `/eve/v1/*` by `withEve` in `next.config.ts` |
| Exa search | `agent/tools/exa_search.ts` |
| AgentMail | `agent/tools/send_email.ts` (requires approval on every call) |
| Linear | `agent/connections/linear.ts` (Linear MCP server) |
| Stripe | `src/app/api/stripe/checkout`, `src/app/api/stripe/webhook` |

## Setup

Requires Node.js 24+.

```bash
cp .env.example .env.local   # fill in the keys
npm install
npm run dev                  # starts Next.js and the eve agent together
```

Database: in the Supabase SQL editor, run each file in `supabase/migrations/` in number order, then `supabase/seed.sql`.
For the demo, turn off **Authentication → Sign In / Providers → Email → Confirm email**.

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
