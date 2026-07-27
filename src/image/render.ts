/**
 * ANSI row emission — the last stage of the cell image engine.
 *
 * Takes a resampled sub-cell grid and turns it into `string[]`, one entry per
 * terminal row, ready to be dropped straight into the frame. Pure, synchronous
 * and allocation-light: no decoding, no resampling, no dithering, no caching.
 *
 * THREE INVARIANTS, each with a measured failure behind it:
 *
 * 1. Every returned row is EXACTLY `grid.cols` display columns. Every glyph any
 *    tier can emit is width 1 (machine-verified in glyphs.ts), and a
 *    caller-supplied `charset` is width-checked before use, so the width is
 *    known by construction. Callers should NOT run image rows through
 *    `stringWidth()` — its 8192-entry memo is budgeted for ~200-char strings and
 *    a stream of unique ~2.6 KB image rows grew the heap by 60 MB in testing.
 *
 * 2. Every row ends with `reset`. A row that emits a background and does not
 *    reset leaks that colour into the one-column focus gutter, into `padStr`'s
 *    centring pad, and visually into the row below.
 *
 * 3. No C0 bytes. `runtime-terminal.ts` strips `/[\x00-\x1a\x1c-\x1f\x7f]/g`
 *    from every row before writing, so anything in that range would silently
 *    vanish and shorten the row. Output here is SGR (`ESC [ ... m`) plus
 *    printable glyphs only — nothing else is ever emitted, and text arriving
 *    from user config is sanitised on the way in.
 *
 * SGR RUN ELISION is the single biggest byte win available and is implemented
 * as chafa's `REUSE_ATTRIBUTES`: the pen state (what fg/bg the terminal is
 * currently set to) is tracked per row, and a cell emits only the halves that
 * actually changed — the combined `\x1b[38;…;48;…m` form when both change, one
 * of the single-attribute forms when one does, and nothing at all when neither
 * does. State is reset at the START of every row and never carried across rows,
 * because `runtime-terminal.ts:113` emits rows independently: an unchanged row
 * is skipped entirely, so a row that depended on its predecessor's pen would
 * render with stale colours the moment the differ skipped that predecessor.
 */

import type { CellGeometry, ImageRenderOptions, ImageTier, RGB, SubCellGrid } from "./types.js";
import { subCellFactor } from "./types.js";
import type { Theme } from "../style/theme.js";
import type { ColorMode } from "../style/colors.js";
import {
  bgColorRgb,
  cellColorRgb,
  fgColor,
  fgColorRgb,
  getColorMode,
  reset,
} from "../style/colors.js";
import { stringWidth, truncate } from "../components/base.js";
import { getBorderChars, type BorderStyle } from "../style/borders.js";
import { fitHalf, fitQuadrant } from "./cellfit.js";
import {
  ASCII_RAMP,
  SHADING_RAMP,
  SOLID_GLYPH,
  brailleGlyph,
  brailleMask,
  compileRamp,
  rampGlyph,
  rampInk,
  rampStepForInk,
} from "./glyphs.js";
import { quantizePacked } from "./quantize.js";

// ─── Pen state and colour keys ────────────────────────────

/**
 * What the terminal's fg/bg are currently set to, as colour KEYS (see
 * `keyOf`). `-1` means "unknown" — the state at the start of every row, so the
 * first cell always emits its colours in full and no row can inherit a pen from
 * the row above it.
 */
interface Pen {
  fg: number;
  bg: number;
}

const NO_PEN = -1;

/**
 * SNAP a requested colour onto the palette this mode can actually show, packed
 * as 0xRRGGBB — which is simultaneously its ELISION KEY.
 *
 * Two jobs, deliberately fused, because separating them is what let them drift:
 *
 * 1. Elision must compare what is actually emitted, not what was requested. In
 *    256-colour mode — the mode Apple Terminal is hard-capped to — neighbouring
 *    cells routinely differ by a level or two of RGB and land on the SAME
 *    palette entry; keying on raw RGB would re-emit an escape that changes
 *    nothing. Keying on the snapped colour elides those, which is most of the
 *    measured byte win on photographs.
 *
 * 2. The IMAGE palette rules have to reach the screen. `quantizePacked` carries
 *    both of them — the 256-colour chroma floor and the DIN99d 16-colour search
 *    — and `dither.ts` diffuses error against exactly this function. Before
 *    this, `paintCell` handed raw means to `colors.ts`, whose `rgbTo256` has no
 *    floor and whose `rgbTo16` matches on plain RGB distance, so the ditherer
 *    corrected toward one colour and the terminal painted another, and the
 *    DIN99d search reached nothing at all.
 *
 * Emitting the SNAPPED colour keeps `colors.ts` as the one place that writes an
 * SGR: every palette entry is a fixed point of `colors.ts`'s own search (pinned
 * by test), so `fgColorRgb(snapped)` re-derives the very index this chose.
 *
 * Under "none" no SGR is emitted at all, so every colour collapses to one
 * constant key: every escape elides and the tier's glyphs carry the picture.
 */
