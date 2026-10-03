import { AgentMailClient } from "agentmail";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Send an email from the agent's AgentMail inbox.",
  inputSchema: z.object({
    to: z.array(z.string().email()).min(1),
    subject: z.string().min(1),
    text: z.string().min(1),
  }),
  approval: always(),
  async execute({ to, subject, text }) {
    const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
    const message = await client.inboxes.messages.send(process.env.AGENTMAIL_INBOX_ID!, {
      to,
      subject,
      text,
    });
    return { messageId: message.messageId, threadId: message.threadId };
  },
});
