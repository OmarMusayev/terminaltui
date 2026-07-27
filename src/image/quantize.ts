/**
 * Colour quantization — "what will this terminal ACTUALLY put on screen?"
 *
 * Everything downstream of the resampler needs this answer, not just the
 * emitter: to diffuse quantization error correctly (dither.ts) you must
 * diffuse against the colour that was *displayed*, and to score a candidate
 * glyph honestly (chafa's `use_quantized_error`) you must score the fg/bg the
 * terminal will really paint. So the primitive here is
 * `quantizeToMode(colour, mode) -> the colour the terminal displays`, and the
 * index/code lookups are the same computation with a different return.
 *
 * Three deliberate departures from the framework's ORIGINAL `rgbTo256`
 * (see devnotes/terminal-image-rendering-exploration.md §4.1):
 *
 *  - The xterm 6x6x6 cube is NOT uniformly spaced. Its levels are
 *    0, 95, 135, 175, 215, 255 — a 95-wide first step and 40 for the rest.
 *    Modelling them as v/255*5 mismaps 107-112 of the 256 channel values.
 *  - The 24-step grey ramp must be evaluated for EVERY colour, not only for
 *    exact r===g===b. Near-greys dominate photographs; (28,26,28) gated out
 *    of the ramp lands on (95,95,95) — error 117 where error 2 was available.
 *  - Ramp-vs-cube is NOT settled by RGB distance below a chroma floor, because
 *    there that criterion oscillates at pixel frequency and blotches the image.
 *    That rule lives in style/xterm-palette.ts as `imagePrefersGreyRamp` and
 *    this module calls it; `quantizePacked` and `prefersGreyRamp` below both go
 *    through that one predicate, and `image/render.ts` SNAPS EVERY PEN THROUGH
 *    `quantizePacked` before emitting it, so the colour the ditherer aims at is
 *    by construction the colour that reaches the screen.
 *
 * The UI emitter deliberately does NOT share the floor — `colors.ts` keeps the
 * exact nearest neighbour, because a lone theme colour has no neighbours to be
 * inconsistent with and the floor drained 34 of 100 built-in theme slots to
 * grey when it was shared. The two searches meet at the palette entries: all
 * 240 are fixed points of both, which is what makes the pre-snap above safe.
 *
 * Palette indices 0-15 are excluded from image output entirely: the user's
 * colour scheme redefines them arbitrarily, so any error model for them is
 * fiction. Cost is +0.16% RMSE and it makes 256-colour output
 * theme-independent.
 */

import type { ColorMode } from "../style/colors.js";
import type { RGB } from "./types.js";
import {
  ANSI16_TABLE,
  CUBE_BRACKET_STEP as PALETTE_CUBE_STEP,
  CUBE_VAL,
  GREY_RAMP_STEP,
  greyRampIndex,
  imagePrefersGreyRamp as palettePrefersGreyRamp,
  xterm256ImageIndex,
  xterm256Rgb as paletteRgb,
} from "../style/xterm-palette.js";

// ---------------------------------------------------------------------------
// Packed RGB helpers
// ---------------------------------------------------------------------------

/** Pack three bytes into a single 0xRRGGBB integer. */
function packRgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/** Unpack a 0xRRGGBB integer produced by {@link packRgb}. */
function unpackRgb(packed: number): RGB {
  return { r: (packed >> 16) & 0xff, g: (packed >> 8) & 0xff, b: packed & 0xff };
}

