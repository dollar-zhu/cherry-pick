import { GoogleGenAI } from "@google/genai";

// Nano Banana 2. Override with FLIER_IMAGE_MODEL, e.g. gemini-3-pro-image for Nano Banana Pro.
const DEFAULT_MODEL = "gemini-3.1-flash-image";
const TIMEOUT_MS = 45_000;

export type BackgroundImage = { bytes: Uint8Array; mimeType: string; model: string };

/**
 * Generates an abstract flier background, or edits `previous` when given.
 * Returns null on any failure (no key, timeout, refusal) so the caller can fall back.
 */
export async function generateBackground(
  prompt: string,
  previous?: { bytes: Uint8Array; mimeType: string },
): Promise<BackgroundImage | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("[flier background] GOOGLE_AI_API_KEY is not set");
    return null;
  }
  const model = process.env.FLIER_IMAGE_MODEL || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  const parts = previous
    ? [
        { inlineData: { mimeType: previous.mimeType, data: Buffer.from(previous.bytes).toString("base64") } },
        { text: prompt },
      ]
    : [{ text: prompt }];

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:5" },
        abortSignal: abort.signal,
      },
    });
    const image = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!image?.data) {
      console.error("[flier background] no image returned", response.candidates?.[0]?.finishReason);
      return null;
    }
    // next/og (Satori) draws PNG and JPEG only.
    const mimeType = image.mimeType ?? "image/png";
    if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
      console.error("[flier background] unsupported image type", mimeType);
      return null;
    }
    return { bytes: new Uint8Array(Buffer.from(image.data, "base64")), mimeType, model };
  } catch (error) {
    console.error("[flier background]", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
