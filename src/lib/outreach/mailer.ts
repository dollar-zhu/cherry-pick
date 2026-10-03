import { AgentMailClient } from "agentmail";
import type { Mailer } from "./send";

export function createAgentMailMailer(): Mailer {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!apiKey || !inboxId) throw new Error("AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID must be set");
  const client = new AgentMailClient({ apiKey });

  return {
    async send({ to, subject, text, headers }, idempotencyKey) {
      const { messageId } = await client.inboxes.messages.send(
        inboxId,
        { to: [to], subject, text, headers },
        { idempotencyKey },
      );
      return { messageId };
    },
  };
}
