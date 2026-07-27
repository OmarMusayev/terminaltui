/**
 * Image-to-terminal-art converter — the public `asciiImage()` entry point.
 *
 * This used to lazy-load `sharp`, which is declared in no manifest and
 * installed nowhere, so every call in the project's history returned
 * `["[Image: install sharp for image support]", "  npm install sharp"]` and the
 * function had never once produced an image. It now decodes with the bundled
 * synchronous decoders (pngjs / jpeg-js, no `sharp`, no native build) and
 * renders through the shared cell engine under src/image/, so this function and
 * the framework's `image()` block are the same renderer.
 *
 * Two long-standing defects went with the rewrite:
 *
 * - **Aspect was applied twice** for the sub-cell modes. The old code scaled
 *   the pixel target by the mode factor, then scaled it again by 0.5 for the
 *   cell aspect, and then the renderers stepped `y` by 2 (blocks) or 4
 *   (braille) — both came out 2x vertically squashed. All geometry now comes
 *   from `imageCellSize()`, which owns CELL_ASPECT and applies it once.
 * - **Dither and quantizer disagreed.** Error was diffused over five grey
 *   levels for a consumer that thresholded to one bit, and only ever over
 *   luminance, so hue and saturation error could never be corrected. Dithering
 *   now runs over the full RGB triple against the palette the terminal will
 *   actually display.
 *
 * See devnotes/terminal-image-rendering-exploration.md §2.2.
 */

import type { DecodeFailure, ImageDither } from "../image/types.js";
import { decodeImage } from "../image/decode.js";
import { imageCellSize } from "../image/geometry.js";
import { renderAsciiRows } from "./image-renderers.js";

export interface AsciiImageOptions {
  /**
   * Output width in terminal CELLS. Default: 60. Not capped at the framework's
   * content column — this is a standalone utility — but `cols * rows` is still
   * bounded by `IMAGE_LIMITS.maxCells`, so an extreme width scales down.
   */
  width?: number;
  /**
   * Output height in terminal ROWS. Given, the image is stretched to fit it
   * exactly. Bounded by `MAX_IMAGE_ROWS` (200).
   */
  height?: number;
  /** Rendering technique. Default: "ascii". */
  mode?: "ascii" | "braille" | "blocks" | "shading";
  /** Ramp for "ascii" and "shading", darkest first. Default: " .:-=+*#%@" / " ·:░▒▓█". */
  charset?: string;
  invert?: boolean;
  /**
   * Emit per-cell colour. Default: false, which guarantees plain text out.
   *
   * It also selects the glyph set for `mode: "blocks"`: a half block conveys
   * nothing once both its pens are suppressed (the shape alone only says "the
   * halves differ"), so `blocks` + `color: false` renders the block SHADING ramp
   * `" ·:░▒▓█"` rather than U+2580/2584/2588.
   */
  color?: boolean;
  /**
   * Default: "none". A no-op in truecolor and whenever `color` is false.
   *
   * Preferred spelling — the same word every other entry point in the framework
   * uses (`ImageBlock.dither`, `ImageRenderOptions.dither`).
   */
  dither?: ImageDither;
  /** @deprecated Use {@link AsciiImageOptions.dither}. Kept for compatibility. */
  dithering?: "none" | "floyd-steinberg" | "ordered";
  /** Explicit 1-bit cut for "braille". Omit to let Otsu choose per image. */
  threshold?: number;
}

const DEFAULT_WIDTH = 60;

/**
 * Convert an image to terminal art.
 *
 * PNG and JPEG decode synchronously and need no dependencies beyond the two
 * bundled decoders. GIF, WebP and BMP are recognised but have no synchronous
 * decoder, so they return an error row rather than pixels.
 *
 * Still `async` because it is published as async and callers await it; the body
 * is entirely synchronous and the promise resolves in the same tick.
 *
 * @param source File path (string) or raw encoded image data (Buffer). A
 *   relative path resolves against `process.cwd()`.
 * @param options Rendering options.
 * @returns One string per output row, each exactly the negotiated column width.
 *   A single `[Error: …]` row if the image could not be read or decoded.
 */
export async function asciiImage(
  source: string | Buffer,
  options?: AsciiImageOptions,
): Promise<string[]> {
  const opts = options ?? {};
  const cols = normCells(opts.width) ?? DEFAULT_WIDTH;
  const rows = normCells(opts.height);

  const decoded = decodeImage(source);
  if (!decoded.ok) return [decodeError(source, decoded.reason, decoded.detail)];

  // An explicit height is an exact box — that is what the old sharp pipeline's
  // `fit: "fill"` did with both dimensions. Without one, aspect is derived and
  // preserved.
  const geom = imageCellSize(
    {
      width: decoded.pixels.width,
      height: decoded.pixels.height,
      format: decoded.format,
    },
    { width: cols, height: rows, fit: rows === undefined ? "contain" : "fill" },
    cols,
    rows,
    // Not rendering into a content column, so the page-layout ceiling of 99
    // does not apply — `asciiImage(img, { width: 400 })` used to come back
    // silently 99 columns wide. IMAGE_LIMITS.maxCells still bounds the total.
    cols,
  );

  return renderAsciiRows(decoded.pixels, geom, {
    mode: opts.mode ?? "ascii",
    color: opts.color === true,
    charset: opts.charset,
    invert: opts.invert === true,
    dither: opts.dither ?? opts.dithering ?? "none",
    threshold: opts.threshold,
  });
}

/**
 * Normalise an author-supplied cell dimension.
 *
 * Zero, negative and non-finite all mean "unspecified" rather than "zero", so a
 * bad expression falls back to the default width instead of rendering a sliver
 * nobody can see.
 */
function normCells(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  return n >= 1 ? n : undefined;
}

/**
 * The failure row.
 *
 * The "could not load image" message predates this rewrite but was unreachable:
 * the `sharp` guard returned first, so a missing file produced the install hint
 * instead. With a real decoder the branch is live again, wired to the decoder's
 * own failure taxonomy — `not-found` keeps the original wording, everything
 * else reports what the decoder said (unsupported magic bytes, no bundled
 * decoder for the format, over budget, corrupt).
 */
function decodeError(
  source: string | Buffer,
  reason: DecodeFailure,
  detail: string,
): string {
  if (reason === "not-found") {
    const label = typeof source === "string" ? source : "(buffer)";
    return `[Error: could not load image: ${sanitize(label)}]`;
  }
  return `[Error: could not decode image: ${sanitize(detail)}]`;
}

/** Control bytes are stripped from every row before it is written, which would
 *  silently shorten a row that was measured before the strip. Neither a path
 *  nor a decoder message is trusted to be free of them. */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1f\x7f]/g, "");
}
