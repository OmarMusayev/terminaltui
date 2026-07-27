/**
 * The xterm palette, and the one search over it.
 *
 * This module exists because there used to be two of everything: `CUBE_LEVELS`
 * and the 6x6x6 nearest-entry search lived in both `style/colors.ts` (the
 * emitter) and `image/quantize.ts` (the ditherer), as did the 16-colour table.
 * They drifted once — one used `>=` and the other `<` at the cube midpoints, so
 * they disagreed on 878,094 of 16,777,216 colours and the ditherer diffused
 * error toward a palette entry the emitter would never paint. A comment in each
 * file asked the next editor to keep them in sync, which is not a mechanism.
 *
 * Deliberately dependency-free — no terminal detection, no I/O, no imports from
 * anywhere else in the tree — so `src/image/` can load it without dragging in
 * `colors.ts`'s load-time `detectColorSupport()`, which was the original reason
 * for the copy.
 *
 * NOT shared: the 16-colour SEARCH. `colors.ts` matches on plain RGB distance
 * for UI chrome, `quantize.ts` matches in DIN99d for pixels. That difference is
 * intentional and measured (report §5.4); only the table below is common.
 *
 * ALSO NOT shared, for the same reason: the 256-colour RAMP-VS-CUBE rule.
 * There are two entry points below —
 *
 *   `xterm256Index`      exact nearest of all 240 entries. UI chrome.
 *   `xterm256ImageIndex` the same search with a chroma floor. Pixels.
 *
 * They were briefly ONE function carrying the floor, and that was a measured
 * regression: 34 of the 100 built-in theme slots that were coloured began
 * rendering NEUTRAL GREY on every 256-colour terminal, `catppuccin` and
 * `rosePine` went effectively monochrome, and the floor even overrode exact
 * nearest-neighbour to pick a strictly WORSE entry (catppuccin's accent
 * #f5c2e7 landed on grey #e4e4e4 at RGB error 38.1 when index 218 #ffafd7 sat
 * at 26.8). The floor exists to stop NEIGHBOURING PIXELS flip-flopping across
 * a decision boundary — a property a sampled grid has and a lone UI colour
 * does not. Applying it to chrome bought nothing and cost every accent.
 *
 * The tables, the LUTs and the two candidate constructions stay common, so the
 * drift this module was created to abolish cannot come back.
 */

/** 8-bit RGB triple. Structural, so it is assignable to every other RGB type. */
export interface PaletteRgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The xterm 6x6x6 cube's channel levels. These are NOT evenly spaced — the
 * first step is 95 wide and the rest are 40 — which is why `Math.round(v/255*5)`
 * (the original implementation) mis-levelled 107 of the 256 channel values.
 */
const CUBE_LEVELS: readonly number[] = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

/**
 * Midpoints between adjacent cube levels, compared with a STRICT `>`.
 *
 * The strictness is load-bearing twice over:
 *
 * 1. The first cube gap (0 -> 95) is 95 wide, so its true midpoint is 47.5 and
 *    47 is strictly nearer to 0 than to 95. A `>=` test promoted v === 47 to
 *    level 95 — not a tie broken differently but a strictly worse palette entry,
 *    by 48² - 47² = 95 in squared distance.
 * 2. The remaining four gaps are 40 wide, so 115/155/195/235 are exact ties.
 *    Both neighbours are equally near but 40 apart in value, so the tie has to
 *    break the same way for every consumer. `>` keeps the LOWER level.
 *
 * Now that there is one table and one search, this is a property of the palette
 * rather than a contract between two files.
 */
const CUBE_BOUNDS: readonly number[] = [47, 115, 155, 195, 235];

/** Nearest cube level INDEX (0-5) for a channel byte. */
const CUBE_IDX = new Uint8Array(256);
/** Nearest cube level VALUE for a channel byte. */
export const CUBE_VAL = new Uint8Array(256);

/**
 * Width of the cube interval bracketing a channel byte.
 *
 * Ordered dithering needs this as its amplitude: the cube's first step is 95
 * wide against 40 for the rest, so shadows need over twice the amplitude of
 * highlights.
 */
export const CUBE_BRACKET_STEP = new Uint8Array(256);

for (let v = 0; v < 256; v++) {
  let k = 0;
  for (const bound of CUBE_BOUNDS) if (v > bound) k++;
  CUBE_IDX[v] = k;
  CUBE_VAL[v] = CUBE_LEVELS[k];

  // The bracketing interval is the pair of levels v sits between; its width is
  // how far a dither offset must push v to reach the neighbouring level.
  let lo = 0;
  while (lo < 4 && CUBE_LEVELS[lo + 1] <= v) lo++;
  CUBE_BRACKET_STEP[v] = CUBE_LEVELS[lo + 1] - CUBE_LEVELS[lo];
}

