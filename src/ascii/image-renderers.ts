/**
 * Adapter from the legacy `AsciiImageOptions` vocabulary onto the cell engine
 * in src/image/.
 *
 * This file used to hold a second, independent implementation of every mode —
 * its own braille bit table, its own half-block fitter, its own colour
 * emission. All of it was worse than the shared engine and none of it had ever
 * run (the `sharp` guard in image.ts returned before any of it was reached).
 * The half-block renderer in particular painted the average of both half-pixels
 * as a FOREGROUND colour, so the glyph carried no information at all and scored
 * identically to a flat one-colour cell.
 *
 * What is left here is translation only: which tier a legacy `mode` means,
 * which ramp it uses, and the one guarantee the legacy API makes that the
 * engine does not — `color: false` emits ZERO escape bytes.
 *
 * See devnotes/terminal-image-rendering-exploration.md §2.2.
 */

import type {
  CellGeometry,
  ImageDither,
  ImageRenderOptions,
  ImageTier,
  PixelBuffer,
  RGB,
  SubCellGrid,
} from "../image/types.js";
import { subCellGridSize } from "../image/geometry.js";
import { resampleToGrid } from "../image/resample.js";
import { ditherGrid } from "../image/dither.js";
import { renderCells } from "../image/render.js";
import { ASCII_RAMP, SHADING_RAMP } from "../image/glyphs.js";
import { getColorMode, setColorMode } from "../style/colors.js";

/** The four rendering modes `AsciiImageOptions.mode` accepts. */
export type AsciiImageMode = "ascii" | "braille" | "blocks" | "shading";

/**
 * Colour composited under partially transparent pixels.
 *
 * `asciiImage()` is a standalone utility with no theme and no knowledge of the
 * terminal's real background, so it assumes the overwhelmingly common dark one.
 * The framework's own `image()` block composites against the theme background
 * instead — it has one to composite against.
 */
export const ASCII_IMAGE_BACKGROUND: RGB = { r: 0, g: 0, b: 0 };

/** Everything the cell engine needs that the legacy options can express. */
export interface AsciiRenderRequest {
  mode: AsciiImageMode;
  /** False forces the uncoloured path AND suppresses every escape sequence. */
  color: boolean;
  /** Ramp override for the two ramp tiers. Ignored by braille and half. */
  charset?: string;
  invert?: boolean;
  dither?: ImageDither;
  /** Explicit 1-bit cut for braille. Undefined leaves the choice to Otsu. */
  threshold?: number;
  /** Defaults to {@link ASCII_IMAGE_BACKGROUND}. */
  background?: RGB;
}

/**
 * Legacy mode + colour flag -> engine tier.
 *
 * The two ramp tiers differ in exactly one thing: "shading" emits a foreground
 * colour per cell and "ascii" emits none. So an uncoloured render of ANY ramp
 * mode is the "ascii" tier carrying that mode's ramp, and a coloured one is the
 * "shading" tier carrying it. That is why `mode: "ascii", color: true` maps to
 * the shading tier — it is the same glyph ramp with a pen, which is precisely
 * what the old `renderAscii(..., useColor)` did.
 *
 * "blocks" is the one mode that genuinely needs two colours per cell, so it
 * maps to the "half" tier when colour is available and falls back to the block
 * shading ramp when it is not: a half block whose foreground and background are
 * both suppressed conveys nothing, because the glyph shape alone only encodes
 * "the two halves differ".
 */
export function selectAsciiTier(mode: AsciiImageMode, color: boolean): ImageTier {
  if (mode === "braille") return "braille";
  if (!color) return "ascii";
  return mode === "blocks" ? "half" : "shading";
}

/**
 * Ramp for a mode, honouring an author-supplied `charset`.
 *
 * "blocks" without colour lands on the shading ramp rather than the ASCII one
 * because it IS a block ramp — and because the legacy ditherer already computed
 * its levels from `BLOCK_CHARS = " ░▒▓█"`, so the mode's own dithering code
 * always assumed a block ramp even though its renderer emitted a binary
 * threshold. `SHADING_RAMP` is that ramp plus the two low steps it was missing.
 */
