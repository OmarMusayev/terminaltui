/**
 * Unit tests for the cell-based image rendering engine (src/image/*).
 *
 * No PTY, no child process — every module here is pure and synchronous, which
 * is the whole point of the design (renderBlock() returns string[] with no
 * await anywhere in the render pass). The end-to-end companion that boots a
 * real app is test/test-image-rendering.ts.
 *
 * Fixtures live in test/fixtures/ and are byte-stable:
 *   pixels-4x2.png       4x2 RGBA with hand-chosen values, incl. a fully
 *                        transparent and a half-transparent pixel
 *   gradient-200x100.png 2:1 gradient with a 1px diagonal comb, so adjacent
 *                        sub-pixels genuinely differ and the glyph fitter has
 *                        real work to do (a flat image proves nothing)
 *   quarters-64x48.jpg   four flat colour quadrants — flat regions survive
 *                        JPEG quantization, so exact-ish pixel assertions hold
 *
 * Run:  npx tsx test/test-image-engine.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeImage, readHeader, sniffFormat } from "../src/image/decode.js";
import { resampleToGrid } from "../src/image/resample.js";
import {
  imageCellSize as geometryCellSize,
  imageBlockRows,
  subCellGridSize,
  DEFAULT_SOURCE_EDGE,
  MAX_IMAGE_COLS,
} from "../src/image/geometry.js";
import {
  fitQuadrant,
  fitHalf,
  fitSolid,
  expandQuadrant,
  quadrantError,
} from "../src/image/cellfit.js";
import {
  SHADING_RAMP,
  ASCII_RAMP,
  BRAILLE_BASE,
  QUADRANT_GLYPHS,
  GLYPH_COVERAGE,
} from "../src/image/glyphs.js";
import { renderCells, renderAltBox } from "../src/image/render.js";
import { selectTier, deriveCapabilities } from "../src/image/tier.js";
import {
  quantize256Index,
  quantizeToMode,
  xterm256Rgb,
} from "../src/image/quantize.js";
import { ditherGrid, resolveDither } from "../src/image/dither.js";
import {
  imageCacheStats,
  clearImageCache,
  pixelCacheKey,
  serialCacheKey,
} from "../src/image/cache.js";
import { clearResolveCache } from "../src/image/resolve.js";
import { CELL_ASPECT, subCellFactor } from "../src/image/types.js";
import type {
  ImageCapabilities,
  ImageHeader,
  ImageTier,
  RGB,
  SubCellGrid,
} from "../src/image/types.js";

import {
  renderImage,
  clearImageHeaderCache,
  imageCellSize as blockCellSize,
} from "../src/components/Image.js";
import {
  rgbTo256,
  ansi256ToRgb,
  cellColorRgb,
  hexToRgb,
  setColorMode,
  getColorMode,
  type ColorMode,
} from "../src/style/colors.js";
import { stringWidth, __widthCacheInspect } from "../src/components/base.js";
import { themes } from "../src/style/theme.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";
import { createRequire } from "node:module";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import type { RenderContext } from "../src/components/base.js";
import type { ImageBlock } from "../src/config/types.js";

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err?.message ?? err}\x1b[0m`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Fixtures ─────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const PIXELS_PNG = join(FIXTURES, "pixels-4x2.png");
const GRADIENT_PNG = join(FIXTURES, "gradient-200x100.png");
const QUARTERS_JPG = join(FIXTURES, "quarters-64x48.jpg");

/** Every control byte the runtime's own output filter strips (runtime-terminal.ts). */
const C0_BYTES = /[\x00-\x1a\x1c-\x1f\x7f]/;

const THEME = themes.dracula;
const BLACK: RGB = { r: 0, g: 0, b: 0 };

const ALL_MODES: ColorMode[] = ["truecolor", "256", "16", "none"];
const CELL_TIERS: ImageTier[] = ["quadrant", "half", "solid", "shading", "ascii", "braille"];

/**
 * Glyphs each tier may legitimately emit. Half of the 16 quadrant codepoints
 * are unreachable by construction (each is the exact complement of a lower-ink
 * partition and always loses the tie-break), so the allowlist is the low-ink
 * set — a renderer that started emitting █ or ▄ would be a real regression.
 */
const TIER_GLYPHS: Record<string, (ch: string) => boolean> = {
  quadrant: ch => " ▘▝▀▖▌▞▗".includes(ch),
  half: ch => " ▀".includes(ch),
  solid: ch => ch === " ",
  shading: ch => SHADING_RAMP.includes(ch),
  ascii: ch => ASCII_RAMP.includes(ch),
  braille: ch => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp >= BRAILLE_BASE && cp <= BRAILLE_BASE + 0xff;
  },
};

/**
 * jpeg-js has no type declarations, so it is required the same way decode.ts
 * requires it — a bare import is a hard TS7016 error.
 */
const jpegEncode: (
  data: { data: Buffer; width: number; height: number },
  quality: number,
) => { data: Buffer } = createRequire(import.meta.url)("jpeg-js").encode;

function withColorMode<T>(mode: ColorMode, fn: () => T): T {
  const prev = getColorMode();
  setColorMode(mode);
  try {
    return fn();
  } finally {
    setColorMode(prev);
  }
}

/** Decode a fixture and resample it into a tier-shaped sub-cell grid. */
function gridFor(path: string, tier: ImageTier, cols: number, rows: number): SubCellGrid {
  const decoded = decodeImage(path);
  if (!decoded.ok) throw new Error(`fixture ${path} failed to decode: ${decoded.reason}`);
  const { subW, subH } = subCellGridSize({ cols, rows }, tier);
  const data = resampleToGrid(decoded.pixels, subW, subH, { background: BLACK });
  return { data, subW, subH, cols, rows, tier };
}

function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

function sameRgb(a: RGB, b: RGB): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

