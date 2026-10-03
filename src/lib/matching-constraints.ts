/**
 * Hard filters for the partner directory. Null means unknown and stays in the
 * set. An empty weekday list means known to have none and is removed.
 * City is a preference: the caller tries a city match, then drops it if empty.
 */

export type ConstraintEvent = {
  city: string;
  guest_count: number;
  date_start: string;
  date_end: string;
};

export type ConstraintProfile = {
  is_seeking_partners: boolean;
  venue_capacity: number | null;
  available_weekdays: number[] | null;
  available_from: string | null;
  available_to: string | null;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Calendar date as written in the ISO string, before any UTC conversion. */
export function calendarDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : value.slice(0, 10);
}

function weekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Weekdays the event occupies. A span of a week or more covers every day. */
export function eventWeekdays(dateStart: string, dateEnd: string): number[] {
  const start = calendarDate(dateStart);
  const end = calendarDate(dateEnd);
  const days = new Set<number>();
  let cursor = start;
  for (let i = 0; i < 7 && cursor <= end; i++) {
    days.add(weekday(cursor));
    cursor = addDays(cursor, 1);
  }
  return [...days];
}

function datesOverlap(profile: ConstraintProfile, event: ConstraintEvent): boolean {
  const start = calendarDate(event.date_start);
  const end = calendarDate(event.date_end);
  if (profile.available_from && profile.available_from > end) return false;
  if (profile.available_to && profile.available_to < start) return false;
  return true;
}

function weekdaysOverlap(profile: ConstraintProfile, event: ConstraintEvent): boolean {
  if (profile.available_weekdays == null) return true;
  if (profile.available_weekdays.length === 0) return false;
  const needed = new Set(eventWeekdays(event.date_start, event.date_end));
  return profile.available_weekdays.some((day) => needed.has(day));
}

export function matchesHardConstraints(
  profile: ConstraintProfile,
  event: ConstraintEvent,
): boolean {
  if (!profile.is_seeking_partners) return false;
  if (profile.venue_capacity != null && profile.venue_capacity < event.guest_count) return false;
  if (!datesOverlap(profile, event)) return false;
  if (!weekdaysOverlap(profile, event)) return false;
  return true;
}

/** Case-insensitive substring, matching the previous city ilike. */
export function cityMatches(profileCity: string, eventCity: string): boolean {
  const needle = eventCity.trim().toLowerCase();
  if (!needle) return false;
  return profileCity.toLowerCase().includes(needle);
}

export function formatWeekdays(days: number[] | null): string {
  if (days == null) return "unknown";
  if (days.length === 0) return "none";
  return [...days].sort((a, b) => a - b).map((day) => DAY[day] ?? String(day)).join(", ");
}

export function formatList(values: string[] | null): string {
  if (values == null) return "unknown";
  if (values.length === 0) return "none";
  return values.join(", ");
}

export function dedupeRankings<T extends { profileId: string; score: number }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const prev = byId.get(row.profileId);
    if (!prev || row.score > prev.score) byId.set(row.profileId, row);
  }
  return [...byId.values()];
}
