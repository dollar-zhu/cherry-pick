/**
 * Hard filters for the partner directory. Code decides every fact that is a
 * column; the model only ranks what passes. Null means unknown: the profile
 * stays and gets an open question. An empty list means known to have none.
 */

export type ConstraintEvent = {
  city: string;
  guest_count: number;
  date_start: string;
  date_end: string;
  timezone: string; // IANA zone of the event city; the DB returns timestamps in UTC
  // false: date_start..date_end is the event itself.
  // true: it is the window the event can move in, limited to allowed_weekdays.
  dates_flexible: boolean;
  allowed_weekdays: number[] | null;
  needs_venue: boolean;
  required_amenities: string[];
};

export type ConstraintProfile = {
  city: string;
  is_seeking_partners: boolean;
  has_venue: boolean;
  venue_capacity: number | null;
  amenities: string[] | null;
  available_weekdays: number[] | null;
  available_from: string | null;
  available_to: string | null;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Calendar date (YYYY-MM-DD) of an instant in the event's time zone. */
export function localDate(value: string, timezone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(value));
}

function weekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Weekdays inside a span of local dates. A span of a week or more covers every day. */
export function spanWeekdays(start: string, end: string): number[] {
  const days = new Set<number>();
  let cursor = start;
  for (let i = 0; i < 7 && cursor <= end; i++) {
    days.add(weekday(cursor));
    cursor = addDays(cursor, 1);
  }
  return [...days];
}

/** Cities must be the same string, ignoring case and spaces. "SF" is not "San Francisco". */
export function sameCity(profileCity: string, eventCity: string): boolean {
  return profileCity.trim().toLowerCase() === eventCity.trim().toLowerCase();
}

/** ILIKE pattern that matches the whole city. % and _ are literal. */
export function cityIlikePattern(city: string): string {
  return city.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Why a profile cannot work for the event, or null if it passes. */
export function exclusionReason(profile: ConstraintProfile, event: ConstraintEvent): string | null {
  if (!profile.is_seeking_partners) return "Not seeking partners";
  if (!sameCity(profile.city, event.city)) return "Different city";
  if (!event.needs_venue) return null;

  if (!profile.has_venue) return "No venue";
  if (profile.venue_capacity != null && profile.venue_capacity < event.guest_count) {
    return "Venue too small";
  }
  if (
    profile.amenities != null &&
    event.required_amenities.some((amenity) => !profile.amenities!.includes(amenity))
  ) {
    return "Missing a required amenity";
  }

  const start = localDate(event.date_start, event.timezone);
  const end = localDate(event.date_end, event.timezone);
  const eventDays = spanWeekdays(start, end);
  const venueDays = profile.available_weekdays;

  if (event.dates_flexible) {
    // The venue must be open at some point in the window, on an allowed day.
    if (profile.available_from && profile.available_from > end) return "Outside available dates";
    if (profile.available_to && profile.available_to < start) return "Outside available dates";
    const wanted = event.allowed_weekdays
      ? eventDays.filter((day) => event.allowed_weekdays!.includes(day))
      : eventDays;
    if (venueDays != null && !wanted.some((day) => venueDays.includes(day))) {
      return "Unavailable on the event weekdays";
    }
  } else {
    // Fixed dates: the venue must cover the whole event.
    if (profile.available_from && profile.available_from > start) return "Outside available dates";
    if (profile.available_to && profile.available_to < end) return "Outside available dates";
    if (venueDays != null && !eventDays.every((day) => venueDays.includes(day))) {
      return "Unavailable on the event weekdays";
    }
  }
  return null;
}

/** Questions the host must ask because a fact the filter needs is unknown. */
export function openQuestions(profile: ConstraintProfile, event: ConstraintEvent): string[] {
  if (!event.needs_venue) return [];
  const questions: string[] = [];
  if (profile.venue_capacity == null) questions.push("Venue capacity is unknown.");
  if (profile.amenities == null && event.required_amenities.length > 0) {
    questions.push(`Ask if the venue has: ${event.required_amenities.join(", ")}.`);
  }
  if (profile.available_weekdays == null) questions.push("Ask which weekdays the venue is open.");
  if (profile.available_from == null || profile.available_to == null) {
    questions.push("Ask which dates the venue is available.");
  }
  return questions;
}

export function formatWeekdays(days: number[] | null): string {
  if (days == null) return "unknown";
  if (days.length === 0) return "none";
  return [...days].sort((a, b) => a - b).map((day) => DAY[day] ?? String(day)).join(", ");
}

/**
 * Orders candidates by how many of their topics appear in the event text.
 * ponytail: word match only; rank the full set with the model if pools outgrow MATCH_LIMIT.
 */
export type CohostCompany = {
  id: string;
  name: string;
  city: string;
  audience: string;
  topics: string[];
  description: string;
  hasVenue: boolean;
};

export type RankedCohost = CohostCompany & { sharedTopics: string[] };

/** Same-city companies, closest shared topics first. A company with no overlap still lists last. */
export function rankCohosts(topics: string[], companies: CohostCompany[], limit = 8): RankedCohost[] {
  return companies
    .map((company) => {
      const text = `${company.name} ${company.description} ${company.audience} ${company.topics.join(" ")}`;
      const sharedTopics = topics.filter((topic) => topicOverlap([topic], text) > 0);
      return { ...company, sharedTopics };
    })
    .sort((a, b) => b.sharedTopics.length - a.sharedTopics.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function topicOverlap(topics: string[], eventText: string): number {
  return topics.filter((topic) => {
    const word = topic.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return word !== "" && new RegExp(`\\b${word}\\b`, "i").test(eventText);
  }).length;
}

export function dedupeRankings<T extends { profileId: string; score: number }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const prev = byId.get(row.profileId);
    if (!prev || row.score > prev.score) byId.set(row.profileId, row);
  }
  return [...byId.values()];
}
