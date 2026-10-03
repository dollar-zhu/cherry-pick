# Cherry Pick

Next.js 16 app with an [eve](https://eve.dev) agent that runs on the Vercel AI Gateway.

| Integration | Where |
| --- | --- |
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
