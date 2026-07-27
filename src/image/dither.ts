/**
 * Error diffusion and ordered dithering over the FULL RGB triple.
 *
 * The framework's pre-existing ditherer (src/ascii/image.ts) diffuses error on
 * the greyscale array only, which cannot correct hue or saturation error at
 * all — a saturated red quantized to a duller red keeps its full chroma error
 * forever. Everything here works on the RGB vector and diffuses against
 * `quantizePacked()`, i.e. against what the terminal will genuinely display.
 *
 * Both entry points WRITE BACK PALETTE-VALID COLOURS. That matters: the
 * emitter re-quantizes on the way out, and quantize is idempotent, so a
 * dithered grid survives the trip to the screen unchanged instead of being
 * perturbed twice.
 *
 * See devnotes/terminal-image-rendering-exploration.md §4.1.
 */

import type { ColorMode } from "../style/colors.js";
import type { ImageDither } from "./types.js";
import { CUBE_BRACKET_STEP, GREY_RAMP_STEP, prefersGreyRamp, quantizePacked } from "./quantize.js";

// ---------------------------------------------------------------------------
// Bayer threshold matrix
// ---------------------------------------------------------------------------

/** Recursive Bayer construction: B(2n) = [[4B, 4B+2], [4B+3, 4B+1]]. */
function buildBayer(order: number): Uint8Array {
  let m: number[][] = [[0]];
  for (let n = 1; n < order; n <<= 1) {
    const size = n * 2;
    const next: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    }
    m = next;
  }
  const flat = new Uint8Array(order * order);
  for (let y = 0; y < order; y++) for (let x = 0; x < order; x++) flat[y * order + x] = m[y][x];
  return flat;
}

const BAYER_ORDER = 8;
const BAYER = buildBayer(BAYER_ORDER);
const BAYER_N2 = BAYER_ORDER * BAYER_ORDER;

/**
 * Displacement amplitude, per mode. Both were swept against a gradient rather
 * than guessed; the metric is RMSE after a 5x5 gaussian, which is what tracks
 * perception (see the note on `ditherGrid`).
 *
 * 256: a multiplier on the local cube bracket step. Ordered dithering
 * reproduces an intermediate level by making a proportion of pixels round up,
 * which is exact when the displacement spans the whole gap between the two
 * bracketing levels — hence a multiplier near 1. The measured curve is flat
 * across 0.85-0.95 (4.31 / 4.21 / 4.15) and climbs steeply past 1.0 (4.55 at
 * 1.0, 10.18 at 1.5). 0.9 takes the low end of that flat bottom because raw
 * per-pixel noise grows monotonically with amplitude, so there is no reason to
 * pay for the last 1.5%. chafa's fixed 0.1 magnitude scores 11.57 here — the
 * adaptive per-channel step is worth 2.7x on this metric.
 *
 * 16: a flat amplitude, because a 16-entry palette has no per-channel
 * structure to measure a gap from. Blurred RMSE keeps falling all the way to
 * amplitude 200 (22.7), but that is the metric rewarding maximum dispersion —
 * raw per-pixel error goes from 41.3 undithered to 59.5, which reads as
 * static. 64 is chafa's shipped equivalent (its 0.25 magnitude over a scaled
 * 8x8 matrix is exactly +/-32), gives -23% blurred RMSE, and holds raw error
 * within 6% of undithered.
 */
const ORDERED_MAGNITUDE_256 = 0.9;
const ORDERED_AMPLITUDE_16 = 64;

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

type ResolvedDither = "ordered" | "floyd-steinberg" | "none";

