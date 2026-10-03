import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens and webhook signatures for outreach email (SUP-20).
 * Pure functions over node:crypto; no database or network.
 */

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function unsubscribeSignature(encodedEmail: string, secret: string) {
  return createHmac("sha256", secret).update(`unsubscribe:${encodedEmail}`).digest("base64url");
}

/**
 * Unsubscribe token for an address. It never expires: unsubscribe links must
 * keep working long after the email was sent.
 */
export function createUnsubscribeToken(email: string, secret: string): string {
  const encoded = b64url(email.trim().toLowerCase());
  return `${encoded}.${unsubscribeSignature(encoded, secret)}`;
}

/** The address a token was issued for, or null if it was forged or mangled. */
export function readUnsubscribeToken(token: string, secret: string): string | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, unsubscribeSignature(encoded, secret))) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  return /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;
}

/**
 * Verifies an AgentMail webhook, which is signed with Svix: HMAC-SHA256 over
 * "<svix-id>.<svix-timestamp>.<raw body>" with the base64 key after "whsec_".
 * `svix-signature` holds space-separated "v1,<base64>" entries (key rotation).
 */
export function verifyWebhookSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!id || !timestamp || !signature) return false;

  const sent = Number(timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(sent) || Math.abs(now - sent) > (input.toleranceSeconds ?? 300)) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature
    .split(" ")
    .some((entry) => entry.startsWith("v1,") && safeEqual(entry.slice(3), expected));
}
