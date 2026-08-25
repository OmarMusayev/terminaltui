#!/usr/bin/env npx tsx
/**
 * Unit tests for the kitty graphics protocol — the Unicode-placeholder variant
 * (src/image/kitty.ts, src/image/kitty-diacritics.ts) and its wiring into
 * src/components/Image.ts.
 *
 * THE METHOD: DECODE OUR OWN OUTPUT. There is no kitty window in CI, and there
 * is nothing to look at even when there is one — the whole point of the
 * protocol is that the pixels never touch the cell grid. So correctness is
 * proved the only way it can be without hardware: a decoder for the encoder,
 * written from the spec rather than from the encoder's source, that turns the
 * escape stream back into pixels and the placement rows back into (row, column)
 * pairs. "Byte-identical to the source" is the assertion; "looks plausible" is
 * not available and would not be worth having.
 *
 * The properties that actually break in production, and are therefore pinned
 * hardest here:
 *   - a placement row measures exactly `cols` display columns (§3.2 — the whole
 *     scheme rests on this, and charWidth got 18 of the first 48 diacritics
 *     wrong before it was fixed, so sizes past index 30 are exercised
 *     explicitly);
 *   - control keys appear on the FIRST chunk only (repeating them makes kitty
 *     treat a continuation as a new command and drop the transfer);
 *   - `q=2` on every escape, so no reply lands in the app's stdin and gets
 *     dispatched as a keystroke (§6.1);
 *   - the image id survives in a LITERAL 24-bit SGR even at `colorMode "256"`,
 *     which is exactly the mode an SSH client reporting `xterm-256color` gets
 *     while really being kitty — quantizing that colour destroys the id;
 *   - a terminal that cannot decode any of it receives ZERO graphics bytes.
 *
 * The PTY-driven companions are test/test-image-rendering.ts (cells) and
 * test/test-image-resize.ts (frames).
 *
 * Run:  npx tsx test/test-image-kitty.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";

import {
  encodeTransmit,
  encodePlacement,
  encodeDelete,
  nextImageId,
  imageIdColor,
  canPlaceholder,
  __resetImageIds,
  PLACEHOLDER_CHAR,
  MAX_IMAGE_ID,
  MAX_PLACEHOLDER_CELLS,
} from "../src/image/kitty.js";
import {
  ROWCOLUMN_DIACRITICS,
  diacriticFor,
  diacriticIndexOf,
  isRowColumnDiacritic,
} from "../src/image/kitty-diacritics.js";
import { KITTY_TIER, selectTier, deriveCapabilities } from "../src/image/tier.js";
import {
  setGraphicsCapability,
  resetGraphicsCache,
  type GraphicsCapability,
} from "../src/image/capability.js";
import { clearImageCache } from "../src/image/cache.js";
import { clearResolveCache } from "../src/image/resolve.js";
import {
  renderImage,
  setGraphicsSink,
  clearImageHeaderCache,
  type GraphicsSink,
} from "../src/components/Image.js";
import { setColorMode, getColorMode, fgColorRgb, type ColorMode } from "../src/style/colors.js";
import { stringWidth, charWidth } from "../src/components/base.js";
import { themes } from "../src/style/theme.js";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import type { RenderContext } from "../src/components/base.js";
import type { ImageBlock } from "../src/config/types.js";
import type { PixelBuffer } from "../src/image/types.js";

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
const GRADIENT_PNG = join(HERE, "fixtures", "gradient-200x100.png");

const THEME = themes.dracula;

/** Every control byte the runtime's own output filter strips (runtime-terminal.ts). */
const C0_BYTES = /[\x00-\x1a\x1c-\x1f\x7f]/;

/** Max base64 bytes the protocol allows in one escape. */
const CHUNK_BYTES = 4096;

/**
 * A synthetic source whose every byte is distinct in a way a stride or
 * byte-order bug would disturb: a horizontal red ramp, a vertical green ramp,
 * and an xorshift blue channel. A flat image would round-trip through almost
 * any bug.
 */
function makeImage(w: number, h: number, opaque: boolean): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 0x2545f491;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const i = (y * w + x) * 4;
      data[i] = (x * 255 / Math.max(1, w - 1)) | 0;
      data[i + 1] = (y * 255 / Math.max(1, h - 1)) | 0;
      data[i + 2] = s & 0xff;
      // A half-transparent checkerboard: `isOpaque` must bail on the first one.
      data[i + 3] = opaque ? 255 : (x + y) % 2 === 0 ? 255 : (s >>> 8) & 0xff;
    }
  }
  return { data, width: w, height: h };
}

/** Deterministic high-entropy RGB, used to prove compression falls back raw. */
function makeNoiseImage(w: number, h: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 0x9e3779b9;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      data[i + c] = s & 0xff;
    }
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

// ─── The decoder: this file's half of the round trip ──────

interface Chunk {
  control: Map<string, string>;
  payload: string;
  raw: string;
}

/**
 * Split an escape stream into APC sequences, refusing any stray byte between
 * them. Deliberately strict: a single character emitted outside a sequence
 * would be printed by a real terminal, and finding that in a test is far
 * cheaper than finding it on screen.
 */
function splitEscapes(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const start = s.indexOf("\x1b_G", i);
    if (start !== i) throw new Error(`stray bytes before the escape at offset ${i}`);
    const end = s.indexOf("\x1b\\", start);
    if (end < 0) throw new Error("unterminated escape (no ST)");
    out.push(s.slice(start, end + 2));
    i = end + 2;
  }
  return out;
}

/** Parse one `ESC _ G <key=value,…> ; <payload> ESC \` sequence. */
function parseChunk(raw: string): Chunk {
  if (!raw.startsWith("\x1b_G")) throw new Error("missing APC introducer");
  if (!raw.endsWith("\x1b\\")) throw new Error("missing ST");
  const body = raw.slice(3, -2);
  const semi = body.indexOf(";");
  if (semi < 0) throw new Error("no ';' separating control data from payload");
  if (body.indexOf(";", semi + 1) >= 0) throw new Error("more than one ';' in the body");
  const control = new Map<string, string>();
  for (const kv of body.slice(0, semi).split(",")) {
    const eq = kv.indexOf("=");
    if (eq < 0) throw new Error(`malformed control key ${JSON.stringify(kv)}`);
    control.set(kv.slice(0, eq), kv.slice(eq + 1));
  }
  return { control, payload: body.slice(semi + 1), raw };
}

