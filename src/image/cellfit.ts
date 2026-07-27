/**
 * Per-cell glyph + colour fitting.
 *
 * A terminal cell can carry exactly TWO colours: one foreground and one
 * background. Every cell technique is therefore the same question — given N
 * sub-pixels, which subset gets the foreground pen, and what are the two pen
 * colours that minimise reconstruction error?
 *
 * Pure and synchronous. Nothing here allocates beyond the returned cell, and
 * nothing here emits escape sequences — colour encoding belongs to the
 * renderer so the module-level `colorMode` cap applies in exactly one place.
 */

import type { FittedCell, RGB } from "./types.js";
import {
  GLYPH_COVERAGE,
  QUADRANT_SUBCELLS,
  SOLID_GLYPH,
  HALF_UPPER,
} from "./glyphs.js";

/**
 * Per-channel weights for the squared-error metric.
 *
 * Plain RGB euclidean distance is acceptable and fast; weighting the channels
 * by rough luminance sensitivity is strictly better and costs three extra
 * multiplies. (2, 4, 3) is the classic integer approximation of the eye's
 * response — green errors are the most visible, blue the least.
 *
 * Crucially, per-channel weights do NOT break the closed-form optimum. The
 * weighted error decomposes into independent per-channel sums, and the
 * minimiser of a weighted sum of squares within a channel is still that
 * channel's arithmetic mean. So `fg = mean(ink)` / `bg = mean(background)`
 * remains exactly optimal for a fixed partition.
 */
const CHANNEL_WEIGHTS = { r: 2, g: 4, b: 3 } as const;

const WR = CHANNEL_WEIGHTS.r;
const WG = CHANNEL_WEIGHTS.g;
const WB = CHANNEL_WEIGHTS.b;

/**
 * Sub-pixels whose channels all sit within this many 8-bit levels of each
 * other are treated as one flat colour. Two levels is below the visible
 * threshold on any display and skips the whole partition search — which is
 * most of a typical UI screenshot, where large regions are a single colour.
 */
const FLAT_EPSILON = 2;

/**
 * Scores that differ by less than this are ties. Scores are sums of squares of
 * sums, bounded by ~9.4e6, so double-precision noise is around 1e-9; 1e-6 is a
 * comfortable margin that still never merges genuinely different partitions.
 */
const SCORE_TIE = 1e-6;

interface QuadCandidate {
  ch: string;
  mask: number;
}

/**
 * The partitions to search, ordered simplest glyph first.
 *
 * Derived from `GLYPH_COVERAGE` rather than a hardcoded `0..15` loop, so a
 * partition can never be selected that has no glyph to draw it. The ordering
 * IS the tie-break: the scan below only replaces the incumbent on a strictly
 * better score, so among equal-scoring partitions the first — and therefore
 * simplest — glyph survives.
 *
 * COMPLEMENT SYMMETRY — the reason half the glyph table never appears in the
 * output, and the first thing a maintainer will mistake for a bug.
 *
 * Mask `m` painted `(fg = A, bg = B)` draws pixel-for-pixel the same cell as
 * mask `15 - m` painted `(fg = B, bg = A)`: the Unicode quadrant glyphs are
 * exact complements of one another. Both partitions therefore always score
 * IDENTICALLY, and the tie-break alone decides the polarity. With the ranking
 * above the winner of every pair is the one with LESS foreground ink:
 *
 *     " "<->"█"   "▘"<->"▟"   "▝"<->"▙"   "▀"<->"▄"
 *     "▖"<->"▜"   "▌"<->"▐"   "▞"<->"▚"   "▗"<->"▛"
 *
 * so `fitQuadrant` only ever emits ` ▘▝▀▖▌▞▗` — never more than two painted
 * sub-cells. That is deliberate, and free: Apple Terminal's Basic profile sets
 * `FontWidthSpacing = 1.004032258064516`, stretching the cell ~0.4% wider than
 * the glyph advance, so adjacent FOREGROUND block glyphs show hairline seams.
 * Background paint fills the whole cell rect and never seams. Minimising ink
 * minimises seams at zero fidelity cost.
 */
const QUADRANT_CANDIDATES: readonly QuadCandidate[] = [...GLYPH_COVERAGE.entries()]
  .sort((a, b) => a[1].simplicity - b[1].simplicity)
  .map(([ch, cov]) => ({ ch, mask: cov.mask }));

