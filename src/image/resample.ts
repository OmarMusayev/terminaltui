/**
 * Box-filter downscaling from decoded pixels straight to the sub-cell grid.
 *
 * Every rendering tier is really a sub-cell sampler — quadrant wants 2x2 per
 * cell, half wants 1x2, braille 2x4 — so the resampler's only job is to turn
 * an arbitrary source raster into exactly `subW x subH` composited RGBA
 * samples. Doing that with nearest-neighbour point sampling aliases badly at
 * the ratios images actually get used at (1600x1000 -> 200x100 throws away 39
 * of every 40 pixels); a true area average costs barely more code and is the
 * single biggest quality lever in the whole pipeline.
 *
 * Pure: no I/O, no runtime imports, no module state.
 */

import type { PixelBuffer, RGB } from "./types.js";

export interface ResampleOptions {
  /** Colour composited under partially transparent pixels. */
  background: RGB;
  /**
   * Negate the image's INK, not the composited result.
   *
   * `background` exists so transparent regions blend into the page; inverting
   * after compositing turned a logo's transparent surround into a bright
   * rectangle on a dark terminal, which is the opposite of what the option is
   * for. Inverting the premultiplied mean instead leaves a fully transparent
   * sample sitting on the page background either way.
   */
  invert?: boolean;
}

// Averaging happens directly on the encoded sRGB bytes, which is what every
// other terminal image renderer does. A linear-light path was tried and removed:
// no entry point could reach it, and it visibly brightens midtones against every
// tool a user would compare against. See devnotes/terminal-image-rendering-exploration.md.

// ─── Coverage spans ───────────────────────────────────────

/**
 * Per-destination-index source range and its fractional coverage weights.
 *
 * Precomputing this once per axis means the inner loop never recomputes a
 * `min`/`max` clip, and the same column table is reused for every row.
 */
interface Spans {
  /** First source index contributing to destination i. */
  start: Int32Array;
  /** How many source indices contribute. */
  count: Int32Array;
  /** Offset of destination i's run inside `weights`. */
  offset: Int32Array;
  /** Total weight of destination i's run — the normalisation denominator. */
  sum: Float64Array;
  weights: Float64Array;
}

function buildSpans(srcLen: number, dstLen: number): Spans {
  const scale = srcLen / dstLen;
  // A destination cell spans at most ceil(scale) whole source cells plus the
  // two partial ones it straddles.
  const cap = Math.ceil(scale) + 2;

  const start = new Int32Array(dstLen);
  const count = new Int32Array(dstLen);
  const offset = new Int32Array(dstLen);
  const sum = new Float64Array(dstLen);
  const weights = new Float64Array(dstLen * cap);

  let w = 0;
  for (let i = 0; i < dstLen; i++) {
    const lo = i * scale;
    const hi = (i + 1) * scale;
    let s = Math.floor(lo);
    let e = Math.ceil(hi);
    // Upscaling: a destination cell narrower than one source pixel still has
    // to read that pixel.
    if (e <= s) e = s + 1;
    if (s > srcLen - 1) s = srcLen - 1;
    if (e > srcLen) e = srcLen;

    start[i] = s;
    count[i] = e - s;
    offset[i] = w;

    let total = 0;
    for (let x = s; x < e; x++) {
      const overlap = Math.min(x + 1, hi) - Math.max(x, lo);
      const weight = overlap > 0 ? overlap : 0;
      weights[w++] = weight;
      total += weight;
    }
    // Degenerate ranges (zero-area destination cells) must not divide by zero.
    sum[i] = total > 0 ? total : 1;
  }

  return { start, count, offset, sum, weights };
}

// ─── Resampling ───────────────────────────────────────────

/**
 * The degenerate path: no usable source, so every sample is pure background.
 *
 * `invert` is deliberately NOT applied — it inverts ink, and there is none
 * here, so an unreadable image stays the colour of the page rather than
 * flashing a bright rectangle.
 */