/** Round to an integer and clamp into [0, 255]. Every LUT here is indexed by byte. */
function toByte(v: number): number {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

// ---------------------------------------------------------------------------
// xterm-256: the 6x6x6 cube (16-231) and the 24-step grey ramp (232-255)
// ---------------------------------------------------------------------------

// The cube levels, the midpoint bounds, the per-byte LUTs and the grey ramp all
// come from style/xterm-palette.ts, which style/colors.ts uses too. They were
// duplicated here to keep src/image/ off colors.ts's load-time terminal
// detection; the palette module has none, so the copy is gone. The two copies
// had already drifted once (`>=` vs `<` at the cube midpoints, 878,094 of
// 16,777,216 colours disagreeing), which made the ditherer diffuse error toward
// an entry the emitter would never paint.

/**
 * Per-channel spacing between the two xterm cube levels bracketing a value.
 * Ordered dithering needs this as its amplitude. Indexed by channel byte.
 */
export const CUBE_BRACKET_STEP: Readonly<Uint8Array> = PALETTE_CUBE_STEP;

/** Spacing of the xterm grey ramp (232-255 are 8, 18, 28 ... 238). */
export { GREY_RAMP_STEP };

/**
 * True when the grey ramp beats the colour cube for this colour. Exposed so
 * the ditherer can pick the right amplitude: the ramp's step is 10 where the
 * cube's is 40-95, and perturbing a near-grey by a cube-sized offset would
 * knock it off the ramp and inject visible colour noise.
 *
 * Re-exported rather than reimplemented. The decision is NOT plain nearest
 * neighbour (a chroma floor overrides it — see the palette module), and the
 * ditherer must aim at the same entry the emitter will paint. A second copy of
 * this predicate is exactly the drift that was found and fixed once before.
 */
export function prefersGreyRamp(r: number, g: number, b: number): boolean {
  return palettePrefersGreyRamp(toByte(r), toByte(g), toByte(b));
}

/**
 * The xterm-256 palette index this terminal will paint, restricted to 16-255.
 *
 * Each family's candidate is exact, not approximate: squared euclidean distance
 * separates per channel, so the per-channel nearest level IS the globally
 * nearest cube entry, and the ramp candidate is the exact optimum over the ramp.
 * Which family wins is then decided by the shared rule in the palette module —
 * the true nearest of all 240 entries everywhere except below its chroma floor,
 * where the ramp takes it outright. ~20 ops either way.
 */
export function quantize256Index(r: number, g: number, b: number): number {
  return xterm256ImageIndex(r, g, b);
}

/** True RGB of an xterm-256 palette index. Indices 0-15 are terminal-defined and return black. */
export function xterm256Rgb(index: number): RGB {
  return paletteRgb(index);
}

// ---------------------------------------------------------------------------
// DIN99d — a euclidean perceptual space, used for the 16-colour path
// ---------------------------------------------------------------------------

// Chosen over CIEDE2000 because DIN99d is *euclidean*: convert each palette
// entry once and keep using plain squared distance, no per-pair weighting.
// Measured in the report at 43.85 -> 35.81 perceptual RMSE (-18%) against RGB
// distance at 16 colours, with the two metrics disagreeing on 22.7% of inputs.
// Concretely: (157,92,52) brown goes to bright-black grey under RGB distance
// and to red under DIN99d; (238,232,185) cream goes to white, should be yellow.

const SRGB_LINEAR = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  SRGB_LINEAR[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const D65_XN = 95.047;
const D65_YN = 100.0;
const D65_ZN = 108.883;
const LAB_EPS = 216 / 24389; // (6/29)^3
const LAB_KAPPA = 24389 / 27; // 903.296...

const COS50 = Math.cos((50 * Math.PI) / 180);
const SIN50 = Math.sin((50 * Math.PI) / 180);
const DEG50 = (50 * Math.PI) / 180;

function labF(t: number): number {
  return t > LAB_EPS ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

/**
 * Convert sRGB to DIN99d, writing [L99d, a99d, b99d] into `out`.
 *
 * `out` is caller-supplied so the hot path allocates nothing. The final
 * hue rotation by +50 degrees is a rigid rotation of the (a,b) plane and so
 * cannot change any euclidean distance; it is kept only to match Cui et al.
 * so the values are comparable with reference implementations.
 *
 * Constants verified against DIN99's defining constraint: L99d is calibrated
 * so that L* = 100 maps to exactly 100 (measured 100.0002 for white, 0 for
 * black). Neutrals carry a small negative a99d — that is the documented
 * consequence of the XYZ pre-rotation, not an error.
 */
function toDin99d(r: number, g: number, b: number, out: Float64Array): void {
  const rl = SRGB_LINEAR[toByte(r)];
  const gl = SRGB_LINEAR[toByte(g)];
  const bl = SRGB_LINEAR[toByte(b)];

  const X = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) * 100;
  const Y = (0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl) * 100;
  const Z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) * 100;

  // DIN99d's defining pre-rotation of XYZ; the reference white is not rotated.
  const Xd = 1.12 * X - 0.12 * Z;

  const fx = labF(Xd / D65_XN);
  const fy = labF(Y / D65_YN);
  const fz = labF(Z / D65_ZN);

  const L = 116 * fy - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);

  const e = A * COS50 + B * SIN50;
  const f = 1.14 * (B * COS50 - A * SIN50);
  const G = Math.sqrt(e * e + f * f);
  const C99 = 22.5 * Math.log(1 + 0.06 * G);
  const h99 = Math.atan2(f, e) + DEG50;

  out[0] = 325.22 * Math.log(1 + 0.0036 * L);
  out[1] = C99 * Math.cos(h99);
  out[2] = C99 * Math.sin(h99);
}

// ---------------------------------------------------------------------------
// The 16 ANSI colours
// ---------------------------------------------------------------------------

