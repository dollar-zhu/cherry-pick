import { GoogleGenAI, Modality } from "@google/genai";
import { zodSchema } from "ai";
import { intakeInstructions, LIVE_MODEL } from "@/lib/intake";
import { intentSchema } from "@/lib/intent";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

async function liveConfig() {
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
            // Same schema as the chat tool, so voice and chat cannot drift apart.
            parametersJsonSchema: await zodSchema(intentSchema).jsonSchema,
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
        liveConnectConstraints: { model: LIVE_MODEL, config: await liveConfig() },
      },
    });
    if (!token.name) return error(502, "Could not start voice chat.");
    return Response.json({ token: token.name, model: LIVE_MODEL });
  } catch (e) {
    console.error("[api/voice]", e);
    return error(502, "Could not start voice chat.");
  }
}
