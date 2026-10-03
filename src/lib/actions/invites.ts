"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type InviteActionResult = { status: "ok" } | { status: "error"; message: string };

const KNOWN_ERRORS = [
  "Sign in to continue.",
  "Select at least one company.",
  "You can send at most 25 invites at a time.",
  "Event not found.",
  "You can only invite matched companies.",
  "You cannot invite your own company.",
  "This invite is no longer waiting for a response.",
  "This invite is not waiting for your decision.",
  "Note must be 500 characters or fewer.",
];

function friendlyError(message: string, fallback: string) {
  return KNOWN_ERRORS.find((known) => message.includes(known)) ?? fallback;
}

async function clientOrError(): Promise<
  { ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; error: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, error: "Sign in to continue." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { ok: false, error: "Sign in to continue." };
  return { ok: true, supabase };
}

export async function sendInvites(
  eventId: string,
  profileIds: string[],
): Promise<InviteActionResult & { count?: number }> {
  const event = z.string().uuid().safeParse(eventId);
  const ids = z.array(z.string().uuid()).safeParse([...new Set(profileIds)]);
  if (!event.success || !ids.success || ids.data.length === 0) {
    return { status: "error", message: "Select at least one company." };
  }
  if (ids.data.length > 25) {
    return { status: "error", message: "You can send at most 25 invites at a time." };
  }

  const gate = await clientOrError();
  if (!gate.ok) return { status: "error", message: gate.error };

  const { data, error } = await gate.supabase.rpc("send_invites", {
    p_event_id: event.data,
    p_profile_ids: ids.data,
  });
  if (error) {
    console.error("[sendInvites]", error);
    return {
      status: "error",
      message: friendlyError(error.message, "Could not send invites. Please try again."),
    };
  }

  const count = Array.isArray(data) ? data.length : 0;
  if (count === 0) {
    return { status: "error", message: "Those companies were already invited." };
  }
  return { status: "ok", count };
}

export async function respondToInvite(
  inviteId: string,
  accept: boolean,
  note: string,
): Promise<InviteActionResult> {
  const id = z.string().uuid().safeParse(inviteId);
  const parsedNote = z.string().max(500).safeParse(note);
  if (!id.success || !parsedNote.success) {
    return {
      status: "error",
      message: parsedNote.success
        ? "This invite is no longer waiting for a response."
        : "Note must be 500 characters or fewer.",
    };
  }

  const gate = await clientOrError();
  if (!gate.ok) return { status: "error", message: gate.error };

  const { error } = await gate.supabase.rpc("respond_to_invite", {
    p_invite_id: id.data,
    p_accept: accept,
    p_note: parsedNote.data,
  });
  if (error) {
    console.error("[respondToInvite]", error);
    return {
      status: "error",
      message: friendlyError(error.message, "Could not update this invite. Please try again."),
    };
  }
  return { status: "ok" };
}

export async function decideInvite(inviteId: string, approve: boolean): Promise<InviteActionResult> {
  const id = z.string().uuid().safeParse(inviteId);
  if (!id.success) {
    return { status: "error", message: "This invite is not waiting for your decision." };
  }

  const gate = await clientOrError();
  if (!gate.ok) return { status: "error", message: gate.error };

  const { error } = await gate.supabase.rpc("decide_invite", {
    p_invite_id: id.data,
    p_approve: approve,
  });
  if (error) {
    console.error("[decideInvite]", error);
    return {
      status: "error",
      message: friendlyError(error.message, "Could not update this invite. Please try again."),
    };
  }
  return { status: "ok" };
}
