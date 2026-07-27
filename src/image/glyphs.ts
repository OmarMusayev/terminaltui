/**
 * Codepoint tables for the cell-based image renderer.
 *
 * Pure data plus a handful of index helpers — no imports, no side effects, so
 * this module can be consumed by the cell fitter, the renderer and tests
 * without dragging in the runtime.
 *
 * DENSITY CEILING: 2x2 quadrants. Sextants (U+1FB00) and octants (U+1CD00)
 * are deliberately absent. A scan of every font in /System/Library/Fonts,
 * /Library/Fonts, ~/Library/Fonts and Terminal.app's bundle found exactly ONE
 * face covering them — `.LastResort`, which IS the tofu placeholder. That
 * includes all 34 installed JetBrains Mono Nerd Font faces. They would render
 * as boxes, and they buy at most +0.66 dB over quadrants anyway.
 *
 * Every glyph here is display width 1 under `stringWidth()` (verified).
 */

// ─── Quadrants — 2x2 subcells, two colours ────────────────

/**
 * Sub-cell bit assignments. This bit order is the contract between glyphs.ts
 * and cellfit.ts and is used verbatim as the index into `QUADRANT_GLYPHS`:
 *
 *     bit 0 = top-left      bit 1 = top-right
 *     bit 2 = bottom-left   bit 3 = bottom-right
 *
 * A set bit means "this sub-cell is painted in the FOREGROUND colour"; a clear
 * bit means it shows the cell background. Sub-cell arrays are indexed in the
 * same order: [TL, TR, BL, BR] — row-major over a 2x2 grid.
 */
export const QUADRANT_BIT = {
  topLeft: 1,
  topRight: 2,
  bottomLeft: 4,
  bottomRight: 8,
} as const;

/** Number of sub-cells in a quadrant cell. */
export const QUADRANT_SUBCELLS = 4;

/**
 * The 16 quadrant codepoints, indexed by the 4-bit coverage mask above.
 *
 * Every entry was verified by DERIVING its coverage from the official Unicode
 * name in UnicodeData.txt and comparing it to the mask it is filed under (e.g.
 * "QUADRANT UPPER RIGHT AND LOWER LEFT" -> TR|BL = 6). A transposed or
 * mirrored entry here produces a subtly flipped image that is near-impossible
 * to spot by eye, so the table is machine-checked rather than eyeballed.
 */
const QUADRANT_CODEPOINTS: readonly number[] = [
  0x0020, // 0  ....  SPACE
  0x2598, // 1  T...  QUADRANT UPPER LEFT
  0x259d, // 2  .T..  QUADRANT UPPER RIGHT
  0x2580, // 3  TT..  UPPER HALF BLOCK
  0x2596, // 4  ..B.  QUADRANT LOWER LEFT
  0x258c, // 5  T.B.  LEFT HALF BLOCK
  0x259e, // 6  .TB.  QUADRANT UPPER RIGHT AND LOWER LEFT
  0x259b, // 7  TTB.  QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER LEFT
  0x2597, // 8  ...B  QUADRANT LOWER RIGHT
  0x259a, // 9  T..B  QUADRANT UPPER LEFT AND LOWER RIGHT
  0x2590, // 10 .T.B  RIGHT HALF BLOCK
  0x259c, // 11 TT.B  QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER RIGHT
  0x2584, // 12 ..BB  LOWER HALF BLOCK
  0x2599, // 13 T.BB  QUADRANT UPPER LEFT AND LOWER LEFT AND LOWER RIGHT
  0x259f, // 14 .TBB  QUADRANT UPPER RIGHT AND LOWER LEFT AND LOWER RIGHT
  0x2588, // 15 TTBB  FULL BLOCK
];

/** The same 16 glyphs as single-character strings, indexed by coverage mask. */
export const QUADRANT_GLYPHS: readonly string[] = QUADRANT_CODEPOINTS.map(cp =>
  String.fromCodePoint(cp),
);

/**
 * Preference rank for glyphs that score identically. Lower wins.
 *
 * Ties are common — mask 0 and mask 15 always tie exactly, because "all four
 * sub-pixels are background" and "all four are foreground" describe the same
 * single-colour cell. Breaking those ties toward the robust glyph matters:
 *
 *   0  space           needs ZERO font coverage and is never ambiguous-width
 *   1  full block      U+2588, present in essentially every monospace font
 *   2  half blocks     U+2580/2584/258C/2590 — universal, but East Asian Width
 *                      **Ambiguous**: a CJK locale or an "ambiguous = wide"
 *                      setting doubles them and shears the image. No Neutral
 *                      alternative exists for these four masks.
 *   3  single quadrant U+2596/2597/2598/259D — Neutral width (110 fonts here)
 *   4  triple quadrant U+2599/259B/259C/259F, same block, visually busier
 *   5  diagonals       U+259A/U+259E — the least-used pair, and the ones that
 *                      read worst at small sizes
 */
const QUADRANT_SIMPLICITY: readonly number[] = [
  0, 3, 3, 2, 3, 2, 5, 4,
  3, 5, 2, 4, 2, 4, 4, 1,
];