// ═════════════════════════════════════════════════════════════
// DECODE
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Decode\x1b[0m\n");

test("sniffFormat dispatches on magic bytes, not on the file extension", () => {
  assertEqual(sniffFormat(readFileSync(PIXELS_PNG)), "png", "png magic");
  assertEqual(sniffFormat(readFileSync(QUARTERS_JPG)), "jpeg", "jpeg magic");
  assertEqual(sniffFormat(Buffer.from("this is plain text, not an image")), "unknown", "text");
  assertEqual(sniffFormat(Buffer.alloc(0)), "unknown", "empty buffer");
  // A JPEG whose bytes are handed over under a .png name must still sniff jpeg.
  const jpegBytes = readFileSync(QUARTERS_JPG);
  assertEqual(sniffFormat(jpegBytes), "jpeg", "jpeg bytes regardless of provenance");
});

test("PNG decodes to exact dimensions and exact RGBA values", () => {
  const res = decodeImage(PIXELS_PNG);
  assert(res.ok, `expected ok, got ${res.ok ? "" : res.reason}`);
  if (!res.ok) return;
  assertEqual(res.format, "png", "format");
  assertEqual(res.pixels.width, 4, "width");
  assertEqual(res.pixels.height, 2, "height");
  assertEqual(res.pixels.data.length, 4 * 2 * 4, "byte length");

  const expected = [
    [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255],
    [0, 0, 0, 255], [128, 128, 128, 255], [10, 20, 30, 0], [255, 255, 0, 128],
  ];
  const d = res.pixels.data;
  for (let i = 0; i < expected.length; i++) {
    const got = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
    assertEqual(got.join(","), expected[i].join(","), `pixel ${i}`);
  }
});

test("JPEG decodes to exact dimensions and near-exact flat-region colours", () => {
  const res = decodeImage(QUARTERS_JPG);
  assert(res.ok, `expected ok, got ${res.ok ? "" : res.reason}`);
  if (!res.ok) return;
  assertEqual(res.format, "jpeg", "format");
  assertEqual(res.pixels.width, 64, "width");
  assertEqual(res.pixels.height, 48, "height");

  const { data, width } = res.pixels;
  const at = (x: number, y: number): number[] => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  // Sampled well inside each flat quadrant, away from the ringing at the edges.
  const cases: Array<[number, number, number[]]> = [
    [16, 12, [220, 30, 30]],
    [48, 12, [30, 200, 30]],
    [16, 36, [30, 40, 220]],
    [48, 36, [240, 240, 240]],
  ];
  for (const [x, y, want] of cases) {
    const got = at(x, y);
    for (let c = 0; c < 3; c++) {
      assert(
        Math.abs(got[c] - want[c]) <= 8,
        `pixel (${x},${y}) channel ${c}: expected ~${want[c]}, got ${got[c]}`,
      );
    }
    assertEqual(got[3], 255, `pixel (${x},${y}) alpha`);
  }
});

test("Buffer source and path source decode identically", () => {
  const fromPath = decodeImage(GRADIENT_PNG);
  const fromBuffer = decodeImage(readFileSync(GRADIENT_PNG));
  assert(fromPath.ok && fromBuffer.ok, "both decode");
  if (!fromPath.ok || !fromBuffer.ok) return;
  assertEqual(fromBuffer.pixels.width, fromPath.pixels.width, "width");
  assertEqual(fromBuffer.pixels.height, fromPath.pixels.height, "height");
  let diff = 0;
  for (let i = 0; i < fromPath.pixels.data.length; i++) {
    if (fromPath.pixels.data[i] !== fromBuffer.pixels.data[i]) diff++;
  }
  assertEqual(diff, 0, "differing bytes");
});

test("Missing file returns not-found and does not throw", () => {
  const res = decodeImage(join(FIXTURES, "definitely-not-here.png"));
  assert(!res.ok, "expected failure");
  if (res.ok) return;
  assertEqual(res.reason, "not-found", "reason");
  assert(res.detail.length > 0, "detail should name the error");
});

test("A directory returns not-found rather than throwing", () => {
  const res = decodeImage(FIXTURES);
  assert(!res.ok, "expected failure");
  if (!res.ok) assertEqual(res.reason, "not-found", "reason");
});

test("Garbage bytes return unsupported-format and do not throw", () => {
  const res = decodeImage(Buffer.from("not an image at all, just some text bytes"));
  assert(!res.ok, "expected failure");
  if (!res.ok) assertEqual(res.reason, "unsupported-format", "reason");

  const empty = decodeImage(Buffer.alloc(0));
  assert(!empty.ok, "empty buffer should fail");
  if (!empty.ok) assertEqual(empty.reason, "unsupported-format", "empty reason");
});

test("Valid PNG magic with a broken payload returns corrupt, not a throw", () => {
  // Real signature + real IHDR, then junk where the IDAT stream should be.
  const head = readFileSync(PIXELS_PNG).subarray(0, 40);
  const res = decodeImage(Buffer.concat([head, Buffer.alloc(64, 0x7a)]));
  assert(!res.ok, "expected failure");
  if (!res.ok) assertEqual(res.reason, "corrupt", "reason");
});

test("Oversized sources return too-large — by encoded bytes and by pixel budget", () => {
  const bytes = decodeImage(GRADIENT_PNG, { maxSourceBytes: 100 });
  assert(!bytes.ok, "byte budget should reject");
  if (!bytes.ok) assertEqual(bytes.reason, "too-large", "byte budget reason");

  // Checked against the DECLARED header dimensions, so no allocation happens.
  const pixels = decodeImage(GRADIENT_PNG, { maxPixels: 100 });
  assert(!pixels.ok, "pixel budget should reject");
  if (!pixels.ok) assertEqual(pixels.reason, "too-large", "pixel budget reason");
});

test("No decode failure path throws", () => {
  const hostile: Array<string | Buffer> = [
    "",
    "   ",
    join(FIXTURES, "nope.png"),
    FIXTURES,
    Buffer.alloc(0),
    Buffer.from("GIF89a-but-truncated"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    readFileSync(QUARTERS_JPG).subarray(0, 4),
  ];
  for (const source of hostile) {
    let threw = false;
    try {
      const res = decodeImage(source);
      assert(typeof res.ok === "boolean", "result must be a DecodeResult");
    } catch {
      threw = true;
    }
    assert(!threw, `decodeImage threw on ${JSON.stringify(String(source).slice(0, 24))}`);
  }
});

// ═════════════════════════════════════════════════════════════
// HEADER PROBE
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  readHeader\x1b[0m\n");

test("readHeader returns PNG dimensions from a prefix too short to decode", () => {
  const full = readFileSync(GRADIENT_PNG);
  const header = readHeader(full);
  assert(header !== null, "header should parse");
  assertEqual(header?.width, 200, "width");
  assertEqual(header?.height, 100, "height");
  assertEqual(header?.format, "png", "format");

  // The proof that it is a HEADER read and not a decode: 64 bytes is enough
  // for the dimensions and nowhere near enough for the pixels.
  const prefix = full.subarray(0, 64);
  const prefixHeader = readHeader(prefix);
  assertEqual(prefixHeader?.width, 200, "prefix width");
  assertEqual(prefixHeader?.height, 100, "prefix height");
  const decoded = decodeImage(prefix);
  assert(!decoded.ok, "a 64-byte prefix must not decode");
});

test("readHeader walks JPEG segments to SOF without decoding", () => {
  const full = readFileSync(QUARTERS_JPG);
  const header = readHeader(full);
  assertEqual(header?.width, 64, "width");
  assertEqual(header?.height, 48, "height");
  assertEqual(header?.format, "jpeg", "format");

  // SOF0 sits at byte 154 in this fixture (APP0 then DQT precede it), so 200
  // bytes carries the dimensions while stopping far short of the scan data.
  const prefix = full.subarray(0, 200);
  assert(prefix.length < full.length / 3, "the prefix must be a small fraction of the file");
  assertEqual(readHeader(prefix)?.width, 64, "prefix width");
  assertEqual(readHeader(prefix)?.height, 48, "prefix height");
  assert(!decodeImage(prefix).ok, "a 200-byte prefix must not decode");
});

test("readHeader works from a path and matches the buffer answer", () => {
  const fromPath = readHeader(GRADIENT_PNG);
  const fromBuffer = readHeader(readFileSync(GRADIENT_PNG));
  assertEqual(JSON.stringify(fromPath), JSON.stringify(fromBuffer), "path vs buffer");
  assertEqual(readHeader(QUARTERS_JPG)?.height, 48, "jpeg from path");
});

test("readHeader returns null for unrecognised bytes and missing files", () => {
  assertEqual(readHeader(Buffer.from("just some text")), null, "text");
  assertEqual(readHeader(Buffer.alloc(0)), null, "empty");
  assertEqual(readHeader(join(FIXTURES, "nope.png")), null, "missing file");
});

// ═════════════════════════════════════════════════════════════
// GEOMETRY
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Geometry\x1b[0m\n");

function header(width: number, height: number): ImageHeader {
  return { width, height, format: "png" };
}

test("CELL_ASPECT is applied exactly once — 1000x500 at 40 cols is 10 rows", () => {
  // Derived from the constant rather than hardcoded, so the arithmetic is the
  // assertion: cols * (srcH / srcW) * CELL_ASPECT.
  const expected = Math.round(40 * (500 / 1000) * CELL_ASPECT);
  assertEqual(expected, 10, "sanity: the derivation itself");

  const geo = geometryCellSize(header(1000, 500), { width: 40 }, 100);
  assertEqual(geo.cols, 40, "cols");
  assertEqual(geo.rows, expected, "rows");
  // The two ways this goes wrong: aspect never applied (20) or applied twice (5).
  assert(geo.rows !== 20, "aspect was not applied at all");
  assert(geo.rows !== 5, "aspect was applied twice");
});

test("Aspect holds across square, tall and wide sources", () => {
  const cases: Array<[number, number, number, number]> = [
    // srcW, srcH, cols, expected rows
    [500, 500, 40, 10 * 2],
    [500, 1000, 40, 40],
    [200, 100, 40, 10],
    [1600, 1000, 60, 19],
  ];
  for (const [w, h, cols, want] of cases) {
    const derived = Math.round(cols * (h / w) * CELL_ASPECT);
    assertEqual(derived, want, `derivation for ${w}x${h} at ${cols}`);
    const geo = geometryCellSize(header(w, h), { width: cols }, 120);
    assertEqual(geo.rows, want, `rows for ${w}x${h} at ${cols} cols`);
  }
});

test("subCellGridSize is a SECOND, independent multiplier — aspect is not re-applied", () => {
  const geo = geometryCellSize(header(1000, 500), { width: 40 }, 100);
  for (const tier of CELL_TIERS) {
    const f = subCellFactor(tier);
    const { subW, subH } = subCellGridSize(geo, tier);
    assertEqual(subW, geo.cols * f.x, `${tier} subW`);
    assertEqual(subH, geo.rows * f.y, `${tier} subH`);

    // Convert the sub-grid back into square-pixel space and check it recovers
    // the SOURCE aspect. A second aspect factor anywhere would show up here as
    // a 2x error on the sub-cell tiers and not on the flat ones.
    const squareW = subW / f.x;
    const squareH = subH / (CELL_ASPECT * f.y);
    const recovered = squareW / squareH;
    assert(
      Math.abs(recovered - 1000 / 500) < 0.15,
      `${tier}: recovered aspect ${recovered.toFixed(3)}, expected 2.0`,
    );
  }
});

test("maxHeight clamps rows and shrinks cols to keep the aspect", () => {
  const geo = geometryCellSize(header(200, 100), { width: 40, maxHeight: 6 }, 100);
  assert(geo.rows <= 6, `rows ${geo.rows} exceeded maxHeight 6`);
  assert(geo.cols < 40, `cols should shrink to preserve aspect, got ${geo.cols}`);
  assertEqual(geo.rows, Math.round(geo.cols * (100 / 200) * CELL_ASPECT), "rows still aspect-correct");
});

test("maxHeight is never violated across a deterministic ratio sweep", () => {
  // colsWithinRowCap solves this by search: the inverse of a rounded function
  // is not the rounding of the inverse, and a naive cap/ratio hands back a
  // column count whose derived rows blow the cap by one.
  let violations = 0;
  let zeroDims = 0;
  for (let srcW = 7; srcW <= 400; srcW += 13) {
    for (let srcH = 5; srcH <= 400; srcH += 17) {
      for (const cap of [1, 2, 3, 7, 14, 25]) {
        const geo = geometryCellSize(header(srcW, srcH), { maxHeight: cap }, 99);
        if (geo.rows > cap) violations++;
        if (geo.cols < 1 || geo.rows < 1) zeroDims++;
      }
    }
  }
  assertEqual(violations, 0, "maxHeight violations");
  assertEqual(zeroDims, 0, "zero or negative dimensions");
});

test("A null header still yields a deterministic, non-degenerate geometry", () => {
  const a = geometryCellSize(null, { width: 40 }, 100);
  const b = geometryCellSize(null, { width: 40 }, 100);
  assertEqual(JSON.stringify(a), JSON.stringify(b), "repeatable");
  assert(a.estimated, "estimated flag should be set");
  // The placeholder is a square, which through the aspect formula is a 2:1 box.
  assertEqual(a.rows, Math.round(40 * (DEFAULT_SOURCE_EDGE / DEFAULT_SOURCE_EDGE) * CELL_ASPECT), "rows");
  assertEqual(a.rows, 20, "placeholder rows at width 40");
  assert(a.cols >= 1 && a.rows >= 1, "never zero");
});

test("Geometry never returns zero or negative on hostile inputs", () => {
  const hostile: Array<[Record<string, unknown>, number]> = [
    [{}, -5],
    [{}, 0],
    [{}, 1],
    [{ width: 0 }, 80],
    [{ width: -5 }, 80],
    [{ width: Number.NaN }, 80],
    [{ width: 1e9 }, 80],
    [{ height: 0 }, 80],
    [{ maxHeight: 0 }, 80],
    [{ maxHeight: -3 }, 80],
    [{ width: 1e9, maxHeight: 1e9 }, 80],
  ];
  for (const [opts, avail] of hostile) {
    for (const hdr of [null, header(200, 100)]) {
      const geo = geometryCellSize(hdr, opts as never, avail);
      assert(geo.cols >= 1, `cols ${geo.cols} for ${JSON.stringify(opts)} @${avail}`);
      assert(geo.rows >= 1, `rows ${geo.rows} for ${JSON.stringify(opts)} @${avail}`);
      assert(geo.cols <= MAX_IMAGE_COLS, `cols ${geo.cols} exceeded MAX_IMAGE_COLS`);
      assert(Number.isInteger(geo.cols) && Number.isInteger(geo.rows), "integral dimensions");
    }
  }
});

test("frame adds exactly two rows and two columns to the block footprint", () => {
  const bare = geometryCellSize(header(200, 100), { width: 40 }, 80);
  const framed = geometryCellSize(header(200, 100), { width: 40, border: true }, 80);
  assertEqual(bare.blockCols, bare.cols, "unframed blockCols");
  assertEqual(bare.blockRows, bare.rows, "unframed blockRows");
  assertEqual(framed.blockCols, framed.cols + 2, "framed blockCols");
  assertEqual(framed.blockRows, framed.rows + 2, "framed blockRows");
  assert(framed.blockCols <= 80, "framed block must fit its budget");
});

test("imageBlockRows is exactly imageCellSize().blockRows in every state", () => {
  const states: Array<ImageHeader | null> = [header(200, 100), header(1, 1), header(4096, 4096), null];
  for (const hdr of states) {
    for (const opts of [{}, { width: 40 }, { width: 40, border: true }, { maxHeight: 4 }]) {
      assertEqual(
        imageBlockRows(hdr, opts, 80),
        geometryCellSize(hdr, opts, 80).blockRows,
        `blockRows for ${JSON.stringify(opts)}`,
      );
    }
  }
});

// ═════════════════════════════════════════════════════════════
// CELL FITTING
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Cell fitting\x1b[0m\n");

const A = rgb(20, 30, 200);
const B = rgb(230, 200, 40);

test("A flat 2x2 cell collapses to a space carrying only a background", () => {
  const cell = fitQuadrant([A, A, A, A]);
  assertEqual(cell.ch, " ", "glyph");
  assert(sameRgb(cell.fg, A), `fg ${JSON.stringify(cell.fg)}`);
  assert(sameRgb(cell.bg, A), `bg ${JSON.stringify(cell.bg)}`);
  assert(cell.fg !== cell.bg, "fg and bg must be distinct objects, not one aliased reference");
});

test("Top/bottom split fits U+2580 with fg = top, bg = bottom", () => {
  // [TL, TR, BL, BR]
  const cell = fitQuadrant([A, A, B, B]);
  assertEqual(cell.ch, "▀", "glyph (UPPER HALF BLOCK)");
  assert(sameRgb(cell.fg, A), `fg should be the top colour, got ${JSON.stringify(cell.fg)}`);
  assert(sameRgb(cell.bg, B), `bg should be the bottom colour, got ${JSON.stringify(cell.bg)}`);
  assertEqual(quadrantError([A, A, B, B], 3), 0, "the fit is exact");
});

test("Left/right split fits U+258C with fg = left, bg = right", () => {
  const cell = fitQuadrant([A, B, A, B]);
  assertEqual(cell.ch, "▌", "glyph (LEFT HALF BLOCK)");
  assert(sameRgb(cell.fg, A), "fg is the left column");
  assert(sameRgb(cell.bg, B), "bg is the right column");
});

test("A single differing sub-pixel fits its own quadrant glyph", () => {
  assertEqual(fitQuadrant([A, B, B, B]).ch, "▘", "TL -> QUADRANT UPPER LEFT");
  assertEqual(fitQuadrant([B, A, B, B]).ch, "▝", "TR -> QUADRANT UPPER RIGHT");
  assertEqual(fitQuadrant([B, B, A, B]).ch, "▖", "BL -> QUADRANT LOWER LEFT");
  assertEqual(fitQuadrant([B, B, B, A]).ch, "▗", "BR -> QUADRANT LOWER RIGHT");
});

test("DIAGONAL: exhaustive search beats every axis-aligned split", () => {
  // TL and BR are one colour, TR and BL the other. No top/bottom or left/right
  // partition can represent this, and a naive "fit a half block" renderer
  // produces a flat grey cell. The exhaustive 16-partition search must find
  // U+259E (QUADRANT UPPER RIGHT AND LOWER LEFT).
  const sub = [A, B, B, A];
  const cell = fitQuadrant(sub);
  assertEqual(cell.ch, "▞", "glyph");
  assert(sameRgb(cell.fg, B), `fg should be the diagonal ink, got ${JSON.stringify(cell.fg)}`);
  assert(sameRgb(cell.bg, A), `bg should be the other diagonal, got ${JSON.stringify(cell.bg)}`);

  // The diagonal partition (mask 6) is exact; the axis-aligned ones are not.
  const diagonalErr = quadrantError(sub, 6);
  const topBottomErr = quadrantError(sub, 3);
  const leftRightErr = quadrantError(sub, 5);
  assertEqual(diagonalErr, 0, "diagonal error");
  assert(topBottomErr > 0, `top/bottom split should be lossy, got ${topBottomErr}`);
  assert(leftRightErr > 0, `left/right split should be lossy, got ${leftRightErr}`);
  assert(diagonalErr < topBottomErr, "diagonal must beat the top/bottom split");
  assert(diagonalErr < leftRightErr, "diagonal must beat the left/right split");

  // And the reconstruction is pixel-exact.
  const back = expandQuadrant(cell);
  for (let i = 0; i < 4; i++) {
    assert(sameRgb(back[i], sub[i]), `sub-pixel ${i} round-trip`);
  }
});

test("The anti-diagonal is also found (proves the search is not hardcoded to one diagonal)", () => {
  // TR and BL one colour, TL and BR the other — the complement of the case
  // above. It ties with mask 6 by construction, so the canonical low-ink glyph
  // wins and the PIXELS must still be exact.
  const sub = [B, A, A, B];
  const cell = fitQuadrant(sub);
  assertEqual(quadrantError(sub, 9), 0, "the anti-diagonal partition is exact");
  const back = expandQuadrant(cell);
  for (let i = 0; i < 4; i++) {
    assert(sameRgb(back[i], sub[i]), `sub-pixel ${i} round-trip`);
  }
});

test("Every two-colour 2x2 pattern round-trips pixel-exact", () => {
  // 16 masks x an asymmetric colour pair. This is what catches a transposed
  // bit layout: a mirrored table passes every scalar test and silently flips
  // the image, but breaks the round trip.
  for (let mask = 0; mask < 16; mask++) {
    const sub = [0, 1, 2, 3].map(i => (((mask >> i) & 1) ? B : A));
    const cell = fitQuadrant(sub);
    const back = expandQuadrant(cell);
    for (let i = 0; i < 4; i++) {
      assert(sameRgb(back[i], sub[i]), `mask ${mask} sub-pixel ${i}: ${JSON.stringify(back[i])} vs ${JSON.stringify(sub[i])}`);
    }
  }
});

test("fitQuadrant's fast scoring always picks an error-minimal partition", () => {
  // quadrantError() computes the same quantity the long way (build both means,
  // sum deviations) and is an independent reference for the variance-identity
  // scoring inside fitQuadrant.
  let rngState = 0x2f6e2b1;
  const rand = (): number => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  const maskOf = new Map<string, number>();
  QUADRANT_GLYPHS.forEach((ch, m) => { if (!maskOf.has(ch)) maskOf.set(ch, m); });

  let worse = 0;
  for (let n = 0; n < 4000; n++) {
    const sub = [0, 1, 2, 3].map(() =>
      rgb(Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256)),
    );
    const cell = fitQuadrant(sub);
    const chosen = maskOf.get(cell.ch);
    assert(chosen !== undefined, `emitted glyph ${JSON.stringify(cell.ch)} is not a quadrant glyph`);
    const chosenErr = quadrantError(sub, chosen!);
    for (let m = 0; m < 16; m++) {
      if (quadrantError(sub, m) < chosenErr - 1e-6) { worse++; break; }
    }
  }
  assertEqual(worse, 0, "cells where a different partition scored strictly better");
});

test("fitQuadrant only emits the canonical low-ink glyph set", () => {
  let rngState = 0x51f3a7c;
  const rand = (): number => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  const seen = new Set<string>();
  for (let n = 0; n < 5000; n++) {
    const sub = [0, 1, 2, 3].map(() =>
      rgb(Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256)),
    );
    seen.add(fitQuadrant(sub).ch);
  }
  for (const ch of seen) {
    assert(TIER_GLYPHS.quadrant(ch), `emitted U+${(ch.codePointAt(0) ?? 0).toString(16)} outside the allowlist`);
  }
  assert(seen.size >= 6, `expected the fitter to exercise most of the set, saw ${seen.size}`);
});

test("fitQuadrant throws RangeError on a wrong-length sub-cell array", () => {
  for (const bad of [[], [A], [A, B, A], [A, B, A, B, A]]) {
    let threw = false;
    try { fitQuadrant(bad); } catch (err) { threw = err instanceof RangeError; }
    assert(threw, `expected RangeError for length ${bad.length}`);
  }
});

test("fitHalf is lossless when the halves differ and folds when they match", () => {
  const split = fitHalf(A, B);
  assertEqual(split.ch, "▀", "glyph");
  assert(sameRgb(split.fg, A), "fg is the TOP pixel");
  assert(sameRgb(split.bg, B), "bg is the BOTTOM pixel");

  const flat = fitHalf(A, A);
  assertEqual(flat.ch, " ", "matched halves collapse to a space");
  assert(sameRgb(flat.fg, flat.bg), "fg equals bg on a folded cell");

  const solid = fitSolid(B);
  assertEqual(solid.ch, " ", "fitSolid glyph");
  assert(sameRgb(solid.fg, B) && sameRgb(solid.bg, B), "fitSolid pens");
});

// ═════════════════════════════════════════════════════════════
// QUANTIZATION
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Quantization\x1b[0m\n");

test("rgbTo256 holds the four values test-apple-terminal-colors.ts pins", () => {
  assertEqual(rgbTo256(0, 0, 0), 16, "black");
  assertEqual(rgbTo256(255, 255, 255), 231, "white");
  const grey = rgbTo256(128, 128, 128);
  assert(grey >= 232 && grey <= 255, `mid grey should land in the grey ramp, got ${grey}`);
  assertEqual(rgbTo256(255, 0, 0), 196, "pure red");
});

test("rgbTo256 never returns an index in the 0-15 range", () => {
  for (let r = 0; r < 256; r += 7) {
    for (let g = 0; g < 256; g += 11) {
      for (let b = 0; b < 256; b += 13) {
        const idx = rgbTo256(r, g, b);
        assert(idx >= 16 && idx <= 255, `rgbTo256(${r},${g},${b}) = ${idx}`);
      }
    }
  }
});

test("The palette round-trips: every image-safe index is a fixed point", () => {
  let mismatches = 0;
  for (let i = 16; i < 256; i++) {
    const c = ansi256ToRgb(i);
    if (rgbTo256(c.r, c.g, c.b) !== i) mismatches++;
  }
  assertEqual(mismatches, 0, "indices that do not re-quantize to themselves");
});

test("The shipped quantizer beats naive independent-channel rounding, measurably", () => {
  // The naive mapping is what the old implementation did: assume the 6x6x6
  // cube's channel levels are evenly spaced and never consider the grey ramp.
  const naiveIndex = (r: number, g: number, b: number): number =>
    16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);

  let shippedSum = 0;
  let naiveSum = 0;
  let samples = 0;
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const s = ansi256ToRgb(rgbTo256(r, g, b));
        const n = ansi256ToRgb(naiveIndex(r, g, b));
        shippedSum += (s.r - r) ** 2 + (s.g - g) ** 2 + (s.b - b) ** 2;
        naiveSum += (n.r - r) ** 2 + (n.g - g) ** 2 + (n.b - b) ** 2;
        samples++;
      }
    }
  }
  const shippedRmse = Math.sqrt(shippedSum / samples);
  const naiveRmse = Math.sqrt(naiveSum / samples);
  console.log(`      RMSE over ${samples} samples: shipped ${shippedRmse.toFixed(2)}, naive ${naiveRmse.toFixed(2)}`);
  assert(shippedRmse < naiveRmse, `shipped ${shippedRmse} should beat naive ${naiveRmse}`);
  assert(
    shippedRmse < naiveRmse * 0.75,
    `expected a decisive win, got ${shippedRmse.toFixed(2)} vs ${naiveRmse.toFixed(2)}`,
  );

  // And it is not merely better on average: the near-grey case the old code
  // got badly wrong must now be near-exact.
  const nearGrey = ansi256ToRgb(rgbTo256(28, 26, 28));
  const err = Math.abs(nearGrey.r - 28) + Math.abs(nearGrey.g - 26) + Math.abs(nearGrey.b - 28);
  assert(err < 10, `near-grey (28,26,28) mapped to ${JSON.stringify(nearGrey)}, error ${err}`);
});

