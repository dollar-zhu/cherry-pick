import { createAdminClient } from "../supabase/admin";
import { readUnsubscribeToken } from "./crypto";
import { createOutreachStore } from "./store";

/** Suppresses the address a valid token was issued for. Returns it, or null for a bad token. */
export async function unsubscribeByToken(token: string | null | undefined): Promise<string | null> {
  const secret = process.env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (!token || !secret) return null;
  const email = readUnsubscribeToken(token, secret);
  if (!email) return null;
  await createOutreachStore(createAdminClient()).suppress(email, "unsubscribed");
  return email;
}

export function emailFromToken(token: string | null | undefined): string | null {
  const secret = process.env.OUTREACH_UNSUBSCRIBE_SECRET;
  return token && secret ? readUnsubscribeToken(token, secret) : null;
}

/** "jane.doe@example.com" → "ja•••@example.com", so the page does not reveal full addresses. */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}
