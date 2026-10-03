import type { SupabaseClient } from "@supabase/supabase-js";

export const FLIER_BUCKET = "fliers";
const URL_TTL_SECONDS = 60 * 60;

export type FlierRow = {
  id: string;
  version: number;
  storage_path: string;
  background_path: string | null;
  background_source: "gemini" | "fallback";
  vibe: string;
  font_set: string;
  layout: string;
  instruction: string | null;
  created_at: string;
};

export const FLIER_COLUMNS =
  "id, version, storage_path, background_path, background_source, vibe, font_set, layout, instruction, created_at";

export type FlierView = {
  id: string;
  version: number;
  vibe: string;
  fontSet: string;
  instruction: string | null;
  fellBack: boolean;
  imageUrl: string;
  downloadUrl: string;
};

/** Latest flier for an event with short-lived URLs, or null. RLS decides who may see it. */
export async function loadLatestFlier(
  supabase: SupabaseClient,
  eventId: string,
  downloadName: string,
): Promise<{ flier: FlierView | null; error: boolean }> {
  const { data, error } = await supabase
    .from("fliers")
    .select(FLIER_COLUMNS)
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<FlierRow>();
  if (error) {
    console.error("[loadLatestFlier]", error);
    return { flier: null, error: true };
  }
  if (!data) return { flier: null, error: false };
  const flier = await toView(supabase, data, downloadName);
  return { flier, error: flier === null };
}

export async function toView(
  supabase: SupabaseClient,
  row: FlierRow,
  downloadName: string,
): Promise<FlierView | null> {
  const bucket = supabase.storage.from(FLIER_BUCKET);
  const [view, download] = await Promise.all([
    bucket.createSignedUrl(row.storage_path, URL_TTL_SECONDS),
    bucket.createSignedUrl(row.storage_path, URL_TTL_SECONDS, { download: `${downloadName}-v${row.version}.png` }),
  ]);
  if (view.error || download.error) {
    console.error("[flier url]", view.error ?? download.error);
    return null;
  }
  return {
    id: row.id,
    version: row.version,
    vibe: row.vibe,
    fontSet: row.font_set,
    instruction: row.instruction,
    fellBack: row.background_source === "fallback",
    imageUrl: view.data.signedUrl,
    downloadUrl: download.data.signedUrl,
  };
}

/** File-name-safe slug of the event title for downloads. */
export function flierFileName(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return slug ? `${slug}-flier` : "event-flier";
}
