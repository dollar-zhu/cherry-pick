import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type McpCaller = {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  agentClient: string;
};

const callers = new Map<string, McpCaller>();

export function rememberCaller(token: string, caller: McpCaller) {
  if (callers.size > 200) {
    const oldest = callers.keys().next().value;
    if (oldest) callers.delete(oldest);
  }
  callers.set(token, caller);
}

export function callerFrom(extra: { authInfo?: AuthInfo }): McpCaller {
  const token = extra.authInfo?.token;
  const caller = token ? callers.get(token) : undefined;
  if (!caller) throw new Error("Unauthorized");
  return caller;
}