/** Reverse `encodeTransmit`: escape stream -> the pixels the terminal would hold. */
function decodeTransmit(wire: string): { pixels: PixelBuffer; chunks: Chunk[]; format: number } {
  const chunks = splitEscapes(wire).map(parseChunk);
  const head = chunks[0]!.control;
  const format = Number(head.get("f"));
  const width = Number(head.get("s"));
  const height = Number(head.get("v"));
  const encoded = Buffer.from(chunks.map(c => c.payload).join(""), "base64");
  const compression = head.get("o");
  if (compression !== undefined && compression !== "z") {
    throw new Error(`unsupported compression ${JSON.stringify(compression)}`);
  }
  const bytes = compression === "z" ? inflateSync(encoded) : encoded;
  const data = new Uint8ClampedArray(width * height * 4);
  if (format === 24) {
    for (let p = 0; p < width * height; p++) {
      data[p * 4] = bytes[p * 3]!;
      data[p * 4 + 1] = bytes[p * 3 + 1]!;
      data[p * 4 + 2] = bytes[p * 3 + 2]!;
      data[p * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < data.length; i++) data[i] = bytes[i]!;
  }
  return { pixels: { data, width, height }, chunks, format };
}

interface DecodedPlacement {
  /** Image ids read out of each row's foreground SGR. */
  ids: Set<number>;
  /** `cells[r][c]` is the (imageRow, imageColumn) that cell addresses. */
  cells: Array<Array<[number, number]>>;
  trailingReset: boolean[];
}

/**
 * Reverse `encodePlacement`: rows -> the cell addresses a terminal would read.
 *
 * Walks codepoints in threes (placeholder, row mark, column mark) and refuses
 * anything else, so an elided or transposed mark fails loudly rather than
 * decoding into a plausible-but-wrong picture.
 */
function decodePlacement(lines: string[]): DecodedPlacement {
  const ids = new Set<number>();
  const cells: Array<Array<[number, number]>> = [];
  const trailingReset: boolean[] = [];
  for (const line of lines) {
    trailingReset.push(line.endsWith("\x1b[0m"));
    const m = /^\x1b\[38;2;(\d+);(\d+);(\d+)m/.exec(line);
    if (!m) throw new Error("row does not start with a literal 24-bit foreground SGR");
    ids.add((Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]));
    const body = line.slice(m[0].length, line.length - "\x1b[0m".length);
    const cps = [...body].map(c => c.codePointAt(0)!);
    const row: Array<[number, number]> = [];
    for (let i = 0; i < cps.length; i += 3) {
      if (cps[i] !== 0x10eeee) {
        throw new Error(`expected a placeholder at codepoint ${i}, got U+${cps[i]!.toString(16)}`);
      }
      const r = diacriticIndexOf(cps[i + 1] ?? -1);
      const c = diacriticIndexOf(cps[i + 2] ?? -1);
      if (r < 0 || c < 0) throw new Error(`unrecognised diacritic pair at cell ${row.length}`);
      row.push([r, c]);
    }
    cells.push(row);
  }
  return { ids, cells, trailingReset };
}

/** Every image id carried by a foreground SGR anywhere in these rows. */
function idsIn(rows: string[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    for (const m of row.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g)) {
      out.push((Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]));
    }
  }
  return out;
}

/** Placeholder cells across a set of rows — the count a terminal would place. */
function placeholderCells(rows: string[]): number {
  let n = 0;
  for (const row of rows) for (const ch of row) if (ch === PLACEHOLDER_CHAR) n++;
  return n;
}

// ─── Render-path harness ──────────────────────────────────

/** A sink that records the intents `renderImage` declares, and their payloads. */
interface Recorder extends GraphicsSink {
  placements: Array<{ id: number; wire: string }>;
}

function recorder(): Recorder {
  const placements: Array<{ id: number; wire: string }> = [];
  return {
    placements,
    graphicsPlace(id: number, transmit: () => string): boolean {
      // The real runtime defers the thunk to `graphicsCommit()`, once the frame
      // is composed; a recorder has no frame, so it settles immediately. A
      // throwing thunk answers FALSE, which is what the renderer demotes on.
      try {
        placements.push({ id, wire: transmit() });
      } catch {
        return false;
      }
      return true;
    },
  };
}

const PIXEL_CAPABLE: GraphicsCapability = {
  kitty: true,
  kittyPlaceholders: true,
  source: "override",
  reason: "test: pixel path forced on",
};

const CELLS_ONLY: GraphicsCapability = {
  kitty: false,
  kittyPlaceholders: false,
  source: "denied",
  reason: "test: pixel path forced off",
};

function ctx(width: number): RenderContext {
  return { width, theme: THEME, borderStyle: "rounded" };
}

function imageBlock(path: string, extra: Partial<ImageBlock> = {}): ImageBlock {
  return { type: "image", path, ...extra } as ImageBlock;
}

/**
 * Render one image block with the session state the runtime would have
 * published, and hand back everything the terminal would have received.
 *
 * Every module-level slot touched here (`colorMode`, the graphics sink, the
 * graphics capability) is restored in a `finally`, because they are process-wide
 * and a leak would silently change every later test in this file.
 */
function renderWith(
  block: ImageBlock,
  opts: {
    mode?: ColorMode;
    capability?: GraphicsCapability;
    sink?: Recorder | null;
    width?: number;
    env?: Record<string, string | undefined>;
    /** Keep the image caches, so a sequence of renders shares one id space. */
    keepCache?: boolean;
  } = {},
): { rows: string[]; placements: Array<{ id: number; wire: string }> } {
  const sink = opts.sink === undefined ? recorder() : opts.sink;
  const prevMode = getColorMode();
  const prevSink = setGraphicsSink(sink);
  const savedEnv: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(opts.env ?? {})) {
    savedEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    resetGraphicsCache();
    setGraphicsCapability(opts.capability ?? PIXEL_CAPABLE);
    setColorMode(opts.mode ?? "truecolor");
    if (opts.keepCache !== true) {
      clearImageCache();
      clearResolveCache();
      clearImageHeaderCache();
    }
    const rows = renderImage(block, ctx(opts.width ?? 60));
    return { rows, placements: sink?.placements ?? [] };
  } finally {
    setColorMode(prevMode);
    setGraphicsSink(prevSink);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetGraphicsCache();
    if (opts.keepCache !== true) clearImageCache();
  }
}

