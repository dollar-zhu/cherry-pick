"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateBackground, type BackgroundImage } from "@/lib/flier/background";
import {
  VIBE_IDS,
  backgroundPrompt,
  flierText,
  pickStyle,
  refinePrompt,
  type FlierStyle,
  type FontSetId,
  type Layout,
  type VibeId,
} from "@/lib/flier/design";
import { renderFlier } from "@/lib/flier/render";
import {
  FLIER_BUCKET,
  FLIER_COLUMNS,
  flierFileName,
  toView,
  type FlierRow,
  type FlierView,
} from "@/lib/flier/store";

export type FlierActionResult =
  | { status: "ok"; flier: FlierView }
  | { status: "error"; message: string };

const requestSchema = z.discriminatedUnion("mode", [
  // Fresh flier: new background; vibe from the host, else from the format.
  z.object({ mode: z.literal("new"), vibe: z.enum(VIBE_IDS).optional() }),
  // Edit the latest background with an instruction; keep fonts and layout.
  z.object({ mode: z.literal("refine"), instruction: z.string().trim().min(2).max(300) }),
  // Same background, different fonts. No image model call.
  z.object({ mode: z.literal("restyle") }),
]);

export type FlierRequest = z.input<typeof requestSchema>;

const UNIQUE_VIOLATION = "23505";

/**
 * Generates the next flier version for an event the signed-in user hosts.
 * The background comes from Nano Banana; the text is set by renderFlier, so it is
 * always spelled right. If the image model fails, the vibe's gradient is used instead.
 */
export async function generateFlier(eventId: string, request: FlierRequest): Promise<FlierActionResult> {
  const id = z.string().uuid().safeParse(eventId);
  const parsed = requestSchema.safeParse(request);
  if (!id.success || !parsed.success) {
    return { status: "error", message: "Describe the change in 2–300 characters." };
  }
  const req = parsed.data;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { status: "error", message: "Sign in to continue." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { status: "error", message: "Sign in to continue." };

  // RLS returns the event only to its host.
  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, title, topic, format, guest_count, city, timezone, date_start, date_end, dates_flexible")
    .eq("id", id.data)
    .maybeSingle();
  if (!event) return { status: "error", message: "Only the event host can make the flier." };

  const [hostResult, cohostResult, latestResult] = await Promise.all([
    supabase.from("profiles").select("name").eq("user_id", event.owner_id).maybeSingle(),
    supabase
      .from("invites")
      .select("profiles(name)")
      .eq("event_id", event.id)
      .eq("status", "approved")
      .order("updated_at", { ascending: true }),
    supabase
      .from("fliers")
      .select(FLIER_COLUMNS)
      .eq("event_id", event.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<FlierRow>(),
  ]);
  if (cohostResult.error) console.error("[generateFlier cohosts]", cohostResult.error);
  if (latestResult.error) {
    console.error("[generateFlier latest]", latestResult.error);
    return { status: "error", message: "Could not load the current flier. Please try again." };
  }
  const latest = latestResult.data;
  if (req.mode !== "new" && !latest) return { status: "error", message: "Create a flier first." };

  const cohostNames = (cohostResult.data ?? [])
    .map((row) => (row.profiles as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  const text = flierText({
    title: event.title,
    topic: event.topic,
    format: event.format,
    guestCount: event.guest_count,
    city: event.city,
    timezone: event.timezone,
    dateStart: event.date_start,
    dateEnd: event.date_end,
    datesFlexible: event.dates_flexible,
    hostName: hostResult.data?.name ?? null,
    cohostNames,
  });

  // Style and background for this version.
  const previousStyle: FlierStyle | null = latest
    ? { vibe: latest.vibe as VibeId, fontSet: latest.font_set as FontSetId, layout: latest.layout as Layout }
    : null;
  let style: FlierStyle;
  let background: BackgroundImage | { bytes: Uint8Array; mimeType: string } | null = null;
  let backgroundPath: string | null = null; // set when reusing the previous file
  let instruction: string | null = null;

  if (req.mode === "new") {
    style = pickStyle(event.format, Math.random, { vibe: req.vibe }, previousStyle ?? undefined);
    background = await generateBackground(backgroundPrompt(style, event.format));
  } else {
    const prev = latest!;
    const previousBackground = await downloadBackground(supabase, prev.background_path);
    if (prev.background_path && !previousBackground) {
      return { status: "error", message: "Could not load the current flier. Please try again." };
    }
    if (req.mode === "refine") {
      style = previousStyle!;
      instruction = req.instruction;
      background = previousBackground
        ? await generateBackground(refinePrompt(req.instruction, style.layout), previousBackground)
        : // The last version fell back to a gradient: start over, steered by the instruction.
          await generateBackground(`${backgroundPrompt(style, event.format)} Also: ${req.instruction}.`);
    } else {
      // Same background and layout (its calm area matches), new fonts.
      style = pickStyle(event.format, Math.random, { vibe: previousStyle!.vibe, layout: previousStyle!.layout }, previousStyle!);
      background = previousBackground;
      backgroundPath = previousBackground ? prev.background_path : null;
    }
  }

  let png: Uint8Array;
  try {
    png = await renderFlier(text, style, background);
  } catch (error) {
    console.error("[generateFlier render]", error);
    return { status: "error", message: "Could not draw the flier. Please try again." };
  }

  const version = (latest?.version ?? 0) + 1;
  const bucket = supabase.storage.from(FLIER_BUCKET);
  const storagePath = `${event.id}/v${version}.png`;

  if (background && !backgroundPath) {
    backgroundPath = `${event.id}/v${version}-background.${extension(background.mimeType)}`;
    const upload = await bucket.upload(backgroundPath, background.bytes, { contentType: background.mimeType });
    if (upload.error) return uploadFailed(upload.error);
  }
  const upload = await bucket.upload(storagePath, png, { contentType: "image/png" });
  if (upload.error) return uploadFailed(upload.error);

  const { data: row, error } = await supabase
    .from("fliers")
    .insert({
      event_id: event.id,
      version,
      storage_path: storagePath,
      background_path: backgroundPath,
      background_source: backgroundPath ? "gemini" : "fallback",
      model: background && "model" in background ? background.model : null,
      vibe: style.vibe,
      font_set: style.fontSet,
      layout: style.layout,
      instruction,
    })
    .select(FLIER_COLUMNS)
    .single<FlierRow>();
  if (error) {
    console.error("[generateFlier insert]", error);
    return {
      status: "error",
      message:
        error.code === UNIQUE_VIOLATION
          ? "Another flier was just created. Reload and try again."
          : "Could not save the flier. Please try again.",
    };
  }

  const flier = await toView(supabase, row, flierFileName(event.title));
  if (!flier) return { status: "error", message: "The flier was saved but could not be loaded. Reload the page." };
  return { status: "ok", flier };
}

async function downloadBackground(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(FLIER_BUCKET).download(path);
  if (error || !data) {
    console.error("[flier background download]", error);
    return null;
  }
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type || "image/jpeg" };
}

function extension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function uploadFailed(error: { message: string }): FlierActionResult {
  console.error("[generateFlier upload]", error);
  // Same path already taken: another version was created concurrently.
  if (/exists|duplicate/i.test(error.message)) {
    return { status: "error", message: "Another flier was just created. Reload and try again." };
  }
  return { status: "error", message: "Could not save the flier. Please try again." };
}