test("What the image quantizer picks is what the emitter paints", () => {
  // The two 256-colour searches are DELIBERATELY different: colors.ts's
  // rgbTo256 is the exact nearest of all 240 entries (UI chrome, where a lone
  // colour has no neighbours to be consistent with), while quantize256Index
  // carries the chroma floor that keeps a sampled grid from flip-flopping.
  // Sharing one function drained 34 of 100 built-in theme slots to grey.
  //
  // What must still hold — and what makes render.ts's pre-snap safe — is that
  // the image quantizer's OUTPUT is a fixed point of the emitter's search. The
  // renderer snaps every pen through quantizePacked and hands the result to
  // colors.ts, so if rgbTo256 moved that colour anywhere else the ditherer
  // would be steering toward a colour that never gets drawn.
  let mismatches = 0;
  let firstBad = "";
  for (let r = 0; r < 256; r += 5) {
    for (let g = 0; g < 256; g += 5) {
      for (let b = 0; b < 256; b += 5) {
        const wanted = quantize256Index(r, g, b);
        const snapped = xterm256Rgb(wanted);
        const painted = rgbTo256(snapped.r, snapped.g, snapped.b);
        if (painted !== wanted) {
          mismatches++;
          if (!firstBad) firstBad = `(${r},${g},${b}): image ${wanted} painted as ${painted}`;
        }
      }
    }
  }
  assertEqual(mismatches, 0, `image quantizer output is not a fixed point; first ${firstBad}`);
  // Every one of the 240 image-safe entries, exhaustively — the fixed-point
  // property is what both searches have to agree on, so pin all of it.
  for (let i = 16; i < 256; i++) {
    const c = xterm256Rgb(i);
    assertEqual(rgbTo256(c.r, c.g, c.b), i, `emitter fixed point at ${i}`);
    assertEqual(quantize256Index(c.r, c.g, c.b), i, `image fixed point at ${i}`);
  }
  // The tie-break direction is the thing that drifts. Pin both cube bracket
  // midpoints that are exact ties; the floor does not reach them.
  for (const v of [47, 115, 155, 195, 235]) {
    assertEqual(rgbTo256(v, v, 0), quantize256Index(v, v, 0), `tie at channel ${v}`);
  }
});

