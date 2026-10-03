import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { insertEvent } from "@/lib/events";
import { intentSchema, isPast } from "@/lib/intent";
import { callerFrom } from "@/lib/mcp/caller";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";
import { siteUrl } from "@/lib/site";

function intentFields() {
  let current: z.ZodTypeAny = intentSchema;
  while (current instanceof z.ZodEffects) current = current.innerType();
  if (!(current instanceof z.ZodObject)) throw new Error("Event intent schema is not an object.");
  return current.shape;
}

const schema = {
  ...intentFields(),
  idempotency_key: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .optional()
    .describe("Pass the same key to retry without creating a second event"),
};

export const createEventIntentTool = {
  name: "create_event_intent",
  description:
    "Create an event from a complete intent. This writes the event; it does not email anyone. " +
    "Pass idempotency_key to make a retry return the same event.",
  schema,
  async run(args: Record<string, unknown>, extra: { authInfo?: AuthInfo }): Promise<ToolResponse> {
    const { idempotency_key, ...rest } = args;
    const parsed = intentSchema.safeParse(rest);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".") || "intent";
      return toolFailed(`${field}: ${issue?.message ?? "Invalid intent."}`, [
        "Fix the field and call create_event_intent again.",
      ]);
    }
    if (isPast(parsed.data)) {
      return toolFailed("The event dates are in the past.", ["Use a future date, or a flexible window that ends in the future."]);
    }

    const key =
      typeof idempotency_key === "string" && idempotency_key.trim()
        ? `mcp:${idempotency_key.trim()}`
        : `mcp:${crypto.randomUUID()}`;

    const { supabase, userId } = callerFrom(extra);
    const result = await insertEvent(supabase, userId, parsed.data, key);
    if ("error" in result) return toolFailed(result.error);

    const eventUrl = `${siteUrl()}/events/${result.id}`;
    return toolSuccess(`Created "${parsed.data.title}" in ${parsed.data.city}.`, {
      resourceId: result.id,
      nextActions: [`See readiness with get_event_readiness, or open ${eventUrl}.`],
      data: { eventId: result.id, eventUrl },
    });
  },
};
