import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { writeAudit } from "@/lib/audit";
import { callerFrom } from "@/lib/mcp/caller";
import { toolFailed, type ToolResponse } from "@/lib/tool-response";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarize(args: unknown) {
  if (!isRecord(args)) return {};
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => {
      if (typeof value === "string") return [key, value.slice(0, 200)];
      if (typeof value === "number" || typeof value === "boolean" || value == null) return [key, value];
      return [key, Array.isArray(value) ? `array(${value.length})` : "object"];
    }),
  );
}

function eventIdFor(name: string, args: unknown, response: ToolResponse) {
  if (name === "create_event_intent" && response.resourceId) return response.resourceId;
  if (isRecord(args) && typeof args.eventId === "string") return args.eventId;
  if (isRecord(response.data) && typeof response.data.eventId === "string") return response.data.eventId;
  return null;
}

export async function runTool(
  name: string,
  args: unknown,
  extra: { authInfo?: AuthInfo },
  fn: () => Promise<ToolResponse>,
) {
  let response: ToolResponse;
  let caller: ReturnType<typeof callerFrom> | null = null;
  try {
    caller = callerFrom(extra);
    response = await fn();
  } catch (err) {
    console.error(`[mcp ${name}]`, err);
    response = toolFailed(err instanceof Error && err.message === "Unauthorized" ? "Sign in to continue." : "The tool failed.");
  }

  if (caller) {
    await writeAudit(caller.supabase, {
      eventId: eventIdFor(name, args, response),
      actor: "agent",
      action: name,
      outcome: response.status,
      detail: {
        agentClient: caller.agentClient,
        clientId: caller.clientId,
        args: summarize(args),
      },
    });
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(response) }],
  };
}