// ═════════════════════════════════════════════════════════════
// THE DIACRITIC TABLE
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Diacritic table\x1b[0m\n");

test("The vendored table is a wire-format constant: unique, ordered, round-tripping", () => {
  // The terminal decodes an index by looking the codepoint up in ITS copy of
  // this list, so a duplicate or a reordered entry silently shifts every cell
  // of every image. Nothing here hardcodes 297 — that number is kitty's today
  // and its own header only promises "more than 255".
  assert(MAX_PLACEHOLDER_CELLS >= 256, `table must address >= 256 cells, got ${MAX_PLACEHOLDER_CELLS}`);
  assertEqual(MAX_PLACEHOLDER_CELLS, ROWCOLUMN_DIACRITICS.length, "MAX_PLACEHOLDER_CELLS is derived from the table");
  assertEqual(new Set(ROWCOLUMN_DIACRITICS).size, ROWCOLUMN_DIACRITICS.length, "distinct codepoints");
  assertEqual(ROWCOLUMN_DIACRITICS[0], 0x0305, "entry 0 is U+0305 COMBINING OVERLINE");
  assertEqual(ROWCOLUMN_DIACRITICS[MAX_PLACEHOLDER_CELLS - 1], 0x1d244, "last entry is U+1D244");
  for (let i = 0; i < MAX_PLACEHOLDER_CELLS; i++) {
    const cp = diacriticFor(i).codePointAt(0)!;
    assertEqual(diacriticIndexOf(cp), i, `index ${i} round-trips`);
    assert(isRowColumnDiacritic(cp), `U+${cp.toString(16)} must be recognised as a table member`);
  }
});

test("Every table entry is ZERO display columns, including the ones past index 30", () => {
  // This is the prerequisite the whole placeholder scheme rests on. charWidth
  // used to carry a hand-written block list that covered U+0300-036F and
  // stopped: entries 30..47 (U+0483…U+05A1) and the astral tail up to U+1D244
  // all measured 1, so any image wider or taller than 30 cells reported the
  // wrong width and every layout below it drifted.
  const wrong = ROWCOLUMN_DIACRITICS
    .map((cp, i) => [i, cp, charWidth(cp)] as const)
    .filter(([, , w]) => w !== 0);
  assertEqual(wrong.length, 0, `zero-width table entries (first offender: ${
    wrong.length ? `index ${wrong[0]![0]} U+${wrong[0]![1].toString(16).toUpperCase()} -> ${wrong[0]![2]}` : "none"
  })`);
  // And the specific ranges that were wrong, named so a regression is legible.
  for (const cp of [0x0483, 0x0487, 0x0592, 0x05a1, 0x0610, 0x1dc0, 0x1d244]) {
    assertEqual(charWidth(cp), 0, `U+${cp.toString(16).toUpperCase()}`);
  }
  assertEqual(charWidth(0x10eeee), 1, "the placeholder itself is ONE cell");
  assert(!isRowColumnDiacritic(0x0300), "U+0300 is excluded (it NFC-fuses with a Latin base)");
});

test("Out-of-range indices throw rather than clamping", () => {
  // A clamped index maps two image rows onto one terminal row and renders a
  // plausible-but-wrong picture; a throw is caught by the render path's gate.
  let threw = false;
  try { diacriticFor(MAX_PLACEHOLDER_CELLS); } catch (err) { threw = err instanceof RangeError; }
  assert(threw, `diacriticFor(${MAX_PLACEHOLDER_CELLS}) must throw RangeError`);
  threw = false;
  try { diacriticFor(-1); } catch (err) { threw = err instanceof RangeError; }
  assert(threw, "diacriticFor(-1) must throw RangeError");
  assertEqual(diacriticIndexOf(0x41), -1, "a non-member codepoint has no index");
});

// ═════════════════════════════════════════════════════════════
// TRANSMISSION: WIRE FORMAT
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Transmission — wire format\x1b[0m\n");

// 200x120 opaque = 72000 raw bytes -> 96000 base64 -> 24 chunks. Big enough
// that chunking, continuation control data and reassembly are all exercised.
const IMG = makeNoiseImage(200, 120);
const WIRE_ID = 0xabcdef;
const WIRE = encodeTransmit(WIRE_ID, IMG, 60, 30);
const WIRE_CHUNKS = splitEscapes(WIRE).map(parseChunk);

test("Every sequence is APC-introduced and ST-terminated, with no BEL and no stray bytes", () => {
  // splitEscapes throws on a byte outside a sequence, so reaching here already
  // proves the stream is nothing but escapes.
  assert(WIRE_CHUNKS.length > 1, `a 72 KB image must chunk, got ${WIRE_CHUNKS.length}`);
  for (const c of WIRE_CHUNKS) {
    assert(c.raw.startsWith("\x1b_G"), "escape must start with ESC _ G");
    assert(c.raw.endsWith("\x1b\\"), "escape must end with ST (ESC \\)");
  }
  // BEL is a valid ST in the spec and fatal here: the write path's C0 filter
  // strips it, which would leave an unterminated APC swallowing the frame.
  assert(!WIRE.includes("\x07"), "no BEL anywhere in the transmission");
  assertEqual(encodeDelete(WIRE_ID), "\x1b_Ga=d,d=I,i=11259375,q=2\x1b\\", "delete is one APC sequence");
  assert(!encodeDelete(WIRE_ID).includes("\x07"), "delete uses ST, not BEL");
});

test("No chunk exceeds 4096 payload bytes and no non-final chunk splits a base64 quantum", () => {
  const lengths = WIRE_CHUNKS.map(c => c.payload.length);
  assert(Math.max(...lengths) <= CHUNK_BYTES, `largest payload ${Math.max(...lengths)} > ${CHUNK_BYTES}`);
  // A split quantum decodes to garbage on terminals that concatenate before
  // decoding, which is most of them.
  for (const [i, len] of lengths.slice(0, -1).entries()) {
    assertEqual(len % 4, 0, `non-final chunk ${i} payload length is a multiple of 4`);
  }
  assertEqual(lengths.length, Math.ceil(96000 / CHUNK_BYTES), "chunk count for a 96000-byte base64 payload");
  assertEqual(lengths.reduce((a, b) => a + b, 0), 96000, "the payload reassembles to its full length");
});

test("m=1 on every chunk but the last, m=0 on the last", () => {
  for (const [i, c] of WIRE_CHUNKS.slice(0, -1).entries()) {
    assertEqual(c.control.get("m"), "1", `chunk ${i} promises more`);
  }
  assertEqual(WIRE_CHUNKS[WIRE_CHUNKS.length - 1]!.control.get("m"), "0", "the last chunk closes the transfer");
  // A single-chunk image must still say m=0 — an omitted m is "no chunking",
  // but an m=1 with no successor hangs the terminal's assembler.
  const tiny = splitEscapes(encodeTransmit(1, makeImage(2, 2, true), 2, 1)).map(parseChunk);
  assertEqual(tiny.length, 1, "a 2x2 image is one chunk");
  assertEqual(tiny[0]!.control.get("m"), "0", "the only chunk closes the transfer");
  assertEqual(tiny[0]!.control.has("o"), false, "a tiny payload stays raw");
});

test("Control keys appear on the FIRST chunk only", () => {
  // Repeating them on a continuation makes kitty treat the chunk as a new
  // command and drop the transfer — the single most common bug in this
  // protocol's implementations.
  const head = WIRE_CHUNKS[0]!.control;
  assertEqual(head.get("a"), "T", "a=T transmit and display");
  assertEqual(head.get("U"), "1", "U=1 makes the placement VIRTUAL (placeholder-driven)");
  assertEqual(head.get("t"), "d", "t=d direct — the only medium that survives an SSH hop");
  assertEqual(head.get("i"), String(WIRE_ID), "i carries the image id");
  assertEqual(head.get("s"), "200", "s carries the source pixel width");
  assertEqual(head.get("v"), "120", "v carries the source pixel height");
  assertEqual(head.get("c"), "60", "c carries the cell width");
  assertEqual(head.get("r"), "30", "r carries the cell height");
  assertEqual(head.has("o"), false, "incompressible data stays on the raw fallback");

  for (const [i, c] of WIRE_CHUNKS.slice(1).entries()) {
    assertEqual([...c.control.keys()].sort().join(","), "m,q", `continuation ${i} carries only m and q`);
  }
});

test("The continuation-key detector is not vacuous", () => {
  // Every assertion above would also pass against an encoder that emitted no
  // continuation chunks at all, or against a decoder that dropped keys. Inject
  // the exact bug and prove the check fires.
  const sabotaged = WIRE.replace("\x1b_Gm=1,q=2;", "\x1b_Ga=T,m=1,q=2;");
  assert(sabotaged !== WIRE, "the sabotage must actually change the stream");
  const chunks = splitEscapes(sabotaged).map(parseChunk);
  assert(
    chunks.slice(1).some(c => c.control.has("a")),
    "the detector must see a control key smuggled onto a continuation chunk",
  );
});

test("q=2 on every escape — no reply can reach the app's stdin as keystrokes", () => {
  // Not cosmetic. An unsolicited reply is written to stdin and dispatched by
  // the key handler; q=2 suppresses both OK and error responses.
  for (const [i, c] of WIRE_CHUNKS.entries()) {
    assertEqual(c.control.get("q"), "2", `chunk ${i} suppresses replies`);
  }
  assert(encodeDelete(WIRE_ID).includes("q=2"), "delete suppresses replies too");
});

// ═════════════════════════════════════════════════════════════
// TRANSMISSION: PIXEL ROUND TRIP
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Transmission — pixel round trip\x1b[0m\n");

test("An opaque source transmits as f=24 and decodes BYTE-IDENTICALLY", () => {
  const { pixels, format } = decodeTransmit(WIRE);
  assertEqual(format, 24, "opaque sources drop the alpha channel (25% fewer bytes before base64)");
  assertEqual(pixels.width, IMG.width, "source width survives");
  assertEqual(pixels.height, IMG.height, "source height survives");
  assertEqual(pixels.data.length, IMG.data.length, "buffer length survives");
  let firstBad = -1;
  for (let i = 0; i < IMG.data.length; i++) {
    if (pixels.data[i] !== IMG.data[i]) { firstBad = i; break; }
  }
  assertEqual(firstBad, -1, `every byte matches (first mismatch at index ${firstBad}: ` +
    `${firstBad >= 0 ? `${IMG.data[firstBad]} -> ${pixels.data[firstBad]}` : "none"})`);
});

test("A compressible source uses o=z and still decodes BYTE-IDENTICALLY", () => {
  const src = makeImage(200, 120, true);
  // Flatten the pseudo-random blue channel so this fixture is intentionally
  // compressible rather than merely hoping a gradient crosses the threshold.
  for (let i = 0; i < src.data.length; i += 4) src.data[i + 2] = 64;

  const decoded = decodeTransmit(encodeTransmit(0x010204, src, 60, 30));
  assertEqual(decoded.chunks[0]!.control.get("o"), "z", "the first chunk opts into zlib");
  assert(decoded.chunks.length > 1, "the compressed fixture must exercise continuation chunks");
  for (const [i, chunk] of decoded.chunks.slice(1).entries()) {
    assertEqual(chunk.control.has("o"), false, `continuation ${i} does not repeat o=z`);
  }
  const payloadChars = decoded.chunks.reduce((sum, chunk) => sum + chunk.payload.length, 0);
  assert(payloadChars < 96000, `compression must shrink the 96000-char raw payload, got ${payloadChars}`);
  let bad = 0;
  for (let i = 0; i < src.data.length; i++) if (decoded.pixels.data[i] !== src.data[i]) bad++;
  assertEqual(bad, 0, "zlib round-trip differing bytes");
});

test("A source with alpha transmits as f=32 and decodes BYTE-IDENTICALLY", () => {
  const src = makeImage(97, 53, false);
  const { pixels, format, chunks } = decodeTransmit(encodeTransmit(0x010203, src, 40, 12));
  assertEqual(format, 32, "a single transparent pixel forces RGBA");
  assert(chunks.length > 1, `97x53 RGBA must chunk, got ${chunks.length}`);
  assertEqual(pixels.data.length, src.data.length, "buffer length survives");
  let bad = 0;
  for (let i = 0; i < src.data.length; i++) if (pixels.data[i] !== src.data[i]) bad++;
  assertEqual(bad, 0, "differing bytes, alpha included");
  // The alpha really is non-trivial, so the assertion above has content.
  let transparent = 0;
  for (let i = 3; i < src.data.length; i += 4) if (src.data[i] !== 255) transparent++;
  assert(transparent > 0, "the fixture must actually contain transparency");
});

test("Boundary sizes round-trip: 1x1, an exact chunk multiple, and one byte past it", () => {
  // 1024x1 opaque = 3072 raw bytes -> exactly 4096 base64 characters, i.e. one
  // full chunk with nothing following it. Off-by-one chunking shows up here or
  // nowhere.
  for (const [w, h, cols, rows, label] of [
    [1, 1, 1, 1, "1x1"],
    [1024, 1, 60, 1, "1024x1 (exactly 4096 base64 bytes)"],
    [1025, 1, 60, 1, "1025x1 (one pixel past the chunk boundary)"],
  ] as const) {
    const src = makeImage(w, h, true);
    const wire = encodeTransmit(0x0f0f0f, src, cols, rows);
    const decoded = decodeTransmit(wire);
    let bad = 0;
    for (let i = 0; i < src.data.length; i++) if (decoded.pixels.data[i] !== src.data[i]) bad++;
    assertEqual(bad, 0, `${label}: differing bytes`);
    const lengths = decoded.chunks.map(c => c.payload.length);
    assert(Math.max(...lengths) <= CHUNK_BYTES, `${label}: payload over the ceiling`);
    assertEqual(decoded.chunks[decoded.chunks.length - 1]!.control.get("m"), "0", `${label}: last chunk closes`);
  }
  assertEqual(splitEscapes(encodeTransmit(1, makeImage(1024, 1, true), 60, 1)).length, 1, "4096 base64 bytes fit one chunk");
  assertEqual(splitEscapes(encodeTransmit(1, makeImage(1025, 1, true), 60, 1)).length, 2, "4100 base64 bytes need two");
});

test("A malformed buffer is refused, not transmitted as garbage", () => {
  const src = makeImage(4, 4, true);
  for (const [buffer, label] of [
    [{ data: src.data.slice(0, 16), width: 4, height: 4 }, "buffer shorter than width*height*4"],
    [{ data: src.data, width: 0, height: 4 }, "zero width"],
    [{ data: src.data, width: 4, height: -1 }, "negative height"],
  ] as const) {
    let threw = false;
    try { encodeTransmit(1, buffer as PixelBuffer, 2, 2); } catch (err) { threw = err instanceof RangeError; }
    assert(threw, `${label} must throw RangeError`);
  }
});

// ═════════════════════════════════════════════════════════════
// PLACEMENT: THE PROPERTY THE SCHEME RESTS ON
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Placement — geometry and display width\x1b[0m\n");

/**
 * Sizes covering the whole addressable range. Anything at or past 31 exercises
 * the diacritics that used to measure 1 cell (index 30 is U+0483, the first
 * entry outside the U+0300-036F block the old width table covered), and the
 * table-limit case is the widest row the protocol can express at all.
 */
const PLACEMENT_SIZES: Array<[number, number]> = [
  [1, 1],
  [8, 4],
  [31, 31],
  [40, 33],
  [99, 60],
  [MAX_PLACEHOLDER_CELLS, 8],
  [8, MAX_PLACEHOLDER_CELLS],
];

test("Every placement row measures exactly `cols` display columns", () => {
  for (const [cols, rows] of PLACEMENT_SIZES) {
    const lines = encodePlacement(0x123456, cols, rows);
    assertEqual(lines.length, rows, `${cols}x${rows}: one string per image row`);
    const widths = new Set(lines.map(l => stringWidth(l)));
    assertEqual([...widths].join(","), String(cols), `${cols}x${rows}: distinct stringWidth values`);
  }
});

test("Row width is `cols` by codepoint count too, independent of charWidth", () => {
  // A second, independent measure of the same property: if charWidth were
  // wrong in a way that happened to cancel out, this would still catch it.
  for (const [cols, rows] of PLACEMENT_SIZES) {
    const lines = encodePlacement(0x123456, cols, rows);
    const counts = new Set(lines.map(l => placeholderCells([l])));
    assertEqual([...counts].join(","), String(cols), `${cols}x${rows}: placeholders per row`);
  }
});

test("Every cell decodes to its own (row, column) — no transposition, no off-by-one", () => {
  for (const [cols, rows] of [[40, 33], [MAX_PLACEHOLDER_CELLS, 8], [8, MAX_PLACEHOLDER_CELLS]] as const) {
    const decoded = decodePlacement(encodePlacement(0x123456, cols, rows));
    let firstBad = "";
    outer: for (let r = 0; r < rows; r++) {
      const row = decoded.cells[r]!;
      if (row.length !== cols) { firstBad = `row ${r} has ${row.length} cells, want ${cols}`; break; }
      for (let c = 0; c < cols; c++) {
        if (row[c]![0] !== r || row[c]![1] !== c) {
          firstBad = `cell (${r},${c}) decodes to (${row[c]![0]},${row[c]![1]})`;
          break outer;
        }
      }
    }
    assertEqual(firstBad, "", `${cols}x${rows} addressing`);
  }
});

test("The width and addressing checks are not vacuous", () => {
  // Every assertion above is only worth having if it fails on a wrong row.
  // Hand-build the three ways this encoding actually goes wrong and prove the
  // two independent detectors — stringWidth and the decoder — catch each one.
  const fg = imageIdColor(0x123456);
  const reset = "\x1b[0m";

  // 1. Marks transposed (column first). Same width, wrong picture — only the
  //    decoder can see this, which is why the addressing check exists at all.
  const transposed = [0, 1].map(r =>
    fg + [0, 1, 2].map(c => PLACEHOLDER_CHAR + diacriticFor(c) + diacriticFor(r)).join("") + reset);
  assertEqual(stringWidth(transposed[0]!), 3, "a transposed row still measures 3 — width alone cannot catch it");
  const bad = decodePlacement(transposed).cells;
  assert(
    bad[1]![0]![0] !== 1 || bad[1]![0]![1] !== 0,
    "the decoder must disagree with the identity mapping on a transposed row",
  );

  // 2. Column mark elided (kitty's compressed form, which this encoder
  //    deliberately does not emit because cutToWidth can clip a run in half).
  const elided = [fg + [0, 1, 2].map(() => PLACEHOLDER_CHAR + diacriticFor(0)).join("") + reset];
  let threw = false;
  try { decodePlacement(elided); } catch { threw = true; }
  assert(threw, "the decoder must reject an elided column mark rather than guessing");

  // 3. A mark that is not in the table at all — the exact failure that made
  //    every image past 30 cells measure wrong before charWidth was fixed.
  const visible = [fg + [0, 1, 2].map(c => PLACEHOLDER_CHAR + diacriticFor(0) + "x").join("") + reset];
  assertEqual(stringWidth(visible[0]!), 6, "a non-zero-width mark doubles the row's measured width");
  assert(stringWidth(visible[0]!) !== 3, "…so the width check would have failed");
});

test("Every row carries the image id and ends with a LITERAL reset", () => {
  const id = 0x0a0b0c;
  const decoded = decodePlacement(encodePlacement(id, 40, 33));
  assertEqual(decoded.ids.size, 1, "one id across all rows");
  assertEqual([...decoded.ids][0], id, "and it is the id we asked for");
  assert(decoded.trailingReset.every(Boolean), "every row ends with \\x1b[0m");
  // The terminator must NOT be style/colors.ts's `reset` binding, which becomes
  // "" under colorMode "none" and would leak the id colour into the rest of the
  // row. Proven by rendering at every colour mode further down; here just pin
  // that the encoder is unconditional.
  const rows = encodePlacement(id, 4, 2);
  for (const row of rows) {
    assertEqual((row.match(/\x1b\[0m/g) ?? []).length, 1, "exactly one reset per row");
    assertEqual((row.match(/m/g) ?? []).length, 2, "exactly two 'm' bytes — cutToWidth's SGR scanner exits on both");
  }
});

test("Placement rows are ordinary text: no C0 bytes, so the write path's filter cannot damage them", () => {
  // This is why placeholders were chosen over direct placement: the rows go
  // into `lines: string[]` and through the same C0-stripping writer as every
  // other row.
  for (const [cols, rows] of PLACEMENT_SIZES) {
    for (const line of encodePlacement(0x123456, cols, rows)) {
      assert(!C0_BYTES.test(line), `${cols}x${rows}: a placement row contains a C0 byte`);
    }
  }
});

test("Geometry past the table is refused by both the gate and the encoders", () => {
  const over = MAX_PLACEHOLDER_CELLS + 1;
  assert(canPlaceholder(MAX_PLACEHOLDER_CELLS, MAX_PLACEHOLDER_CELLS), "the table limit itself is placeable");
  assert(!canPlaceholder(over, 1), "one column past the table is not");
  assert(!canPlaceholder(1, over), "one row past the table is not");
  assert(!canPlaceholder(0, 4) && !canPlaceholder(4, 0), "an empty footprint is not placeable");
  assert(!canPlaceholder(4.5, 4), "a fractional footprint is not placeable");
  for (const [cols, rows] of [[over, 1], [1, over], [0, 1]] as const) {
    let threw = false;
    try { encodePlacement(1, cols, rows); } catch (err) { threw = err instanceof RangeError; }
    assert(threw, `encodePlacement(${cols}x${rows}) must throw RangeError`);
    threw = false;
    try { encodeTransmit(1, makeImage(4, 4, true), cols, rows); } catch (err) { threw = err instanceof RangeError; }
    assert(threw, `encodeTransmit at ${cols}x${rows} must throw RangeError`);
  }
});

// ═════════════════════════════════════════════════════════════
// IMAGE IDS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Image ids\x1b[0m\n");

test("Ids stay inside three colour bytes, so a third diacritic is never needed", () => {
  __resetImageIds();
  const a = nextImageId();
  const b = nextImageId();
  assertEqual(b, a + 1, "ids increment");
  assert(a >= 1 && b <= MAX_IMAGE_ID, `ids must lie in 1..${MAX_IMAGE_ID}, got ${a} and ${b}`);
  assertEqual(MAX_IMAGE_ID, 0xffffff, "the ceiling is exactly three bytes");
  assertEqual(imageIdColor(MAX_IMAGE_ID), "\x1b[38;2;255;255;255m", "the ceiling encodes without a fourth byte");
  // Ids start well clear of the low numbers other programs on the same
  // terminal hand out first.
  assert(a > 0x1000, `id origin ${a.toString(16)} is too close to the ids other tools use`);
  for (const bad of [0, -1, MAX_IMAGE_ID + 1, 1.5, NaN]) {
    let threw = false;
    try { encodeDelete(bad); } catch (err) { threw = err instanceof RangeError; }
    assert(threw, `encodeDelete(${bad}) must throw RangeError`);
  }
});

test("imageIdColor is a literal 24-bit SGR, NOT what the theme helper would emit at 256", () => {
  // The id travels in the foreground colour. fgColorRgb routes through
  // rgbTo256 whenever colorMode is "256" — which is what an SSH client
  // reporting xterm-256color gets while really being kitty — and quantizing
  // destroys the id.
  const id = 0x747569;
  const literal = imageIdColor(id);
  assertEqual(literal, "\x1b[38;2;116;117;105m", "the hand-written SGR");
  const prev = getColorMode();
  try {
    setColorMode("256");
    const themed = fgColorRgb(116, 117, 105);
    assert(themed !== literal, `fgColorRgb at 256 must differ from the literal (got ${JSON.stringify(themed)})`);
    assert(/\x1b\[38;5;\d+m/.test(themed), `the themed form quantizes to the cube: ${JSON.stringify(themed)}`);
    assertEqual(imageIdColor(id), literal, "imageIdColor is unaffected by the colour mode");
    setColorMode("none");
    assertEqual(imageIdColor(id), literal, "…including the mode that suppresses colour entirely");
  } finally {
    setColorMode(prev);
  }
});

// ═════════════════════════════════════════════════════════════
// THROUGH THE REAL RENDERER
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Through the real renderer\x1b[0m\n");

test("A capable terminal gets placement rows, and the transmission goes to the sink", () => {
  const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 40 }));
  assertEqual(placements.length, 1, "exactly one placement intent for one image");
  const cells = placeholderCells(rows);
  assert(cells > 0, "the frame must contain placeholder cells");
  assertEqual(cells, 40 * rows.length, `every row carries 40 placeholder cells (${rows.length} rows)`);
  // The megabyte of base64 must never appear in a frame row: cutToWidth's SGR
  // scanner would shred it at the first 'm'.
  for (const row of rows) assert(!row.includes("\x1b_G"), "an APC payload leaked into a composed row");
  // …and the transmission the sink got really is a valid one for these rows.
  const decoded = decodeTransmit(placements[0]!.wire);
  const head = splitEscapes(placements[0]!.wire).map(parseChunk)[0]!.control;
  assertEqual(head.get("i"), String(placements[0]!.id), "the transmission names the placed id");
  assertEqual(head.get("c"), "40", "the transmission's cell width matches the placement");
  assertEqual(head.get("r"), String(rows.length), "the transmission's cell height matches the row count");
  assertEqual(decoded.pixels.width, 40 * 10, "10 source pixels per cell column");
  assertEqual(decoded.pixels.height, rows.length * 20, "20 source pixels per cell row");
});

test("The id survives the renderer UNQUANTIZED at every colour mode, 256 included", () => {
  // The regression this guards: an SSH client reporting xterm-256color that is
  // really kitty renders at colorMode "256". If the id colour went through the
  // theme helpers it would be quantized to the cube and the terminal would
  // place the wrong image — or none.
  for (const mode of ["truecolor", "256", "16", "none"] as const) {
    const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 24 }), { mode });
    assertEqual(placements.length, 1, `${mode}: one placement`);
    const ids = idsIn(rows);
    assert(ids.length > 0, `${mode}: no 24-bit foreground SGR in the frame`);
    assertEqual(new Set(ids).size, 1, `${mode}: one distinct id across the frame`);
    assertEqual(ids[0], placements[0]!.id, `${mode}: the painted id is the transmitted id`);
    // Under "none" the shared `reset` binding is "", so a row that used it as
    // its terminator would leak the id colour into the rest of the frame.
    for (const row of rows) {
      assert(row.endsWith("\x1b[0m"), `${mode}: a placement row does not end with a literal reset`);
    }
  }
});

test("A growing frame transmits MORE pixels, under a NEW id each time", () => {
  // Two claims in one, both about a resizable frame on the pixel path.
  //   1. The source buffer is cols*10 x rows*20, so a wider frame is a denser
  //      sample rather than an upscale of the old one — the pixel tier's
  //      version of what the cell tiers get from their sub-cell factor.
  //   2. Each footprint keys its own cache entry and therefore its own image
  //      id. That is required, not incidental: re-transmitting onto a LIVE id
  //      is unspecified (kitty issue #8701 — Ghostty updates it, kitty does
  //      not), so growth must allocate rather than overwrite.
  // The caches are deliberately SHARED across the loop; clearing them between
  // renders would hand out fresh ids for trivial reasons and make (2) vacuous.
  clearImageCache();
  clearResolveCache();
  clearImageHeaderCache();
  const seen: Array<{ cols: number; pixels: number; id: number }> = [];
  for (const width of [16, 32, 64]) {
    const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width }), {
      width: 99,
      keepCache: true,
    });
    const decoded = decodeTransmit(placements[0]!.wire);
    seen.push({ cols: width, pixels: decoded.pixels.width * decoded.pixels.height, id: placements[0]!.id });
    assertEqual(decoded.pixels.width, width * 10, `${width} cells wide -> ${width * 10} source pixels`);
    assertEqual(placeholderCells(rows), width * rows.length, `${width}: placeholder cells`);
  }
  assert(seen[1]!.pixels > seen[0]!.pixels, `32 cells must sample more than 16 (${seen[0]!.pixels} -> ${seen[1]!.pixels})`);
  assert(seen[2]!.pixels > seen[1]!.pixels, `64 cells must sample more than 32 (${seen[1]!.pixels} -> ${seen[2]!.pixels})`);
  assertEqual(new Set(seen.map(s => s.id)).size, 3, "three footprints, three ids");

  // Returning to a size already transmitted reuses its entry — the cache is
  // keyed on the footprint, so shrinking back does not leak a new id per press.
  const again = renderWith(imageBlock(GRADIENT_PNG, { width: 16 }), { width: 99, keepCache: true });
  assertEqual(again.placements[0]!.id, seen[0]!.id, "the 16-cell frame keeps its original id");
  clearImageCache();
});

