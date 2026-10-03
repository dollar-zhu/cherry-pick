import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  FLIER_HEIGHT,
  FLIER_PADDING,
  FLIER_WIDTH,
  fitTitle,
  getFontSet,
  getVibe,
  type FlierStyle,
  type FlierText,
  type FontFace,
  type Layout,
} from "./design";

// Fonts don't depend on the request; read each file once per server instance.
const fontCache = new Map<string, Promise<Buffer>>();
function loadFont(file: string) {
  let data = fontCache.get(file);
  if (!data) {
    data = readFile(join(process.cwd(), "assets/fonts", file));
    fontCache.set(file, data);
  }
  return data;
}

const truncate = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

// Darken (or, for dark ink, lighten) where the text sits so it stays readable on any background.
function overlay(layout: Layout, light: boolean) {
  const c = (a: number) => (light ? `rgba(0,0,0,${a})` : `rgba(250,246,238,${a})`);
  if (layout === "bottom") return `linear-gradient(to bottom, ${c(0)} 25%, ${c(0.5)} 55%, ${c(0.88)} 100%)`;
  if (layout === "split") return `linear-gradient(to bottom, ${c(0.75)} 0%, ${c(0.15)} 38%, ${c(0.15)} 55%, ${c(0.85)} 100%)`;
  return `linear-gradient(to bottom, ${c(0.55)} 0%, ${c(0.4)} 50%, ${c(0.6)} 100%)`;
}

/** Renders the flier PNG: background image (or the vibe's gradient) with the text on top. */
export async function renderFlier(
  text: FlierText,
  style: FlierStyle,
  background: { bytes: Uint8Array; mimeType: string } | null,
): Promise<Uint8Array> {
  const vibe = getVibe(style.vibe);
  const fonts = getFontSet(style.fontSet);
  const { layout } = style;
  const light = vibe.ink === "light";
  const color = light ? "#ffffff" : "#1a1714";
  const muted = light ? "rgba(255,255,255,0.8)" : "rgba(26,23,20,0.72)";
  const centered = layout === "center";
  const contentWidth = FLIER_WIDTH - FLIER_PADDING * 2;
  const title = fitTitle(text.title, fonts, { width: contentWidth, maxLines: layout === "split" ? 4 : 3 });

  const family = (f: FontFace) => `"${f.family}"`;
  const bodyStyle = { fontFamily: family(fonts.body), fontWeight: fonts.body.weight };
  const strongStyle = { fontFamily: family(fonts.bodyStrong), fontWeight: fonts.bodyStrong.weight };

  const heading = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: centered ? "center" : "flex-start" }}>
      <div style={{ ...strongStyle, fontSize: 28, letterSpacing: "0.16em", textTransform: "uppercase", color: vibe.accent }}>
        {text.kicker}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontFamily: family(fonts.display),
          fontWeight: fonts.display.weight,
          fontSize: title.size,
          lineHeight: fonts.titleLineHeight,
          letterSpacing: `${fonts.titleTracking}em`,
          textTransform: fonts.uppercaseTitle ? "uppercase" : "none",
          textAlign: centered ? "center" : "left",
          color,
        }}
      >
        {text.title}
      </div>
      <div style={{ ...bodyStyle, display: "flex", marginTop: 28, fontSize: 36, lineHeight: 1.3, color: muted, textAlign: centered ? "center" : "left", maxWidth: 860 }}>
        {truncate(text.subtitle, 90)}
      </div>
    </div>
  );

  const details = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: centered ? "center" : "flex-start" }}>
      <div style={{ ...strongStyle, fontSize: 36, color }}>{text.when}</div>
      <div style={{ ...bodyStyle, marginTop: 8, fontSize: 36, color }}>{text.where}</div>
      {text.hostedBy && (
        <div style={{ ...strongStyle, marginTop: 36, fontSize: 30, color: vibe.accent, textAlign: centered ? "center" : "left" }}>
          {truncate(text.hostedBy, 70)}
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: 36,
          paddingTop: 20,
          borderTop: `2px solid ${light ? "rgba(255,255,255,0.35)" : "rgba(26,23,20,0.3)"}`,
          ...bodyStyle,
          fontSize: 24,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: muted,
        }}
      >
        {text.footer}
      </div>
    </div>
  );

  const element = (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: vibe.fallback }}>
      {background && (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori renders plain <img>
        <img
          src={`data:${background.mimeType};base64,${Buffer.from(background.bytes).toString("base64")}`}
          width={FLIER_WIDTH}
          height={FLIER_HEIGHT}
          style={{ position: "absolute", top: 0, left: 0, width: FLIER_WIDTH, height: FLIER_HEIGHT, objectFit: "cover" }}
        />
      )}
      <div style={{ position: "absolute", top: 0, left: 0, width: FLIER_WIDTH, height: FLIER_HEIGHT, backgroundImage: overlay(layout, light) }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: FLIER_WIDTH,
          height: FLIER_HEIGHT,
          padding: FLIER_PADDING,
          display: "flex",
          flexDirection: "column",
          alignItems: centered ? "center" : "flex-start",
          justifyContent: layout === "bottom" ? "flex-end" : layout === "center" ? "center" : "space-between",
        }}
      >
        {heading}
        <div style={{ display: "flex", height: layout === "split" ? 0 : 64 }} />
        {details}
      </div>
    </div>
  );

  const faces = [fonts.display, fonts.body, fonts.bodyStrong].filter(
    (f, i, all) => all.findIndex((g) => g.file === f.file) === i,
  );
  const response = new ImageResponse(element, {
    width: FLIER_WIDTH,
    height: FLIER_HEIGHT,
    fonts: await Promise.all(
      faces.map(async (f) => ({ name: f.family, data: await loadFont(f.file), weight: f.weight, style: "normal" as const })),
    ),
  });
  return new Uint8Array(await response.arrayBuffer());
}
