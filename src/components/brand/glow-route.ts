// Onboarding is a long form that scrolls over the bottom of the screen, so it keeps
// the app glow: muted text on glass over the hero glow's white core drops below 4.5:1.
const HERO_PREFIXES = ["/login", "/oauth"];

export function glowIntensityFor(pathname: string): "app" | "hero" {
  return HERO_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? "hero" : "app";
}