test("The chroma floor never touches UI chrome", () => {
  // The regression this pins: with one shared search, `fgColor(theme.accent)`
  // emitted a GREY-RAMP index for any theme colour under chroma 40. rosePine
  // and catppuccin went monochrome and an accent landed one grey step from body
  // text. Chrome must keep the exact nearest neighbour.
  const prev = getColorMode();
  setColorMode("256");
  try {
    // Brute force over all 240 image-safe entries. Chrome must land on the
    // TRUE nearest one; the floor's whole signature was picking a strictly
    // worse entry (catppuccin's accent went to grey at RGB error 38.1 when a
    // pink sat at 26.8), so comparing against the exhaustive answer catches it
    // without hardcoding which colours are "supposed" to stay coloured. Dark
    // near-neutrals like cyberpunk's #01012b legitimately resolve to the grey
    // ramp here, because the cube's only option below 47 is black.
    let worse = 0;
    let firstBad = "";
    for (const [name, theme] of Object.entries(themes)) {
      for (const [slot, hex] of Object.entries(theme)) {
        if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
        const src = hexToRgb(hex)!;
        const err = (i: number): number => {
          const c = xterm256Rgb(i);
          return (c.r - src.r) ** 2 + (c.g - src.g) ** 2 + (c.b - src.b) ** 2;
        };
        let best = 16;
        for (let i = 17; i < 256; i++) if (err(i) < err(best)) best = i;
        const got = rgbTo256(src.r, src.g, src.b);
        if (err(got) > err(best)) {
          worse++;
          if (!firstBad) {
            firstBad = `${name}.${slot} ${hex} -> ${got} (err ${Math.sqrt(err(got)).toFixed(1)}) ` +
              `when ${best} (err ${Math.sqrt(err(best)).toFixed(1)}) was available`;
          }
        }
      }
    }
    assertEqual(worse, 0, `theme slots quantized worse than the true nearest; first ${firstBad}`);
    // Two specific slots the shared floor demonstrably broke, with the entry
    // the exact search is supposed to find.
    assertEqual(rgbTo256(0xf5, 0xc2, 0xe7), 218, "catppuccin accent stays pink");
    assertEqual(rgbTo256(0xeb, 0xbc, 0xba), 181, "rosePine accent stays dusty rose");
  } finally {
    setColorMode(prev);
  }
});

test("quantizeToMode is identity in truecolor and idempotent everywhere", () => {
  const c = rgb(137, 42, 201);
  assert(sameRgb(quantizeToMode(c, "truecolor"), c), "truecolor is identity");
  assert(sameRgb(quantizeToMode(c, "none"), c), "none is identity");
  for (const mode of ALL_MODES) {
    const once = quantizeToMode(c, mode);
    const twice = quantizeToMode(once, mode);
    assert(sameRgb(once, twice), `${mode} is not idempotent`);
  }
  assert(sameRgb(xterm256Rgb(rgbTo256(255, 0, 0)), rgb(255, 0, 0)), "pure red survives 256");
});

