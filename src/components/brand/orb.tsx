import { cn } from "@/lib/utils";
import { orbLabel, toOrbState } from "./orb-state";

type OrbProps = {
  /** Set by the voice feature. Unknown values render the idle orb. */
  state?: unknown;
  /** Diameter in px. */
  size?: number;
  className?: string;
};

export function Orb({ state, size = 72, className }: OrbProps) {
  const s = toOrbState(state);
  return (
    <div
      role="img"
      aria-label={orbLabel(s)}
      data-state={s}
      className={cn("cp-orb", className)}
      style={{ width: size, height: size }}
    />
  );
}