function keyOf(mode: ColorMode, r: number, g: number, b: number): number {
  return mode === "none" ? 0 : quantizePacked(r, g, b, mode);
}

/** Unpack a {@link keyOf} result into a caller-owned scratch colour. */
function unkey(key: number, into: RGB): RGB {
  into.r = (key >> 16) & 0xff;
  into.g = (key >> 8) & 0xff;
  into.b = key & 0xff;
  return into;
}

/** Clamp/round to a byte. Mirrors `clamp8` in colors.ts so keys and emitted
 *  truecolor parameters cannot disagree on a fractional channel mean. */
function c8(v: number): number {
  return v > 0 ? (v < 255 ? Math.round(v) : 255) : 0;
}

/** Scratch colours for unpacking keys on the way to the emitter. Two, so the
 *  combined fg+bg form can never be handed the same object twice. */
const PEN_FG: RGB = { r: 0, g: 0, b: 0 };
const PEN_BG: RGB = { r: 0, g: 0, b: 0 };

/**
 * Emit the escape for a cell needing BOTH pens, skipping whatever is already
 * set. Returns "" when the cell inherits both — the common case inside a run.
 */
function paintPair(pen: Pen, fgKey: number, bgKey: number): string {
  const needFg = fgKey !== pen.fg;
  const needBg = bgKey !== pen.bg;
  if (!needFg && !needBg) return "";
  pen.fg = fgKey;
  pen.bg = bgKey;
  // Both changed: one combined CSI is ~6-10% fewer bytes than two and, more
  // importantly, one parse instead of two on the receiving terminal.
  if (needFg && needBg) return cellColorRgb(unkey(fgKey, PEN_FG), unkey(bgKey, PEN_BG));
  if (needFg) {
    unkey(fgKey, PEN_FG);
    return fgColorRgb(PEN_FG.r, PEN_FG.g, PEN_FG.b);
  }
  unkey(bgKey, PEN_BG);
  return bgColorRgb(PEN_BG.r, PEN_BG.g, PEN_BG.b);
}

/**
 * Emit only a background. Used for every cell whose glyph is a SPACE: a space
 * paints no ink, so the foreground pen is irrelevant and deliberately left
 * ALONE — a run of flat cells between two same-coloured textured cells then
 * costs one escape instead of three.
 */
function paintBg(pen: Pen, bgKey: number): string {
  if (bgKey === pen.bg) return "";
  pen.bg = bgKey;
  unkey(bgKey, PEN_BG);
  return bgColorRgb(PEN_BG.r, PEN_BG.g, PEN_BG.b);
}

/**
 * Emit only a foreground. Used by the single-colour tiers (shading, braille),
 * which never set a background and so let the terminal's own background show
 * through the unpainted part of the glyph.
 */
function paintFg(pen: Pen, fgKey: number): string {
  if (fgKey === pen.fg) return "";
  pen.fg = fgKey;
  unkey(fgKey, PEN_FG);
  return fgColorRgb(PEN_FG.r, PEN_FG.g, PEN_FG.b);
}

// ─── Luminance ────────────────────────────────────────────

/** Rec.601 luma in 0..255. The ramp tiers and the braille threshold both need
 *  a single intensity per sample; 601 is the standard weighting for it. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ─── Ramps ────────────────────────────────────────────────

/**
 * Compile a ramp, rejecting any charset that would break the width invariant.
 *
 * `charset` comes from user config, so it can contain an emoji (width 2), a CJK
 * character (width 2), a combining mark (width 0) or a control character
 * (width 0). Any of those makes the emitted row measure wrong, which corrupts
 * centring and trips `truncateLine`. One `stringWidth` call per ramp entry, once
 * per render — not per cell — buys a hard guarantee.
 */
