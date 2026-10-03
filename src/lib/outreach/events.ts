import { debitKeyFor, EMAIL_CREDIT_COST, type MessageStatus } from "./send.ts";

/**
 * AgentMail delivery events for outreach messages (SUP-20):
 *   message.sent       → confirm the debit (idempotent; send.ts reserved it before sending)
 *   message.delivered  → mark delivered
 *   message.bounced    → mark bounced, refund; permanent bounces are suppressed
 *   message.rejected   → mark failed, refund
 *   message.complained → mark complained, suppress (spam report; no refund)
 * Every write is idempotent, so AgentMail's retries and out-of-order delivery are safe.
 */

export type AgentMailEvent =
  | { eventType: "message.sent"; eventId: string; send: { messageId: string; recipients: string[] } }
  | { eventType: "message.delivered"; eventId: string; delivery: { messageId: string; recipients: string[] } }
  | {
      eventType: "message.bounced";
      eventId: string;
      bounce: { messageId: string; type: string; subType?: string; recipients: { address: string; status?: string }[] };
    }
  | { eventType: "message.rejected"; eventId: string; reject: { messageId: string; reason: string } }
  | {
      eventType: "message.complained";
      eventId: string;
      complaint: { messageId: string; type?: string; recipients: string[] };
    }
  | { eventType: string; eventId: string };

export type TrackedMessage = {
  id: string;
  userId: string;
  eventId: string;
  recipientEmail: string;
  status: MessageStatus;
};

export interface OutreachEventStore {
  findByAgentMailId(agentmailMessageId: string): Promise<TrackedMessage | null>;
  markMessage(messageId: string, patch: { status: MessageStatus; agentmailMessageId?: string; error?: string }): Promise<void>;
  /** Idempotent per key. True if this call charged; false if the key was already used. */
  debit(userId: string, amount: number, key: string, ref: string): Promise<boolean>;
  /** Idempotent per key; does nothing unless `debitKey` was charged. */
  refundIfDebited(userId: string, amount: number, debitKey: string, ref: string): Promise<void>;
  suppress(email: string, reason: "unsubscribed" | "bounced" | "complained"): Promise<void>;
  audit(entry: {
    userId: string;
    eventId: string;
    action: "outreach_delivery";
    outcome: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export { debitKeyFor };

// A later event must not move a message backwards (e.g. a late "sent" after "bounced").
const RANK: Partial<Record<MessageStatus, number>> = { sending: 0, sent: 1, delivered: 2, bounced: 3, complained: 3, failed: 3 };
const advances = (from: MessageStatus, to: MessageStatus) => (RANK[to] ?? 0) > (RANK[from] ?? -1);

function messageIdOf(event: AgentMailEvent): string | null {
  const e = event as Record<string, unknown>;
  for (const key of ["send", "delivery", "bounce", "reject", "complaint"]) {
    const payload = e[key] as { messageId?: unknown } | undefined;
    if (typeof payload?.messageId === "string") return payload.messageId;
  }
  return null;
}

export async function handleAgentMailEvent(
  event: AgentMailEvent,
  store: OutreachEventStore,
): Promise<"handled" | "ignored"> {
  const agentmailMessageId = messageIdOf(event);
  if (!agentmailMessageId) return "ignored";
  const m = await store.findByAgentMailId(agentmailMessageId);
  if (!m) return "ignored"; // not an outreach message (e.g. the agent's own mail)

  const key = debitKeyFor(m.id);
  const audit = (outcome: string, detail: Record<string, unknown> = {}) =>
    store
      .audit({ userId: m.userId, eventId: m.eventId, action: "outreach_delivery", outcome, detail: { messageId: m.id, agentmailEventId: event.eventId, ...detail } })
      .catch((e) => console.error("[outreach] audit failed", e));
  const mark = async (status: MessageStatus, error?: string) => {
    if (advances(m.status, status)) await store.markMessage(m.id, { status, error });
  };

  switch (event.eventType) {
    case "message.sent":
      if (m.status === "bounced" || m.status === "failed") {
        await audit("debit_skipped", { reason: `late sent event after ${m.status}` });
        return "handled";
      }
      await store.debit(m.userId, EMAIL_CREDIT_COST, key, m.id);
      await mark("sent");
      await audit("credits_debited", { amount: EMAIL_CREDIT_COST });
      return "handled";

    case "message.delivered":
      await mark("delivered");
      await audit("delivered");
      return "handled";

    case "message.bounced": {
      const { bounce } = event as Extract<AgentMailEvent, { eventType: "message.bounced" }>;
      const permanent = bounce.type?.toLowerCase() === "permanent";
      if (permanent) {
        for (const r of bounce.recipients ?? []) await store.suppress(r.address, "bounced");
      }
      await mark("bounced", `${bounce.type}${bounce.subType ? `/${bounce.subType}` : ""}`);
      await store.refundIfDebited(m.userId, EMAIL_CREDIT_COST, key, m.id);
      await audit("bounced", { type: bounce.type, subType: bounce.subType, suppressed: permanent });
      return "handled";
    }

    case "message.rejected": {
      const { reject } = event as Extract<AgentMailEvent, { eventType: "message.rejected" }>;
      await mark("failed", reject.reason?.slice(0, 500));
      await store.refundIfDebited(m.userId, EMAIL_CREDIT_COST, key, m.id);
      await audit("rejected", { reason: reject.reason });
      return "handled";
    }

    case "message.complained": {
      const { complaint } = event as Extract<AgentMailEvent, { eventType: "message.complained" }>;
      const recipients = complaint.recipients?.length ? complaint.recipients : [m.recipientEmail];
      for (const r of recipients) await store.suppress(r, "complained");
      await mark("complained");
      await audit("complained");
      return "handled";
    }

    default:
      return "ignored";
  }
}
