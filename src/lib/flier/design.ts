// Flier design choices (SUP-23). Pure: no I/O, no "@/" imports, so node --test can load it.
//
// A flier is two layers: an abstract, text-free background from Nano Banana in one
// of the VIBES, and text set in one of the FONT_SETS in one of the LAYOUTS.
// The model never draws text; we place it, so names and dates are always spelled right.

export const FLIER_WIDTH = 1080;
export const FLIER_HEIGHT = 1350; // 4:5 portrait
export const FLIER_PADDING = 88;

export type Ink = "light" | "dark"; // text color over the background

export type Vibe = {
  id: string;
  label: string;
  /** What the background looks like. Never mentions text. */
  look: string;
  ink: Ink;
  accent: string;
  /** CSS background used when image generation fails. */
  fallback: string;
};

export const VIBES = [
  {
    id: "candlelit",
    label: "Candlelit dinner",
    look: "warm candlelit dinner atmosphere, deep amber and oxblood tones, soft out-of-focus bokeh lights, subtle film grain",
    ink: "light",
    accent: "#F6C77D",
    fallback: "linear-gradient(160deg, #3b0d0c 0%, #1a0606 55%, #080202 100%)",
  },
  {
    id: "midnight-neon",
    label: "Midnight neon",
    look: "deep navy and violet darkness with thin glowing cyan and magenta light trails, long-exposure feel, futuristic and technical",
    ink: "light",
    accent: "#7DF9FF",
    fallback: "linear-gradient(160deg, #1b1446 0%, #0b0b2a 55%, #03030f 100%)",
  },
  {
    id: "paper-minimal",
    label: "Paper minimal",
    look: "warm off-white textured paper with a few large soft abstract ink shapes in charcoal and terracotta, lots of empty space, Swiss minimal",
    ink: "dark",
    accent: "#B4532A",
    fallback: "linear-gradient(160deg, #f6f0e6 0%, #efe6d6 60%, #e4d7c2 100%)",
  },
  {
    id: "sunset-grain",
    label: "Sunset grain",
    look: "grainy blurred gradient of peach, coral and magenta like a sunset over the bay, soft and dreamy, risograph texture",
    ink: "light",
    accent: "#FFE3C2",
    fallback: "linear-gradient(170deg, #ff9a76 0%, #d9467a 55%, #4a1543 100%)",
  },
  {
    id: "botanical-shadow",
    label: "Botanical shadow",
    look: "moody dark green abstract shadows of large leaves on a plaster wall, dappled light, calm and lush",
    ink: "light",
    accent: "#CFE8B8",
    fallback: "linear-gradient(160deg, #1f3a2b 0%, #10211a 55%, #050c08 100%)",
  },
  {
    id: "liquid-chrome",
    label: "Liquid chrome",
    look: "abstract liquid chrome and iridescent glass shapes flowing on a black background, glossy reflections, high-end tech",
    ink: "light",
    accent: "#D7D2FF",
    fallback: "linear-gradient(160deg, #2a2a33 0%, #101014 55%, #000000 100%)",
  },
] as const satisfies readonly Vibe[];

export type VibeId = (typeof VIBES)[number]["id"];
export const VIBE_IDS = VIBES.map((v) => v.id) as [VibeId, ...VibeId[]];

export type FontFace = { file: string; family: string; weight: 400 | 600 | 700 | 800 };

export type FontSet = {
  id: string;
  display: FontFace;
  body: FontFace;
  bodyStrong: FontFace;
  uppercaseTitle: boolean;
  /** Average glyph width as a share of font size, for line-fitting estimates. */
  titleWidth: number;
  titleLineHeight: number;
  titleTracking: number; // em
};

// Files live in assets/fonts (static TTFs, SIL Open Font License, from Fontsource).
const face = (file: string, family: string, weight: FontFace["weight"]): FontFace => ({ file, family, weight });
const INTER = face("inter-400.ttf", "Inter", 400);
const INTER_STRONG = face("inter-600.ttf", "Inter", 600);