/** Spacing of the xterm grey ramp (232-255 are 8, 18, 28 ... 238). */
export const GREY_RAMP_STEP = 10;

/**
 * Grey ramp index (0-23) whose entry is nearest to a colour.
 *
 * Squared distance to (v,v,v) is convex in v with its minimum at the arithmetic
 * mean, so rounding the mean onto the uniform ramp is exactly optimal — a
 * luminance-weighted mean would not be.
 */
export function greyRampIndex(r: number, g: number, b: number): number {
  const i = Math.round((r + g + b - 24) / 30);
  return i < 0 ? 0 : i > 23 ? 23 : i;
}

/** Round to an integer and clamp into [0, 255]. Every LUT here is indexed by byte. */
function toByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function dist2(r: number, g: number, b: number, qr: number, qg: number, qb: number): number {
  const dr = r - qr;
  const dg = g - qg;
  const db = b - qb;
  return dr * dr + dg * dg + db * db;
}

/**
 * Squared chroma — the squared distance from a colour to the neutral axis —
 * SCALED BY THREE.
 *
 * `sum((c_i - mean)^2)` expands exactly to `((r-g)² + (g-b)² + (b-r)²) / 3`.
 * Carrying the 3 instead of dividing it out keeps this in exact integer
 * arithmetic on a per-pixel hot path; the scale cancels because the only
 * consumer compares it against a constant scaled the same way.
 */
function chroma2x3(r: number, g: number, b: number): number {
  const rg = r - g;
  const gb = g - b;
  const br = b - r;
  return rg * rg + gb * gb + br * br;
}

/**
 * Chroma below which a colour is painted NEUTRAL — from the grey ramp — even
 * when a cube entry is euclidean-nearer. See {@link prefersGreyRamp}.
 *
 * Swept over four images (the pillars photo, the welcome OG banner, the
 * gradient and quarters fixtures) at 33/36/40/42/44/45. 40 is the knee: it is
 * the largest floor that leaves saturated art bit-identical to the old
 * behaviour (the OG banner's teal accent bar keeps 100% of its chroma at 40 and
 * starts eroding at 42), and it removes 58% of the photo's grey/cube flips.
 *
 * The anchor for that range is a property of the palette, not of the images:
 * the smallest NON-ZERO chroma the 6x6x6 cube can express is one channel one
 * level off, which is sqrt(2/3) * 40 = 32.7 in the 40-wide brackets. Below that
 * every coloured cube entry necessarily OVER-states the pixel's chroma, so the
 * only honest options are "neutral" and "too colourful", and neutral is the one
 * that does not flicker.
 */
const NEUTRAL_CHROMA_FLOOR = 40;
/** The floor in {@link chroma2x3}'s units: squared, times three. */
const NEUTRAL_CHROMA_FLOOR_SQ3 = 3 * NEUTRAL_CHROMA_FLOOR * NEUTRAL_CHROMA_FLOOR;