function safeRamp(charset: string | undefined, fallback: string): readonly string[] {
  if (charset === undefined || charset.length === 0) return compileRamp(fallback);
  const cells = compileRamp(charset);
  for (let i = 0; i < cells.length; i++) {
    if (stringWidth(cells[i]) !== 1) return compileRamp(fallback);
  }
  return cells;
}

// ─── Braille thresholding ─────────────────────────────────

/**
 * Otsu's threshold over the grid's luminance histogram.
 *
 * Braille is a 1-BIT tier: eight dots share one foreground and the unlit area
 * shows a terminal background nobody chose. Its only good use is line art, and
 * line art is bimodal (ink vs paper) with a wildly unbalanced area split — a
 * plot is ~95% background. Otsu maximises between-class variance, so it lands
 * between the two modes regardless of that imbalance, where a fixed 50% or a
 * min/max midpoint both drift with exposure.
 *
 * Returns 255 for a degenerate (single-valued) histogram, which lights no dot
 * at all: a flat image genuinely has no structure to draw, and an arbitrary
 * split of it would be pure noise.
 */
function otsuThreshold(data: Uint8ClampedArray, samples: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < samples; i++) {
    const o = i * 4;
    hist[c8(luma(data[o], data[o + 1], data[o + 2]))]++;
  }

  let total = 0;
  for (let t = 0; t < 256; t++) total += t * hist[t];

  let sumB = 0;
  let weightB = 0;
  let bestVariance = 0;
  let threshold = 255;
  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = samples - weightB;
    if (weightF === 0) break;
    sumB += t * hist[t];
    const meanDelta = sumB / weightB - (total - sumB) / weightF;
    const variance = weightB * weightF * meanDelta * meanDelta;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

// ─── The renderer ─────────────────────────────────────────

/**
 * Render a resampled sub-cell grid to ANSI rows — one string per terminal row,
 * each EXACTLY `grid.cols` display columns wide and each terminated by `reset`.
 *
 * ALIGNMENT IS NOT APPLIED HERE. Rows come back at exactly `grid.cols` columns
 * with no leading or trailing pad; `opts.align` is the caller's business
 * (Image.ts pads to the block's available width, which this module has no
 * knowledge of). Padding here would double up with that and mis-centre.
 *
 * ALSO NOT APPLIED HERE, by design, because each belongs to an earlier stage
 * that owns the pixels: `opts.invert` (resample.ts composites it), `opts.dither`
 * (dither.ts mutates the grid before fitting — dithering after glyph fitting
 * would be corrected away by the two-colour means), `opts.background`
 * (resample.ts composites alpha against it), `opts.width` / `opts.height` /
 * `opts.fit` / `opts.maxHeight` (geometry decided the grid's dimensions).
 * The only option read here is `opts.charset`, which overrides the ramp for the
 * two ramp tiers.
 *
 * @param grid  Sub-cell RGBA, alpha already composited, sized for `tier`.
 * @param tier  Which technique to emit. NOT "alt" — see `renderAltBox`.
 * @param opts  Public per-block options; only `charset` is consumed.
 * @param _theme Reserved. The grid's colours are absolute by this point (the
 *               theme background was already composited under alpha upstream),
 *               so nothing here is theme-dependent.
 * @throws RangeError if the grid's sub-cell dimensions do not match the tier's
 *               sampling factor, or for tier "alt". Both are geometry bugs that
 *               would otherwise surface as a silently smeared or mis-sized
 *               image rather than as a stack trace.
 */