export const FONT_SETS = [
  { id: "editorial", display: face("playfair-display-700.ttf", "Playfair Display", 700), body: INTER, bodyStrong: INTER_STRONG, uppercaseTitle: false, titleWidth: 0.52, titleLineHeight: 1.05, titleTracking: -0.01 },
  { id: "poster", display: face("bebas-neue-400.ttf", "Bebas Neue", 400), body: INTER, bodyStrong: INTER_STRONG, uppercaseTitle: true, titleWidth: 0.4, titleLineHeight: 0.92, titleTracking: 0.01 },
  { id: "grotesk", display: face("space-grotesk-700.ttf", "Space Grotesk", 700), body: face("space-grotesk-400.ttf", "Space Grotesk", 400), bodyStrong: face("space-grotesk-700.ttf", "Space Grotesk", 700), uppercaseTitle: false, titleWidth: 0.56, titleLineHeight: 1.0, titleTracking: -0.03 },
  { id: "classic", display: face("dm-serif-display-400.ttf", "DM Serif Display", 400), body: face("dm-sans-400.ttf", "DM Sans", 400), bodyStrong: face("dm-sans-600.ttf", "DM Sans", 600), uppercaseTitle: false, titleWidth: 0.48, titleLineHeight: 1.04, titleTracking: -0.01 },
  { id: "heavy", display: face("archivo-black-400.ttf", "Archivo Black", 400), body: face("archivo-400.ttf", "Archivo", 400), bodyStrong: face("archivo-black-400.ttf", "Archivo Black", 400), uppercaseTitle: true, titleWidth: 0.72, titleLineHeight: 0.98, titleTracking: -0.02 },
  { id: "avant", display: face("syne-800.ttf", "Syne", 800), body: INTER, bodyStrong: INTER_STRONG, uppercaseTitle: false, titleWidth: 0.8, titleLineHeight: 1.0, titleTracking: -0.02 },
  { id: "soft-serif", display: face("fraunces-700.ttf", "Fraunces", 700), body: face("dm-sans-400.ttf", "DM Sans", 400), bodyStrong: face("dm-sans-600.ttf", "DM Sans", 600), uppercaseTitle: false, titleWidth: 0.54, titleLineHeight: 1.04, titleTracking: -0.02 },
  { id: "elegant", display: face("instrument-serif-400.ttf", "Instrument Serif", 400), body: INTER, bodyStrong: INTER_STRONG, uppercaseTitle: false, titleWidth: 0.42, titleLineHeight: 1.0, titleTracking: -0.01 },
] as const satisfies readonly FontSet[];

export type FontSetId = (typeof FONT_SETS)[number]["id"];

/** Where the text sits; the background prompt keeps that area calm. */
export const LAYOUTS = ["bottom", "center", "split"] as const;
export type Layout = (typeof LAYOUTS)[number];

// Phrased as soft falloff, not regions: "middle band" made the model draw a literal letterbox strip.
const CALM_AREA: Record<Layout, string> = {
  bottom: "The detail and light gather toward the top and fade gradually into soft, low-detail tones toward the bottom edge.",
  center: "The detail and light gather toward the edges and corners and fade gradually into a soft, low-detail center.",
  split: "The detail and light sit loosely around the middle and fade gradually into soft, low-detail tones toward both the top and bottom edges.",
};

const SEAMLESS =
  "One continuous, seamless, full-bleed image: no panels, stripes, bands, letterboxing, split screens, borders or frames.";

export type FlierStyle = { vibe: VibeId; fontSet: FontSetId; layout: Layout };

export function getVibe(id: string): Vibe {
  return VIBES.find((v) => v.id === id) ?? VIBES[0];
}

export function getFontSet(id: string): FontSet {
  return FONT_SETS.find((f) => f.id === id) ?? FONT_SETS[0];
}

/** Default vibe for an event format, so a dinner looks like a dinner unless the host picks. */
export function vibeForFormat(format: string): VibeId | null {
  const f = format.toLowerCase();
  if (/dinner|supper|wine|tasting/.test(f)) return "candlelit";
  if (/roundtable|salon|breakfast|brunch/.test(f)) return "paper-minimal";
  if (/workshop|hack|demo|meetup/.test(f)) return "midnight-neon";
  if (/garden|picnic|retreat|walk/.test(f)) return "botanical-shadow";
  if (/party|mixer|happy hour|drinks/.test(f)) return "sunset-grain";
  return null;
}

type Random = () => number;
const pick = <T,>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length) % items.length];

/** Random font set and layout; vibe from the request, then the format, then random. */
export function pickStyle(
  format: string,
  random: Random,
  wanted: Partial<FlierStyle> = {},
  avoid?: Partial<FlierStyle>,
): FlierStyle {
  const fontSets = FONT_SETS.filter((f) => f.id !== avoid?.fontSet);
  return {
    vibe: wanted.vibe ?? vibeForFormat(format) ?? pick(VIBES, random).id,
    fontSet: wanted.fontSet ?? pick(fontSets.length ? fontSets : FONT_SETS, random).id,
    layout: wanted.layout ?? pick(LAYOUTS, random),
  };
}

