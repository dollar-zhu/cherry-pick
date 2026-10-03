import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const COHOST_ERRORS = [
  "Sign in to continue.",
  "Event not found.",
  "Save your company profile before applying.",
  "You already have a request for this event.",
  "Note must be 500 characters or fewer.",
  "This invite is not waiting for your decision.",
] as const;

export function cohostError(message: string, fallback: string) {
  return COHOST_ERRORS.find((known) => message.includes(known)) ?? fallback;
}

const postedEventRow = z.object({
  id: z.string().uuid(),
  title: z.string(),
  topic: z.string(),
  format: z.string(),
  city: z.string(),
  timezone: z.string(),
  date_start: z.string(),
  date_end: z.string(),
  dates_flexible: z.boolean(),
  guest_count: z.number(),
  host_name: z.string().nullable(),
  application_status: z.string().nullable(),
});

export type PostedEvent = z.infer<typeof postedEventRow>;

export async function listPostedEvents(
  supabase: SupabaseClient,
): Promise<{ error: string } | { events: PostedEvent[] }> {
  const { data, error } = await supabase.rpc("posted_events");
  if (error) return { error: cohostError(error.message, "Could not load events.") };
  const events = (Array.isArray(data) ? data : []).flatMap((row) => {
    const parsed = postedEventRow.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  return { events };
}

export async function applyToEvent(
  supabase: SupabaseClient,
  eventId: string,
  note: string,
): Promise<{ error: string } | { applicationId: string }> {
  const id = z.string().uuid().safeParse(eventId);
  const parsedNote = z.string().max(500).safeParse(note);
  if (!id.success) return { error: "Event not found." };
  if (!parsedNote.success) return { error: "Note must be 500 characters or fewer." };

  const { data, error } = await supabase.rpc("apply_to_event", {
    p_event_id: id.data,
    p_note: parsedNote.data,
  });
  if (error) return { error: cohostError(error.message, "Could not apply. Please try again.") };
  const row = Array.isArray(data) ? data[0] : data;
  const applicationId = (row as { id?: string } | null)?.id;
  if (!applicationId) return { error: "Could not apply. Please try again." };
  return { applicationId };
}

const applicationRow = z.object({
  id: z.string().uuid(),
  status: z.string(),
  note: z.string().nullable(),
  event_id: z.string().uuid(),
  events: z.object({ title: z.string() }).nullable(),
  profiles: z.object({ name: z.string() }).nullable(),
});

export type CohostApplication = {
  id: string;
  status: string;
  note: string | null;
  eventId: string;
  eventTitle: string;
  companyName: string;
};

/** Applications and accepted invites on events that ownerId hosts. */
export async function listApplications(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ error: string } | { applications: CohostApplication[] }> {
  // RLS also returns the caller's own outgoing applications, so filter to events they host.
  const { data, error } = await supabase
    .from("invites")
    .select("id, status, note, event_id, events!inner(title, owner_id), profiles(name)")
    .eq("events.owner_id", ownerId)
    .in("status", ["applied", "accepted"])
    .order("created_at", { ascending: false });
  if (error) return { error: "Could not load applications." };

  const applications: CohostApplication[] = (data ?? []).flatMap((row) => {
    const record = row as {
      id: string;
      status: string;
      note: string | null;
      event_id: string;
      events: { title: string } | { title: string }[] | null;
      profiles: { name: string } | { name: string }[] | null;
    };
    const parsed = applicationRow.safeParse({
      ...record,
      events: Array.isArray(record.events) ? record.events[0] ?? null : record.events,
      profiles: Array.isArray(record.profiles) ? record.profiles[0] ?? null : record.profiles,
    });
    if (!parsed.success) return [];
    return [{
      id: parsed.data.id,
      status: parsed.data.status,
      note: parsed.data.note,
      eventId: parsed.data.event_id,
      eventTitle: parsed.data.events?.title ?? "Event",
      companyName: parsed.data.profiles?.name ?? "Unknown",
    }];
  });
  return { applications };
}

export async function decideCohost(
  supabase: SupabaseClient,
  inviteId: string,
  approve: boolean,
): Promise<{ error: string } | { status: "approved" | "rejected" }> {
  const id = z.string().uuid().safeParse(inviteId);
  if (!id.success) return { error: "This invite is not waiting for your decision." };
  const { error } = await supabase.rpc("decide_invite", {
    p_invite_id: id.data,
    p_approve: approve,
  });
  if (error) return { error: cohostError(error.message, "Could not update this application.") };
  return { status: approve ? "approved" as const : "rejected" as const };
}