/**
 * Resolve the user's request against the terminal's colour mode.
 *
 * "auto" is decided per mode, and the deciding evidence was SCREENSHOTS of the
 * real renderer, not a metric. Both numeric metrics available here are
 * actively misleading for this output, so they are recorded but not obeyed:
 *
 *   256 colour        chroma kept   blurred RMSE   raw RMSE
 *   none                   18%          n/a           n/a
 *   ordered                13%         10.83        13.43
 *   floyd-steinberg        81%          4.81        19.38
 *
 * Blurred RMSE says FS wins by 2.25x. It is wrong here: blurring models an eye
 * integrating adjacent samples, which is true of print dots and false of
 * terminal cells, which are enormous. On screen FS at 256 colours is visible
 * confetti — isolated saturated cells over grey — because reproducing a dark
 * blue means alternating across the cube's 0->95 gap, and at one cell per
 * sample that dispersion never fuses. Raw RMSE is no better a guide: it
 * rewards not dispersing at all.
 *
 * So:
 *
 * - **256 -> none.** The 240-entry palette is dense enough that nearest-colour
 *   is already smooth, and it keeps text inside images legible. It loses
 *   saturation in dark regions — a dark saturated pixel is euclidean-nearer to
 *   the grey ramp than to any cube entry, so it lands on the ramp — but a
 *   slightly desaturated picture reads better than a noisy one.
 * - **16 -> none.** This used to be floyd-steinberg, on the claim that
 *   "undithered output of a dark image is nearly empty". Rendering the
 *   alternatives disproved it twice over. The emptiness was a separate bug —
 *   the `shading` tier painted `coverage x colour`, i.e. luminance squared, so
 *   the picture was a third of its true brightness (fixed in render.ts). And
 *   with 16 entries the dispersion is enormous: reproducing a mid grey means
 *   alternating between black and a saturated primary, so at one cell per
 *   sample FS renders a photograph as scattered coloured dots on black with no
 *   identifiable content, while the undithered quadrant image is a legible
 *   posterised photograph. Measured on the pillars fixture at 54 cells: RMSE
 *   32.5 undithered against 52.0 dithered, and the rendered comparison is not
 *   close.
 * - **truecolor / none -> none.** Nothing to correct, and in "none" no colour
 *   is emitted at all, so perturbing pixels would only add noise to the glyph
 *   choice.
 *
 * Bayer is never chosen automatically. It applies ONE threshold to all three
 * channels, so it can displace a pixel along the grey axis but can never
 * manufacture chroma — at 256 it measured worse than no dithering at all.
 * Both algorithms remain available explicitly.
 */
export function resolveDither(kind: ImageDither, mode: ColorMode): ResolvedDither {
  if (mode === "truecolor" || mode === "none") return "none";
  if (kind === "auto") return "none";
  return kind;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Dither an RGBA sub-cell grid in place, snapping every pixel onto the palette
 * `mode` can display. Alpha is left untouched.
 *
 * @param grid RGBA bytes, length must be w * h * 4, row-major.
 * @param w    Grid width in sub-pixels.
 * @param h    Grid height in sub-pixels.
 * @param mode The viewer's colour mode; "truecolor" and "none" are no-ops.
 * @param kind Requested algorithm; "auto" resolves per {@link resolveDither}.
 */
export function ditherGrid(
  grid: Uint8ClampedArray,
  w: number,
  h: number,
  mode: ColorMode,
  kind: ImageDither,
): void {
  if (w <= 0 || h <= 0) return;
  const resolved = resolveDither(kind, mode);
  if (resolved === "none") return;
  if (resolved === "floyd-steinberg") floydSteinberg(grid, w, h, mode);
  else ordered(grid, w, h, mode);
}

// ---------------------------------------------------------------------------
// Ordered (Bayer)
// ---------------------------------------------------------------------------

function ordered(grid: Uint8ClampedArray, w: number, h: number, mode: ColorMode): void {
  const indexed256 = mode === "256";
  for (let y = 0; y < h; y++) {
    const rowBayer = (y & (BAYER_ORDER - 1)) * BAYER_ORDER;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const r = grid[i];
      const g = grid[i + 1];
      const b = grid[i + 2];

      // Centre the threshold in (-0.5, +0.5) so the perturbation has zero mean
      // and flat regions keep their average colour.
      const t = (BAYER[rowBayer + (x & (BAYER_ORDER - 1))] + 0.5) / BAYER_N2 - 0.5;

      let ar: number;
      let ag: number;
      let ab: number;
      if (indexed256) {
        if (prefersGreyRamp(r, g, b)) {
          // A near-grey sits on the 10-wide ramp; a 40-95 wide cube kick would
          // throw it off the ramp entirely and inject colour noise into what
          // should stay neutral.
          ar = ag = ab = GREY_RAMP_STEP;
        } else {
          ar = CUBE_BRACKET_STEP[r];
          ag = CUBE_BRACKET_STEP[g];
          ab = CUBE_BRACKET_STEP[b];
        }
        ar *= ORDERED_MAGNITUDE_256;
        ag *= ORDERED_MAGNITUDE_256;
        ab *= ORDERED_MAGNITUDE_256;
      } else {
        ar = ag = ab = ORDERED_AMPLITUDE_16;
      }

      const packed = quantizePacked(r + t * ar, g + t * ag, b + t * ab, mode);
      grid[i] = (packed >> 16) & 0xff;
      grid[i + 1] = (packed >> 8) & 0xff;
      grid[i + 2] = packed & 0xff;
    }
  }
}