/** Per-glyph sub-cell coverage, so scorers never re-derive the bit layout. */
export interface GlyphCoverage {
  /** The 4-bit mask this glyph paints (see `QUADRANT_BIT`). */
  mask: number;
  /**
   * Ink flags per sub-cell in [TL, TR, BL, BR] order. `true` means the glyph
   * paints that sub-cell in the foreground colour.
   */
  subcells: readonly boolean[];
  /** Count of painted sub-cells (0-4). */
  ink: number;
  /** Tie-break rank; see `QUADRANT_SIMPLICITY`. Lower is preferred. */
  simplicity: number;
}

/**
 * Coverage bitmap for every quadrant glyph, keyed by the glyph itself.
 *
 * cellfit.ts builds its candidate list from this map rather than hardcoding
 * `for (mask = 0; mask < 16; mask++)`, so the search can never score a
 * partition that has no glyph to draw it with.
 */
export const GLYPH_COVERAGE: ReadonlyMap<string, GlyphCoverage> = new Map(
  QUADRANT_GLYPHS.map((ch, mask) => {
    const subcells = [
      (mask & QUADRANT_BIT.topLeft) !== 0,
      (mask & QUADRANT_BIT.topRight) !== 0,
      (mask & QUADRANT_BIT.bottomLeft) !== 0,
      (mask & QUADRANT_BIT.bottomRight) !== 0,
    ];
    const coverage: GlyphCoverage = {
      mask,
      subcells,
      ink: subcells.reduce((n, on) => n + (on ? 1 : 0), 0),
      simplicity: QUADRANT_SIMPLICITY[mask],
    };
    return [ch, coverage] as const;
  }),
);

// ─── Half blocks and solids ───────────────────────────────

/**
 * U+2580 UPPER HALF BLOCK. The foreground paints the **TOP** half and the
 * background shows through the bottom, so `fg = top pixel, bg = bottom pixel`.
 * Getting this backwards flips every image vertically.
 */
export const HALF_UPPER = "▀";

/**
 * The solid tier's glyph: a plain space carrying only an SGR background.
 * This is the ONLY cell form that requires no font coverage whatsoever, which
 * is why every higher tier collapses to it for flat cells.
 */
export const SOLID_GLYPH = " ";

// ─── Ramps ────────────────────────────────────────────────

/**
 * Shading ramp, 7 levels: space, MIDDLE DOT, COLON, LIGHT/MEDIUM/DARK SHADE,
 * FULL BLOCK. Used by the `shading` tier (foreground colour only).
 *
 * Short ramps beat long ones: a 70-glyph ramp's steps are not perceptually
 * uniform and adjacent entries are indistinguishable at terminal sizes.
 */
export const SHADING_RAMP = " ·:░▒▓█";

/** Default ASCII ramp, 10 levels, no colour at all. */
export const ASCII_RAMP = " .:-=+*#%@";

/**
 * Areal INK COVERAGE of the glyphs the shading ramp is built from, 0..1.
 *
 * Exact for the four Unicode shade blocks — U+2591/2/3 are defined as light,
 * medium and dark shade, i.e. 25/50/75% fill, and U+2588 is a filled cell. The
 * two sparse steps are measured estimates: MIDDLE DOT and COLON paint a couple
 * of small marks in a cell that is mostly whitespace.
 *
 * This table exists because the ramp is NOT uniform in ink, and treating it as
 * uniform is a two-and-a-half-stop exposure error. `rampGlyph` maps intensity
 * to POSITION (i / (n-1)), so intensity 1/6 selected `·` — which covers 5% of
 * its cell, not 17%. Combined with painting that glyph in the pixel's own
 * colour, perceived brightness came out as coverage x colour rather than
 * colour: measured mean luminance 37 against the source's 81, i.e. an almost
 * black rectangle where three neighbouring tiers rendered correctly exposed.
 */
const RAMP_INK: ReadonlyMap<string, number> = new Map<string, number>([
  [" ", 0],
  ["·", 0.05],
  [":", 0.1],
  ["░", 0.25],
  ["▒", 0.5],
  ["▓", 0.75],
  ["█", 1],
]);

/**
 * Per-step ink coverage for a compiled ramp.
 *
 * Falls back to UNIFORM spacing (`i / (n-1)`) unless every glyph is in
 * {@link RAMP_INK} and the resulting sequence is non-decreasing. A ramp is
 * author-supplied, so it can mix known and unknown glyphs or list them out of
 * order; a non-monotone coverage table would make the renderer pick a sparser
 * glyph for a brighter pixel, which is worse than a wrong-but-ordered estimate.
 * The uniform fallback is exactly what the renderer assumed before this table
 * existed, so an unknown charset is no worse off than it was.
 */
export function rampInk(cells: readonly string[]): readonly number[] {
  const n = cells.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const known: number[] = [];
  let monotone = true;
  for (let i = 0; i < n; i++) {
    const v = RAMP_INK.get(cells[i]);
    if (v === undefined) { monotone = false; break; }
    if (i > 0 && v < known[i - 1]) { monotone = false; break; }
    known.push(v);
  }
  if (monotone && known[n - 1] > 0) return known;
  const uniform: number[] = new Array(n) as number[];
  for (let i = 0; i < n; i++) uniform[i] = i / (n - 1);
  return uniform;
}

