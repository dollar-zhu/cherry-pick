import { verifyWebhookSignature } from "@/lib/outreach/crypto";
import { handleAgentMailEvent, type AgentMailEvent } from "@/lib/outreach/events";
import { createOutreachStore } from "@/lib/outreach/store";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_CHARS = 1_000_000;

/** AgentMail delivery events (Svix-signed). Register this URL with message.* event types. */
export async function POST(request: Request) {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const body = await request.text();
  if (body.length > MAX_BODY_CHARS) return new Response("Payload too large", { status: 413 });

  const valid = verifyWebhookSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: AgentMailEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    const result = await handleAgentMailEvent(event, createOutreachStore(createAdminClient()));
    return Response.json({ result });
  } catch (e) {
    // Non-2xx makes AgentMail retry; every handler write is idempotent.
    console.error("[agentmail webhook]", event.eventType, e);
    return new Response("Handler failed", { status: 500 });
  }
}
