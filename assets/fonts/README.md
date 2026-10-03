# Flier fonts

Static TrueType files (Latin subset) used by `src/lib/flier/render.tsx`. `next/og`
reads only ttf, otf and woff, so these are not woff2.

All are licensed under the SIL Open Font License 1.1 and were downloaded from
Fontsource (`https://cdn.jsdelivr.net/fontsource/fonts/<id>@latest/latin-<weight>-normal.ttf`).

| File | Family | Weight |
|---|---|---|
| archivo-400.ttf | Archivo | 400 |
| archivo-black-400.ttf | Archivo Black | 400 |
| bebas-neue-400.ttf | Bebas Neue | 400 |
| dm-sans-400.ttf, dm-sans-600.ttf | DM Sans | 400, 600 |
| dm-serif-display-400.ttf | DM Serif Display | 400 |
| fraunces-700.ttf | Fraunces | 700 |
| instrument-serif-400.ttf | Instrument Serif | 400 |
| inter-400.ttf, inter-600.ttf | Inter | 400, 600 |
| playfair-display-700.ttf | Playfair Display | 700 |
| space-grotesk-400.ttf, space-grotesk-700.ttf | Space Grotesk | 400, 700 |
| syne-800.ttf | Syne | 800 |

To add a font set: add the file here, then an entry in `FONT_SETS` in
`src/lib/flier/design.ts` (tune `titleWidth` by rendering a long title).
Latin only: titles in other scripts render with missing glyphs.