// ═════════════════════════════════════════════════════════════
// THE EMULATOR'S VIEW
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  The emulator's view\x1b[0m\n");

test("A chunked transmission is ONE graphics record, and no payload reaches the cell grid", () => {
  const vt = new VirtualTerminal(80, 40);
  vt.write(WIRE);
  const records = vt.graphics();
  assertEqual(records.length, 1, "24 escapes coalesce into one logical transfer");
  const rec = records[0]!;
  assertEqual(rec.protocol, "apc", "kitty graphics arrive as APC");
  assertEqual(rec.chunks, WIRE_CHUNKS.length, "every chunk is accounted for");
  assertEqual(rec.byteLength, WIRE.length, "byteLength is the whole transfer, not the first slice");
  assert(rec.controlData.includes("a=T"), `control data identifies the transmission: ${rec.controlData}`);
  assert(rec.controlData.includes(`i=${WIRE_ID}`), "…and names the image id");

  // The payload must not be printed. A terminal that mis-parses APC would show
  // base64 on screen, which is exactly what q=2 and the ST terminator prevent.
  const screen = vt.text();
  assert(screen.trim() === "", `the cell grid must stay empty, got ${JSON.stringify(screen.slice(0, 80))}`);
  const sample = WIRE_CHUNKS[0]!.payload.slice(0, 32);
  assert(sample.length === 32, "sanity: the sample really is payload");
  assert(!screen.includes(sample), "base64 payload leaked into the cell grid");
});

