#!/usr/bin/env node
/**
 * Image quality harness — numerical validation of the cell rendering engine.
 *
 * NOT A TEST SUITE, and deliberately not discovered by `test/run-all.ts`: its
 * glob takes `test-*.ts` and `*.test.ts` (run-all.ts `shouldRun`), and
 * `image-quality-harness.ts` matches neither. This is a measurement tool — it
 * decodes real photographs, renders them through every tier at every colour
 * mode and prints a table. Run it by hand:
 *
 *   npx tsx test/image-quality-harness.ts
 *   npx tsx test/image-quality-harness.ts --width 80
 *   npx tsx test/image-quality-harness.ts --width 40 path/to/other.png
 *
 * WHY IT EXISTS. "Does the image look right" cannot be eyeballed at six tiers
 * times four colour modes; a human spots a transposed sub-cell or an inverted
 * mask, and nothing else. The quality ordering, on the other hand, is a hard
 * prediction: quadrant carries 4 sub-samples per cell, half carries 2, solid
 * carries 1, so quadrant MUST beat half and half MUST beat solid. If it does
 * not, something in the fitter, the emitter or the quantizer is wrong and the
 * number says so. Exit code is non-zero when that ordering breaks or when a
 * rendered row fails a structural invariant.
 *
 * ─── METHODOLOGY (the part that decides whether the numbers mean anything) ───
 *
 * 1. RECONSTRUCTION IS PARSED BACK OUT OF THE ANSI, not read from the fitter.
 *    Every row is re-parsed as SGR: pen state is tracked exactly as a terminal
 *    would, palette indices are mapped back through `ansi256ToRgb` /
 *    `ansi16ToRgb`, and each cell yields (glyph, fg, bg). That measures the
 *    WHOLE pipeline — resample, dither, glyph fit, quantization, run elision —
 *    rather than the fitter's opinion of itself. An elision bug that dropped a
 *    needed escape would show up here as a colour smear, and in the fitter's
 *    own numbers not at all.
 *
 * 2. EVERY TIER IS SCORED ON ONE COMMON LATTICE: 2 sub-columns by 4 sub-rows
 *    per cell (the LCM of the tiers' sub-cell factors — 2x2, 1x2, 2x4, 1x1).
 *    This is not a detail, it is the whole comparison. Scoring each tier at its
 *    OWN sub-cell resolution flatters the coarse tiers to the point of
 *    nonsense: a solid cell reproduces a 1x1 reference exactly, so it would
 *    score near-infinite PSNR and "beat" quadrant. The harness measures that
 *    control explicitly and prints it, so the choice is justified by a number
 *    rather than by assertion.
 *
 * 3. GLYPH COVERAGE IS PAINTED, NOT ASSUMED. Quadrant, half, solid and braille
 *    have exact sub-cell bitmaps (`GLYPH_COVERAGE`, `BRAILLE_DOT_BIT`), so
 *    their reconstruction is exact. The two ramp tiers do not: a "#" covers
 *    some fraction of its cell and that fraction is font-dependent, so their
 *    rows use an approximate areal-coverage table (`GLYPH_INK`) — exact for the
 *    four Unicode shade blocks, estimated for ASCII. Their absolute dB
 *    therefore carries a modelling assumption; the block tiers' do not.
 *
 * 4. BRAILLE IS MODELLED HONESTLY. A braille dot is a small disc with
 *    whitespace around it, not a filled sub-cell, and the unlit area shows a
 *    terminal background nobody chose. Both are modelled (`BRAILLE_DOT_FILL`),
 *    which is why braille scores below a one-colour solid block — as the
 *    exploration predicted. Modelling dots as filled squares would inflate it.
 *
 * 5. TWO ERROR METRICS. Raw RMSE/PSNR is per-pixel. Blurred PSNR applies a 5x5
 *    binomial kernel to both sides first, which is what the eye does and the
 *    only metric under which dithering can win — nearest-neighbour quantization
 *    minimises raw error BY CONSTRUCTION, so a raw-only table would report that
 *    dithering makes things worse, every time, and be useless.
 */

import { resolve } from "node:path";

import { decodeImage, readHeader } from "../src/image/decode.js";
import { imageCellSize, subCellGridSize } from "../src/image/geometry.js";
import { resampleToGrid } from "../src/image/resample.js";
import { ditherGrid, resolveDither } from "../src/image/dither.js";
import { renderCells } from "../src/image/render.js";
import {
  ASCII_RAMP,
  BRAILLE_BASE,
  BRAILLE_DOT_BIT,
  GLYPH_COVERAGE,
  HALF_UPPER,
  SHADING_RAMP,
  SOLID_GLYPH,
} from "../src/image/glyphs.js";
import type { ColorMode } from "../src/style/colors.js";
import {
  ansi16ToRgb,
  ansi256ToRgb,
  bgColorRgb,
  cellColorRgb,
  fgColorRgb,
  getColorMode,
  hexToRgb,
  reset,
  rgbTo16,
  rgbTo256,
  setColorMode,
} from "../src/style/colors.js";
import { defaultTheme } from "../src/style/theme.js";
import type { ImageDither, ImageTier, PixelBuffer, RGB, SubCellGrid } from "../src/image/types.js";
import { subCellFactor } from "../src/image/types.js";

// ─── Configuration ────────────────────────────────────────

