import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  InvalidToolInputError,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { CHAT_MAX_MESSAGE_CHARS, CHAT_MAX_MESSAGES, intentSchema } from "@/lib/intent";

export const maxDuration = 60;

// Bounds forged assistant/tool parts too; real 30-message threads stay far below this.
const MAX_BODY_CHARS = 500_000;

const tools = {
  propose_event_intent: tool({
    description:
      "Propose the event intent for the user to review. Call only once every field is known. " +
      "This does not create the event; the user confirms it in the UI.",
    inputSchema: intentSchema,
    // No side effect: the event is created only when the user clicks Confirm.
    execute: async () => ({ status: "awaiting_user_confirmation" as const }),
  }),
};

function instructions() {
  return `You help a host plan an event by turning a conversation into a structured event intent.

Today is ${new Date().toISOString().slice(0, 10)}.

Collect these fields: title, topic, goal, format, city, date_start, date_end, guest_count, budget_cap_cents, currency, sales_boundary, partner_criteria.
- Ask for at most two missing fields at a time, in plain conversational text (no markdown).
- Never invent values the user has not given or clearly implied. You may suggest a title.
- Dates must be in the future, as ISO 8601 date-times with a UTC offset matching the event's city.
- budget_cap_cents is the budget in minor units (3,000 means 300000); currency is its ISO 4217 code (EUR, USD). Confirm the currency if the user only gave a symbol or a city.
- Once every field is known, call propose_event_intent. If it returns a validation error, ask the user for the field that failed.
- After proposing, tell the user to review the card and press Confirm. Never say the event has been created.`;
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function textLength(message: UIMessage) {
  return message.parts.reduce((n, part) => (part.type === "text" ? n + part.text.length : n), 0);
}

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return error(401, "Unauthorized");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Unauthorized");

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_CHARS) return error(413, "Request too large");
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return error(400, "Invalid request");
  }
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw)) return error(400, "Invalid request");
  if (raw.length > CHAT_MAX_MESSAGES) {
    return error(413, `This conversation hit the ${CHAT_MAX_MESSAGES}-message limit. Start a new one.`);
  }

  const parsed = await safeValidateUIMessages({ messages: raw, tools });
  if (!parsed.success) return error(400, "Invalid messages");
  // Server instructions are the only system prompt; drop client-sent system messages.
  const messages = parsed.data.filter((m) => m.role === "user" || m.role === "assistant");

  if (messages.some((m) => m.role === "user" && textLength(m) > CHAT_MAX_MESSAGE_CHARS)) {
    return error(413, `Messages are limited to ${CHAT_MAX_MESSAGE_CHARS} characters.`);
  }

  const result = streamText({
    model: "anthropic/claude-sonnet-5",
    instructions: instructions(),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: isStepCount(4),
    maxOutputTokens: 2048,
    abortSignal: request.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      onError: (e) => {
        if (InvalidToolInputError.isInstance(e)) return "The proposed event had invalid details.";
        console.error("[api/chat]", e);
        return "Something went wrong. Please try again.";
      },
    }),
  });
}
