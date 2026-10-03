import { z } from "zod";

// Keep this list identical to the check constraint in supabase/migrations/.
export const AMENITIES = [
  "projector",
  "wifi",
  "av_system",
  "catering",
  "kitchen",
  "step_free_access",
  "accessible_restroom",
  "parking",
] as const;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const; // index = Postgres dow

const isoDate = z.string().date("Enter a valid calendar date.");

export const Profile = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    city: z.string().trim().min(1),
    audience: z.string().trim().min(1),
    topics: z.array(z.string().trim().min(1)).min(1),
    website_url: z.string().url("Enter a valid link.").nullable(),
    is_seeking_partners: z.boolean(),
    has_venue: z.boolean(),
    // Venue fields: null = unknown or no venue. amenities [] = known to have none.
    venue_capacity: z.number().int().positive().nullable(),
    amenities: z.array(z.enum(AMENITIES)).nullable(),
    available_weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
    available_from: isoDate.nullable(),
    available_to: isoDate.nullable(),
  })
  .refine((p) => !p.has_venue || p.venue_capacity !== null, {
    message: "Venue capacity is required when you offer a venue.",
    path: ["venue_capacity"],
  })
  .refine((p) => !p.available_from || !p.available_to || p.available_from <= p.available_to, {
    message: "The end date must be on or after the start date.",
    path: ["available_to"],
  });

export type Profile = z.infer<typeof Profile>;

const PROFILE_TEXT = ["name", "description", "city", "audience"] as const;

/** Fields the intake must collect before creating an event or browsing co-hosts. */
export function missingProfileFields(
  profile: {
    name?: string | null;
    description?: string | null;
    city?: string | null;
    audience?: string | null;
    topics?: string[] | null;
  } | null,
): string[] {
  if (!profile) return [...PROFILE_TEXT, "topics"];
  const missing: string[] = [];
  for (const key of PROFILE_TEXT) {
    if (!profile[key]?.trim()) missing.push(key);
  }
  if (!profile.topics?.some((topic) => topic.trim())) missing.push("topics");
  return missing;
}

export function readProfileForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const numberOrNull = (key: string) => (text(key) === "" ? null : Number(text(key)));
  const venue = formData.get("has_venue") === "on";
  const website = text("website_url");

  return {
    name: text("name"),
    description: text("description"),
    city: text("city"),
    audience: text("audience"),
    topics: text("topics").split(",").map((t) => t.trim()).filter(Boolean),
    // "acme.com" -> "https://acme.com"
    website_url: website === "" ? null : /^https?:\/\//i.test(website) ? website : `https://${website}`,
    is_seeking_partners: formData.get("is_seeking_partners") === "on",
    has_venue: venue,
    venue_capacity: venue ? numberOrNull("venue_capacity") : null,
    amenities: venue && formData.get("amenities_confirmed") === "on"
      ? formData.getAll("amenities").map(String) : null,
    available_weekdays: venue && formData.get("weekdays_confirmed") === "on"
      ? formData.getAll("available_weekdays").map(Number) : null,
    available_from: venue ? text("available_from") || null : null,
    available_to: venue ? text("available_to") || null : null,
  };
}