/** Sub-columns per cell on the common scoring lattice. LCM of the tiers' x factors (1, 2). */
const REF_X = 2;
/** Sub-rows per cell on the common scoring lattice. LCM of the tiers' y factors (1, 2, 4). */
const REF_Y = 4;

/**
 * Areal fill of a braille dot inside its sub-cell.
 *
 * A dot is a disc with padding around it, not a filled square. 0.55 is the
 * figure the exploration used and is consistent with the dot geometry of the
 * common braille faces; it is the single assumption that makes braille's score
 * meaningful rather than flattering.
 */
const BRAILLE_DOT_FILL = 0.55;

/**
 * Approximate ink coverage per ramp glyph, 0..1.
 *
 * EXACT for the four shade blocks — U+2591/2592/2593/2588 are defined as 25%,
 * 50%, 75% and 100% fill. ESTIMATED for the ASCII glyphs, which vary by
 * typeface; they are ordered correctly and roughly correct in magnitude, which
 * is enough to expose the ramps' non-linear transfer but not enough to treat
 * their absolute dB as exact.
 */
const GLYPH_INK: ReadonlyMap<string, number> = new Map<string, number>([
  [" ", 0],
  ["·", 0.04],
  [":", 0.08],
  ["░", 0.25],
  ["▒", 0.5],
  ["▓", 0.75],
  ["█", 1],
  [".", 0.04],
  ["-", 0.09],
  ["=", 0.15],
  ["+", 0.16],
  ["*", 0.2],
  ["#", 0.4],
  ["%", 0.38],
  ["@", 0.62],
]);

const TIERS: readonly ImageTier[] = ["quadrant", "half", "solid", "shading", "ascii", "braille"];
const MODES: readonly ColorMode[] = ["truecolor", "256", "16"];

/**
 * Glyphs each tier is allowed to emit, as an independent cross-check of the
 * fitter's claim that complement masks are unreachable (a quadrant mask and its
 * complement always score identically, so the tie-break keeps the low-ink one).
 * The space is reachable in EVERY colour tier because `render.ts` folds a cell
 * whose two pens survive quantization as one colour into a bare background.
 */
const GLYPH_ALLOWLIST: Partial<Record<ImageTier, string>> = {
  quadrant: " ▘▝▀▖▌▞▗",
  half: " ▀",
  solid: " ",
  shading: SHADING_RAMP,
  ascii: ASCII_RAMP,
};

const DEFAULT_SOURCES = ["assets/recordings/og-image.png", "assets/recordings/devto-cover.png"];
const DEFAULT_WIDTH = 60;

/** Published predictions from devnotes/terminal-image-rendering-exploration.md §4.1. */
const PREDICTED = {
  /** fg+bg half block over fg-only. */
  halfOverFgOnly: 3.17,
  /** fg-only half block, which the report measured as identical to solid. */
  fgOnlyAbsolute: 20.09,
  /** quadrant over half. */
  quadrantOverHalf: 0.63,
};

/** dB below which two tiers are called tied rather than ordered. */
const ORDERING_EPSILON = 0.01;

// ─── Tiny assertion tracker ───────────────────────────────

let checksPassed = 0;
let checksFailed = 0;

