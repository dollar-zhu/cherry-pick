"use client";

import { usePathname } from "next/navigation";
import { Glow } from "./glow";
import { glowIntensityFor } from "./glow-route";

/** The one glow for the whole app; hero screens get the stronger one. */
export function RouteGlow() {
  return <Glow intensity={glowIntensityFor(usePathname() ?? "/")} />;
}
