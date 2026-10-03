# Cherry Pick

Next.js 16 app with an [eve](https://eve.dev) agent that runs on the Vercel AI Gateway.

| Integration | Where |
| --- | --- |
| Event-intent chat (assistant-ui + AI SDK) | `src/app/(app)/events/new`, `src/app/api/chat`, `src/components/assistant/`, `src/lib/intent.ts` |
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

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