function check(ok: boolean, name: string, detail = ""): void {
  if (ok) {
    checksPassed++;
    return;
  }
  checksFailed++;
  console.error(`    FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

// ─── SGR parsing ──────────────────────────────────────────

/** One cell as the terminal would hold it. `null` means "terminal default". */
interface ParsedCell {
  ch: string;
  fg: RGB | null;
  bg: RGB | null;
}

/**
 * Replay a rendered row through a minimal SGR machine and return its cells.
 *
 * Only the forms the emitter can produce are accepted — `0`, `39`/`49`, the
 * sixteen fg/bg codes, `38;5;n` / `48;5;n` and `38;2;r;g;b` / `48;2;r;g;b`,
 * including the combined fg+bg CSI. Anything else throws rather than being
 * skipped: a silently ignored parameter would show up as a plausible-looking
 * quality number instead of as a bug.
 */
function parseRow(row: string, mode: ColorMode): ParsedCell[] {
  const cells: ParsedCell[] = [];
  let fg: RGB | null = null;
  let bg: RGB | null = null;
  let i = 0;

  while (i < row.length) {
    if (row[i] === "\x1b") {
      if (row[i + 1] !== "[") throw new Error(`non-CSI escape at ${i} in row`);
      const end = row.indexOf("m", i);
      if (end < 0) {
        throw new Error(`unterminated CSI at ${i} — emitter produced a non-SGR sequence`);
      }
      const params = row
        .slice(i + 2, end)
        .split(";")
        .map(p => (p === "" ? 0 : Number(p)));
      let p = 0;
      while (p < params.length) {
        const code = params[p];
        if (code === 0) {
          fg = null;
          bg = null;
          p++;
        } else if (code === 39) {
          fg = null;
          p++;
        } else if (code === 49) {
          bg = null;
          p++;
        } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          fg = ansi16ToRgb(code);
          p++;
        } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
          bg = ansi16ToRgb(code);
          p++;
        } else if (code === 38 || code === 48) {
          const kind = params[p + 1];
          let colour: RGB;
          if (kind === 5) {
            colour = ansi256ToRgb(params[p + 2]);
            p += 3;
          } else if (kind === 2) {
            colour = { r: params[p + 2], g: params[p + 3], b: params[p + 4] };
            p += 5;
          } else {
            throw new Error(`unsupported ${code};${kind} colour form`);
          }
          if (code === 38) fg = colour;
          else bg = colour;
        } else {
          throw new Error(`unexpected SGR parameter ${code} in ${mode} mode`);
        }
      }
      i = end + 1;
      continue;
    }
    const cp = row.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    cells.push({ ch, fg, bg });
    i += ch.length;
  }

  return cells;
}

// ─── Reconstruction ───────────────────────────────────────

/**
 * Paint the parsed cells onto the common lattice, one flat colour per sub-cell.
 *
 * `ink` is the terminal's default foreground and `paper` its default
 * background: the single-colour tiers (shading, ascii, braille) deliberately
 * emit no background, so what the viewer actually sees behind their glyphs is
 * the terminal's own colour, and modelling it as anything else would credit
 * those tiers with information they never sent.
 *
 * @returns RGB triples, length `cols * REF_X * rows * REF_Y * 3`.
 */
function reconstruct(
  parsed: ParsedCell[][],
  tier: ImageTier,
  cols: number,
  rowCount: number,
  mode: ColorMode,
  ink: RGB,
  paper: RGB,
): Float64Array {
  const refW = cols * REF_X;
  const refH = rowCount * REF_Y;
  const out = new Float64Array(refW * refH * 3);
  const factor = subCellFactor(tier);
  const spanX = REF_X / factor.x;
  const spanY = REF_Y / factor.y;

  for (let cy = 0; cy < rowCount; cy++) {
    const cells = parsed[cy];
    check(
      cells.length === cols,
      `${tier}/${mode} row ${cy} cell count`,
      `${cells.length} != ${cols}`,
    );
    for (let cx = 0; cx < Math.min(cols, cells.length); cx++) {
      const cell = cells[cx];
      const fg = cell.fg ?? ink;
      const bg = cell.bg ?? paper;
      for (let sy = 0; sy < factor.y; sy++) {
        for (let sx = 0; sx < factor.x; sx++) {
          const colour = subCellColour(tier, cell, sx, sy, fg, bg, paper);
          paintSub(out, refW, cx, cy, sx, sy, spanX, spanY, colour);
        }
      }
    }
  }

  return out;
}

/** The colour a single sub-cell of a fitted cell actually shows on screen. */
function subCellColour(
  tier: ImageTier,
  cell: ParsedCell,
  sx: number,
  sy: number,
  fg: RGB,
  bg: RGB,
  paper: RGB,
): RGB {
  switch (tier) {
    case "quadrant": {
      const coverage = GLYPH_COVERAGE.get(cell.ch);
      if (coverage === undefined) {
        check(false, "quadrant glyph in coverage table", `saw ${JSON.stringify(cell.ch)}`);
        return bg;
      }
      return coverage.subcells[sy * 2 + sx] ? fg : bg;
    }
    case "half": {
      if (cell.ch === SOLID_GLYPH) return bg;
      if (cell.ch !== HALF_UPPER) {
        check(false, "half tier glyph allowlist", `saw ${JSON.stringify(cell.ch)}`);
        return bg;
      }
      // fg is the TOP pixel; getting this backwards flips the image vertically.
      return sy === 0 ? fg : bg;
    }
    case "solid":
      return bg;
    case "shading":
    case "ascii": {
      // Areal coverage, not a bitmap: a ramp glyph mixes ink and paper in a
      // ratio the font decides, uniformly across the cell at this scale.
      const alpha = inkCoverage(cell.ch, tier);
      return mix(cell.bg ?? paper, fg, alpha);
    }
    case "braille": {
      const mask = cell.ch.codePointAt(0)! - BRAILLE_BASE;
      const lit = (mask >> BRAILLE_DOT_BIT[sy][sx]) & 1;
      // Unlit dots show the terminal background — braille sets no bg at all.
      return lit ? mix(paper, fg, BRAILLE_DOT_FILL) : paper;
    }
    default:
      return bg;
  }
}

/** Ink fraction for a ramp glyph, falling back to the ramp's own step index. */
function inkCoverage(ch: string, tier: ImageTier): number {
  const known = GLYPH_INK.get(ch);
  if (known !== undefined) return known;
  const ramp = tier === "shading" ? SHADING_RAMP : ASCII_RAMP;
  const idx = Array.from(ramp).indexOf(ch);
  return idx < 0 ? 0 : idx / (Array.from(ramp).length - 1);
}

function mix(from: RGB, to: RGB, t: number): RGB {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/** Fill one sub-cell's rectangle of the common lattice with a flat colour. */
function paintSub(
  out: Float64Array,
  refW: number,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  spanX: number,
  spanY: number,
  colour: RGB,
): void {
  const x0 = cx * REF_X + sx * spanX;
  const y0 = cy * REF_Y + sy * spanY;
  for (let y = y0; y < y0 + spanY; y++) {
    for (let x = x0; x < x0 + spanX; x++) {
      const o = (y * refW + x) * 3;
      out[o] = colour.r;
      out[o + 1] = colour.g;
      out[o + 2] = colour.b;
    }
  }
}

// ─── Metrics ──────────────────────────────────────────────

/** Drop alpha from an RGBA grid. Alpha is already composited by resample.ts. */
function toRgbFloat(rgba: Uint8ClampedArray, samples: number): Float64Array {
  const out = new Float64Array(samples * 3);
  for (let i = 0; i < samples; i++) {
    out[i * 3] = rgba[i * 4];
    out[i * 3 + 1] = rgba[i * 4 + 1];
    out[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return out;
}

function rmse(a: Float64Array, b: Float64Array): number {
  let acc = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

/** Peak signal-to-noise in dB against an 8-bit peak. */
function psnr(err: number): number {
  return err === 0 ? Infinity : 20 * Math.log10(255 / err);
}

/**
 * How many times the 5-tap kernel is applied. `--blur N` on the command line.
 *
 * This is a real experimental knob, not a cosmetic one: ordered dithering uses
 * an 8x8 Bayer matrix, so a single 5-tap pass does not integrate a whole
 * repeat of the pattern and under-credits it. Two passes (~9 taps) do. The
 * default is one pass so the headline numbers stay comparable to the
 * exploration's; raise it to see the dither ordering change.
 */
let blurPasses = 1;

/**
 * Separable 5-tap binomial blur, edge-clamped, applied `blurPasses` times.
 *
 * The perceptual proxy: dithering trades per-pixel error for a correct LOCAL
 * MEAN, so it can only win under a metric that integrates over a neighbourhood.
 * Reporting raw error alone would rank every dither below no dither and say
 * nothing about what a viewer sees.
 */
function blur(src: Float64Array, w: number, h: number): Float64Array {
  let acc = src;
  for (let pass = 0; pass < blurPasses; pass++) acc = blurOnce(acc, w, h);
  return acc;
}

function blurOnce(src: Float64Array, w: number, h: number): Float64Array {
  const K = [1, 4, 6, 4, 1];
  const KSUM = 16;
  const tmp = new Float64Array(src.length);
  const out = new Float64Array(src.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -2; k <= 2; k++) {
          const xx = Math.min(w - 1, Math.max(0, x + k));
          acc += src[(y * w + xx) * 3 + c] * K[k + 2];
        }
        tmp[(y * w + x) * 3 + c] = acc / KSUM;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -2; k <= 2; k++) {
          const yy = Math.min(h - 1, Math.max(0, y + k));
          acc += tmp[(yy * w + x) * 3 + c] * K[k + 2];
        }
        out[(y * w + x) * 3 + c] = acc / KSUM;
      }
    }
  }
  return out;
}

// ─── Byte accounting ──────────────────────────────────────

/**
 * What the same cells would cost with SGR run elision switched OFF.
 *
 * Recomputed from the PARSED cells rather than from a second renderer, so the
 * comparison is guaranteed to describe the same pixels: every cell re-emits the
 * escape `render.ts` would emit with no pen memory (the combined CSI for a
 * two-colour cell, a single attribute for the one-colour tiers, nothing for a
 * blank glyph), through the same emitters in colors.ts. The colour mode must
 * already be set by the caller.
 */
function bytesWithoutElision(cells: ParsedCell[][], tier: ImageTier): number {
  let total = 0;
  for (const row of cells) {
    for (const cell of row) {
      total += Buffer.byteLength(cell.ch);
      const paintsInk = cell.ch !== SOLID_GLYPH && cell.ch !== "⠀";
      switch (tier) {
        case "quadrant":
        case "half":
          if (cell.bg === null) break;
          total += Buffer.byteLength(
            cell.ch === SOLID_GLYPH || cell.fg === null
              ? bgColorRgb(cell.bg.r, cell.bg.g, cell.bg.b)
              : cellColorRgb(cell.fg, cell.bg),
          );
          break;
        case "solid":
          if (cell.bg !== null) {
            total += Buffer.byteLength(bgColorRgb(cell.bg.r, cell.bg.g, cell.bg.b));
          }
          break;
        case "shading":
        case "braille":
          if (paintsInk && cell.fg !== null) {
            total += Buffer.byteLength(fgColorRgb(cell.fg.r, cell.fg.g, cell.fg.b));
          }
          break;
        case "ascii":
          break;
        default:
          break;
      }
    }
    total += Buffer.byteLength(reset);
  }
  return total;
}

/**
 * Independent check of the tiers' glyph sets, straight off the wire.
 *
 * Braille has no fixed allowlist — every one of U+2800..U+28FF is legal — so it
 * is range-checked instead. Everything else must stay inside its published set;
 * a glyph outside it is either a fitter bug or a claim in the docs that is no
 * longer true, and both matter to whoever writes emulator assertions.
 */
function checkGlyphs(parsed: ParsedCell[][], tier: ImageTier, mode: ColorMode): void {
  const allowed = GLYPH_ALLOWLIST[tier];
  for (const row of parsed) {
    for (const cell of row) {
      if (tier === "braille") {
        const cp = cell.ch.codePointAt(0)!;
        if (cp < BRAILLE_BASE || cp > BRAILLE_BASE + 0xff) {
          check(false, `${tier}/${mode} glyph in U+2800..U+28FF`, JSON.stringify(cell.ch));
          return;
        }
        continue;
      }
      if (allowed !== undefined && !allowed.includes(cell.ch)) {
        check(
          false,
          `${tier}/${mode} glyph allowlist`,
          `${JSON.stringify(cell.ch)} not in ${JSON.stringify(allowed)}`,
        );
        return;
      }
    }
  }
  checksPassed++;
}

// ─── One render ───────────────────────────────────────────

interface Measurement {
  tier: ImageTier;
  mode: ColorMode;
  dither: ImageDither;
  psnr: number;
  rmse: number;
  blurPsnr: number;
  bytes: number;
  naive: number;
  cells: number;
}

interface Job {
  pixels: PixelBuffer;
  cols: number;
  rows: number;
  background: RGB;
  ink: RGB;
  reference: Float64Array;
  referenceBlur: Float64Array;
}

/**
 * Render one (tier, mode, dither) combination and score it.
 *
 * Mirrors `renderBody` in src/components/Image.ts exactly — resample, clone,
 * dither, emit — minus the two cache layers, which would return another
 * combination's rows and are irrelevant to fidelity.
 */
function measure(job: Job, tier: ImageTier, mode: ColorMode, dither: ImageDither): Measurement {
  const previous = getColorMode();
  setColorMode(mode);
  try {
    const geom = { cols: job.cols, rows: job.rows };
    const { subW, subH } = subCellGridSize(geom, tier);
    const data = resampleToGrid(job.pixels, subW, subH, { background: job.background });
    const grid: SubCellGrid = { data, subW, subH, cols: job.cols, rows: job.rows, tier };
    if (resolveDither(dither, mode) !== "none") {
      ditherGrid(grid.data, subW, subH, mode, dither);
    }

    const rows = renderCells(grid, tier, {}, defaultTheme);
    check(rows.length === job.rows, `${tier}/${mode} row count`, `${rows.length} != ${job.rows}`);
    for (const row of rows) {
      if (!row.endsWith(reset)) {
        check(false, `${tier}/${mode} row terminated by reset`);
        break;
      }
    }

    // Parsed ONCE and shared: the reconstruction, the glyph allowlist and the
    // no-elision byte model must all describe the same cells, or the table
    // would silently compare three different renderings.
    const parsed = rows.map(row => parseRow(row, mode));
    const recon = reconstruct(parsed, tier, job.cols, job.rows, mode, job.ink, job.background);
    checkGlyphs(parsed, tier, mode);
    const refW = job.cols * REF_X;
    const refH = job.rows * REF_Y;
    const err = rmse(recon, job.reference);
    const blurErr = rmse(blur(recon, refW, refH), job.referenceBlur);

    const bytes = rows.reduce((sum, row) => sum + Buffer.byteLength(row), 0);
    const naive = bytesWithoutElision(parsed, tier);
    check(
      bytes <= naive,
      `${tier}/${mode} elision never costs bytes`,
      `elided ${bytes} > naive ${naive}`,
    );

    return {
      tier,
      mode,
      dither,
      psnr: psnr(err),
      rmse: err,
      blurPsnr: psnr(blurErr),
      bytes,
      naive,
      cells: job.cols * job.rows,
    };
  } finally {
    setColorMode(previous);
  }
}

/**
 * The legacy fg-only half block, modelled: one SGR foreground per cell, glyph
 * `▀`, and no background — so the cell reads as a single flat colour and the
 * glyph carries no information at all. Reconstructed on the same lattice as
 * everything else, which is what makes the delta against the real fg+bg half
 * block comparable to the exploration's +3.17 dB prediction.
 */
function measureFgOnlyHalf(job: Job, mode: ColorMode): Measurement {
  const previous = getColorMode();
  setColorMode(mode);
  try {
    const { subW, subH } = subCellGridSize({ cols: job.cols, rows: job.rows }, "half");
    const data = resampleToGrid(job.pixels, subW, subH, { background: job.background });

    const refW = job.cols * REF_X;
    const refH = job.rows * REF_Y;
    const recon = new Float64Array(refW * refH * 3);
    let bytes = 0;
    let naive = 0;
    for (let cy = 0; cy < job.rows; cy++) {
      let previousKey = -1;
      for (let cx = 0; cx < job.cols; cx++) {
        const top = (cy * 2 * subW + cx) * 4;
        const bottom = ((cy * 2 + 1) * subW + cx) * 4;
        const flat = quantizeThrough(
          {
            r: (data[top] + data[bottom]) / 2,
            g: (data[top + 1] + data[bottom + 1]) / 2,
            b: (data[top + 2] + data[bottom + 2]) / 2,
          },
          mode,
        );
        paintSub(recon, refW, cx, cy, 0, 0, REF_X, REF_Y, flat.rgb);
        const escape = Buffer.byteLength(fgColorRgb(flat.rgb.r, flat.rgb.g, flat.rgb.b));
        naive += escape;
        if (flat.key !== previousKey) {
          bytes += escape;
          previousKey = flat.key;
        }
        bytes += Buffer.byteLength(HALF_UPPER);
        naive += Buffer.byteLength(HALF_UPPER);
      }
      bytes += Buffer.byteLength(reset);
      naive += Buffer.byteLength(reset);
    }

    const err = rmse(recon, job.reference);
    const blurErr = rmse(blur(recon, refW, refH), job.referenceBlur);
    return {
      tier: "half",
      mode,
      dither: "none",
      psnr: psnr(err),
      rmse: err,
      blurPsnr: psnr(blurErr),
      bytes,
      naive,
      cells: job.cols * job.rows,
    };
  } finally {
    setColorMode(previous);
  }
}

/** The colour the terminal will genuinely display for `c`, plus its palette key. */
function quantizeThrough(c: RGB, mode: ColorMode): { rgb: RGB; key: number } {
  if (mode === "256") {
    const idx = rgbTo256(c.r, c.g, c.b);
    return { rgb: ansi256ToRgb(idx), key: idx };
  }
  if (mode === "16") {
    const code = rgbTo16(c.r, c.g, c.b);
    return { rgb: ansi16ToRgb(code), key: code };
  }
  const rgb = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
  return { rgb, key: (rgb.r << 16) | (rgb.g << 8) | rgb.b };
}

/**
 * The control that justifies the common lattice: solid scored against a
 * reference at its OWN 1x1 resolution, where its reconstruction IS the
 * reference up to quantization.
 */
function nativeLatticeControl(job: Job, mode: ColorMode): number {
  const previous = getColorMode();
  setColorMode(mode);
  try {
    const data = resampleToGrid(job.pixels, job.cols, job.rows, { background: job.background });
    const grid: SubCellGrid = {
      data,
      subW: job.cols,
      subH: job.rows,
      cols: job.cols,
      rows: job.rows,
      tier: "solid",
    };
    const rows = renderCells(grid, "solid", {}, defaultTheme);
    const recon = new Float64Array(job.cols * job.rows * 3);
    for (let cy = 0; cy < job.rows; cy++) {
      const cells = parseRow(rows[cy], mode);
      for (let cx = 0; cx < job.cols; cx++) {
        const bg = cells[cx].bg ?? job.background;
        const o = (cy * job.cols + cx) * 3;
        recon[o] = bg.r;
        recon[o + 1] = bg.g;
        recon[o + 2] = bg.b;
      }
    }
    return psnr(rmse(recon, toRgbFloat(data, job.cols * job.rows)));
  } finally {
    setColorMode(previous);
  }
}

// ─── Fixture-free correctness self-test ───────────────────

/**
 * Round-trip the WHOLE pipeline on content it can represent exactly, and
 * require zero error.
 *
 * A quadrant cell holds two colours over four sub-cells, so a source split
 * left/right is exactly representable: resample, fit, emit, parse and
 * reconstruct must all agree to the byte or the result is not 0.00. That makes
 * this one number a simultaneous check on sub-cell ORDER (a transposed feed
 * reads left/right as top/bottom and cannot be exact), mask assignment, the
 * emitter, run elision and this harness's own SGR parser. Every scalar test in
 * the engine passes under a transposition; this one does not.
 *
 * The complementary assertion matters just as much: on a left/right split the
 * half tier MUST be strictly worse, because it samples one column per cell. If
 * it were not, the harness would be measuring something other than what it
 * claims to.
 */
function losslessRoundTrip(): void {
  const cols = 8;
  const rows = 4;
  const w = cols * REF_X;
  const h = rows * REF_Y;

  // Deterministic, high-contrast, and different in every cell so a
  // neighbour-swap cannot pass by luck.
  const cellColour = (i: number, side: number): RGB => ({
    r: (i * 37 + side * 113) % 256,
    g: (i * 91 + side * 29) % 256,
    b: (i * 53 + side * 197) % 256,
  });

  for (const axis of ["horizontal", "vertical"] as const) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / REF_X);
        const cy = Math.floor(y / REF_Y);
        // "horizontal" splits each cell left/right (detail across x), which only
        // the quadrant tier can resolve; "vertical" splits it top/bottom, which
        // quadrant and half both can.
        const side =
          axis === "horizontal" ? (x % REF_X) : y % REF_Y < REF_Y / 2 ? 0 : 1;
        const c = cellColour(cy * cols + cx, side);
        const o = (y * w + x) * 4;
        data[o] = c.r;
        data[o + 1] = c.g;
        data[o + 2] = c.b;
        data[o + 3] = 255;
      }
    }

    const pixels: PixelBuffer = { data, width: w, height: h };
    const black: RGB = { r: 0, g: 0, b: 0 };
    const reference = toRgbFloat(
      resampleToGrid(pixels, w, h, { background: black }),
      w * h,
    );
    const job: Job = {
      pixels,
      cols,
      rows,
      background: black,
      ink: { r: 255, g: 255, b: 255 },
      reference,
      referenceBlur: blur(reference, w, h),
    };

    const quadrant = measure(job, "quadrant", "truecolor", "none");
    check(
      quadrant.rmse === 0,
      `lossless round trip, ${axis} split, quadrant`,
      `RMSE ${fixed(quadrant.rmse, 4)} — sub-cell order, mask table, emitter or parser disagree`,
    );

    const half = measure(job, "half", "truecolor", "none");
    if (axis === "vertical") {
      check(
        half.rmse === 0,
        "lossless round trip, vertical split, half",
        `RMSE ${fixed(half.rmse, 4)}`,
      );
    } else {
      check(
        half.rmse > 0,
        "half is blind to a left/right split",
        `RMSE ${fixed(half.rmse, 4)} — the metric is not resolving horizontal detail`,
      );
    }
  }
}

// ─── Table formatting ─────────────────────────────────────

function fixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "inf";
  return value.toFixed(digits);
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

const COLUMNS: ReadonlyArray<{ head: string; width: number; align: "l" | "r" }> = [
  { head: "tier", width: 13, align: "l" },
  { head: "mode", width: 10, align: "l" },
  { head: "PSNR dB", width: 8, align: "r" },
  { head: "RMSE", width: 7, align: "r" },
  { head: "blur dB", width: 8, align: "r" },
  { head: "bytes", width: 8, align: "r" },
  { head: "noElide", width: 8, align: "r" },
  { head: "saved", width: 7, align: "r" },
  { head: "B/cell", width: 7, align: "r" },
];

function headerRow(): string {
  return (
    "  " +
    COLUMNS.map(c => (c.align === "l" ? padRight(c.head, c.width) : padLeft(c.head, c.width))).join(
      "  ",
    )
  );
}

/** Default row label: the tier, plus the dither when one is in play. */
function labelOf(m: Measurement): string {
  if (m.dither === "none") return m.tier;
  return `${m.tier}:${m.dither === "floyd-steinberg" ? "fs" : m.dither[0]}`;
}

function measurementRow(m: Measurement, label = labelOf(m)): string {
  const saved = m.naive > 0 ? ((1 - m.bytes / m.naive) * 100).toFixed(1) + "%" : "—";
  const values = [
    label,
    m.mode,
    fixed(m.psnr),
    fixed(m.rmse),
    fixed(m.blurPsnr),
    String(m.bytes),
    String(m.naive),
    saved,
    (m.bytes / m.cells).toFixed(1),
  ];
  return (
    "  " +
    COLUMNS.map((c, i) =>
      c.align === "l" ? padRight(values[i], c.width) : padLeft(values[i], c.width),
    ).join("  ")
  );
}

// ─── Per-image run ────────────────────────────────────────

function runImage(path: string, width: number): void {
  const absolute = resolve(path);
  const header = readHeader(absolute);
  const decoded = decodeImage(absolute);

  console.log(`\n\x1b[1m  ${path}\x1b[0m`);
  if (!decoded.ok) {
    check(false, `decode ${path}`, `${decoded.reason} — ${decoded.detail}`);
    return;
  }

  const geom = imageCellSize(header, { width }, width);
  const background = hexToRgb(defaultTheme.bg ?? "#000000") ?? { r: 0, g: 0, b: 0 };
  const ink = hexToRgb(defaultTheme.text) ?? { r: 255, g: 255, b: 255 };

  // The reference: the SOURCE, box-filtered to the common lattice by the same
  // area filter the tiers use. Sharing the resampler is deliberate — it isolates
  // the cell-encoding error, which is what this harness measures, from
  // resampling error, which it does not.
  const refW = geom.cols * REF_X;
  const refH = geom.rows * REF_Y;
  const referenceRgba = resampleToGrid(decoded.pixels, refW, refH, { background });
  const reference = toRgbFloat(referenceRgba, refW * refH);

  const job: Job = {
    pixels: decoded.pixels,
    cols: geom.cols,
    rows: geom.rows,
    background,
    ink,
    reference,
    referenceBlur: blur(reference, refW, refH),
  };

  console.log(
    `    source ${decoded.pixels.width}x${decoded.pixels.height} ${decoded.format} → ` +
      `${geom.cols}x${geom.rows} cells (${geom.cols * geom.rows}), ` +
      `lattice ${refW}x${refH} sub-samples`,
  );
  console.log(
    `    paper ${defaultTheme.bg} · ink ${defaultTheme.text} · dither OFF unless stated\n`,
  );

  // ── Table 1: the tier ladder, dither off so the ordering is a clean control.
  console.log("  \x1b[1mTIER x COLOUR MODE\x1b[0m (dither off)");
  console.log(headerRow());
  const grid = new Map<string, Measurement>();
  for (const tier of TIERS) {
    for (const mode of MODES) {
      const m = measure(job, tier, mode, "none");
      grid.set(`${tier}/${mode}`, m);
      console.log(measurementRow(m));
    }
  }

  // ── Table 2: dithering, which only exists for the indexed modes.
  console.log("\n  \x1b[1mDITHER\x1b[0m (indexed modes only — a no-op in truecolor by contract)");
  console.log(headerRow());
  for (const tier of ["quadrant", "solid"] as const) {
    for (const mode of ["256", "16"] as const) {
      for (const kind of ["none", "ordered", "floyd-steinberg"] as const) {
        console.log(measurementRow(measure(job, tier, mode, kind)));
      }
    }
  }

  // ── Table 3: the exploration's headline prediction.
  console.log("\n  \x1b[1mHALF BLOCK: fg+bg vs the legacy fg-only\x1b[0m (dither off)");
  console.log(headerRow());
  for (const mode of MODES) {
    const fgOnly = measureFgOnlyHalf(job, mode);
    console.log(measurementRow(fgOnly, "half:fgonly"));
    console.log(measurementRow(grid.get(`half/${mode}`)!, "half:fg+bg"));
    console.log(measurementRow(grid.get(`solid/${mode}`)!, "solid"));
    const delta = grid.get(`half/${mode}`)!.psnr - fgOnly.psnr;
    const vsSolid = Math.abs(fgOnly.psnr - grid.get(`solid/${mode}`)!.psnr);
    console.log(
      `    → ${mode}: fg+bg gains \x1b[1m${fixed(delta)} dB\x1b[0m over fg-only ` +
        `(report predicted +${PREDICTED.halfOverFgOnly}); ` +
        `fg-only is within ${fixed(vsSolid)} dB of a solid one-colour cell`,
    );
  }

  // ── Verdicts. These are the reason the harness exits non-zero.
  console.log("\n  \x1b[1mORDERING\x1b[0m (truecolor, dither off — the clean control)");
  const quadrant = grid.get("quadrant/truecolor")!;
  const half = grid.get("half/truecolor")!;
  const solid = grid.get("solid/truecolor")!;
  const braille = grid.get("braille/truecolor")!;
  const shading = grid.get("shading/truecolor")!;

  verdict("quadrant > half", quadrant.psnr, half.psnr, PREDICTED.quadrantOverHalf);
  verdict("half > solid", half.psnr, solid.psnr, PREDICTED.halfOverFgOnly);
  console.log(
    `    braille ${fixed(braille.psnr)} dB vs solid ${fixed(solid.psnr)} dB — ` +
      (braille.psnr < solid.psnr ? "below, as predicted for photographs" : "ABOVE solid, unexpected"),
  );
  console.log(
    `    shading ${fixed(shading.psnr)} dB — one colour per cell plus an ink ratio; ` +
      `${shading.psnr < solid.psnr ? "below" : "above"} solid`,
  );

  // The ladder must also hold in what actually ships to Apple Terminal: 256
  // colours with ordered dithering on. Dithering perturbs the sub-cells before
  // the fitter sees them, so this is not implied by the truecolor result.
  console.log(
    "\n  \x1b[1mORDERING\x1b[0m (256 colours + ordered dither — what ships to Apple Terminal)",
  );
  const shipped = {
    quadrant: measure(job, "quadrant", "256", "auto"),
    half: measure(job, "half", "256", "auto"),
    solid: measure(job, "solid", "256", "auto"),
  };
  verdict("quadrant > half", shipped.quadrant.psnr, shipped.half.psnr, PREDICTED.quadrantOverHalf);
  verdict("half > solid", shipped.half.psnr, shipped.solid.psnr, PREDICTED.halfOverFgOnly);

  console.log(
    `\n    control: solid scored on its OWN 1x1 lattice = ` +
      `\x1b[1m${fixed(nativeLatticeControl(job, "truecolor"))} dB\x1b[0m truecolor / ` +
      `${fixed(nativeLatticeControl(job, "256"))} dB at 256, against ` +
      `${fixed(solid.psnr)} / ${fixed(grid.get("solid/256")!.psnr)} dB on the shared lattice.`,
  );
  console.log("    Infinite, literally: at its native resolution a one-colour cell IS its own");
  console.log("    reference. That is why every tier here is scored on one common lattice.");
}

/**
 * Report — and grade — one rung of the tier ladder.
 *
 * A denser tier scoring BELOW a coarser one is a real defect and fails the run:
 * more sub-samples per cell cannot cost fidelity. An exact TIE is only a
 * warning, because it is legitimate on degenerate content — a source with no
 * detail on the axis the denser tier adds (vertical bars wider than a cell,
 * a flat colour field) genuinely gives both tiers the same information. Making
 * a tie fatal would fire on synthetic inputs and teach the reader to ignore the
 * exit code, which is worse than missing one.
 */
function verdict(name: string, better: number, worse: number, predicted: number): void {
  const delta = better - worse;
  const regression = delta < -ORDERING_EPSILON;
  const tie = Math.abs(delta) <= ORDERING_EPSILON;
  const mark = regression ? "\x1b[31m✗\x1b[0m" : tie ? "\x1b[33m=\x1b[0m" : "\x1b[32m✓\x1b[0m";
  const note = tie ? "  TIE — legitimate only where the source lacks detail on that axis" : "";
  console.log(
    `    ${mark} ${padRight(name, 16)} ${padLeft(fixed(delta), 7)} dB` +
      `   (report predicted +${predicted})${note}`,
  );
  check(!regression, `ordering: ${name}`, `${fixed(better)} vs ${fixed(worse)} dB`);
}

// ─── Entry point ──────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  let width = DEFAULT_WIDTH;
  const sources: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--width") {
      width = Number(args[++i]);
      continue;
    }
    if (args[i] === "--blur") {
      blurPasses = Number(args[++i]);
      continue;
    }
    sources.push(args[i]);
  }
  if (!Number.isFinite(width) || width < 1) {
    console.error(`  invalid --width`);
    process.exit(2);
  }
  if (!Number.isInteger(blurPasses) || blurPasses < 0 || blurPasses > 8) {
    console.error(`  invalid --blur (0..8 passes of a 5-tap binomial kernel)`);
    process.exit(2);
  }
  const paths = sources.length > 0 ? sources : DEFAULT_SOURCES;

  console.log("\x1b[1m\n  image quality harness\x1b[0m");
  console.log(
    `  \x1b[2mreconstruction parsed back out of the emitted ANSI; ` +
      `all tiers scored on a shared ${REF_X}x${REF_Y}-per-cell lattice; ` +
      `blur = ${blurPasses}x 5-tap\x1b[0m`,
  );

  const ambient = getColorMode();
  try {
    losslessRoundTrip();
    for (const path of paths) runImage(path, width);
  } finally {
    setColorMode(ambient);
  }

  console.log(`\n  ${checksPassed} checks passed, ${checksFailed} failed\n`);
  process.exit(checksFailed === 0 ? 0 : 1);
}

main();
