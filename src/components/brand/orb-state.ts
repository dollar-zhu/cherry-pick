export const ORB_STATES = ["idle", "listening", "thinking", "speaking"] as const;

export type OrbState = (typeof ORB_STATES)[number];

const LABELS: Record<OrbState, string> = {
  idle: "Voice idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

/** Voice events arrive as loose strings; anything unrecognized shows the idle orb. */
export function toOrbState(value: unknown): OrbState {
  return typeof value === "string" && (ORB_STATES as readonly string[]).includes(value)
    ? (value as OrbState)
    : "idle";
}

export function orbLabel(state: OrbState): string {
  return LABELS[state];
}