test("Placement rows land as exactly one cell each in the emulator's grid", () => {
  // The diacritics must attach to the preceding cell rather than advancing the
  // cursor; if they did not, an image would occupy 3x its width on screen.
  const cols = 40;
  const rows = 6;
  const vt = new VirtualTerminal(80, 20);
  vt.write(encodePlacement(0x334455, cols, rows).join("\r\n"));
  const grid = vt.cells();
  for (let r = 0; r < rows; r++) {
    let occupied = 0;
    for (let c = 0; c < 80; c++) {
      if (grid[r]![c]!.char.codePointAt(0) === 0x10eeee) occupied++;
    }
    assertEqual(occupied, cols, `row ${r}: placeholder cells on screen`);
    // Column cols and beyond must be untouched — nothing wrapped or spilled.
    assertEqual(grid[r]![cols]!.char, " ", `row ${r}: nothing painted past the image`);
  }
  assertEqual(vt.graphics().length, 0, "placement rows are TEXT — they produce no graphics record");
});

test("A delete is its own record and does not merge into a transmission", () => {
  const vt = new VirtualTerminal(80, 20);
  vt.write(WIRE);
  vt.write(encodeDelete(WIRE_ID));
  const records = vt.graphics();
  assertEqual(records.length, 2, "transmit + delete");
  assertEqual(records[1]!.chunks, 1, "a delete is never chunked");
  assert(records[1]!.controlData.includes("a=d"), `delete control data: ${records[1]!.controlData}`);
  assert(records[1]!.controlData.includes("d=I"), "d=I is the uppercase form that actually frees the pixels");
});

