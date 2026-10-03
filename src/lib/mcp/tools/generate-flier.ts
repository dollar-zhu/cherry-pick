import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { buildFlier, type FlierRequest } from "@/lib/flier/generate";
import { VIBE_IDS } from "@/lib/flier/design";
import { callerFrom } from "@/lib/mcp/caller";
import { siteUrl } from "@/lib/site";
import { toolFailed, toolSuccess, type ToolResponse } from "@/lib/tool-response";

export const generateFlierTool = {
  name: "generate_flier",
  description:
    "Make the next flier version for an event the signed-in user hosts. Best after co-hosts are approved, because the flier lists approved co-hosts. mode new paints a fresh background (10-20 s); refine edits the latest background with an instruction; restyle keeps the background and changes the fonts.",
  schema: {
    eventId: z.string().uuid().describe("Event id"),
    mode: z.enum(["new", "refine", "restyle"]).default("new"),
    vibe: z.enum(VIBE_IDS).optional().describe("Only for mode new. Omit to match the event format."),
    instruction: z
      .string()
      .min(2)
      .max(300)
      .optional()
      .describe("Required for mode refine, e.g. 'darker, more minimal'"),
  },
  async run(
    args: { eventId: string; mode?: "new" | "refine" | "restyle"; vibe?: (typeof VIBE_IDS)[number]; instruction?: string },
    extra: { authInfo?: AuthInfo },
  ): Promise<ToolResponse> {
    const { supabase } = callerFrom(extra);
    const mode = args.mode ?? "new";
    if (mode === "refine" && !args.instruction) {
      return toolFailed("Refine needs an instruction.", ["Ask the user what to change about the background."]);
    }
    const request: FlierRequest =
      mode === "new"
        ? { mode, vibe: args.vibe }
        : mode === "refine"
          ? { mode, instruction: args.instruction! }
          : { mode };

    const result = await buildFlier(supabase, args.eventId, request);
    if (result.status === "error") {
      return toolFailed(result.message, ["Do not say a flier was made."]);
    }
    const { flier } = result;
    const eventUrl = `${siteUrl()}/events/${args.eventId}`;
    return toolSuccess(
      `Made flier version ${flier.version}${flier.fellBack ? " with a plain background, because image generation was unavailable" : ""}.`,
      {
        resourceId: flier.id,
        nextActions: [
          "Show the user the image URL. It expires in 1 hour.",
          `The host can refine or download it on ${eventUrl}.`,
        ],
        data: {
          flierId: flier.id,
          version: flier.version,
          vibe: flier.vibe,
          fellBack: flier.fellBack,
          imageUrl: flier.imageUrl,
          downloadUrl: flier.downloadUrl,
          eventUrl,
        },
      },
    );
  },
};
