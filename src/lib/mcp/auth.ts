import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/user";
import { rememberCaller } from "@/lib/mcp/caller";

type CachedSession = { userId: string; accessToken: string; exp: number };
const sessions = new Map<string, CachedSession>();

function jwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function agentClient(req: Request) {
  return req.headers.get("user-agent")?.slice(0, 200) || "unknown";
}

async function userFromJwt(token: string, req: Request): Promise<AuthInfo | undefined> {
  // getUser is unavailable on a client configured with accessToken, so verify
  // on a plain client, then use a separate user-scoped client for tool calls.
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    console.error("[mcp] token rejected", error?.message ?? "no user");
    return undefined;
  }

  const claims = jwtPayload(token);
  const exp = typeof claims?.exp === "number" ? claims.exp : undefined;
  if (exp && exp < Date.now() / 1000) return undefined;

  const clientId = typeof claims?.client_id === "string" ? claims.client_id : "supabase-user";
  rememberCaller(token, {
    supabase: createUserClient(token),
    userId: data.user.id,
    clientId,
    agentClient: agentClient(req),
  });

  return {
    token,
    clientId,
    scopes: ["openid", "email", "profile"],
    expiresAt: exp,
    extra: { userId: data.user.id },
  };
}

async function exchangeAgentToken(raw: string): Promise<CachedSession | null> {
  const hash = createHash("sha256").update(raw).digest("hex");
  const cached = sessions.get(hash);
  if (cached && cached.exp > Date.now() / 1000 + 60) return cached;

  const admin = createAdminClient();
  if (!admin) {
    console.error("[mcp] SUPABASE_SECRET_KEY is required to exchange an agent token.");
    return null;
  }

  const { data: row } = await admin
    .from("agent_tokens")
    .select("user_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!row?.user_id) return null;

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.user_id as string);
  const email = userData.user?.email;
  if (userError || !email) return null;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) return null;

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data: verified, error: otpError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashed,
  });
  const accessToken = verified.session?.access_token;
  if (otpError || !accessToken) return null;

  const exp = verified.session?.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
  const session = { userId: row.user_id as string, accessToken, exp };
  sessions.set(hash, session);
  return session;
}

async function userFromAgentToken(raw: string, req: Request): Promise<AuthInfo | undefined> {
  const session = await exchangeAgentToken(raw);
  if (!session) return undefined;

  const supabase = createUserClient(session.accessToken);
  rememberCaller(raw, {
    supabase,
    userId: session.userId,
    clientId: "agent-token",
    agentClient: agentClient(req),
  });

  return {
    token: raw,
    clientId: "agent-token",
    scopes: ["openid", "email", "profile"],
    expiresAt: session.exp,
    extra: { userId: session.userId },
  };
}

export async function verifyMcpToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return undefined;
  }
  if (bearerToken.startsWith("cp_")) return userFromAgentToken(bearerToken, req);
  return userFromJwt(bearerToken, req);
}