/**
 * Should a PIXEL be painted from the grey ramp rather than the colour cube?
 *
 * IMAGE PATH ONLY. UI chrome calls {@link prefersGreyRamp}, which is the exact
 * nearest-neighbour answer; the floor below is a deliberate accuracy sacrifice
 * that only pays for itself on a sampled grid.
 *
 * NOT the euclidean-nearest answer, deliberately. Plain RGB distance decides
 * this question with a criterion that oscillates at pixel frequency, and that
 * oscillation is what made 256-colour photos look blotchy on Apple Terminal:
 *
 *   (68,18,22) chroma 39 -> cube (95,0,0), a saturated red
 *   (70,21,24) chroma 39 -> ramp (38,38,38), a flat neutral
 *
 * Those two are 4 units apart in the source and 78 apart on screen. Nothing
 * about the pixels differs — what differs is where each channel happens to sit
 * inside its cube bracket, and the cube's brackets are 40 to 95 wide against
 * the ramp's 10. So the ramp's error is smooth in the input while the cube's
 * sawtooths, and their crossing point wanders with the sawtooth. Neighbouring
 * pixels of near-identical colour land on opposite sides of it, in patches,
 * which reads as hard islands of saturated blue/red/teal in a grey field.
 * (Measured on the pillars demo: 6.1% of adjacent sub-pixel pairs within 10 RGB
 * units of each other landed on opposite sides, and 4.5% of pixels disagreed
 * with three of their four neighbours.)
 *
 * The fix is to take the chroma decision away from RGB distance in the band
 * where RGB distance is not qualified to make it. Below the floor the answer is
 * always "neutral"; above it the exact nearest-neighbour comparison stands.
 *
 * This ACCEPTS HIGHER RGB ERROR (+3.3% RMSE on that photo, chroma retention
 * 36% -> 26%) to keep the decision stable across neighbouring pixels, and that
 * is the right trade: a uniformly slightly-desaturated image reads far better
 * than one that is half grey and half neon. Metrics do not capture this — the
 * choice was made by rendering the real image through the real renderer and
 * comparing screenshots, and every numeric alternative that scored better on
 * RGB error looked worse on screen.
 *
 * WHAT THIS DOES NOT FIX, measured, so the next person does not spend the day
 * finding out again. The floor cannot restore colour, because the palette has
 * none to give: on the pillars photo at the demo's own 54-cell width, 55.8% of
 * sub-pixels have all three channels inside ONE cube bracket and therefore
 * quantize to a NEUTRAL cube entry under any rule whatsoever, while 61% of them
 * carry less chroma than the smallest non-zero chroma the cube can express
 * (32.7 in the 40-wide brackets, 77.6 in the 95-wide shadow bracket). A grey
 * rendition of a colourful photograph is the palette's answer, not a defect.
 * Rendered and compared at life size: a bracket-scaled floor (96.7% neutral),
 * a chroma-weighted 240-entry search, a chroma-overshoot allowance and a
 * luminance-weighted anisotropic metric each either kept the colour and RAISED
 * the blotch rate (adjacent source-alike pairs landing >=40 apart: 2.35% here
 * against 3.8-6.0% for those), or removed the blotching by removing all colour.
 * Dithering does restore chroma (25% -> 44-91%) and every form of it looks
 * worse on screen: Floyd-Steinberg is confetti, ordered is a visible halftone,
 * and a chroma-only ordered dither — which eliminates islands entirely on the
 * numbers (12.5% -> 0.0%) — reads as a printing screen.
 *
 * The `dc === 0` escape is load-bearing: it keeps all 240 image-safe entries
 * fixed points of this search, which the round-trip test pins and which the
 * dither path depends on (it re-quantizes colours it has already quantized).
 * Without it (0,0,0) — chroma 0, so below any floor — would answer "ramp" and
 * land on 232 rather than 16.
 *
 * @param r Red channel. MUST already be an integer in [0, 255]; this indexes
 *          `CUBE_VAL` directly, so callers holding floats clamp first
 *          (`xterm256ImageIndex` and `quantize.ts` both do).
 * @param g Green channel, same precondition.
 * @param b Blue channel, same precondition.
 */
export function imagePrefersGreyRamp(r: number, g: number, b: number): boolean {
  const dc = dist2(r, g, b, CUBE_VAL[r], CUBE_VAL[g], CUBE_VAL[b]);
  if (dc === 0) return false;
  if (chroma2x3(r, g, b) < NEUTRAL_CHROMA_FLOOR_SQ3) return true;
  const gv = 8 + GREY_RAMP_STEP * greyRampIndex(r, g, b);
  return dist2(r, g, b, gv, gv, gv) < dc;
}

/**
 * The EXACT answer: is the nearest grey-ramp entry nearer than the nearest cube
 * entry? No floor, no bias — plain squared distance over the two candidates,
 * which between them cover all 240 image-safe entries.
 *
 * This is what UI chrome uses. A theme colour has no neighbours to be
 * inconsistent with, so the stability the floor buys is worth nothing there and
 * the accuracy it spends is worth a great deal: it is the difference between
 * `rosePine.accent` painting a dusty pink and painting the same grey as body
 * text.
 *
 * Ties resolve to the cube (`<` not `<=`), which is what keeps (0,0,0) -> 16
 * and (255,255,255) -> 231.
 */
export function prefersGreyRamp(r: number, g: number, b: number): boolean {
  const dc = dist2(r, g, b, CUBE_VAL[r], CUBE_VAL[g], CUBE_VAL[b]);
  if (dc === 0) return false;
  const gv = 8 + GREY_RAMP_STEP * greyRampIndex(r, g, b);
  return dist2(r, g, b, gv, gv, gv) < dc;
}