export function renderCells(
  grid: SubCellGrid,
  tier: ImageTier,
  opts: ImageRenderOptions = {},
  _theme?: Theme,
): string[] {
  if (tier === "alt") {
    throw new RangeError("renderCells cannot emit the alt tier — use renderAltBox()");
  }

  const { cols, rows, subW, subH, data } = grid;
  const factor = subCellFactor(tier);
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    subW !== cols * factor.x ||
    subH !== rows * factor.y
  ) {
    throw new RangeError(
      `grid ${subW}x${subH} does not match tier "${tier}" (${factor.x}x${factor.y}) ` +
        `for ${cols}x${rows} cells`,
    );
  }
  if (data.length < subW * subH * 4) {
    throw new RangeError(`grid data is ${data.length} bytes, need ${subW * subH * 4}`);
  }
  if (rows <= 0) return [];
  // A zero-width image is still `rows` rows tall. Returning fewer would shift
  // every FocusRect below it — the same defect §3.3 documents for the height
  // estimator, and the reason all four image states must agree on row count.
  if (cols <= 0) return new Array(rows).fill(reset) as string[];

  // Read ONCE. `colorMode` is a module-level `let` that runtime.ts swaps per
  // render for per-SSH-session colour; it cannot change inside this synchronous
  // call, and re-reading it per cell would cost a call per pen.
  const mode = getColorMode();

  // Under "none" no SGR is emitted at all, so every colour key collapses to 0.
  // Folding a cell to a space "because its two pens are equal" would then blank
  // the ENTIRE image instead of leaving the glyph shapes visible.
  const foldEqualPens = mode !== "none";

  const out: string[] = new Array(rows) as string[];
  const pen: Pen = { fg: NO_PEN, bg: NO_PEN };

  switch (tier) {
    case "quadrant": {
      // Four scratch colours reused for every cell. `fitQuadrant` only reads
      // them and returns freshly allocated pens, so nothing can alias — this
      // saves 5 allocations per cell (20k cells at the maxCells ceiling).
      const quad: RGB[] = [
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
      ];
      for (let y = 0; y < rows; y++) {
        pen.fg = NO_PEN;
        pen.bg = NO_PEN;
        let row = "";
        const top = y * 2 * subW;
        const bottom = top + subW;
        for (let x = 0; x < cols; x++) {
          const sx = x * 2;
          read(data, (top + sx) * 4, quad[0]);
          read(data, (top + sx + 1) * 4, quad[1]);
          read(data, (bottom + sx) * 4, quad[2]);
          read(data, (bottom + sx + 1) * 4, quad[3]);
          const cell = fitQuadrant(quad);
          row += paintCell(pen, mode, cell.ch, cell.fg, cell.bg, foldEqualPens);
        }
        out[y] = row + reset;
      }
      break;
    }

    case "half": {
      const top = { r: 0, g: 0, b: 0 };
      const bottom = { r: 0, g: 0, b: 0 };
      for (let y = 0; y < rows; y++) {
        pen.fg = NO_PEN;
        pen.bg = NO_PEN;
        let row = "";
        const upper = y * 2 * subW;
        const lower = upper + subW;
        for (let x = 0; x < cols; x++) {
          read(data, (upper + x) * 4, top);
          read(data, (lower + x) * 4, bottom);
          const cell = fitHalf(top, bottom);
          row += paintCell(pen, mode, cell.ch, cell.fg, cell.bg, foldEqualPens);
        }
        out[y] = row + reset;
      }
      break;
    }

    case "solid": {
      // The one tier that needs zero font coverage: a space carrying only a
      // background. No fitting to do — the sub-cell IS the cell.
      const c = { r: 0, g: 0, b: 0 };
      for (let y = 0; y < rows; y++) {
        pen.fg = NO_PEN;
        pen.bg = NO_PEN;
        let row = "";
        const base = y * subW;
        for (let x = 0; x < cols; x++) {
          read(data, (base + x) * 4, c);
          row += paintBg(pen, keyOf(mode, c.r, c.g, c.b)) + SOLID_GLYPH;
        }
        out[y] = row + reset;
      }
      break;
    }

    case "shading": {
      // A foreground-only cell shows `coverage x pen`, so painting the pixel's
      // own colour into a partly-inked glyph reproduces luminance SQUARED — the
      // tier measured a mean luminance of 37 against the source's 81 and read
      // as an almost-black rectangle. Pick the sparsest step whose ink can
      // still carry the pixel, then scale the pen up by 1/coverage so the
      // product comes back to the pixel. Hue is preserved because all three
      // channels take the same scale.
      //
      // The unpainted area is modelled as BLACK, which is what a terminal
      // showing a dark theme gives. It is deliberately not composited against
      // `theme.background`: this tier emits no background precisely so the
      // page shows through, and the page's real colour is the terminal's
      // default, which nothing here can read.
      const ramp = safeRamp(opts.charset, SHADING_RAMP);
      const ink = rampInk(ramp);
      const c = { r: 0, g: 0, b: 0 };
      for (let y = 0; y < rows; y++) {
        pen.fg = NO_PEN;
        pen.bg = NO_PEN;
        let row = "";
        const base = y * subW;
        for (let x = 0; x < cols; x++) {
          read(data, (base + x) * 4, c);
          const peak = c.r > c.g ? (c.r > c.b ? c.r : c.b) : c.g > c.b ? c.g : c.b;
          const step = rampStepForInk(ink, peak / 255);
          const ch = ramp[step];
          const coverage = ink[step];
          // A blank ramp step paints nothing, so it needs no foreground and
          // must not disturb the pen.
          if (coverage <= 0 || ch === SOLID_GLYPH) {
            row += ch;
            continue;
          }
          // `peak * s <= 255` by construction of `rampStepForInk`, except on
          // the fallback branch where the ramp ran out; the min keeps the pen
          // inside the gamut there instead of clipping one channel and
          // shifting the hue.
          const s = Math.min(1 / coverage, peak > 0 ? 255 / peak : 1);
          row += paintFg(pen, keyOf(mode, c.r * s, c.g * s, c.b * s)) + ch;
        }
        out[y] = row + reset;
      }
      break;
    }

    case "ascii": {
      // No colour at all — this tier exists for colorMode "none", NO_COLOR and
      // non-TTY output. The trailing `reset` is kept anyway so the "every row
      // ends with reset" invariant is uniform across tiers and testable as one
      // rule; under "none" it is the empty string and costs nothing.
      const ramp = safeRamp(opts.charset, ASCII_RAMP);
      for (let y = 0; y < rows; y++) {
        let row = "";
        const base = y * subW;
        for (let x = 0; x < cols; x++) {
          const o = (base + x) * 4;
          row += rampGlyph(ramp, luma(data[o], data[o + 1], data[o + 2]) / 255);
        }
        out[y] = row + reset;
      }
      break;
    }

    case "braille": {
      const threshold = otsuThreshold(data, subW * subH);
      const lit: boolean[] = [false, false, false, false, false, false, false, false];
      const ink = { r: 0, g: 0, b: 0 };
      for (let y = 0; y < rows; y++) {
        pen.fg = NO_PEN;
        pen.bg = NO_PEN;
        let row = "";
        const base = y * 4 * subW;
        for (let x = 0; x < cols; x++) {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let n = 0;
          for (let dy = 0; dy < 4; dy++) {
            const line = base + dy * subW + x * 2;
            for (let dx = 0; dx < 2; dx++) {
              const o = (line + dx) * 4;
              const r = data[o];
              const g = data[o + 1];
              const b = data[o + 2];
              const on = luma(r, g, b) > threshold;
              lit[dy * 2 + dx] = on;
              if (on) {
                sr += r;
                sg += g;
                sb += b;
                n++;
              }
            }
          }
          const mask = brailleMask(lit);
          if (mask === 0) {
            // Nothing is painted, so no foreground is needed and the pen is left
            // alone — on line art, which is mostly empty, this is where nearly
            // all of the byte saving comes from. U+2800 rather than a space so
            // the tier's output stays inside one assertable codepoint range.
            row += brailleGlyph(0);
            continue;
          }
          // The lit dots are the only thing visible; averaging the unlit ones in
          // would drag the ink toward the paper colour and wash out thin lines.
          ink.r = sr / n;
          ink.g = sg / n;
          ink.b = sb / n;
          row += paintFg(pen, keyOf(mode, ink.r, ink.g, ink.b)) + brailleGlyph(mask);
        }
        out[y] = row + reset;
      }
      break;
    }
  }

  return out;
}