const NO_TEXT =
  "Absolutely no text, letters, numbers, words, signage, logos, watermarks, people, faces or hands anywhere in the image.";

export function backgroundPrompt(style: Pick<FlierStyle, "vibe" | "layout">, format: string): string {
  const vibe = getVibe(style.vibe);
  return [
    `Abstract background artwork for a portrait event flier for an intimate ${format.toLowerCase()}.`,
    `Look: ${vibe.look}.`,
    CALM_AREA[style.layout],
    SEAMLESS,
    "Editorial, tasteful, high quality.",
    NO_TEXT,
  ].join(" ");
}

/** Prompt for editing the previous background, e.g. "darker, add a skyline". */
export function refinePrompt(instruction: string, layout: Layout): string {
  return [
    `Edit this abstract flier background: ${instruction.trim()}.`,
    "Keep it abstract and keep the overall composition.",
    CALM_AREA[layout],
    SEAMLESS,
    NO_TEXT,
  ].join(" ");
}

/** Word-wraps an estimate of the title and returns the largest size that fits in maxLines. */
export function fitTitle(
  title: string,
  fontSet: Pick<FontSet, "titleWidth" | "uppercaseTitle">,
  { width, maxLines = 3, max = 150, min = 48 }: { width: number; maxLines?: number; max?: number; min?: number },
): { size: number; lines: number } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const widthFactor = fontSet.titleWidth * (fontSet.uppercaseTitle ? 1.12 : 1);
  for (let size = max; size >= min; size -= 4) {
    // 8% slack: the width factors are averages and wide letters cluster in some words.
    const perLine = (width * 0.92) / (size * widthFactor);
    let lines = 1;
    let used = 0;
    let fits = true;
    for (const word of words) {
      if (word.length > perLine) fits = false;
      const next = used === 0 ? word.length : used + 1 + word.length;
      if (next <= perLine) used = next;
      else {
        lines += 1;
        used = word.length;
      }
    }
    if (fits && lines <= maxLines) return { size, lines };
  }
  return { size: min, lines: maxLines };
}

export type FlierFacts = {
  title: string;
  topic: string;
  format: string;
  guestCount: number;
  city: string;
  timezone: string;
  dateStart: string;
  dateEnd: string;
  datesFlexible: boolean;
  hostName: string | null;
  cohostNames: string[];
};

export type FlierText = {
  kicker: string;
  title: string;
  subtitle: string;
  when: string;
  where: string;
  hostedBy: string | null;
  footer: string;
};

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function hostedByLine(hostName: string | null, cohostNames: string[]): string | null {
  const names = [hostName, ...cohostNames].filter((n): n is string => Boolean(n && n.trim()));
  if (names.length === 0) return null;
  if (names.length <= 3) return `Hosted by ${names.join(" × ")}`;
  return `Hosted by ${names.slice(0, 2).join(" × ")} + ${names.length - 2} more`;
}

/**
 * The words on the flier. Only public facts: never the budget, goal or partner criteria,
 * which are the host's private brief.
 */
export function flierText(facts: FlierFacts, locale = "en-US"): FlierText {
  const start = new Date(facts.dateStart);
  const end = new Date(facts.dateEnd);
  const tz = facts.timezone || "UTC";
  let when: string;
  if (facts.datesFlexible) {
    const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: tz });
    const a = month.format(start);
    const b = month.format(end);
    when = a === b ? `${a} · date to be announced` : `${a} – ${b} · date to be announced`;
  } else {
    const day = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: tz });
    const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz });
    const sameDay = day.format(start) === day.format(end);
    when = sameDay
      ? `${day.format(start)} · ${time.format(start)} – ${time.format(end)}`
      : `${day.format(start)} – ${day.format(end)}`;
  }
  return {
    kicker: `${capitalize(facts.format.trim())} for ${facts.guestCount} · Invite only`,
    title: facts.title.trim(),
    subtitle: capitalize(facts.topic.trim()),
    when,
    where: facts.city.trim(),
    hostedBy: hostedByLine(facts.hostName, facts.cohostNames),
    footer: "RSVP via the hosts",
  };
}
