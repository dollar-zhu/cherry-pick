import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AMENITIES } from "@/lib/contracts";
import { intakeInstructions, LIVE_MODEL } from "@/lib/intake";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const text = (description: string) => ({ type: Type.STRING, description });

function liveConfig() {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: intakeInstructions("voice"),
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [
      {
        functionDeclarations: [
          {
            name: "propose_event_intent",
            description:
              "Propose the event intent for the user to review. Call once every field is known, " +
              "and again if the host changes a field. This does not create the event; the user confirms it in the UI.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                title: text("Short public name of the event"),
                topic: text("Subject the event is about"),
                goal: text("What the host wants the event to achieve"),
                format: text("Event format, e.g. dinner, panel, workshop, mixer"),
                city: text("City where the event takes place"),
                timezone: text("IANA time zone of the event city, e.g. America/Los_Angeles"),
                date_start: text(
                  "ISO 8601 date-time with UTC offset, e.g. 2026-11-14T19:00:00+01:00",
                ),
                date_end: text(
                  "ISO 8601 date-time with UTC offset, on or after date_start",
                ),
                guest_count: {
                  type: Type.INTEGER,
                  description: "Expected number of guests",
                },
                budget_cap_cents: {
                  type: Type.INTEGER,
                  description:
                    "Maximum total budget in minor units of currency, e.g. 300000 for 3,000.00",
                },
                currency: text("ISO 4217 currency code of the budget, e.g. EUR or USD"),
                sales_boundary: text("What selling or pitching is and is not allowed at the event"),
                partner_criteria: text("Requirements a sponsor or partner must meet"),
                needs_venue: {
                  type: Type.BOOLEAN,
                  description: "True if a partner must provide the venue",
                },
                dates_flexible: {
                  type: Type.BOOLEAN,
                  description:
                    "False: date_start and date_end are the event itself. True: they are the earliest and latest possible dates",
                },
                allowed_weekdays: {
                  type: Type.ARRAY,
                  nullable: true,
                  items: { type: Type.INTEGER },
                  description:
                    "Only when dates_flexible: possible days, 0 = Sunday ... 6 = Saturday. null = any day. null when dates are fixed",
                },
                required_amenities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING, enum: [...AMENITIES] },
                  description: `Things the venue must have. [] = none. Allowed: ${AMENITIES.join(", ")}`,
                },
              },
              required: [
                "title",
                "topic",
                "goal",
                "format",
                "city",
                "timezone",
                "date_start",
                "date_end",
                "guest_count",
                "budget_cap_cents",
                "currency",
                "sales_boundary",
                "partner_criteria",
                "needs_venue",
                "dates_flexible",
                "allowed_weekdays",
                "required_amenities",
              ],
            },
          },
        ],
      },
    ],
  };
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return error(401, "Unauthorized");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Unauthorized");

  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API;
  if (!apiKey) return error(503, "Voice chat is not configured.");

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        // Locks the model, prompt, and tool so the browser token cannot be reused as a general key.
        liveConnectConstraints: { model: LIVE_MODEL, config: liveConfig() },
      },
    });
    if (!token.name) return error(502, "Could not start voice chat.");
    return Response.json({ token: token.name, model: LIVE_MODEL });
  } catch (e) {
    console.error("[api/voice]", e);
    return error(502, "Could not start voice chat.");
  }
}