/** Copy one RGBA sample into a scratch colour, dropping alpha (already
 *  composited by resample.ts — `SubCellGrid.data` is opaque by contract). */
function read(data: Uint8ClampedArray, offset: number, into: RGB): void {
  into.r = data[offset];
  into.g = data[offset + 1];
  into.b = data[offset + 2];
}

/**
 * Emit one two-colour cell: the escapes it still needs, then its glyph.
 *
 * Folds to "background only, painted with a space" in two cases — when the
 * fitter already chose a space, and when both pens survive quantization as the
 * SAME colour (very common at 16 colours, and not rare at 256). The second fold
 * is not just a byte saving: the glyph would be invisible either way, and a
 * space needs no font coverage and can never be classified East Asian Ambiguous
 * and doubled in width under a CJK locale.
 */
function paintCell(
  pen: Pen,
  mode: ColorMode,
  ch: string,
  fg: RGB,
  bg: RGB,
  foldEqualPens: boolean,
): string {
  const bgKey = keyOf(mode, bg.r, bg.g, bg.b);
  if (ch === SOLID_GLYPH) return paintBg(pen, bgKey) + SOLID_GLYPH;
  const fgKey = keyOf(mode, fg.r, fg.g, fg.b);
  if (foldEqualPens && fgKey === bgKey) return paintBg(pen, bgKey) + SOLID_GLYPH;
  return paintPair(pen, fgKey, bgKey) + ch;
}