function clamp255(v: number): number {
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

function toRgb(r: number, g: number, b: number): RGB {
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

/** Weighted squared distance between two colours. Not a perceptual metric — a
 *  cheap, monotone stand-in that is good enough to rank partitions. */
function colorDistanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return WR * dr * dr + WG * dg * dg + WB * db * db;
}

/**
 * A flat cell: a space carrying only a background colour.
 *
 * `fg` is set equal to `bg` so a renderer that emits both produces a visually
 * identical cell, and one that notices `fg === bg` can drop the foreground SGR
 * entirely. The two objects are distinct on purpose — sharing one reference
 * across both fields turns any downstream mutation into a silent double-write.
 */
export function fitSolid(c: RGB): FittedCell {
  return {
    ch: SOLID_GLYPH,
    fg: toRgb(c.r, c.g, c.b),
    bg: toRgb(c.r, c.g, c.b),
  };
}

/**
 * Fit a 1x2 half-block cell. This tier is lossless: `▀` U+2580 paints the
 * foreground over the TOP half and lets the background show through the
 * bottom, so two independent pixels are reproduced exactly.
 *
 * When the two pixels match (within `FLAT_EPSILON`) the cell collapses to a
 * space with a background colour. That is shorter on the wire, needs zero font
 * coverage, and dodges the East Asian Width Ambiguous classification of
 * U+2580 that would otherwise shear the image under a CJK locale.
 */
export function fitHalf(top: RGB, bottom: RGB): FittedCell {
  if (
    Math.abs(top.r - bottom.r) <= FLAT_EPSILON &&
    Math.abs(top.g - bottom.g) <= FLAT_EPSILON &&
    Math.abs(top.b - bottom.b) <= FLAT_EPSILON
  ) {
    return fitSolid({
      r: (top.r + bottom.r) / 2,
      g: (top.g + bottom.g) / 2,
      b: (top.b + bottom.b) / 2,
    });
  }
  return {
    ch: HALF_UPPER,
    fg: toRgb(top.r, top.g, top.b),
    bg: toRgb(bottom.r, bottom.g, bottom.b),
  };
}

/**
 * Fit a 2x2 quadrant cell by exhaustive search over all 16 partitions.
 *
 * For four sub-pixels, exhaustive search is both faster AND more accurate than
 * 2-means (measured 23.89 vs 23.76 dB) — there is nothing to iterate toward.
 * For a FIXED partition the optimal pens are the closed-form means of each
 * side, so the only free variable is the partition itself.
 *
 * The scoring uses the standard identity
 *
 *     Σ‖x − mean‖²  =  Σ‖x‖² − ‖Σx‖²/n
 *
 * applied to both sides of the partition. `Σ‖x‖²` is the same for every
 * partition, so minimising total error is exactly maximising
 * `‖S_ink‖²/n_ink + ‖S_bg‖²/n_bg`. That removes the second pass over the
 * sub-pixels and every division except one per side. `quadrantError()` below
 * computes the same quantity the long way and is the reference the fast path
 * is checked against.
 *
 * @param subcells Exactly 4 colours in [TL, TR, BL, BR] order — row-major over
 *                 the 2x2 sub-cell grid, matching `QUADRANT_BIT`.
 */
export function fitQuadrant(subcells: readonly RGB[]): FittedCell {
  if (subcells.length !== QUADRANT_SUBCELLS) {
    // A wrong-length grid means the resampler is indexing incorrectly, which
    // would otherwise surface as a mysteriously smeared image.
    throw new RangeError(
      `fitQuadrant expects ${QUADRANT_SUBCELLS} sub-cells, got ${subcells.length}`,
    );
  }

  // One pass: totals for the search, and min/max for the flat-cell shortcut.
  let tr = 0;
  let tg = 0;
  let tb = 0;
  let minR = Infinity, maxR = -Infinity;
  let minG = Infinity, maxG = -Infinity;
  let minB = Infinity, maxB = -Infinity;
  for (let i = 0; i < QUADRANT_SUBCELLS; i++) {
    const p = subcells[i];
    tr += p.r; tg += p.g; tb += p.b;
    if (p.r < minR) minR = p.r;
    if (p.r > maxR) maxR = p.r;
    if (p.g < minG) minG = p.g;
    if (p.g > maxG) maxG = p.g;
    if (p.b < minB) minB = p.b;
    if (p.b > maxB) maxB = p.b;
  }

  // Degenerate cell: every sub-pixel is the same colour, so no glyph can beat
  // a plain background. Skips all 16 partition evaluations, which is the
  // common case for UI screenshots and flat art.
  if (
    maxR - minR <= FLAT_EPSILON &&
    maxG - minG <= FLAT_EPSILON &&
    maxB - minB <= FLAT_EPSILON
  ) {
    return fitSolid({ r: tr / 4, g: tg / 4, b: tb / 4 });
  }

  let best = QUADRANT_CANDIDATES[0];
  let bestScore = -Infinity;
  let bestInkR = 0, bestInkG = 0, bestInkB = 0, bestInkN = 0;

  for (let c = 0; c < QUADRANT_CANDIDATES.length; c++) {
    const cand = QUADRANT_CANDIDATES[c];
    const mask = cand.mask;

    let ir = 0, ig = 0, ib = 0, n = 0;
    for (let i = 0; i < QUADRANT_SUBCELLS; i++) {
      if ((mask >> i) & 1) {
        const p = subcells[i];
        ir += p.r; ig += p.g; ib += p.b;
        n++;
      }
    }
    const br = tr - ir, bg = tg - ig, bb = tb - ib;
    const m = QUADRANT_SUBCELLS - n;

    let score = 0;
    if (n > 0) score += (WR * ir * ir + WG * ig * ig + WB * ib * ib) / n;
    if (m > 0) score += (WR * br * br + WG * bg * bg + WB * bb * bb) / m;

    if (score > bestScore + SCORE_TIE) {
      bestScore = score;
      best = cand;
      bestInkR = ir; bestInkG = ig; bestInkB = ib; bestInkN = n;
    }
  }

  // Means are rounded only now, at the end. Rounding before scoring would cost
  // 16 extra rounds per cell and could only ever change the outcome by half a
  // level, which is far below the flat-cell epsilon.
  const bgN = QUADRANT_SUBCELLS - bestInkN;
  const bgR = tr - bestInkR, bgG = tg - bestInkG, bgB = tb - bestInkB;

  // An empty side has no colour of its own; mirroring the other pen keeps the
  // cell visually correct and lets the renderer drop one SGR.
  const fg = bestInkN > 0
    ? toRgb(bestInkR / bestInkN, bestInkG / bestInkN, bestInkB / bestInkN)
    : toRgb(bgR / bgN, bgG / bgN, bgB / bgN);
  const background = bgN > 0
    ? toRgb(bgR / bgN, bgG / bgN, bgB / bgN)
    : toRgb(bestInkR / bestInkN, bestInkG / bestInkN, bestInkB / bestInkN);

  return { ch: best.ch, fg, bg: background };
}

/**
 * Reconstruct the 2x2 sub-pixels a fitted cell will actually display, in
 * [TL, TR, BL, BR] order.
 *
 * The inverse of `fitQuadrant`, and the only honest way to compare two fits:
 * because of the complement symmetry above, two cells with different glyphs
 * and swapped pens can be pixel-identical. Off the render path — for tests,
 * emulator assertions and error measurement.
 */
export function expandQuadrant(cell: FittedCell): RGB[] {
  const coverage = GLYPH_COVERAGE.get(cell.ch);
  // A non-quadrant glyph (a solid space, a ramp character) paints no sub-cell
  // ink, so the whole cell reads as its background.
  if (coverage === undefined) return [cell.bg, cell.bg, cell.bg, cell.bg];
  return coverage.subcells.map(ink => (ink ? cell.fg : cell.bg));
}

/**
 * Weighted squared error of fitting `subcells` with a given coverage `mask`,
 * using that partition's optimal (mean) pens.
 *
 * Computed the direct way — build both means, then sum squared deviations —
 * so it is an independent reference for `fitQuadrant`'s identity-based scoring
 * rather than a restatement of it. Not on the render path; exported for tests
 * and for debugging a suspicious cell.
 */
export function quadrantError(subcells: readonly RGB[], mask: number): number {
  let ir = 0, ig = 0, ib = 0, n = 0;
  let br = 0, bg = 0, bb = 0, m = 0;
  for (let i = 0; i < subcells.length; i++) {
    const p = subcells[i];
    if ((mask >> i) & 1) { ir += p.r; ig += p.g; ib += p.b; n++; }
    else { br += p.r; bg += p.g; bb += p.b; m++; }
  }
  const inkMean: RGB = n > 0 ? { r: ir / n, g: ig / n, b: ib / n } : { r: 0, g: 0, b: 0 };
  const bgMean: RGB = m > 0 ? { r: br / m, g: bg / m, b: bb / m } : { r: 0, g: 0, b: 0 };

  let err = 0;
  for (let i = 0; i < subcells.length; i++) {
    err += colorDistanceSq(subcells[i], ((mask >> i) & 1) ? inkMean : bgMean);
  }
  return err;
}