/**
 * The SPARSEST ramp step that can still reproduce a pixel at full strength.
 *
 * A foreground-only cell shows `coverage x pen` over the terminal's own
 * background, and the pen is capped at 255 per channel. So a pixel whose
 * brightest channel is `maxChannel` is reproduced exactly by any step with
 * `coverage >= maxChannel / 255` (scale the pen by `1 / coverage`) and cannot
 * be reproduced by any sparser one. Choosing the sparsest such step keeps the
 * ramp a real ramp — dark pixels get sparse glyphs, bright pixels get dense
 * ones — while making the reconstruction exact rather than a third as bright.
 *
 * Minimising ink is also free fidelity elsewhere: Apple Terminal's Basic
 * profile stretches the cell ~0.4% wider than the glyph advance, so adjacent
 * FOREGROUND block glyphs show hairline seams that background paint never does.
 *
 * @param ink Coverage per step, from {@link rampInk}. Must be non-decreasing.
 * @param need Required coverage, `maxChannel / 255`, in 0..1.
 */
export function rampStepForInk(ink: readonly number[], need: number): number {
  for (let i = 0; i < ink.length; i++) if (ink[i] >= need) return i;
  return ink.length - 1;
}

const RAMP_CACHE_CAP = 32;
const rampCache = new Map<string, readonly string[]>();

/**
 * Split a ramp into an array of single characters, memoised.
 *
 * Uses codepoint iteration, not `.slice(i, i + 1)`, so an author-supplied
 * `charset` containing astral characters is not cut in half into lone
 * surrogates. Bounded FIFO cache: charsets come from config, so the working
 * set is tiny, but an unbounded map keyed by user strings is a leak.
 */
export function compileRamp(ramp: string): readonly string[] {
  const hit = rampCache.get(ramp);
  if (hit !== undefined) return hit;
  const cells = Array.from(ramp);
  if (rampCache.size >= RAMP_CACHE_CAP) {
    rampCache.delete(rampCache.keys().next().value!); // evict oldest
  }
  rampCache.set(ramp, cells);
  return cells;
}

/**
 * Pick a ramp glyph for a normalised intensity.
 *
 * @param ramp  A ramp string or a pre-compiled cell array (hot loops should
 *              hoist `compileRamp` out and pass the array).
 * @param level Intensity in 0..1, where 0 is the ramp's first entry. Values
 *              outside the range are clamped rather than wrapped.
 */
export function rampGlyph(ramp: string | readonly string[], level: number): string {
  const cells = typeof ramp === "string" ? compileRamp(ramp) : ramp;
  if (cells.length === 0) return SOLID_GLYPH;
  // Round, not floor: it maps 0 -> first and 1 -> last exactly, keeping pure
  // black and pure white crisp instead of squashing white into the last bucket.
  const i = Math.round((level > 1 ? 1 : level < 0 ? 0 : level) * (cells.length - 1));
  return cells[i];
}

// ─── Braille — 2x4 subcells, ONE colour ───────────────────

/** U+2800 BRAILLE PATTERN BLANK. Add an 8-bit dot mask to reach any pattern. */
export const BRAILLE_BASE = 0x2800;

/**
 * `BRAILLE_DOT_BIT[row][col]` -> bit index, for a 4-row by 2-column sub-cell
 * grid. The mapping is NOT row-major and NOT a simple raster order — dots 7
 * and 8 were appended to 6-dot braille decades later, so the bottom row's bits
 * sit above the rest:
 *
 *     col0 rows 0..3 -> bits 0,1,2,6      (dots 1,2,3,7)
 *     col1 rows 0..3 -> bits 3,4,5,7      (dots 4,5,6,8)
 *
 * Verified against all 256 "BRAILLE PATTERN DOTS-n" names in UnicodeData.txt.
 */
export const BRAILLE_DOT_BIT: readonly (readonly number[])[] = [
  [0, 3], // row 0 -> dot1, dot4
  [1, 4], // row 1 -> dot2, dot5
  [2, 5], // row 2 -> dot3, dot6
  [6, 7], // row 3 -> dot7, dot8
];

/** Glyph for an 8-bit braille dot mask. Out-of-range bits are masked off. */
export function brailleGlyph(mask: number): string {
  return String.fromCodePoint(BRAILLE_BASE + (mask & 0xff));
}

/**
 * Build a braille dot mask from a 4x2 grid of lit flags in ROW-MAJOR order
 * ([r0c0, r0c1, r1c0, r1c1, ...]) — i.e. the order a 2x4 sub-cell grid is
 * naturally scanned in. Handles the non-obvious bit layout for the caller.
 */
export function brailleMask(lit: readonly boolean[]): number {
  let mask = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      if (lit[row * 2 + col]) mask |= 1 << BRAILLE_DOT_BIT[row][col];
    }
  }
  return mask;
}
