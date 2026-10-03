"use server";

import { z } from "zod";
import { approvePublish, publishStatus, type PublishData } from "@/lib/publish/approve";
import { createPackageMailer } from "@/lib/publish/mailer";
import { createPublishStore } from "@/lib/publish/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ToolResponse } from "@/lib/tool-response";

const ids = z.object({
  launchPackageId: z.string().uuid(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

async function currentUserId() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return auth?.claims.sub ?? null;
}

/** Hash, approvals and pending state for the Launch Studio. Null if not found or not a co-host. */
export async function getPublishStatus(launchPackageId: string) {
  if (!z.string().uuid().safeParse(launchPackageId).success) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    return await publishStatus({ launchPackageId, userId, store: createPublishStore(createAdminClient()) });
  } catch (e) {
    console.error("[publish] status failed", e);
    return null;
  }
}

/**
 * A co-host's "Approve publish" click (SUP-24 Launch Studio / SUP-27 approval card).
 * The package is sent only after both co-hosts approve the same version.
 * This is the only path that releases a launch package; the agent cannot call it.
 * `contentHash` is the one getPublishStatus returned for the version on screen.
 */
export async function approvePublishLaunchPackage(
  launchPackageId: string,
  contentHash: string,
): Promise<ToolResponse<PublishData>> {
  if (!ids.safeParse({ launchPackageId, contentHash }).success) {
    return { status: "failed", summary: "Invalid launch package.", nextActions: [] };
  }
  const userId = await currentUserId();
  if (!userId) return { status: "blocked", summary: "Sign in to approve publishing.", nextActions: ["Sign in."] };

  try {
    return await approvePublish({
      launchPackageId,
      expectedHash: contentHash,
      userId,
      store: createPublishStore(createAdminClient()),
      mailer: createPackageMailer(),
    });
  } catch (e) {
    console.error("[publish] approval failed", e);
    return {
      status: "failed",
      summary: "Could not record the approval. Nothing was sent.",
      nextActions: ["Try again in a minute."],
    };
  }
}
