import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Flier fonts are read from disk at runtime (src/lib/flier/render.tsx).
  outputFileTracingIncludes: {
    // Keys are picomatch globs, so the dynamic segment's brackets are escaped.
    "/events/\\[id\\]": ["./assets/fonts/**/*"],
    // The generate_flier MCP tool renders the same fliers.
    "/api/mcp": ["./assets/fonts/**/*"],
  },
};

export default withEve(nextConfig);