// ═════════════════════════════════════════════════════════════
// CAPABILITY GATING
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Capability gating\x1b[0m\n");

test("selectTier reaches the pixel tier ONLY with a placeholder-capable gate", () => {
  const caps = deriveCapabilities("truecolor", true);
  assertEqual(selectTier("auto", caps, { kittyPlaceholders: true }), KITTY_TIER, "capable terminal");
  assertEqual(selectTier("auto", caps, { kittyPlaceholders: false }), "quadrant", "kitty without placeholders (Konsole)");
  assertEqual(selectTier("auto", caps), "quadrant", "no gate supplied — the safe default for every existing caller");
  // An author's explicit mode and the cell escape hatch both outrank pixels.
  assertEqual(selectTier("half", caps, { kittyPlaceholders: true }), "half", "an explicit block mode wins");
});

test("With the gate denied, the renderer emits ZERO graphics bytes and draws cells", () => {
  const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 40 }), {
    capability: CELLS_ONLY,
  });
  assertEqual(placements.length, 0, "the sink is never called");
  assertEqual(placeholderCells(rows), 0, "not one placeholder cell — those would be tofu here");
  // …but the image still renders. Unicode-capable hosts negotiate quadrant
  // cells with combined foreground/background SGR. A bare Windows CI process
  // legitimately negotiates solid cells, whose SGR is background-only. Both
  // contain a truecolor background, and neither can be mistaken for placement.
  assert(rows.join("").includes("48;2;"), "the image must still render as coloured cells");
  // Nothing that could be mistaken for a graphics escape leaves the renderer.
  for (const row of rows) {
    assert(!row.includes("\x1b_"), "an APC introducer reached a frame row");
    assert(!row.includes("\x1bP"), "a DCS introducer reached a frame row");
  }
  const vt = new VirtualTerminal(120, rows.length + 2);
  vt.write(rows.join("\r\n"));
  assertEqual(vt.graphics().length, 0, "a real terminal parser sees no graphics sequence at all");
});

