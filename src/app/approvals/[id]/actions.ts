"use server";

import { revalidatePath } from "next/cache";
import { runApprovedAction, type ApprovalRecord } from "@/lib/approvals";
import { writeAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function decideApproval(formData: FormData): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { error: "Sign in to decide this." };

  const { data, error } = await supabase.rpc("decide_approval", {
    p_id: id,
    p_decision: decision,
  });
  if (error || !data) return { error: error?.message ?? "Could not save that decision." };

  const approval = data as ApprovalRecord;
  await writeAudit(supabase, {
    eventId: approval.event_id,
    actor: "human",
    action: decision === "approved" ? "approve" : "reject",
    outcome: decision,
    detail: { approvalId: approval.id, action: approval.action },
  });

  if (decision === "approved") {
    const ran = await runApprovedAction(supabase, approval);
    if (ran.error) return { error: ran.error };
  }

  revalidatePath(`/approvals/${id}`);
  return {};
}
