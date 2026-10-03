import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutreachEventStore, TrackedMessage } from "./events";
import type { MessageStatus, OutreachMessage, OutreachSendStore } from "./send";

/**
 * Supabase implementation of the outreach stores (SUP-20).
 *
 * outreach_messages comes from SUP-19 (drafts) / SUP-16 (schema); credit_ledger
 * and audit_log from SUP-16; email_suppressions from 0004_email_suppressions.sql.
 * If names differ, change them here only.
 *
 * Expected outreach_messages columns:
 *   id, batch_id, user_id, event_id, recipient_email, subject, body_text,
 *   credit_cost, status, approved_by, approved_at, sent_at,
 *   agentmail_message_id (unique), error
 */
const T = {
  messages: "outreach_messages",
  suppressions: "email_suppressions",
  ledger: "credit_ledger",
  audit: "audit_log",
} as const;

const UNIQUE_VIOLATION = "23505";
// Statuses that used one of the day's send slots.
const COUNTS_TOWARD_LIMIT: MessageStatus[] = ["sending", "sent", "delivered", "bounced", "complained"];

const MESSAGE_COLUMNS =
  "id, batch_id, user_id, event_id, recipient_email, subject, body_text, credit_cost, status";

function toMessage(r: Record<string, unknown>): OutreachMessage {
  return {
    id: r.id as string,
    batchId: r.batch_id as string,
    userId: r.user_id as string,
    eventId: r.event_id as string,
    recipientEmail: String(r.recipient_email).trim().toLowerCase(),
    subject: r.subject as string,
    bodyText: r.body_text as string,
    creditCost: Number(r.credit_cost),
    status: r.status as MessageStatus,
  };
}

export function createOutreachStore(db: SupabaseClient): OutreachSendStore & OutreachEventStore {
  async function ledgerInsert(row: Record<string, unknown>) {
    const { error } = await db.from(T.ledger).insert(row);
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  }

  // ponytail: client-side sum, paged past PostgREST's 1000-row cap; swap for a
  // credit_balance() SQL function once SUP-16 provides one.
  async function creditBalance(userId: string) {
    const PAGE = 1000;
    let sum = 0;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(T.ledger)
        .select("amount")
        .eq("user_id", userId)
        .order("idempotency_key")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of data ?? []) sum += Number(row.amount);
      if (!data || data.length < PAGE) return sum;
    }
  }

  return {
    async approveBatch(batchId, userId) {
      const approve = await db
        .from(T.messages)
        .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
        .eq("batch_id", batchId)
        .eq("user_id", userId)
        .eq("status", "pending_approval");
      if (approve.error) throw approve.error;

      const { data, error } = await db
        .from(T.messages)
        .select(MESSAGE_COLUMNS)
        .eq("batch_id", batchId)
        .eq("user_id", userId)
        .order("id");
      if (error) throw error;
      return data?.length ? data.map(toMessage) : null;
    },

    async isSuppressed(email) {
      const { data, error } = await db
        .from(T.suppressions)
        .select("email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },

    creditBalance,

    async claimSendSlot(messageId, userId, since, limit) {
      // Claim first, then count: two concurrent batches cannot both see a free slot.
      const claim = await db
        .from(T.messages)
        .update({ status: "sending", sent_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("user_id", userId)
        .in("status", ["approved", "deferred"])
        .select("id");
      if (claim.error) throw claim.error;
      if (!claim.data?.length) return false; // already claimed elsewhere

      const { count, error } = await db
        .from(T.messages)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", COUNTS_TOWARD_LIMIT)
        .gte("sent_at", since.toISOString());
      if (error) throw error;
      if ((count ?? 0) <= limit) return true;

      const undo = await db.from(T.messages).update({ status: "deferred", sent_at: null }).eq("id", messageId);
      if (undo.error) throw undo.error;
      return false;
    },

    async markMessage(messageId, patch) {
      const { error } = await db
        .from(T.messages)
        .update({
          status: patch.status,
          ...(patch.agentmailMessageId ? { agentmail_message_id: patch.agentmailMessageId } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
        })
        .eq("id", messageId);
      if (error) throw error;
    },

    async findByAgentMailId(agentmailMessageId) {
      const { data, error } = await db
        .from(T.messages)
        .select(MESSAGE_COLUMNS)
        .eq("agentmail_message_id", agentmailMessageId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const m = toMessage(data);
      const tracked: TrackedMessage = {
        id: m.id,
        userId: m.userId,
        eventId: m.eventId,
        recipientEmail: m.recipientEmail,
        creditCost: m.creditCost,
        status: m.status,
      };
      return tracked;
    },

    async debit(userId, amount, key, ref) {
      await ledgerInsert({ user_id: userId, amount: -amount, operation: "outreach_email", idempotency_key: key, ref });
    },

    async refundIfDebited(userId, amount, debitKey, ref) {
      const { data, error } = await db
        .from(T.ledger)
        .select("idempotency_key")
        .eq("idempotency_key", debitKey)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;
      await ledgerInsert({
        user_id: userId,
        amount,
        operation: "outreach_email_refund",
        idempotency_key: `${debitKey}:refund`,
        ref,
      });
    },

    async suppress(email, reason) {
      const { error } = await db
        .from(T.suppressions)
        .upsert({ email: email.trim().toLowerCase(), reason }, { onConflict: "email", ignoreDuplicates: true });
      if (error) throw error;
    },

    async audit({ userId, eventId, action, outcome, detail }) {
      const { error } = await db.from(T.audit).insert({
        user_id: userId,
        event_id: eventId,
        actor: action === "outreach_send" ? "human" : "system",
        action,
        outcome,
        detail,
      });
      if (error) throw error;
    },
  };
}