test("TERMINALTUI_IMAGE pins the cell path, which necessarily defeats pixels", () => {
  // The two escape hatches have different jobs and used to disagree: a value
  // that names a cell tier cannot also produce a bitmap.
  for (const value of ["off", "half", "cells", "ascii"]) {
    const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 40 }), {
      env: { TERMINALTUI_IMAGE: value },
    });
    assertEqual(placements.length, 0, `TERMINALTUI_IMAGE=${value}: no transmission`);
    assertEqual(placeholderCells(rows), 0, `TERMINALTUI_IMAGE=${value}: no placeholder cells`);
  }
  // A typo must degrade to normal negotiation rather than silently disabling
  // images — the documented behaviour, and the exact drift that was fixed.
  const { placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 40 }), {
    env: { TERMINALTUI_IMAGE: "quadrnat" },
  });
  assertEqual(placements.length, 1, "an unrecognised value is neutral, so pixels still negotiate");
});

test("No graphics sink means cells, never a grid of tofu", () => {
  // renderImage called outside a runtime — a unit test, an embedder, a
  // snapshot script. Placement cells with no transmission behind them are
  // unreadable, so the pixel tier must decline rather than half-commit.
  const { rows, placements } = renderWith(imageBlock(GRADIENT_PNG, { width: 40 }), { sink: null });
  assertEqual(placements.length, 0, "no sink, no placements");
  assertEqual(placeholderCells(rows), 0, "no placeholder cells");
  assert(rows.length > 0, "the image still renders");
  assert(!rows.join("").includes("[Image:"), "and it is pixels-as-cells, not the placeholder text");
});

test("An unreadable source demotes to the alt box instead of placing an empty image", () => {
  const missing = imageBlock(join(HERE, "fixtures", "does-not-exist.png"), { width: 40, alt: "GONE" });
  const { rows, placements } = renderWith(missing);
  assertEqual(placements.length, 0, "nothing is transmitted for a source that will not decode");
  assertEqual(placeholderCells(rows), 0, "and nothing is placed");
  assert(rows.join("\n").includes("GONE"), "the alt label is drawn instead");
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