function fillBackground(subW: number, subH: number, bg: RGB): Uint8ClampedArray {
  const out = new Uint8ClampedArray(subW * subH * 4);
  const r = bg.r;
  const g = bg.g;
  const b = bg.b;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Area-average `pixels` down (or up) to a `subW x subH` RGBA grid, with alpha
 * composited against `opts.background`.
 *
 * The filter is a true box filter with fractional edge coverage: destination
 * cell (x, y) averages every source pixel overlapping the rectangle
 * `[x*sx, (x+1)*sx) x [y*sy, (y+1)*sy)`, weighting the partially covered edge
 * pixels by their overlap area. Non-integer ratios are therefore exact, not
 * snapped.
 *
 * Alpha uses straight (non-premultiplied) `out = src*a + bg*(1-a)`. Colour is
 * accumulated premultiplied so that fully transparent pixels cannot bleed
 * their undefined RGB into the average — averaging composited pixels is
 * algebraically identical to compositing the premultiplied average, so this
 * costs nothing. `invert` negates the premultiplied mean before the background
 * is mixed in, so it inverts the image and never the page behind it.
 *
 * The returned buffer is `subW * subH * 4` bytes with alpha already resolved
 * to 255, matching `SubCellGrid.data`.
 */
export function resampleToGrid(
  pixels: PixelBuffer,
  subW: number,
  subH: number,
  opts: ResampleOptions,
): Uint8ClampedArray {
  if (subW <= 0 || subH <= 0) return new Uint8ClampedArray(0);

  const bg = opts.background;
  const invert = opts.invert === true;

  const src = pixels.data;
  const srcW = pixels.width;
  const srcH = pixels.height;

  // A truncated or mis-declared buffer would read `undefined` and poison the
  // accumulators with NaN; degrade to a flat background instead.
  if (srcW <= 0 || srcH <= 0 || src.length < srcW * srcH * 4) {
    return fillBackground(subW, subH, bg);
  }

  const bgR = clampByte(bg.r);
  const bgG = clampByte(bg.g);
  const bgB = clampByte(bg.b);

  const cols = buildSpans(srcW, subW);
  const rows = buildSpans(srcH, subH);

  const out = new Uint8ClampedArray(subW * subH * 4);
  // One destination row of premultiplied RGB plus coverage, before division.
  const acc = new Float64Array(subW * 4);

  for (let dy = 0; dy < subH; dy++) {
    acc.fill(0);

    const rowStart = rows.start[dy];
    const rowCount = rows.count[dy];
    const rowOffset = rows.offset[dy];

    for (let k = 0; k < rowCount; k++) {
      const wy = rows.weights[rowOffset + k];
      if (wy <= 0) continue;
      const rowBase = (rowStart + k) * srcW * 4;

      for (let dx = 0; dx < subW; dx++) {
        const colCount = cols.count[dx];
        const colOffset = cols.offset[dx];
        let p = rowBase + cols.start[dx] * 4;

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let j = 0; j < colCount; j++, p += 4) {
          // Weight colour by alpha as well as coverage: premultiplied accumulation.
          const wa = cols.weights[colOffset + j] * (src[p + 3] / 255);
          r += src[p] * wa;
          g += src[p + 1] * wa;
          b += src[p + 2] * wa;
          a += wa;
        }

        const o = dx * 4;
        acc[o] += wy * r;
        acc[o + 1] += wy * g;
        acc[o + 2] += wy * b;
        acc[o + 3] += wy * a;
      }
    }

    const rowSum = rows.sum[dy];
    let o = dy * subW * 4;
    for (let dx = 0; dx < subW; dx++) {
      const norm = 1 / (rowSum * cols.sum[dx]);
      const i = dx * 4;
      const coverage = acc[i + 3] * norm;
      const gap = 1 - coverage;
      // Negating the premultiplied mean against its own coverage is what keeps
      // the background out of the inversion: a fully transparent sample has
      // coverage 0, so its ink term is 0 both ways and only `bg * gap` remains.
      const ink = invert ? coverage * 255 : 0;
      const sign = invert ? -1 : 1;

      const r = ink + sign * acc[i] * norm + bgR * gap;
      const g = ink + sign * acc[i + 1] * norm + bgG * gap;
      const b = ink + sign * acc[i + 2] * norm + bgB * gap;

      // Uint8ClampedArray rounds and clamps on assignment.
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
      o += 4;
    }
  }

  return out;
}

function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const i = Math.round(v);
  return i < 0 ? 0 : i > 255 ? 255 : i;
}
