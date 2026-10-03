import type { ToolResponse } from "../tool-response";
import { createUnsubscribeToken } from "./crypto.ts";

/**
 * Sending an approved outreach batch (SUP-20). Drafts come from SUP-19
 * (prepare_outreach_batch) in outreach_messages with status "pending_approval".
 * Credits are not taken here: they are debited when AgentMail confirms the
 * send (see ./events.ts), and refunded if the message then bounces.
 */

export const DAILY_SEND_LIMIT = 5;

export type MessageStatus =
  | "pending_approval"
  | "approved"
  | "deferred" // over the daily limit; sendable on a later run
  | "sending"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"
  | "insufficient_credits";

export type OutreachMessage = {
  id: string;
  batchId: string;
  userId: string; // sending company's owner; per-company once SUP-26 adds orgs
  eventId: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  creditCost: number;
  status: MessageStatus;
};

const SENDABLE: ReadonlySet<MessageStatus> = new Set(["approved", "deferred"]);

export interface OutreachSendStore {
  /**
   * Marks the batch's pending messages approved by `userId` and returns every
   * message in the batch. Null if the batch does not exist or is not theirs.
   */
  approveBatch(batchId: string, userId: string): Promise<OutreachMessage[] | null>;
  isSuppressed(email: string): Promise<boolean>;
  creditBalance(userId: string): Promise<number>;
  /**
   * Atomically moves the message to "sending" if the user has sent fewer than
   * `limit` messages since `since`; otherwise marks it "deferred".
   */
  claimSendSlot(messageId: string, userId: string, since: Date, limit: number): Promise<boolean>;
  markMessage(
    messageId: string,
    patch: { status: MessageStatus; agentmailMessageId?: string; error?: string },
  ): Promise<void>;
  audit(entry: {
    userId: string;
    eventId: string;
    action: "outreach_send";
    outcome: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export interface Mailer {
  send(
    message: { to: string; subject: string; text: string; headers: Record<string, string> },
    idempotencyKey: string,
  ): Promise<{ messageId: string }>;
}

export type SendBatchData = {
  sent: number;
  suppressed: number;
  deferred: number;
  insufficientCredits: number;
  failed: number;
  skipped: number;
};

export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Body and headers with a visible unsubscribe link and RFC 8058 one-click headers. */
export function withUnsubscribe(
  message: { text: string; email: string },
  config: { siteUrl: string; secret: string },
) {
  const token = createUnsubscribeToken(message.email, config.secret);
  const site = config.siteUrl.replace(/\/+$/, "");
  const page = `${site}/unsubscribe?t=${token}`;
  const oneClick = `${site}/api/unsubscribe?t=${token}`;
  return {
    text: `${message.text.trimEnd()}\n\n--\nDon't want emails like this? Unsubscribe: ${page}`,
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export async function sendApprovedBatch(input: {
  batchId: string;
  userId: string;
  store: OutreachSendStore;
  mailer: Mailer;
  unsubscribe: { siteUrl: string; secret: string };
  now?: Date;
}): Promise<ToolResponse<SendBatchData>> {
  const { batchId, userId, store, mailer } = input;
  const since = startOfUtcDay(input.now ?? new Date());

  const messages = await store.approveBatch(batchId, userId);
  if (!messages) {
    return {
      status: "failed",
      summary: "Outreach batch not found, or it belongs to someone else.",
      nextActions: ["Prepare an outreach batch first."],
    };
  }

  const data: SendBatchData = { sent: 0, suppressed: 0, deferred: 0, insufficientCredits: 0, failed: 0, skipped: 0 };
  // Credits are debited on AgentMail's confirmation, so count what this run has committed.
  let committed = 0;
  let balance: number | null = null;

  for (const m of messages) {
    if (!SENDABLE.has(m.status)) {
      data.skipped++;
      continue;
    }
    const audit = (outcome: string, detail: Record<string, unknown> = {}) =>
      store
        .audit({ userId, eventId: m.eventId, action: "outreach_send", outcome, detail: { batchId, messageId: m.id, ...detail } })
        .catch((e) => console.error("[outreach] audit failed", e));

    if (await store.isSuppressed(m.recipientEmail)) {
      await store.markMessage(m.id, { status: "suppressed" });
      await audit("suppressed");
      data.suppressed++;
      continue;
    }

    balance ??= await store.creditBalance(userId);
    if (balance - committed < m.creditCost) {
      await store.markMessage(m.id, { status: "insufficient_credits" });
      await audit("insufficient_credits", { balance, committed, cost: m.creditCost });
      data.insufficientCredits++;
      continue;
    }

    if (!(await store.claimSendSlot(m.id, userId, since, DAILY_SEND_LIMIT))) {
      await audit("deferred", { limit: DAILY_SEND_LIMIT });
      data.deferred++;
      continue;
    }

    const { text, headers } = withUnsubscribe({ text: m.bodyText, email: m.recipientEmail }, input.unsubscribe);
    try {
      // Keyed by our message id: a retry after a timeout cannot send twice.
      const { messageId } = await mailer.send({ to: m.recipientEmail, subject: m.subject, text, headers }, m.id);
      await store.markMessage(m.id, { status: "sent", agentmailMessageId: messageId });
      await audit("sent", { agentmailMessageId: messageId, creditCost: m.creditCost });
      committed += m.creditCost;
      data.sent++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await store.markMessage(m.id, { status: "failed", error: error.slice(0, 500) });
      await audit("failed", { error });
      data.failed++;
    }
  }

  const parts = [
    `${data.sent} sent`,
    data.suppressed && `${data.suppressed} skipped (unsubscribed or bounced before)`,
    data.deferred && `${data.deferred} deferred (daily limit of ${DAILY_SEND_LIMIT})`,
    data.insufficientCredits && `${data.insufficientCredits} not sent (not enough credits)`,
    data.failed && `${data.failed} failed`,
  ].filter(Boolean);

  const nextActions: string[] = [];
  if (data.sent) nextActions.push("Watch for replies; credits are charged when AgentMail confirms each send.");
  if (data.deferred) nextActions.push("Approve the batch again tomorrow to send the deferred emails.");
  if (data.insufficientCredits) nextActions.push("Buy credits, then approve the batch again.");
  if (data.failed) nextActions.push("Check the failed recipients' addresses, then approve again.");

  if (data.skipped === messages.length) {
    return { status: "success", summary: "Nothing left to send in this batch.", nextActions: [], data };
  }
  return {
    status: data.sent > 0 ? "success" : data.failed > 0 ? "failed" : "blocked",
    summary: parts.join(", ") + ".",
    nextActions,
    data,
  };
}