/**
 * The xterm-256 index this palette paints for a colour, treating the 6x6x6 cube
 * (16-231) and the 24-step grey ramp (232-255) as one 240-entry palette.
 *
 * Each candidate is the exact optimum within its own family, at two evaluations
 * rather than 240:
 *  - The cube is a product set, so minimising each channel independently (via
 *    CUBE_IDX) already yields the nearest cube entry.
 *  - The grey ramp is the line r=g=b, and argmin_x sum((c-x)²) is the channel
 *    mean, so the nearest ramp entry is the mean snapped to `8 + 10i`.
 *
 * Which of the two WINS is plain squared distance — see {@link prefersGreyRamp}
 * — so this IS the exhaustive nearest neighbour over all 240 usable entries,
 * evaluated in two comparisons. Pixels want a different rule and get one from
 * {@link xterm256ImageIndex}; do not merge the two again.
 *
 * The grey candidate is considered for EVERY colour, not only for exact
 * r===g===b: near-greys dominate photographs and anti-aliased UI, and a gate
 * sent (28,26,28) to cube (95,95,95) when ramp entry (28,28,28) was sitting
 * right there.
 *
 * Ties resolve to the cube, which is what keeps (0,0,0) -> 16 and
 * (255,255,255) -> 231. Indices 0-15 are never returned — the user's scheme
 * redefines them arbitrarily, so no error model for them is honest.
 */
export function xterm256Index(r: number, g: number, b: number): number {
  const ri = toByte(r);
  const gi = toByte(g);
  const bi = toByte(b);
  return prefersGreyRamp(ri, gi, bi)
    ? 232 + greyRampIndex(ri, gi, bi)
    : 16 + 36 * CUBE_IDX[ri] + 6 * CUBE_IDX[gi] + CUBE_IDX[bi];
}

/**
 * {@link xterm256Index} for PIXELS: the same two candidates, decided by
 * {@link imagePrefersGreyRamp}'s chroma floor instead of by distance.
 *
 * Every one of the 240 image-safe entries is a fixed point of BOTH searches, so
 * a colour snapped by this function is painted verbatim by `colors.ts` — which
 * is what lets `image/render.ts` pre-snap its pens and still emit through the
 * shared emitter. That property is pinned by test, and it is the whole reason
 * two rules can coexist without the ditherer aiming at an entry the emitter
 * would never paint.
 */
export function xterm256ImageIndex(r: number, g: number, b: number): number {
  const ri = toByte(r);
  const gi = toByte(g);
  const bi = toByte(b);
  return imagePrefersGreyRamp(ri, gi, bi)
    ? 232 + greyRampIndex(ri, gi, bi)
    : 16 + 36 * CUBE_IDX[ri] + 6 * CUBE_IDX[gi] + CUBE_IDX[bi];
}

/**
 * True RGB of an xterm-256 palette index — the inverse of
 * {@link xterm256Index} over the 240 image-safe entries.
 *
 * Indices 0-15 return black: they are theme-defined and have no fixed RGB.
 */
export function xterm256Rgb(index: number): PaletteRgb {
  const i = index | 0;
  if (i >= 232 && i <= 255) {
    const v = 8 + GREY_RAMP_STEP * (i - 232);
    return { r: v, g: v, b: v };
  }
  if (i < 16 || i > 231) return { r: 0, g: 0, b: 0 };
  const n = i - 16;
  return {
    r: CUBE_LEVELS[Math.floor(n / 36)],
    g: CUBE_LEVELS[Math.floor(n / 6) % 6],
    b: CUBE_LEVELS[n % 6],
  };
}

/**
 * The 16 ANSI colours and their SGR foreground codes.
 *
 * These values are terminal-dependent — a user's scheme may redefine every one
 * of them. The point of pinning them is self-consistency: the emitter and the
 * ditherer must assume the same thing.
 */
export const ANSI16_TABLE: ReadonlyArray<PaletteRgb & { code: number }> = [
  { r: 0, g: 0, b: 0, code: 30 },       // black
  { r: 170, g: 0, b: 0, code: 31 },     // red
  { r: 0, g: 170, b: 0, code: 32 },     // green
  { r: 170, g: 170, b: 0, code: 33 },   // yellow
  { r: 0, g: 0, b: 170, code: 34 },     // blue
  { r: 170, g: 0, b: 170, code: 35 },   // magenta
  { r: 0, g: 170, b: 170, code: 36 },   // cyan
  { r: 170, g: 170, b: 170, code: 37 }, // white
  { r: 85, g: 85, b: 85, code: 90 },    // bright black
  { r: 255, g: 85, b: 85, code: 91 },   // bright red
  { r: 85, g: 255, b: 85, code: 92 },   // bright green
  { r: 255, g: 255, b: 85, code: 93 },  // bright yellow
  { r: 85, g: 85, b: 255, code: 94 },   // bright blue
  { r: 255, g: 85, b: 255, code: 95 },  // bright magenta
  { r: 85, g: 255, b: 255, code: 96 },  // bright cyan
  { r: 255, g: 255, b: 255, code: 97 }, // bright white
];