test("Dithering is a hard no-op in truecolor and in none, in both directions", () => {
  const base = new Uint8ClampedArray(16 * 8 * 4);
  for (let i = 0; i < base.length; i += 4) {
    base[i] = (i * 7) & 0xff;
    base[i + 1] = (i * 13) & 0xff;
    base[i + 2] = (i * 29) & 0xff;
    base[i + 3] = 255;
  }
  for (const mode of ["truecolor", "none"] as const) {
    for (const kind of ["auto", "ordered", "floyd-steinberg"] as const) {
      const copy = new Uint8ClampedArray(base);
      ditherGrid(copy, 16, 8, mode, kind);
      let diff = 0;
      for (let i = 0; i < base.length; i++) if (copy[i] !== base[i]) diff++;
      assertEqual(diff, 0, `${mode}/${kind} changed ${diff} bytes`);
      assertEqual(resolveDither(kind, mode), "none", `resolveDither(${kind}, ${mode})`);
    }
  }
  // ...and it DOES something in an indexed mode, otherwise the test above is vacuous.
  const dithered = new Uint8ClampedArray(base);
  ditherGrid(dithered, 16, 8, "256", "floyd-steinberg");
  let moved = 0;
  for (let i = 0; i < base.length; i++) if (dithered[i] !== base[i]) moved++;
  assert(moved > 0, "an explicit dither at 256 colours should change the grid");

  // "auto" is decided per colour mode, from screenshots of the real renderer
  // rather than from a metric — see the resolveDither doc comment.
  //
  // 256 has a dense enough palette that nearest-colour is already smooth, and
  // dispersing error across the cube's 0->95 dark gap reads as confetti at one
  // cell per sample. 16 has nothing to work with undithered, so FS earns its
  // keep there. Bayer is never automatic: one threshold shared across all three
  // channels can shift lightness but never manufacture chroma.
  assertEqual(resolveDither("auto", "256"), "none", "256 is dense enough to go undithered");
  assertEqual(resolveDither("auto", "16"), "none", "16 disperses across the whole gamut — confetti");
  assertEqual(resolveDither("ordered", "256"), "ordered", "ordered stays available opt-in");
  assertEqual(resolveDither("floyd-steinberg", "256"), "floyd-steinberg", "FS stays available opt-in");

  // ...and "auto" really is a no-op at 256, so the grid is untouched.
  const autoAt256 = new Uint8ClampedArray(base);
  ditherGrid(autoAt256, 16, 8, "256", "auto");
  let autoMoved = 0;
  for (let i = 0; i < base.length; i++) if (autoAt256[i] !== base[i]) autoMoved++;
  assertEqual(autoMoved, 0, "auto at 256 leaves the grid alone");
});