// ─── Alt-text box ─────────────────────────────────────────

/** Anything in this range is either stripped by `runtime-terminal.ts` (C0, DEL)
 *  or can rewrite the rest of the line (ESC). Alt text is author-supplied, so
 *  it is scrubbed before it is measured — stripping AFTER measuring is exactly
 *  how a box ends up a column short. */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/**
 * Render a bordered alt-text box of EXACTLY `geo.rows` rows by `geo.cols`
 * columns.
 *
 * Used for every non-pixel state: decode failed, format unsupported, source
 * over budget, decode not yet resolved. The row count is fixed by the caller
 * (from the image header, before any pixel is decoded) so the box and the
 * eventual image occupy identical space and nothing reflows when the pixels
 * land.
 *
 * The label is TRUNCATED, not just padded. The placeholder this replaces padded
 * only, and measured 25-66 columns wide inside a 20-column allocation, which
 * blows through `truncateLine` and shears every row it is composed with.
 *
 * Degrades rather than fails on a box too small to draw: under 3 rows or 4
 * columns there is no room for a frame, so the label is emitted alone, still at
 * exactly the requested geometry.
 *
 * @param border Glyph set for the box. The caller passes the SAME style its
 *   successful render would frame with — hardcoding "rounded" here made a
 *   block's border change shape the moment its asset went missing.
 */
export function renderAltBox(
  alt: string,
  geo: CellGeometry,
  theme: Theme,
  border?: BorderStyle,
): string[] {
  const cols = Math.max(0, Math.floor(geo.cols));
  const rows = Math.max(0, Math.floor(geo.rows));
  if (rows === 0) return [];
  // A zero-width box is still `rows` rows of nothing — returning fewer would
  // shift every block below it.
  if (cols === 0) return new Array(rows).fill(reset) as string[];

  const label = alt.replace(CONTROL_CHARS, "").trim();
  const edge = fgColor(theme.border);
  const muted = fgColor(theme.muted);
  const out: string[] = [];

  if (rows < 3 || cols < 4) {
    const middle = (rows - 1) >> 1;
    for (let y = 0; y < rows; y++) {
      out.push(y === middle ? muted + centred(label, cols) + reset : " ".repeat(cols) + reset);
    }
    return out;
  }

  const chars = getBorderChars(border === "none" ? "rounded" : border);
  const inner = cols - 2;
  const labelRow = (rows - 2 - 1) >> 1;

  out.push(edge + chars.topLeft + chars.horizontal.repeat(inner) + chars.topRight + reset);
  for (let y = 0; y < rows - 2; y++) {
    const body =
      y === labelRow && label.length > 0
        ? muted + centred(label, inner, inner - 2) + reset
        : " ".repeat(inner);
    out.push(edge + chars.vertical + reset + body + edge + chars.vertical + reset);
  }
  out.push(edge + chars.bottomLeft + chars.horizontal.repeat(inner) + chars.bottomRight + reset);

  return out;
}

/**
 * Truncate `text` to fit and centre it in exactly `width` display columns.
 *
 * `budget` is the width the text itself may occupy (one column narrower than
 * the box on each side, so the label never touches the frame); it falls back to
 * the full width on a box too narrow to afford the breathing room. `truncate()`
 * appends an ellipsis and a reset when it cuts, so the result is measured with
 * `stringWidth` rather than assumed.
 */
function centred(text: string, width: number, budget = width): string {
  if (width <= 0) return "";
  const room = budget >= 1 && budget <= width ? budget : width;
  const shown = text.length > 0 ? truncate(text, room) : "";
  const pad = width - stringWidth(shown);
  if (pad <= 0) return shown;
  const left = pad >> 1;
  return " ".repeat(left) + shown + " ".repeat(pad - left);
}