// ---------------------------------------------------------------------------
// Floyd-Steinberg, serpentine
// ---------------------------------------------------------------------------

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function floydSteinberg(grid: Uint8ClampedArray, w: number, h: number, mode: ColorMode): void {
  // Two rolling error rows of RGB triples. Only ever two are live, so this is
  // O(w) regardless of image height.
  let cur = new Float32Array(w * 3);
  let next = new Float32Array(w * 3);

  for (let y = 0; y < h; y++) {
    // Serpentine: alternating the scan direction stops the error from always
    // travelling the same way, which is what produces FS's diagonal worming.
    // Two lines of code for a visibly cleaner image.
    const ltr = (y & 1) === 0;
    const rowBase = y * w * 4;

    for (let n = 0; n < w; n++) {
      const x = ltr ? n : w - 1 - n;
      const i = rowBase + x * 4;
      const e = x * 3;

      // Clamp BEFORE quantizing and measure the error against the clamped
      // value: an unclamped accumulator runs away in saturated regions and
      // smears bright highlights into visible streaks.
      const r = clamp255(grid[i] + cur[e]);
      const g = clamp255(grid[i + 1] + cur[e + 1]);
      const b = clamp255(grid[i + 2] + cur[e + 2]);

      const packed = quantizePacked(r, g, b, mode);
      const qr = (packed >> 16) & 0xff;
      const qg = (packed >> 8) & 0xff;
      const qb = packed & 0xff;
      grid[i] = qr;
      grid[i + 1] = qg;
      grid[i + 2] = qb;

      const er = (r - qr) / 16;
      const eg = (g - qg) / 16;
      const eb = (b - qb) / 16;

      // 7/16 ahead on this row, then 3/16 - 5/16 - 1/16 on the next, all
      // mirrored when the scan runs right to left.
      const ahead = ltr ? x + 1 : x - 1;
      const behind = ltr ? x - 1 : x + 1;
      if (ahead >= 0 && ahead < w) {
        const j = ahead * 3;
        cur[j] += er * 7;
        cur[j + 1] += eg * 7;
        cur[j + 2] += eb * 7;
      }
      if (y + 1 < h) {
        if (behind >= 0 && behind < w) {
          const j = behind * 3;
          next[j] += er * 3;
          next[j + 1] += eg * 3;
          next[j + 2] += eb * 3;
        }
        next[e] += er * 5;
        next[e + 1] += eg * 5;
        next[e + 2] += eb * 5;
        if (ahead >= 0 && ahead < w) {
          const j = ahead * 3;
          next[j] += er;
          next[j + 1] += eg;
          next[j + 2] += eb;
        }
      }
    }

    const swap = cur;
    cur = next;
    next = swap;
    next.fill(0);
  }
}