export function asciiRamp(mode: AsciiImageMode, charset?: string): string {
  if (charset !== undefined && charset.length > 0) return charset;
  return mode === "ascii" ? ASCII_RAMP : SHADING_RAMP;
}

/**
 * Render decoded pixels to terminal rows at a geometry the caller has already
 * negotiated with `imageCellSize()`.
 *
 * Rows come back exactly `geom.cols` display columns wide, `geom.rows` of them,
 * each terminated by `reset` (which is the empty string when colour is off).
 *
 * @param pixels Decoded RGBA source, full frame.
 * @param geom   Cell geometry from src/image/geometry.ts. The cell aspect has
 *               already been applied there and must not be applied again here —
 *               the sub-cell factor below is a SEPARATE multiplier.
 * @param req    Translated legacy options.
 */
export function renderAsciiRows(
  pixels: PixelBuffer,
  geom: CellGeometry,
  req: AsciiRenderRequest,
): string[] {
  const tier = selectAsciiTier(req.mode, req.color);
  // The second and only other multiplier: 2x2 for quadrant, 1x2 for half,
  // 2x4 for braille, 1x1 for the ramp tiers.
  const { subW, subH } = subCellGridSize(geom, tier);

  const data = resampleToGrid(pixels, subW, subH, {
    background: req.background ?? ASCII_IMAGE_BACKGROUND,
    invert: req.invert === true,
  });

  if (tier === "braille" && req.threshold !== undefined) {
    binarize(data, req.threshold);
  }

  // Dithering must land on the sub-cell grid BEFORE any glyph is fitted: the
  // two-colour tiers average their sub-pixels into one fg and one bg pen, so
  // noise injected afterwards would be averaged straight back out. A no-op in
  // truecolor (nothing to correct) and under "none" (nothing is emitted to
  // correct against) — see resolveDither() in dither.ts.
  const mode = req.color ? getColorMode() : "none";
  ditherGrid(data, subW, subH, mode, req.dither ?? "none");

  const grid: SubCellGrid = {
    data,
    subW,
    subH,
    cols: geom.cols,
    rows: geom.rows,
    tier,
  };

  const opts: ImageRenderOptions =
    tier === "ascii" || tier === "shading"
      ? { charset: asciiRamp(req.mode, req.charset) }
      : {};

  // `color: false` has always meant "plain text out", so it is enforced
  // structurally rather than tier by tier: under colour mode "none" every
  // emitter in colors.ts returns "" and `reset` is empty, so no tier — not even
  // braille, which always paints a foreground — can leak an escape. The emitter
  // is the only thing here that reads that module-level state, so the swap is
  // wrapped as tightly around it as possible. This is the same swap-and-restore
  // runtime.ts performs per frame for per-session colour, and safe for the same
  // reason: renderCells is synchronous and cannot interleave with another one.
  const ambient = getColorMode();
  if (mode !== ambient) setColorMode(mode);
  try {
    return renderCells(grid, tier, opts);
  } finally {
    if (mode !== ambient) setColorMode(ambient);
  }
}

/**
 * Collapse the grid to pure black and white about `threshold`.
 *
 * The braille tier picks its own cut with Otsu, which has no parameter to hand
 * an explicit threshold to. Binarising first makes Otsu's answer exact rather
 * than approximate: a two-valued histogram maximises between-class variance at
 * t = 0, and the tier lights a dot when luma > t, so every pixel that was
 * `>= threshold` — the legacy comparison — lights and no other does.
 *
 * The trade is visible and deliberate: a 1-bit image has no colour left to
 * carry, so with `color: true` the lit dots come out white. Omitting
 * `threshold` keeps the image's own ink colours and lets Otsu choose the cut,
 * which is the better rendering for anything that is not already line art.
 */
function binarize(data: Uint8ClampedArray, threshold: number): void {
  const cut = Number.isFinite(threshold) ? threshold : 128;
  for (let i = 0; i < data.length; i += 4) {
    // Rec.601 luma, matching the engine's own luminance.
    const v =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] >= cut ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}