// ═════════════════════════════════════════════════════════════
// TIER SELECTION
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Tier selection\x1b[0m\n");

function caps(
  colorMode: ImageCapabilities["colorMode"],
  unicode: boolean,
  conservative: boolean,
): ImageCapabilities {
  return { colorMode, unicode, conservative };
}

test("The auto ladder is evaluated most-restrictive-first", () => {
  assertEqual(selectTier("auto", caps("none", true, false)), "ascii", "no colour -> ascii");
  assertEqual(selectTier("auto", caps("none", true, true)), "ascii", "no colour wins over conservative");
  assertEqual(selectTier("auto", caps("truecolor", false, false)), "solid", "no unicode -> solid");
  // 16 colours no longer diverts to a one-pen ramp: quadrant carries four
  // samples per cell where shading carries one, and rendered side by side the
  // quadrant picture is legible where the ramp is a smear.
  assertEqual(selectTier("auto", caps("16", true, false)), "quadrant", "16 colours -> quadrant");
  assertEqual(selectTier("auto", caps("16", true, true)), "half", "16 + conservative -> half");
  assertEqual(selectTier("auto", caps("16", false, false)), "solid", "16 without unicode -> solid");
  assertEqual(selectTier("auto", caps("256", true, true)), "half", "conservative -> half");
  assertEqual(selectTier("auto", caps("256", true, false)), "quadrant", "full capability -> quadrant");
  assertEqual(selectTier("auto", caps("truecolor", true, false)), "quadrant", "truecolor -> quadrant");
});

test("Braille is never reachable from auto, over every capability combination", () => {
  for (const cm of ["truecolor", "256", "16", "none"] as const) {
    for (const uni of [true, false]) {
      for (const cons of [true, false]) {
        const tier = selectTier("auto", caps(cm, uni, cons));
        assert(tier !== "braille", `auto produced braille for ${cm}/${uni}/${cons}`);
        assert(tier !== "alt", `auto produced alt for ${cm}/${uni}/${cons}`);
      }
    }
  }
  assertEqual(selectTier("braille", caps("256", true, false)), "braille", "explicit braille is honoured");
});

test("An explicit mode is honoured verbatim, with no capability demotion", () => {
  for (const tier of CELL_TIERS) {
    assertEqual(selectTier(tier, caps("none", false, true)), tier, `explicit ${tier}`);
  }
});

test("deriveCapabilities ignores the server's multiplexer env for remote sessions", () => {
  const local = deriveCapabilities("256", true);
  assert(typeof local.conservative === "boolean", "conservative is derived");
  const remote = deriveCapabilities("256", true, "xterm-256color");
  assertEqual(remote.colorMode, "256", "colour mode passes through");
  assertEqual(remote.unicode, true, "unicode passes through");
  assertEqual(remote.conservative, false, "a recognised remote TERM is not conservative");
  assertEqual(
    deriveCapabilities("256", true, "some-unknown-term").conservative,
    true,
    "an unrecognised remote TERM is conservative",
  );
});

// ═════════════════════════════════════════════════════════════
// RENDER — the invariants every row must satisfy
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Render invariants\x1b[0m\n");

const RENDER_COLS = 24;
const RENDER_ROWS = 6;

test("Every row of every tier in every colour mode is exactly `cols` columns wide", () => {
  let checked = 0;
  for (const tier of CELL_TIERS) {
    const grid = gridFor(GRADIENT_PNG, tier, RENDER_COLS, RENDER_ROWS);
    for (const mode of ALL_MODES) {
      const rows = withColorMode(mode, () => renderCells(grid, tier));
      assertEqual(rows.length, RENDER_ROWS, `${tier}/${mode} row count`);
      for (let y = 0; y < rows.length; y++) {
        const w = stringWidth(rows[y]);
        assertEqual(w, RENDER_COLS, `${tier}/${mode} row ${y} width`);
        checked++;
      }
    }
  }
  assertEqual(checked, CELL_TIERS.length * ALL_MODES.length * RENDER_ROWS, "rows checked");
});

test("Every coloured row ends with a reset, and `none` emits no escapes at all", () => {
  for (const tier of CELL_TIERS) {
    const grid = gridFor(GRADIENT_PNG, tier, RENDER_COLS, RENDER_ROWS);
    for (const mode of ALL_MODES) {
      const rows = withColorMode(mode, () => renderCells(grid, tier));
      for (let y = 0; y < rows.length; y++) {
        if (mode === "none") {
          assert(!rows[y].includes("\x1b"), `${tier}/none row ${y} emitted an escape`);
        } else {
          assert(
            rows[y].endsWith("\x1b[0m"),
            `${tier}/${mode} row ${y} does not end with reset — it would leak into the focus gutter`,
          );
        }
      }
    }
  }
});

test("No rendered row contains a C0 control byte the runtime would silently strip", () => {
  for (const tier of CELL_TIERS) {
    const grid = gridFor(GRADIENT_PNG, tier, RENDER_COLS, RENDER_ROWS);
    for (const mode of ALL_MODES) {
      const rows = withColorMode(mode, () => renderCells(grid, tier));
      for (let y = 0; y < rows.length; y++) {
        // ESC (0x1b) is legitimate; everything else in C0 plus DEL is not —
        // runtime-terminal.ts removes them AFTER the width was computed, which
        // is exactly how a row ends up a column short.
        assert(!C0_BYTES.test(rows[y]), `${tier}/${mode} row ${y} contains a stripped control byte`);
      }
    }
  }
});

test("Each tier emits only glyphs from its own allowlist", () => {
  for (const tier of CELL_TIERS) {
    const grid = gridFor(GRADIENT_PNG, tier, RENDER_COLS, RENDER_ROWS);
    for (const mode of ALL_MODES) {
      const rows = withColorMode(mode, () => renderCells(grid, tier));
      for (const row of rows) {
        const plain = row.replace(/\x1b\[[0-9;]*m/g, "");
        for (const ch of plain) {
          assert(
            TIER_GLYPHS[tier](ch),
            `${tier}/${mode} emitted U+${(ch.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
          );
        }
      }
    }
  }
});

test("Rendered output contains no graphics-protocol escape sequences", () => {
  // The engine is cell-only by design. An accidental sixel/kitty/iTerm2
  // emission would be invisible in text() but would corrupt every terminal
  // that does not speak it.
  for (const tier of CELL_TIERS) {
    const grid = gridFor(GRADIENT_PNG, tier, RENDER_COLS, RENDER_ROWS);
    for (const mode of ALL_MODES) {
      const joined = withColorMode(mode, () => renderCells(grid, tier)).join("\n");
      for (const [name, seq] of [["OSC", "\x1b]"], ["DCS", "\x1bP"], ["APC", "\x1b_"], ["PM", "\x1b^"], ["SOS", "\x1bX"]] as const) {
        assert(!joined.includes(seq), `${tier}/${mode} emitted a ${name} introducer`);
      }
      // Cross-check through the emulator's own parser rather than trusting the
      // substring scan.
      const vt = new VirtualTerminal(RENDER_COLS, RENDER_ROWS + 2);
      vt.write(joined.replace(/\n/g, "\r\n"));
      assertEqual(vt.graphics().length, 0, `${tier}/${mode} produced a graphics record`);
    }
  }
});

test("renderCells rejects the alt tier and any grid/tier geometry mismatch", () => {
  const grid = gridFor(GRADIENT_PNG, "quadrant", 4, 2);
  let threw = false;
  try { renderCells(grid, "alt"); } catch (err) { threw = err instanceof RangeError; }
  assert(threw, "tier 'alt' must throw");

  threw = false;
  try { renderCells({ ...grid, tier: "half" }, "half"); } catch (err) { threw = err instanceof RangeError; }
  assert(threw, "a quadrant-shaped grid rendered as half must throw");

  threw = false;
  try { renderCells({ ...grid, subW: grid.subW + 1 }, "quadrant"); } catch (err) { threw = err instanceof RangeError; }
  assert(threw, "a sub-grid one column too wide must throw");
});

test("SGR run elision reduces bytes and is provably lossless", () => {
  // A naive emitter written here from scratch: set both pens on every cell,
  // never track state. The elided renderer must produce the same visible cells
  // in fewer bytes.
  const naiveRows = (grid: SubCellGrid, tier: ImageTier): string[] => {
    const { cols, rows, subW, data } = grid;
    const f = subCellFactor(tier);
    const out: string[] = [];
    for (let y = 0; y < rows; y++) {
      let row = "";
      for (let x = 0; x < cols; x++) {
        const px: RGB[] = [];
        for (let sy = 0; sy < f.y; sy++) {
          for (let sx = 0; sx < f.x; sx++) {
            const i = ((y * f.y + sy) * subW + (x * f.x + sx)) * 4;
            px.push(rgb(data[i], data[i + 1], data[i + 2]));
          }
        }
        const cell = tier === "quadrant"
          ? fitQuadrant(px)
          : tier === "half"
            ? fitHalf(px[0], px[1])
            : fitSolid(px[0]);
        // Snap through the IMAGE palette first, exactly as render.ts does. The
        // emitter's own 256-colour search has no chroma floor, so handing it a
        // raw fitter mean would make this reference disagree with the renderer
        // about the colour rather than about the elision, which is the only
        // thing under test here.
        row += cellColorRgb(
          quantizeToMode(cell.fg, getColorMode()),
          quantizeToMode(cell.bg, getColorMode()),
        ) + cell.ch;
      }
      out.push(row + "\x1b[0m");
    }
    return out;
  };

  /**
   * Replay ANSI rows through the emulator and read back what each cell will
   * actually LOOK LIKE — the four sub-cell colours the glyph paints, not the
   * (glyph, fg, bg) triple.
   *
   * Comparing the triple would be wrong: the renderer folds a cell whose two
   * pens survive quantization as one colour into a bare space, which changes
   * the glyph while changing nothing on screen. Expanding through the glyph's
   * coverage is the only honest equivalence test.
   */
  const replay = (rows: string[], cols: number): string[][] => {
    const vt = new VirtualTerminal(cols, rows.length + 1);
    vt.write(rows.join("\r\n"));
    const cells = vt.cells();
    const out: string[][] = [];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[y][x];
        const coverage = GLYPH_COVERAGE.get(cell.char);
        const fg = cell.fg ?? "default";
        const bg = cell.bg ?? "default";
        out.push(
          coverage === undefined
            ? [bg, bg, bg, bg]
            : coverage.subcells.map(ink => (ink ? fg : bg)),
        );
      }
    }
    return out;
  };

  for (const tier of ["quadrant", "half", "solid"] as const) {
    for (const source of [QUARTERS_JPG, GRADIENT_PNG]) {
      const grid = gridFor(source, tier, 40, 10);
      for (const mode of ["truecolor", "256", "16"] as const) {
        const elided = withColorMode(mode, () => renderCells(grid, tier));
        const naive = withColorMode(mode, () => naiveRows(grid, tier));

        const elidedBytes = Buffer.byteLength(elided.join(""), "utf8");
        const naiveBytes = Buffer.byteLength(naive.join(""), "utf8");
        // Where a strict win is guaranteed: any image with flat regions in any
        // mode, and any image at all in the indexed modes, where neighbouring
        // cells that differ slightly in RGB quantize to the SAME palette entry.
        // (The gradient fixture carries a deliberate 1px diagonal comb, so in
        // truecolor no two adjacent cells share a pen and there is genuinely
        // nothing to elide — asserting a win there would be asserting a lie.)
        const strict = source === QUARTERS_JPG || mode !== "truecolor";
        if (strict) {
          assert(
            elidedBytes < naiveBytes,
            `${tier}/${mode}: elided ${elidedBytes} B is not smaller than naive ${naiveBytes} B`,
          );
        } else {
          assert(elidedBytes <= naiveBytes, `${tier}/${mode}: elision made output LARGER`);
        }

        const a = replay(elided, 40);
        const b = replay(naive, 40);
        assertEqual(a.length, b.length, `${tier}/${mode} cell count`);
        for (let i = 0; i < a.length; i++) {
          assertEqual(a[i].join("|"), b[i].join("|"), `${tier}/${mode} cell ${i} sub-cell colours`);
        }
      }
    }
  }

  for (const [label, source] of [["gradient", GRADIENT_PNG], ["quarters", QUARTERS_JPG]] as const) {
    const grid = gridFor(source, "quadrant", 40, 10);
    const eB = Buffer.byteLength(withColorMode("256", () => renderCells(grid, "quadrant")).join(""), "utf8");
    const nB = Buffer.byteLength(withColorMode("256", () => naiveRows(grid, "quadrant")).join(""), "utf8");
    console.log(`      quadrant/256 40x10 ${label}: elided ${eB} B vs naive ${nB} B (${(nB / eB).toFixed(2)}x)`);
  }
});

test("A zero-width or zero-height grid still reports the right row count", () => {
  // All four image states must agree on row count or every FocusRect below the
  // block shifts.
  const empty: SubCellGrid = {
    data: new Uint8ClampedArray(0), subW: 0, subH: 8, cols: 0, rows: 4, tier: "quadrant",
  };
  assertEqual(withColorMode("256", () => renderCells(empty, "quadrant")).length, 4, "zero-width rows");
  const none: SubCellGrid = {
    data: new Uint8ClampedArray(0), subW: 0, subH: 0, cols: 0, rows: 0, tier: "quadrant",
  };
  assertEqual(withColorMode("256", () => renderCells(none, "quadrant")).length, 0, "zero-height rows");
});

// ═════════════════════════════════════════════════════════════
// ALT BOX
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Alt box\x1b[0m\n");

const LONG_ALT =
  "A very long alternative description that is far wider than any box it will " +
  "ever be asked to fit inside, and which must be truncated rather than merely padded.";

test("renderAltBox returns exactly the requested rows AND columns for a long label", () => {
  const rows = renderAltBox(LONG_ALT, { cols: 20, rows: 6 }, THEME);
  assertEqual(rows.length, 6, "row count");
  for (let y = 0; y < rows.length; y++) {
    assertEqual(stringWidth(rows[y]), 20, `row ${y} width`);
  }
});

test("renderAltBox holds exact geometry across a full size sweep", () => {
  // The placeholder this replaced padded only, and measured 25-66 columns wide
  // inside a 20-column allocation.
  let checked = 0;
  for (let cols = 1; cols <= 30; cols++) {
    for (let rows = 1; rows <= 8; rows++) {
      const out = renderAltBox(LONG_ALT, { cols, rows }, THEME);
      assertEqual(out.length, rows, `rows for ${cols}x${rows}`);
      for (let y = 0; y < out.length; y++) {
        assertEqual(stringWidth(out[y]), cols, `width for ${cols}x${rows} row ${y}`);
        assert(!C0_BYTES.test(out[y]), `control byte in ${cols}x${rows} row ${y}`);
      }
      checked++;
    }
  }
  assertEqual(checked, 240, "geometries checked");
});

test("renderAltBox sanitises author-supplied escapes before measuring", () => {
  const hostile = [
    "\x1b[31mred\x1b[0m and \x07bell",
    "line\nbreak\ttab",
    "\x00\x01\x02",
    "",
    "   ",
    "]0;title",
  ];
  for (const alt of hostile) {
    const out = renderAltBox(alt, { cols: 18, rows: 5 }, THEME);
    assertEqual(out.length, 5, `rows for ${JSON.stringify(alt)}`);
    for (const row of out) {
      assertEqual(stringWidth(row), 18, `width for ${JSON.stringify(alt)}`);
      assert(!C0_BYTES.test(row), `control byte survived for ${JSON.stringify(alt)}`);
    }
  }
});

test("Degenerate alt geometries return sane shapes instead of throwing", () => {
  assertEqual(renderAltBox("x", { cols: 10, rows: 0 }, THEME).length, 0, "zero rows");
  const zeroCols = renderAltBox("x", { cols: 0, rows: 3 }, THEME);
  assertEqual(zeroCols.length, 3, "zero cols still reserves rows");
  for (const row of zeroCols) assertEqual(stringWidth(row), 0, "zero-width row");
});

// ═════════════════════════════════════════════════════════════
// BLOCK RENDERER + CACHE
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Block renderer and cache\x1b[0m\n");

function ctx(width: number): RenderContext {
  return { width, theme: THEME, borderStyle: "rounded" };
}

function imageBlock(path: string, extra: Partial<ImageBlock> = {}): ImageBlock {
  return { type: "image", path, ...extra } as ImageBlock;
}

function resetCaches(): void {
  clearImageCache();
  clearResolveCache();
  clearImageHeaderCache();
}

test("A second render of the same block hits the row cache and does not re-decode", () => {
  withColorMode("256", () => {
    resetCaches();
    const block = imageBlock(GRADIENT_PNG, { width: 30 });
    const first = renderImage(block, ctx(60));
    const afterFirst = imageCacheStats();
    assertEqual(afterFirst.pixelMisses, 1, "first render should miss the pixel cache once");
    assertEqual(afterFirst.serialMisses, 1, "first render should miss the row cache once");
    assertEqual(afterFirst.pixelEntries, 1, "one decoded grid cached");
    assertEqual(afterFirst.serialEntries, 1, "one emitted row set cached");

    const second = renderImage(block, ctx(60));
    const afterSecond = imageCacheStats();
    assertEqual(afterSecond.serialHits, 1, "second render should hit the row cache");
    assertEqual(
      afterSecond.pixelMisses,
      afterFirst.pixelMisses,
      "second render must NOT re-decode — a pixel miss means a fresh decode",
    );
    assertEqual(afterSecond.pixelEntries, 1, "still one decoded grid");
    assertEqual(first.join("\n"), second.join("\n"), "identical output");
    assert(first.length > 0, "renderImage produced rows");
  });
});

test("Changing colour mode makes a new row entry but reuses the decoded pixels", () => {
  resetCaches();
  const block = imageBlock(GRADIENT_PNG, { width: 30 });
  const at256 = withColorMode("256", () => renderImage(block, ctx(60)));
  const afterA = imageCacheStats();
  const atTrue = withColorMode("truecolor", () => renderImage(block, ctx(60)));
  const afterB = imageCacheStats();

  assertEqual(afterB.serialEntries, 2, "colour mode must key the row cache");
  assertEqual(
    afterB.pixelEntries,
    afterA.pixelEntries,
    "colour mode must NOT key the pixel cache — two SSH sessions share one decode",
  );
  assertEqual(afterB.pixelMisses, afterA.pixelMisses, "no second decode");
  assert(at256.join("") !== atTrue.join(""), "the two colour modes must emit different bytes");

  // And the keys themselves say so.
  const base = {
    path: GRADIENT_PNG, cols: 30, rows: 8, subW: 60, subH: 16,
    tier: "quadrant" as ImageTier, background: "#000000",
  };
  const pk = pixelCacheKey(base);
  assertEqual(pixelCacheKey(base), pk, "pixel key is stable");
  assert(
    serialCacheKey({ pixelKey: pk, tier: "quadrant", colorMode: "256", dither: "auto" }) !==
      serialCacheKey({ pixelKey: pk, tier: "quadrant", colorMode: "truecolor", dither: "auto" }),
    "serial keys must differ by colour mode",
  );
  assert(
    serialCacheKey({ pixelKey: pk, tier: "quadrant", colorMode: "256", dither: "auto" }) !==
      serialCacheKey({ pixelKey: pk, tier: "half", colorMode: "256", dither: "auto" }),
    "serial keys must differ by tier",
  );
});

test("clearImageCache empties both levels and zeroes the counters", () => {
  withColorMode("256", () => {
    resetCaches();
    renderImage(imageBlock(GRADIENT_PNG, { width: 20 }), ctx(60));
    const before = imageCacheStats();
    assert(before.pixelEntries > 0 && before.serialEntries > 0, "cache should be warm");
    assert(before.pixelBytes > 0 && before.serialBytes > 0, "byte accounting should be non-zero");

    clearImageCache();
    const after = imageCacheStats();
    assertEqual(after.pixelEntries, 0, "pixel entries");
    assertEqual(after.serialEntries, 0, "serial entries");
    assertEqual(after.pixelBytes, 0, "pixel bytes");
    assertEqual(after.serialBytes, 0, "serial bytes");
    assertEqual(after.pixelHits + after.pixelMisses + after.serialHits + after.serialMisses, 0, "counters");
  });
});

test("renderImage output is exactly blockRows rows and never exceeds ctx.width", () => {
  withColorMode("256", () => {
    resetCaches();
    const cases: Array<[Partial<ImageBlock>, number]> = [
      [{ width: 30 }, 60],
      [{ width: 30, border: true }, 60],
      [{ width: 30, align: "left" }, 60],
      [{ width: 30, align: "right" }, 60],
      [{ maxHeight: 4 }, 60],
      [{ fit: "fill", width: 20, height: 5 }, 60],
      [{ mode: "half", width: 20 }, 40],
      [{ mode: "ascii", width: 20 }, 40],
      [{}, 20],
    ];
    for (const [extra, width] of cases) {
      const block = imageBlock(GRADIENT_PNG, extra);
      const geo = blockCellSize(block, width);
      const rows = renderImage(block, ctx(width));
      assertEqual(rows.length, geo.blockRows, `row count for ${JSON.stringify(extra)}`);
      for (let y = 0; y < rows.length; y++) {
        const w = stringWidth(rows[y]);
        assert(w <= width, `row ${y} of ${JSON.stringify(extra)} is ${w} wide in a ${width}-col block`);
        assert(!C0_BYTES.test(rows[y]), `control byte in row ${y} of ${JSON.stringify(extra)}`);
      }
    }
  });
});

test("Every failure path renders the alt box at the predicted row count", () => {
  withColorMode("256", () => {
    resetCaches();
    const failures: Array<[string, string]> = [
      [join(FIXTURES, "definitely-not-here.png"), "missing file"],
      ["https://example.com/logo.png", "remote url"],
      ["", "empty path"],
      ["art:logo", "unsupported scheme"],
      ["data:image/png;base64,!!!!", "malformed data uri"],
      [join(FIXTURES), "a directory"],
    ];
    for (const [path, label] of failures) {
      const block = imageBlock(path, { width: 30, alt: "ALT-TEXT-MARKER" });
      const geo = blockCellSize(block, 60);
      const rows = renderImage(block, ctx(60));
      assertEqual(rows.length, geo.blockRows, `row count for ${label}`);
      for (const row of rows) {
        assert(stringWidth(row) <= 60, `row too wide for ${label}`);
      }
      const plain = rows.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
      assert(plain.includes("ALT-TEXT-MARKER"), `alt text missing for ${label}`);
      assert(!plain.includes("[Image:"), `${label} fell back to the old placeholder`);
    }
  });
});

test("A long alt in a 20-column block does not overflow (the old placeholder did)", () => {
  withColorMode("256", () => {
    resetCaches();
    const block = imageBlock(join(FIXTURES, "nope.png"), { alt: LONG_ALT, width: 18 });
    const rows = renderImage(block, ctx(20));
    assert(rows.length > 0, "produced rows");
    for (let y = 0; y < rows.length; y++) {
      const w = stringWidth(rows[y]);
      assert(w <= 20, `row ${y} measured ${w} columns inside a 20-column block`);
    }
  });
});

test("renderImage never throws, on any hostile block", () => {
  withColorMode("256", () => {
    resetCaches();
    const hostile: ImageBlock[] = [
      imageBlock(""),
      imageBlock("   "),
      imageBlock("art:logo"),
      imageBlock("data:,"),
      imageBlock(GRADIENT_PNG, { width: 0 }),
      imageBlock(GRADIENT_PNG, { width: -5, height: Number.NaN }),
      imageBlock(GRADIENT_PNG, { width: 1e9 }),
      imageBlock(GRADIENT_PNG, { charset: "🙂🙃" }),
      imageBlock(GRADIENT_PNG, { background: "not-a-hex" }),
      imageBlock(QUARTERS_JPG, { mode: "braille", width: 12 }),
      imageBlock("/etc/hosts", { width: 12 }),
    ];
    for (const block of hostile) {
      for (const width of [-3, 0, 1, 4, 20, 80]) {
        let rows: string[] | null = null;
        try {
          rows = renderImage(block, ctx(width));
        } catch (err: any) {
          throw new Error(`threw for ${JSON.stringify(block.path)} @${width}: ${err?.message}`);
        }
        assert(Array.isArray(rows), "must return an array");
        // geometry.ts clamps cols to >= 1 before adding any frame border, so a
        // sub-1-cell allocation gets a 1-cell block rather than nothing. That
        // floor is the documented behaviour, not an overflow.
        const budget = Math.max(1, width);
        for (const row of rows) {
          assert(stringWidth(row) <= budget, `overflow for ${block.path} @${width}`);
        }
      }
    }
  });
});

test("A rendered image block emits no graphics-protocol sequences either", () => {
  withColorMode("256", () => {
    resetCaches();
    const rows = renderImage(imageBlock(GRADIENT_PNG, { width: 30 }), ctx(60));
    const vt = new VirtualTerminal(60, rows.length + 2);
    vt.write(rows.join("\r\n"));
    assertEqual(vt.graphics().length, 0, "graphics records emitted by the block renderer");
  });
});

// ═════════════════════════════════════════════════════════════
// REGRESSIONS — one per defect the adversarial review found. Every one of
// these passed before the fix and failed after it was reverted; none of them
// was reachable through the assertions that already existed.
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Regressions\x1b[0m\n");

test("estimator and renderer agree on height INSIDE a panel (availHeight is threaded)", () => {
  withColorMode("256", () => {
    resetCaches();
    // A source taller than the pane, so the renderer's row cap actually bites.
    for (const [w, h] of [[60, 8], [80, 12], [40, 6], [77, 14]] as Array<[number, number]>) {
      const block = imageBlock(GRADIENT_PNG);
      const estimated = blockCellSize(block, w, h).blockRows;
      const rendered = renderImage(block, { ...ctx(w), panelHeight: h }).length;
      assertEqual(estimated, rendered, `estimator vs renderer at width ${w} panelHeight ${h}`);
      // And the unconstrained estimate is genuinely different, i.e. the test
      // would catch a regression rather than pass vacuously.
      assert(
        blockCellSize(block, w).blockRows > rendered,
        `unconstrained estimate should exceed the panel-clamped one at ${w}x${h}`,
      );
    }
  });
});

test("the layout walk places a focus rect below an image using the PANEL's height", () => {
  withColorMode("256", () => {
    resetCaches();
    const blocks = [
      {
        type: "panel",
        config: { content: [imageBlock(GRADIENT_PNG), { type: "link", label: "GO", url: "/x" }] },
      },
    ] as any;
    const paneH = 16;
    const rects = computeFocusPositions(blocks, 79, paneH, () => []);
    const rendered = renderImage(imageBlock(GRADIENT_PNG), { ...ctx(79), panelHeight: paneH }).length;
    assertEqual(rects.length, 1, "one focusable");
    // image rows + one blank separator row.
    assertEqual(rects[0].y, rendered + 1, "link y must follow the rows actually drawn");
  });
});

test("the L1 key carries the crop, so fit:\"cover\" cannot collide with another fit", () => {
  withColorMode("truecolor", () => {
    resetCaches();
    const cover = imageBlock(GRADIENT_PNG, { width: 10, height: 3, fit: "cover", mode: "half" });
    const fill = imageBlock(GRADIENT_PNG, { width: 10, height: 3, fit: "fill", mode: "half" });

    // Cold, in isolation: capture what each SHOULD look like.
    resetCaches();
    const coverAlone = renderImage(cover, ctx(40)).join("\n");
    resetCaches();
    const fillAlone = renderImage(fill, ctx(40)).join("\n");
    assert(coverAlone !== fillAlone, "cover and fill must render differently to begin with");

    // Both orders, one warm cache: neither may inherit the other's pixels.
    resetCaches();
    assertEqual(renderImage(fill, ctx(40)).join("\n"), fillAlone, "fill first, fill");
    assertEqual(renderImage(cover, ctx(40)).join("\n"), coverAlone, "fill first, then cover");
    resetCaches();
    assertEqual(renderImage(cover, ctx(40)).join("\n"), coverAlone, "cover first, cover");
    assertEqual(renderImage(fill, ctx(40)).join("\n"), fillAlone, "cover first, then fill");
    assertEqual(imageCacheStats().pixelEntries, 2, "two distinct grids must be cached");
  });
});

test("pixelCacheKey distinguishes crops and treats absent as the full frame", () => {
  const base = {
    path: GRADIENT_PNG,
    cols: 10,
    rows: 3,
    subW: 10,
    subH: 6,
    tier: "half" as ImageTier,
    background: BLACK,
  };
  const full = pixelCacheKey(base);
  const cropped = pixelCacheKey({ ...base, crop: { sx: 16, sy: 0, sw: 167, sh: 100 } });
  const other = pixelCacheKey({ ...base, crop: { sx: 0, sy: 0, sw: 200, sh: 100 } });
  assert(full !== cropped, "full frame vs crop");
  assert(cropped !== other, "two different crops");
  assertEqual(pixelCacheKey(base), full, "keying is deterministic");
});

test("contain/fill never crop, even when the header could not be read", () => {
  withColorMode("truecolor", () => {
    resetCaches();
    // A JPEG whose SOF sits past readHeader's 1 MiB probe: the header is
    // unreadable but jpeg-js still decodes the whole file. geometry.ts then
    // reports a fictional DEFAULT_SOURCE_EDGE-sized "full frame", and applying
    // it as a crop hard-cut the image to its top-left 256x256 pixels.
    const w = 400;
    const h = 100;
    const raw = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const left = x < w / 2;
        raw[i] = left ? 255 : 0;
        raw[i + 1] = 0;
        raw[i + 2] = left ? 0 : 255;
        raw[i + 3] = 255;
      }
    }
    const encoded = jpegEncode({ data: raw, width: w, height: h }, 95).data;
    const padding: Buffer[] = [];
    for (let k = 0; k < 20; k++) {
      const seg = Buffer.alloc(2 + 65535);
      seg[0] = 0xff;
      seg[1] = 0xe1; // APP1
      seg.writeUInt16BE(65535, 2);
      padding.push(seg);
    }
    const file = join(tmpdir(), `terminaltui-bigheader-${process.pid}.jpg`);
    writeFileSync(file, Buffer.concat([encoded.subarray(0, 2), ...padding, encoded.subarray(2)]));
    try {
      assertEqual(readHeader(file), null, "header must be unreadable for this test to mean anything");
      const decoded = decodeImage(file);
      assert(decoded.ok && decoded.pixels.width === 400, "but the pixels must still decode");

      const rows = renderImage(imageBlock(file, { width: 8, mode: "solid", align: "left" }), ctx(20));
      // 8 cells across a half-red/half-blue source: 4 red then 4 blue. A crop to
      // the left 256 of 400 pixels gave 6 red, a blend, then 1 blue.
      const bgs = [...rows[0].matchAll(/48;2;(\d+);(\d+);(\d+)/g)].map(m => Number(m[1]));
      assertEqual(bgs.length, 2, "two colour runs across the row");
      const reds = (rows[0].match(/ /g) ?? []).length;
      assertEqual(reds, 8, "eight cells");
      assert(bgs[0] > 200 && bgs[1] < 60, `left run red, right run blue (got ${bgs.join(",")})`);
    } finally {
      try { unlinkSync(file); } catch { /* best effort */ }
    }
  });
});

test("a framed block never emits rows wider than its allocation", () => {
  withColorMode("256", () => {
    resetCaches();
    for (let w = 0; w <= 8; w++) {
      const rows = renderImage(imageBlock(GRADIENT_PNG, { border: true, mode: "solid" }), ctx(w));
      for (const row of rows) {
        assert(
          stringWidth(row) <= Math.max(1, w),
          `framed row at width ${w} was ${stringWidth(row)} columns`,
        );
      }
      assertEqual(
        rows.length,
        blockCellSize(imageBlock(GRADIENT_PNG, { border: true }), w).blockRows,
        `row count at width ${w}`,
      );
    }
  });
});

test("the alt box borders in the SAME style the successful frame would use", () => {
  withColorMode("256", () => {
    resetCaches();
    const style = { ...ctx(40), borderStyle: "double" as const };
    const ok = renderImage(
      imageBlock(GRADIENT_PNG, { width: 20, height: 4, fit: "fill", border: true, mode: "solid" }),
      style,
    );
    const missing = renderImage(
      imageBlock(join(FIXTURES, "definitely-not-here.png"), {
        width: 20,
        height: 4,
        fit: "fill",
        border: true,
      }),
      style,
    );
    assert(ok[0].includes("\u2554"), "successful frame uses the double corner");
    assert(missing[0].includes("\u2554"), "alt box must use the same corner, not a rounded one");
    // And an explicit style on the block wins over the site's.
    const pinned = renderImage(
      imageBlock(join(FIXTURES, "definitely-not-here.png"), {
        width: 20,
        height: 4,
        fit: "fill",
        border: "heavy",
      }),
      style,
    );
    assert(!pinned[0].includes("\u2554"), "block-level border style overrides the site's");
  });
});

test("invert negates the image's ink and leaves the composited background alone", () => {
  // 4x1 of white at alpha 0 / 85 / 170 / 255.
  const src = new Uint8ClampedArray(4 * 4);
  const alphas = [0, 85, 170, 255];
  for (let x = 0; x < 4; x++) {
    src[x * 4] = 255;
    src[x * 4 + 1] = 255;
    src[x * 4 + 2] = 255;
    src[x * 4 + 3] = alphas[x];
  }
  const pixels = { data: src, width: 4, height: 1 };
  const bg = rgb(26, 27, 38);
  const plain = resampleToGrid(pixels, 4, 1, { background: bg });
  const inverted = resampleToGrid(pixels, 4, 1, { background: bg, invert: true });

  // A fully transparent pixel is pure background in BOTH renders — inverting it
  // used to turn a logo's transparent surround into a bright box.
  for (let c = 0; c < 3; c++) {
    assertEqual(plain[c], [bg.r, bg.g, bg.b][c], `plain transparent channel ${c}`);
    assertEqual(inverted[c], [bg.r, bg.g, bg.b][c], `inverted transparent channel ${c}`);
  }
  // Opaque white inverts to black.
  assertEqual(plain[12], 255, "plain opaque");
  assertEqual(inverted[12], 0, "inverted opaque");
});

test("style/colors.ts and image/quantize.ts share ONE 256-colour palette", () => {
  // They were independent implementations of the SEARCH and drifted once, on
  // 878,094 of 16,777,216 colours. The searches are now deliberately different
  // (chrome exact, pixels floored) but the TABLES and the cube/ramp candidate
  // arithmetic are common, so the two must still agree everywhere the floor
  // does not reach: on every neutral, and on both directions of the inverse.
  // A stride-13 sweep is ~1.3M samples; the cube midpoints are where the drift
  // lived, and the floor cannot move a neutral.
  let mismatches = 0;
  for (let r = 0; r < 256; r += 1) {
    for (let g = 0; g < 256; g += 13) {
      for (let b = 0; b < 256; b += 7) {
        // Above the floor the two searches are the same computation.
        const mean = (r + g + b) / 3;
        if (Math.hypot(r - mean, g - mean, b - mean) < 45) continue;
        if (rgbTo256(r, g, b) !== quantize256Index(r, g, b)) mismatches++;
      }
    }
  }
  assertEqual(mismatches, 0, "rgbTo256 vs quantize256Index above the chroma floor");
  for (const v of [47, 48, 115, 116, 155, 195, 235, 0, 255]) {
    assertEqual(rgbTo256(v, v, v), quantize256Index(v, v, v), `midpoint grey ${v}`);
  }
  assertEqual(rgbTo256(0, 0, 0), 16, "black");
  assertEqual(rgbTo256(255, 255, 255), 231, "white");
  assertEqual(rgbTo256(128, 128, 128), 244, "mid grey");
  assertEqual(rgbTo256(255, 0, 0), 196, "red");
  // The inverse agrees too, in both directions.
  for (let i = 16; i < 256; i++) {
    assert(sameRgb(ansi256ToRgb(i), xterm256Rgb(i)), `inverse disagrees at index ${i}`);
  }
});

test("stringWidth does not memoise image-sized rows", () => {
  withColorMode("truecolor", () => {
    resetCaches();
    const rows = renderImage(imageBlock(GRADIENT_PNG, { width: 60 }), ctx(80));
    const long = rows.find(r => r.length > 512);
    assert(long !== undefined, "a truecolor image row should exceed the cache ceiling");
    const before = __widthCacheInspect().size;
    stringWidth(long!);
    const after = __widthCacheInspect();
    assert(!after.has(long!), "an image row must not enter the shared width memo");
    assertEqual(after.size, before, "and must not grow it");
    // Short strings still cache, so the memo is not simply disabled.
    const short = "a short ui string";
    stringWidth(short);
    assert(__widthCacheInspect().has(short), "ordinary UI strings still memoise");
  });
});

// ═════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