// The table comes from style/xterm-palette.ts so the emitter and this module
// assume the same 16 colours. The SEARCH stays local and stays perceptual:
// colors.ts matches UI chrome on plain RGB distance, this matches pixels in
// DIN99d, and that difference is deliberate and measured.
const ANSI16 = ANSI16_TABLE;

/** DIN99d coordinates of the 16 ANSI colours, flat [L,a,b] triples. */
const ANSI16_D99 = new Float64Array(16 * 3);
{
  const scratch = new Float64Array(3);
  for (let i = 0; i < 16; i++) {
    const e = ANSI16[i];
    toDin99d(e.r, e.g, e.b, scratch);
    ANSI16_D99[i * 3] = scratch[0];
    ANSI16_D99[i * 3 + 1] = scratch[1];
    ANSI16_D99[i * 3 + 2] = scratch[2];
  }
}

// Lazily-filled 5-5-5 lookup: a DIN99d conversion costs three pow(), a cbrt(),
// a log() and an atan2(), which is far too much per pixel per frame. The
// 8-unit input bucket is negligible against a 16-colour palette whose Voronoi
// cells are tens of units across — a bucket only ever straddles a boundary
// where the two candidates are near-equidistant, so the cost of picking the
// "wrong" one there is close to zero. Measured: the LUT picks a different
// entry than an exact per-query evaluation on 4.0% of inputs, but those flips
// cost only 0.29% in perceptual RMSE, which confirms they are all near-ties.
// -1 means "not computed yet".
const LUT16 = new Int8Array(32768).fill(-1);
const d99Scratch = new Float64Array(3);

function nearest16Exact(r: number, g: number, b: number): number {
  toDin99d(r, g, b, d99Scratch);
  const L = d99Scratch[0];
  const A = d99Scratch[1];
  const B = d99Scratch[2];
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 16; i++) {
    const dL = L - ANSI16_D99[i * 3];
    const dA = A - ANSI16_D99[i * 3 + 1];
    const dB = B - ANSI16_D99[i * 3 + 2];
    const d = dL * dL + dA * dA + dB * dB;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Nearest ANSI colour as a table index 0-15 (0-7 normal, 8-15 bright), by DIN99d distance. */
export function quantize16Index(r: number, g: number, b: number): number {
  const ri = toByte(r);
  const gi = toByte(g);
  const bi = toByte(b);
  const key = ((ri >> 3) << 10) | ((gi >> 3) << 5) | (bi >> 3);
  const hit = LUT16[key];
  if (hit >= 0) return hit;
  // Evaluate the bucket's centre, not the query, so every colour in a bucket
  // gets the same answer whichever one populated it.
  const idx = nearest16Exact((ri & ~7) | 4, (gi & ~7) | 4, (bi & ~7) | 4);
  LUT16[key] = idx;
  return idx;
}

// ---------------------------------------------------------------------------
// The primitive
// ---------------------------------------------------------------------------

/**
 * The colour the terminal will actually display when asked for `r,g,b` under
 * `mode`, packed as 0xRRGGBB.
 *
 * Allocation-free — this runs per sub-pixel per frame on a cache miss, so the
 * ditherer and the cell fitter use this form and only box the result when they
 * hand it to a caller.
 */
export function quantizePacked(r: number, g: number, b: number, mode: ColorMode): number {
  if (mode === "256") {
    const ri = toByte(r);
    const gi = toByte(g);
    const bi = toByte(b);
    if (palettePrefersGreyRamp(ri, gi, bi)) {
      const gv = 8 + GREY_RAMP_STEP * greyRampIndex(ri, gi, bi);
      return packRgb(gv, gv, gv);
    }
    return packRgb(CUBE_VAL[ri], CUBE_VAL[gi], CUBE_VAL[bi]);
  }
  if (mode === "16") {
    const e = ANSI16[quantize16Index(r, g, b)];
    return packRgb(e.r, e.g, e.b);
  }
  // truecolor: the terminal reproduces the request exactly.
  // none: no SGR is emitted at all, so there is no palette to snap to — the
  // glyph tiers carry the information and the value must pass through
  // untouched for their averaging to stay meaningful.
  return packRgb(toByte(r), toByte(g), toByte(b));
}

/**
 * The colour the terminal will actually display for a requested colour under a
 * given colour mode.
 *
 * This is the key primitive for dithering: error must be diffused against what
 * was displayed, not against what was requested. It is also what
 * `use_quantized_error` scores glyph candidates against, so a cell's glyph
 * choice can compensate for palette error instead of the pixels being
 * pre-noised.
 */
export function quantizeToMode(c: RGB, mode: ColorMode): RGB {
  return unpackRgb(quantizePacked(c.r, c.g, c.b, mode));
}
