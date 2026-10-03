"use server";

import { z } from "zod";
import { createAgentMailMailer } from "@/lib/outreach/mailer";
import { sendApprovedBatch, type SendBatchData } from "@/lib/outreach/send";
import { createOutreachStore } from "@/lib/outreach/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ToolResponse } from "@/lib/tool-response";

/**
 * The human approval for an outreach batch (SUP-20). Called by the approval
 * card's Approve button (SUP-27): approving and sending are one click, and only
 * the batch's owner can do it. The agent cannot call this.
 */
export async function approveAndSendOutreachBatch(batchId: string): Promise<ToolResponse<SendBatchData>> {
  if (!z.string().uuid().safeParse(batchId).success) {
    return { status: "failed", summary: "Invalid batch id.", nextActions: [] };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { status: "blocked", summary: "Sign in to send outreach.", nextActions: ["Sign in."] };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (!siteUrl || !secret) {
    console.error("[outreach] NEXT_PUBLIC_SITE_URL and OUTREACH_UNSUBSCRIBE_SECRET must be set");
    return { status: "failed", summary: "Outreach email is not configured.", nextActions: [] };
  }

  try {
    return await sendApprovedBatch({
      batchId,
      userId,
      store: createOutreachStore(createAdminClient()),
      mailer: createAgentMailMailer(),
      unsubscribe: { siteUrl, secret },
    });
  } catch (e) {
    console.error("[outreach] send failed", e);
    return {
      status: "failed",
      summary: "Sending stopped because of an error. Emails already sent are unaffected.",
      nextActions: ["Approve the batch again to send the rest."],
    };
  }
}
