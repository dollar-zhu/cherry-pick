/**
 * Location match for the partner directory. Cities must be the same string,
 * ignoring case and surrounding spaces. "SF" does not match "San Francisco".
 */

export function sameCity(profileCity: string, eventCity: string): boolean {
  return profileCity.trim().toLowerCase() === eventCity.trim().toLowerCase();
}

/** ILIKE pattern that matches the whole city. % and _ are literal. */
export function cityIlikePattern(city: string): string {
  return city.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function dedupeRankings<T extends { profileId: string; score: number }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const prev = byId.get(row.profileId);
    if (!prev || row.score > prev.score) byId.set(row.profileId, row);
  }
  return [...byId.values()];
}
