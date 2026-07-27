/**
 * Tests for the pure-TypeScript animated GIF decoder (src/image/gif.ts).
 *
 * Two kinds of evidence, on purpose:
 *
 *  1. Synthetic GIFs built byte-by-byte in this file, including a mirrored
 *     LZW *encoder*, so each format feature (interlace, disposal, KwKwK,
 *     mid-stream CLEAR, local tables) is exercised by a stream whose correct
 *     output is known by construction — not by what the decoder happens to
 *     produce.
 *
 *  2. Ground truth against ffmpeg: reference frames are extracted with
 *     `ffmpeg -vsync 0` as PNGs, decoded through the repo's own decodeImage,
 *     and compared per channel against our composited canvases. A decoder
 *     that only agrees with itself proves nothing; agreeing with ffmpeg to
 *     MAE ~0 on a 36-frame dirty-rect GIF pins the compositing. Delays and
 *     frame counts are checked against `ffprobe -show_frames` the same way.
 *     Pixels our decoder leaves fully transparent are masked out of the
 *     comparison — ffmpeg seeds them with the background colour, a canvas
 *     convention rather than compositing — so the claim holds for GIFs whose
 *     first frame does not cover the canvas, not only for these fixtures.
 *
 * The ffmpeg section is skipped (not failed) when no ffmpeg binary exists,
 * because the decoder under test exists precisely for such machines — the
 * synthetic section still runs everywhere.
 *
 * Run:  npx tsx test/test-gif-decode.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decodeGif,
  decodeGifFirstFrame,
  normalizeGifDelayMs,
} from "../src/image/gif.js";
import type { GifImage } from "../src/image/gif.js";
import { decodeImage } from "../src/image/decode.js";
import { IMAGE_LIMITS } from "../src/image/types.js";
import type { PixelBuffer } from "../src/image/types.js";

// ─── Test harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err instanceof Error ? err.message : String(err)}\x1b[0m`);
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

/** Unwrap a decode expected to succeed, so failures carry the reason. */
function mustDecode(bytes: Uint8Array, label: string): GifImage {
  const result = decodeGif(bytes);
  if (!result.ok) throw new Error(`${label}: decode failed: ${result.reason}`);
  return result.gif;
}

/** Assert one canvas pixel is exactly the given RGBA. */
function assertPixel(
  frame: PixelBuffer,
  x: number,
  y: number,
  rgba: [number, number, number, number],
  label: string,
): void {
  const i = (y * frame.width + x) * 4;
  const got = [frame.data[i], frame.data[i + 1], frame.data[i + 2], frame.data[i + 3]];
  if (got[0] !== rgba[0] || got[1] !== rgba[1] || got[2] !== rgba[2] || got[3] !== rgba[3]) {
    throw new Error(`${label}: pixel (${x},${y}) expected [${rgba}], got [${got}]`);
  }
}

// ─── Synthetic GIF builder ────────────────────────────────
//
// A miniature GIF *writer*, so every feature test runs against a stream whose
// correct decode is known by construction. The LZW encoder mirrors the
// decoder's width-growth rule exactly (grow after the table reaches the code
// space, encoder one entry ahead), which is the property that makes real
// encoder/decoder pairs interoperate — and the property under test.

/** Smallest power p >= 1 with 2^p >= n; colour table sizes are 2^p entries. */
function tablePow(n: number): number {
  let p = 1;
  while (1 << p < n) p++;
  return p;
}

function lzwEncode(indices: number[], minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out: number[] = [];
  let acc = 0;
  let accBits = 0;
  let width = minCodeSize + 1;
  let next = end + 1;
  const dict = new Map<string, number>();

  const emit = (code: number): void => {
    acc |= code << accBits;
    accBits += width;
    while (accBits >= 8) {
      out.push(acc & 0xff);
      acc >>= 8;
      accBits -= 8;
    }
  };

  emit(clear);
  let prevKey = "";
  let prevCode = -1;
  for (const k of indices) {
    if (prevKey === "") {
      prevKey = String(k);
      prevCode = k;
      continue;
    }
    const key = `${prevKey},${k}`;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prevKey = key;
      prevCode = hit;
      continue;
    }
    emit(prevCode);
    if (next < 4096) {
      dict.set(key, next);
      next++;
      // Mirror of the decoder: it adds its entry one code later, so its table
      // holds next-1 entries when it has processed the code just emitted —
      // and it widens once that count reaches the code space.
      if (next > 1 << width && width < 12) width++;
    }
    prevKey = String(k);
    prevCode = k;
  }
  if (prevCode >= 0) emit(prevCode);
  emit(end);
  if (accBits > 0) out.push(acc & 0xff);
  return Uint8Array.from(out);
}

/** Pack explicit (code, width) pairs LSB-first — for hand-built LZW streams. */
function packCodes(codes: Array<[number, number]>): Uint8Array {
  const out: number[] = [];
  let acc = 0;
  let accBits = 0;
  for (const [code, width] of codes) {
    acc |= code << accBits;
    accBits += width;
    while (accBits >= 8) {
      out.push(acc & 0xff);
      acc >>= 8;
      accBits -= 8;
    }
  }
  if (accBits > 0) out.push(acc & 0xff);
  return Uint8Array.from(out);
}

/**
 * Worst-case LZW amplification: CLEAR, one literal, then always the next free
 * code (the KwKwK case), then the deepest code repeated once the table
 * saturates at 4096. Each ladder code appends a chain one longer than the
 * last, so ~27 KiB of codes expands to the full 64 Mpx budget — the shape the
 * decoder's budget regressions below exist to stop. Output may overshoot
 * `npix`; the decoder drops the excess and stops at npix, exactly as a
 * hostile file would rely on. Every chain bottoms out at literal 0, so the
 * decoded indices are all 0.
 */
function kwkwkLadderLzw(npix: number): Uint8Array {
  const clear = 4; // minCodeSize 2: clear = 1 << 2, end = 5
  const codes: Array<[number, number]> = [];
  let codeSize = 3; // minCodeSize + 1
  let available = 6; // end + 1
  let chainLen = 1; // expansion length of the deepest table entry
  let produced = 1; // the literal below
  codes.push([clear, codeSize], [0, codeSize]);
  while (produced < npix) {
    if (available < 4096) {
      codes.push([available, codeSize]);
      chainLen++;
      produced += chainLen;
      available++;
      // Mirror of the decoder's growth rule: widen once the table fills the
      // current code space, 12-bit ceiling.
      if (available > (1 << codeSize) - 1 && codeSize < 12) codeSize++;
    } else {
      codes.push([4095, codeSize]);
      produced += chainLen;
    }
  }
  return packCodes(codes);
}

type Rgb = [number, number, number];

interface FrameSpec {
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Palette indices in FILE order (pre-reordered by caller when interlaced). */
  indices?: number[];
  /** Pre-packed LZW code bytes; overrides `indices`. */
  rawLzw?: Uint8Array;
  lct?: Rgb[];
  interlace?: boolean;
  gce?: { delayCs?: number; disposal?: number; transparentIndex?: number };
  minCodeSize?: number;
  /** Data sub-block chunk size, default 255. */
  subBlockSize?: number;
}

interface GifSpec {
  version?: "87a" | "89a";
  w: number;
  h: number;
  gct?: Rgb[];
  bg?: number;
  loop?: number;
  frames: FrameSpec[];
}

function buildGif(spec: GifSpec): Uint8Array {
  const out: number[] = [];
  const str = (s: string): void => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  };
  const u16 = (v: number): void => {
    out.push(v & 0xff, (v >> 8) & 0xff);
  };
  const table = (entries: Rgb[], pow: number): void => {
    for (let i = 0; i < 1 << pow; i++) {
      const e = entries[i] ?? [0, 0, 0];
      out.push(e[0], e[1], e[2]);
    }
  };

  str(`GIF${spec.version ?? "89a"}`);
  u16(spec.w);
  u16(spec.h);
  const gctPow = spec.gct ? tablePow(spec.gct.length) : 0;
  out.push(spec.gct ? 0x80 | (gctPow - 1) : 0, spec.bg ?? 0, 0);
  if (spec.gct) table(spec.gct, gctPow);

  if (spec.loop !== undefined) {
    out.push(0x21, 0xff, 11);
    str("NETSCAPE2.0");
    out.push(3, 1, spec.loop & 0xff, (spec.loop >> 8) & 0xff, 0);
  }

  for (const f of spec.frames) {
    if (f.gce !== undefined) {
      const trans = f.gce.transparentIndex;
      const packed = ((f.gce.disposal ?? 0) << 2) | (trans !== undefined ? 1 : 0);
      out.push(0x21, 0xf9, 4, packed);
      u16(f.gce.delayCs ?? 0);
      out.push(trans ?? 0, 0);
    }
    out.push(0x2c);
    u16(f.x ?? 0);
    u16(f.y ?? 0);
    u16(f.w);
    u16(f.h);
    const lctPow = f.lct ? tablePow(f.lct.length) : 0;
    let packed = f.lct ? 0x80 | (lctPow - 1) : 0;
    if (f.interlace) packed |= 0x40;
    out.push(packed);
    if (f.lct) table(f.lct, lctPow);

    const paletteBits = f.lct ? lctPow : gctPow;
    // The spec floor for the minimum code size is 2 even for bicolour images.
    const mcs = f.minCodeSize ?? Math.max(2, paletteBits);
    out.push(mcs);
    const data = f.rawLzw ?? lzwEncode(f.indices ?? [], mcs);
    const chunk = f.subBlockSize ?? 255;
    for (let i = 0; i < data.length; i += chunk) {
      const n = Math.min(chunk, data.length - i);
      out.push(n);
      for (let j = 0; j < n; j++) out.push(data[i + j]);
    }
    out.push(0);
  }

  out.push(0x3b);
  return Uint8Array.from(out);
}

// Shared palettes. Values are arbitrary but distinct in every channel, so a
// swapped index or channel shows up as a hard mismatch, not a near-miss.
const RED: Rgb = [200, 30, 40];
const GREEN: Rgb = [20, 180, 60];
const BLUE: Rgb = [10, 50, 220];
const WHITE: Rgb = [250, 250, 250];
const PAL4: Rgb[] = [RED, GREEN, BLUE, WHITE];

const opaque = (c: Rgb): [number, number, number, number] => [c[0], c[1], c[2], 255];

// ─── Fixtures ─────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTSRC_GIF = join(HERE, "fixtures", "video", "testsrc-48x32-8f.gif");
const SINTEL_GIF = join(HERE, "..", "devnotes", "media", "sintel-3s.gif");

console.log("\n\x1b[1mGIF decoder — headers and colour tables\x1b[0m\n");

test("GIF87a, global colour table, single frame decodes exactly", () => {
  const gif = mustDecode(
    buildGif({
      version: "87a",
      w: 2,
      h: 2,
      gct: PAL4,
      frames: [{ w: 2, h: 2, indices: [0, 1, 2, 3] }],
    }),
    "87a",
  );
  assertEqual(gif.width, 2, "width");
  assertEqual(gif.height, 2, "height");
  assertEqual(gif.frames.length, 1, "frame count");
  assertEqual(gif.loopCount, 0, "default loopCount");
  const f = gif.frames[0].pixels;
  assertPixel(f, 0, 0, opaque(RED), "87a");
  assertPixel(f, 1, 0, opaque(GREEN), "87a");
  assertPixel(f, 0, 1, opaque(BLUE), "87a");
  assertPixel(f, 1, 1, opaque(WHITE), "87a");
});

test("GIF89a decodes; unknown version is rejected without throwing", () => {
  const bytes = buildGif({ w: 1, h: 1, gct: PAL4, frames: [{ w: 1, h: 1, indices: [2] }] });
  assert(decodeGif(bytes).ok, "89a should decode");
  const bad = bytes.slice();
  bad[4] = 0x38; // "GIF88a"
  const result = decodeGif(bad);
  assert(!result.ok, "GIF88a must be rejected");
});

test("local colour table overrides global; next frame reverts to global", () => {
  const gif = mustDecode(
    buildGif({
      w: 1,
      h: 1,
      gct: [RED, GREEN],
      frames: [
        { w: 1, h: 1, lct: [BLUE, WHITE], indices: [0] },
        { w: 1, h: 1, indices: [0] },
      ],
    }),
    "lct",
  );
  assertPixel(gif.frames[0].pixels, 0, 0, opaque(BLUE), "frame 0 uses the local table");
  assertPixel(gif.frames[1].pixels, 0, 0, opaque(RED), "frame 1 falls back to the global table");
});

test("frame with no colour table anywhere fails cleanly", () => {
  const result = decodeGif(buildGif({ w: 1, h: 1, frames: [{ w: 1, h: 1, indices: [0], minCodeSize: 2 }] }));
  assert(!result.ok, "must fail");
  assert(!result.ok && /colour table/.test(result.reason), `reason names the table: ${(result as { reason?: string }).reason}`);
});

console.log("\n\x1b[1mGIF decoder — LZW\x1b[0m\n");

test("mid-stream CLEAR resets the table and keeps decoding", () => {
  // clear, 1, 2, CLEAR, 1, 2, end — all at width 3 (table never reaches 8).
  const raw = packCodes([[4, 3], [1, 3], [2, 3], [4, 3], [1, 3], [2, 3], [5, 3]]);
  const gif = mustDecode(
    buildGif({ w: 4, h: 1, gct: PAL4, frames: [{ w: 4, h: 1, rawLzw: raw, minCodeSize: 2 }] }),
    "mid-clear",
  );
  const f = gif.frames[0].pixels;
  assertPixel(f, 0, 0, opaque(GREEN), "mid-clear");
  assertPixel(f, 1, 0, opaque(BLUE), "mid-clear");
  assertPixel(f, 2, 0, opaque(GREEN), "mid-clear");
  assertPixel(f, 3, 0, opaque(BLUE), "mid-clear");
});

test("KwKwK: a code equal to the next free slot decodes as oldCode + its first byte", () => {
  // clear, 1, 6, end. When 6 arrives the table's next free slot IS 6, so the
  // decoder must synthesise string(1)+first(1) = [1,1]. Output: [1,1,1].
  const raw = packCodes([[4, 3], [1, 3], [6, 3], [5, 3]]);
  const gif = mustDecode(
    buildGif({ w: 3, h: 1, gct: PAL4, frames: [{ w: 3, h: 1, rawLzw: raw, minCodeSize: 2 }] }),
    "kwkwk",
  );
  const f = gif.frames[0].pixels;
  assertPixel(f, 0, 0, opaque(GREEN), "kwkwk");
  assertPixel(f, 1, 0, opaque(GREEN), "kwkwk");
  assertPixel(f, 2, 0, opaque(GREEN), "kwkwk");
});

test("a code PAST the next free slot is corrupt, not KwKwK", () => {
  const raw = packCodes([[4, 3], [1, 3], [7, 3], [5, 3]]); // 7 > next free slot 6
  const result = decodeGif(
    buildGif({ w: 3, h: 1, gct: PAL4, frames: [{ w: 3, h: 1, rawLzw: raw, minCodeSize: 2 }] }),
  );
  assert(!result.ok, "must fail");
});

test("missing END code is tolerated once every pixel is produced", () => {
  const raw = packCodes([[4, 3], [1, 3], [2, 3]]); // no end code
  const gif = mustDecode(
    buildGif({ w: 2, h: 1, gct: PAL4, frames: [{ w: 2, h: 1, rawLzw: raw, minCodeSize: 2 }] }),
    "no-end",
  );
  assertPixel(gif.frames[0].pixels, 1, 0, opaque(BLUE), "no-end");
});

test("premature END code fails instead of leaving a partial frame", () => {
  const raw = packCodes([[4, 3], [1, 3], [5, 3]]); // end after 1 of 2 pixels
  const result = decodeGif(
    buildGif({ w: 2, h: 1, gct: PAL4, frames: [{ w: 2, h: 1, rawLzw: raw, minCodeSize: 2 }] }),
  );
  assert(!result.ok, "must fail");
});

/** Deterministic LCG so the width-growth streams are reproducible. */
function makeLcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return (x >>> 16) & 0xffff;
  };
}

const PAL16: Rgb[] = [];
for (let i = 0; i < 16; i++) PAL16.push([(i * 13) % 256, (i * 71 + 5) % 256, (i * 29 + 11) % 256]);

function assertIndicesRoundTrip(w: number, h: number, seed: number, label: string, subBlockSize?: number): void {
  const rand = makeLcg(seed);
  const indices: number[] = [];
  for (let i = 0; i < w * h; i++) indices.push(rand() & 15);
  const gif = mustDecode(
    buildGif({ w, h, gct: PAL16, frames: [{ w, h, indices, subBlockSize }] }),
    label,
  );
  const f = gif.frames[0].pixels;
  for (let i = 0; i < w * h; i++) {
    const c = PAL16[indices[i]];
    const d = i * 4;
    if (f.data[d] !== c[0] || f.data[d + 1] !== c[1] || f.data[d + 2] !== c[2] || f.data[d + 3] !== 255) {
      throw new Error(
        `${label}: pixel ${i} expected [${c},255], got [${f.data[d]},${f.data[d + 1]},${f.data[d + 2]},${f.data[d + 3]}]`,
      );
    }
  }
}

test("variable code width grows through 12 bits (64x64 pseudo-random round trip)", () => {
  // 4096 pixels over 16 symbols pushes the table past 2^11 entries, so the
  // stream crosses every width step the growth rule allows.
  assertIndicesRoundTrip(64, 64, 0xdecafbad, "width-growth");
});

test("table saturation at 4096 without a CLEAR (deferred clear) still decodes", () => {
  // 16384 pixels saturate the table; the encoder then reuses it un-cleared,
  // which is legal and exactly what "deferred clear" means.
  assertIndicesRoundTrip(128, 128, 0x5eed1e55, "saturation");
});

test("LZW bit stream runs across 1-byte data sub-blocks unchanged", () => {
  assertIndicesRoundTrip(32, 32, 0xabad1dea, "tiny-sub-blocks", 1);
});

test("minimum code size of 1 (width 2..12) is accepted for bicolour data", () => {
  // Some encoders write mcs 1 for two-colour images even though the spec
  // floor is 2; browsers decode them, so we must too.
  // clear=2, end=3, width 2: clear, 0, 1, 0, end — but 0,1,0 adds entries
  // 4,5 -> available hits 4 after the second add? Trace: after code "1"
  // available=5 > mask 3 -> width 3. Keep it simple and hand-pack.
  const raw = packCodes([[2, 2], [0, 2], [1, 2], [4, 3], [3, 3]]);
  // Decodes as: 0, 1, then code 4 = string(0-entry 4 = "0,1")... entry 4 is
  // prefix 0 suffix 1 -> [0,1]. Output [0,1,0,1].
  const gif = mustDecode(
    buildGif({ w: 4, h: 1, gct: [RED, GREEN], frames: [{ w: 4, h: 1, rawLzw: raw, minCodeSize: 1 }] }),
    "mcs1",
  );
  const f = gif.frames[0].pixels;
  assertPixel(f, 0, 0, opaque(RED), "mcs1");
  assertPixel(f, 1, 0, opaque(GREEN), "mcs1");
  assertPixel(f, 2, 0, opaque(RED), "mcs1");
  assertPixel(f, 3, 0, opaque(GREEN), "mcs1");
});

console.log("\n\x1b[1mGIF decoder — interlace, transparency, disposal\x1b[0m\n");

test("interlaced frame: rows land per the 8/8/4/2 pass structure", () => {
  // Height 10 exercises passes of unequal length: file row order must be
  // 0,8 (pass 1), 4 (pass 2), 2,6 (pass 3), 1,3,5,7,9 (pass 4).
  const fileOrder = [0, 8, 4, 2, 6, 1, 3, 5, 7, 9];
  const w = 4;
  const indices: number[] = [];
  for (const row of fileOrder) for (let c = 0; c < w; c++) indices.push(row);
  const pal: Rgb[] = [];
  for (let i = 0; i < 10; i++) pal.push([i * 20, 255 - i * 20, (i * 37) % 256]);
  const gif = mustDecode(
    buildGif({ w, h: 10, gct: pal, frames: [{ w, h: 10, indices, interlace: true }] }),
    "interlace",
  );
  const f = gif.frames[0].pixels;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < w; x++) assertPixel(f, x, y, opaque(pal[y]), "interlace");
  }
});

test("transparent index leaves the previous frame's pixels visible", () => {
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 2,
      gct: PAL4,
      frames: [
        { w: 2, h: 2, indices: [0, 0, 0, 0] },
        { w: 2, h: 2, indices: [3, 1, 3, 1], gce: { transparentIndex: 3 } },
      ],
    }),
    "transparency",
  );
  const f = gif.frames[1].pixels;
  assertPixel(f, 0, 0, opaque(RED), "index 3 is a hole onto frame 0");
  assertPixel(f, 1, 0, opaque(GREEN), "index 1 paints");
  assertPixel(f, 0, 1, opaque(RED), "index 3 is a hole onto frame 0");
  assertPixel(f, 1, 1, opaque(GREEN), "index 1 paints");
});

test("a GCE governs only the one image that follows it", () => {
  // Frame 0 declares index 1 transparent; frame 1 has no GCE and uses index 1
  // everywhere. If the GCE leaked, frame 1 would keep frame 0's red.
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 1,
      gct: PAL4,
      frames: [
        { w: 2, h: 1, indices: [0, 0], gce: { transparentIndex: 1, delayCs: 50 } },
        { w: 2, h: 1, indices: [1, 1] },
      ],
    }),
    "gce-scope",
  );
  assertPixel(gif.frames[1].pixels, 0, 0, opaque(GREEN), "no stale transparency");
  assertEqual(gif.frames[1].delayMs, 100, "no stale delay: unset delay 0 clamps to 100");
});

test("frames composite at their (left, top) sub-rect, not at the origin", () => {
  const gif = mustDecode(
    buildGif({
      w: 3,
      h: 3,
      gct: PAL4,
      frames: [
        { w: 3, h: 3, indices: new Array(9).fill(0) },
        { x: 1, y: 2, w: 2, h: 1, indices: [1, 2] },
      ],
    }),
    "sub-rect",
  );
  const f = gif.frames[1].pixels;
  assertPixel(f, 0, 0, opaque(RED), "outside the rect untouched");
  assertPixel(f, 1, 2, opaque(GREEN), "rect origin at (1,2)");
  assertPixel(f, 2, 2, opaque(BLUE), "rect extends right");
  assertPixel(f, 0, 2, opaque(RED), "left of rect untouched");
});

test("disposal 1 (leave): the frame persists under later frames", () => {
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 1,
      gct: PAL4,
      frames: [
        { w: 2, h: 1, indices: [0, 0], gce: { disposal: 1 } },
        { w: 1, h: 1, indices: [1], gce: { disposal: 1 } },
        { x: 1, y: 0, w: 1, h: 1, indices: [2] },
      ],
    }),
    "disposal-1",
  );
  const f = gif.frames[2].pixels;
  assertPixel(f, 0, 0, opaque(GREEN), "frame 1's pixel survives");
  assertPixel(f, 1, 0, opaque(BLUE), "frame 2 paints its own rect");
});

test("disposal 2 (restore to background) fills the rect with the background colour", () => {
  // bg index 3 = WHITE. Frame 0 paints everything red with disposal 2 and no
  // transparency, so before frame 1 draws, its rect reverts to white.
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 2,
      gct: PAL4,
      bg: 3,
      frames: [
        { w: 2, h: 2, indices: [0, 0, 0, 0], gce: { disposal: 2 } },
        { w: 1, h: 1, indices: [1] },
      ],
    }),
    "disposal-2",
  );
  const f0 = gif.frames[0].pixels;
  assertPixel(f0, 0, 0, opaque(RED), "frame 0 is untouched by its own disposal");
  const f1 = gif.frames[1].pixels;
  assertPixel(f1, 0, 0, opaque(GREEN), "frame 1 paints over the restored rect");
  assertPixel(f1, 1, 0, opaque(WHITE), "restored to the background colour");
  assertPixel(f1, 1, 1, opaque(WHITE), "restored to the background colour");
});

test("disposal 2 with a transparent index restores to transparent instead", () => {
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 1,
      gct: PAL4,
      bg: 3,
      frames: [
        { w: 2, h: 1, indices: [0, 0], gce: { disposal: 2, transparentIndex: 2 } },
        { w: 1, h: 1, indices: [1] },
      ],
    }),
    "disposal-2-transparent",
  );
  assertPixel(gif.frames[1].pixels, 1, 0, [0, 0, 0, 0], "restored rect is transparent");
});

test("disposal 3 (restore to previous) rewinds the canvas snapshot", () => {
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 2,
      gct: PAL4,
      frames: [
        { w: 2, h: 2, indices: [0, 0, 0, 0], gce: { disposal: 1 } },
        { w: 1, h: 1, indices: [1], gce: { disposal: 3 } },
        { x: 1, y: 1, w: 1, h: 1, indices: [2] },
      ],
    }),
    "disposal-3",
  );
  assertPixel(gif.frames[1].pixels, 0, 0, opaque(GREEN), "frame 1 shows its own paint");
  const f2 = gif.frames[2].pixels;
  assertPixel(f2, 0, 0, opaque(RED), "frame 1's paint was rewound before frame 2");
  assertPixel(f2, 1, 1, opaque(BLUE), "frame 2's own rect");
});

test("disposal 4 is restore-to-previous (Netscape off-by-one; ffmpeg reads it as leave)", () => {
  // Pins a documented divergence from the ffmpeg ground truth: encoders that
  // copied Netscape's off-by-one documentation write 4 meaning "restore
  // previous", and Chromium reads it that way; ffmpeg leaves the frame in
  // place. Without this pin the branch is dead in the suite and the
  // divergence could flip silently.
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 2,
      gct: PAL4,
      frames: [
        { w: 2, h: 2, indices: [0, 0, 0, 0], gce: { disposal: 1 } },
        { w: 2, h: 2, indices: [1, 1, 1, 1], gce: { disposal: 4 } },
        { w: 1, h: 1, indices: [2] },
      ],
    }),
    "disposal-4",
  );
  const f2 = gif.frames[2].pixels;
  assertPixel(f2, 0, 0, opaque(BLUE), "frame 2 paints its own rect");
  assertPixel(f2, 1, 1, opaque(RED), "frame 1 was rewound (ffmpeg would keep GREEN here)");
});

test("disposal 5..7 are undefined and read as leave-in-place, matching ffmpeg", () => {
  for (const disposal of [5, 6, 7]) {
    const gif = mustDecode(
      buildGif({
        w: 2,
        h: 2,
        gct: PAL4,
        frames: [
          { w: 2, h: 2, indices: [0, 0, 0, 0], gce: { disposal: 1 } },
          { w: 2, h: 2, indices: [1, 1, 1, 1], gce: { disposal } },
          { w: 1, h: 1, indices: [2] },
        ],
      }),
      `disposal-${disposal}`,
    );
    assertPixel(gif.frames[2].pixels, 1, 1, opaque(GREEN), `disposal ${disposal} leaves frame 1 in place`);
  }
});

test("a frame rect entirely off-canvas is kept (ffmpeg -vsync 0 drops it)", () => {
  // Pins the other documented divergence: an off-canvas frame still consumes
  // its GCE delay and browsers keep it, so it is emitted as an unchanged
  // canvas rather than silently dropped from the animation.
  const gif = mustDecode(
    buildGif({
      w: 2,
      h: 2,
      gct: PAL4,
      frames: [
        { w: 2, h: 2, indices: [0, 1, 2, 3] },
        { x: 5, y: 5, w: 2, h: 2, indices: [0, 0, 0, 0], gce: { delayCs: 7 } },
      ],
    }),
    "off-canvas",
  );
  assertEqual(gif.frames.length, 2, "off-canvas frame is emitted");
  assertEqual(gif.frames[1].delayMs, 70, "its delay is honoured");
  let diff = 0;
  const a = gif.frames[0].pixels.data;
  const b = gif.frames[1].pixels.data;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  assertEqual(diff, 0, "canvas unchanged by the off-canvas rect");
});

console.log("\n\x1b[1mGIF decoder — loop count and delays\x1b[0m\n");

test("NETSCAPE2.0 loop count is honoured; 0 and absence both mean infinite", () => {
  const one = (loop?: number): Uint8Array =>
    buildGif({ w: 1, h: 1, gct: PAL4, loop, frames: [{ w: 1, h: 1, indices: [0] }] });
  assertEqual(mustDecode(one(5), "loop-5").loopCount, 5, "explicit 5");
  assertEqual(mustDecode(one(65535), "loop-max").loopCount, 65535, "uint16 max");
  assertEqual(mustDecode(one(0), "loop-0").loopCount, 0, "explicit 0 = infinite");
  assertEqual(mustDecode(one(undefined), "loop-none").loopCount, 0, "absent = infinite");
});

test("delays: centiseconds x10, with 0 and 1 clamped to 100 ms like browsers do", () => {
  const gif = mustDecode(
    buildGif({
      w: 1,
      h: 1,
      gct: PAL4,
      frames: [
        { w: 1, h: 1, indices: [0], gce: { delayCs: 0 } },
        { w: 1, h: 1, indices: [1], gce: { delayCs: 1 } },
        { w: 1, h: 1, indices: [2], gce: { delayCs: 7 } },
        { w: 1, h: 1, indices: [3], gce: { delayCs: 100 } },
      ],
    }),
    "delays",
  );
  assertEqual(gif.frames[0].delayMs, 100, "0 cs clamps to 100 ms");
  assertEqual(gif.frames[1].delayMs, 100, "1 cs clamps to 100 ms");
  assertEqual(gif.frames[2].delayMs, 70, "7 cs is 70 ms");
  assertEqual(gif.frames[3].delayMs, 1000, "100 cs is 1000 ms");
});

console.log("\n\x1b[1mGIF decoder — malformed input and budgets\x1b[0m\n");

test("truncated fixture returns ok:false without throwing", () => {
  const bytes = new Uint8Array(readFileSync(TESTSRC_GIF));
  const cut = bytes.subarray(0, Math.floor(bytes.length * 0.6));
  const result = decodeGif(cut);
  assert(!result.ok, "60% of the file must not decode");
  assert(!result.ok && result.reason.length > 0, "reason is populated");
  assertEqual(decodeGifFirstFrame(bytes.subarray(0, 1000)), null, "first-frame path returns null mid-frame-0");
});

test("every truncation point of the fixture fails cleanly (never throws)", () => {
  const bytes = new Uint8Array(readFileSync(TESTSRC_GIF));
  // The trailer is the final byte, so every strict prefix must fail — the
  // decoder deliberately refuses "half the animation, silently".
  for (let cut = 0; cut < bytes.length; cut += 7) {
    const result = decodeGif(bytes.subarray(0, cut));
    if (result.ok) throw new Error(`prefix of ${cut} bytes decoded ok`);
  }
  assert(!decodeGif(bytes.subarray(0, bytes.length - 1)).ok, "missing trailer alone fails");
  assert(decodeGif(bytes).ok, "the intact file still decodes");
});

test("random bytes behind a GIF header never throw", () => {
  const rand = makeLcg(0xfeedface);
  for (let trial = 0; trial < 50; trial++) {
    const bytes = new Uint8Array(2048);
    for (let i = 0; i < bytes.length; i++) bytes[i] = rand() & 0xff;
    bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
    decodeGif(bytes); // outcome irrelevant; not throwing is the contract
    decodeGifFirstFrame(bytes);
  }
});

test("stray zero padding between blocks is tolerated", () => {
  const bytes = buildGif({ w: 1, h: 1, gct: PAL4, frames: [{ w: 1, h: 1, indices: [0] }] });
  const padded = new Uint8Array(bytes.length + 3);
  padded.set(bytes.subarray(0, bytes.length - 1), 0); // everything before the trailer
  // three 0x00 bytes, then the trailer
  padded[bytes.length + 2] = 0x3b;
  assert(decodeGif(padded).ok, "padding before the trailer must not fail the decode");
});

test("an unknown block introducer is rejected", () => {
  const bytes = buildGif({ w: 1, h: 1, gct: PAL4, frames: [{ w: 1, h: 1, indices: [0] }] });
  const mangled = new Uint8Array(bytes.length + 1);
  mangled.set(bytes.subarray(0, bytes.length - 1), 0);
  mangled[bytes.length - 1] = 0x99; // not an extension, image, or trailer
  mangled[bytes.length] = 0x3b;
  assert(!decodeGif(mangled).ok, "0x99 is not a valid block");
});

test("a canvas past IMAGE_LIMITS.maxPixels is rejected before any allocation", () => {
  // 9000 * 9000 = 81,000,000 > 8192 * 8192.
  const result = decodeGif(buildGif({ w: 9000, h: 9000, gct: PAL4, frames: [{ w: 1, h: 1, indices: [0] }] }));
  assert(!result.ok, "must fail");
  assert(!result.ok && /exceeds/.test(result.reason), "reason names the budget");
});

test("total decoded size across frames is capped by IMAGE_LIMITS.maxPixels", () => {
  // 2900^2 = 8,410,000 px per emitted frame. The working canvas is charged
  // too, so canvas + 7 snapshots = 8 x 8.41 Mpx crosses the 8192^2 =
  // 67,108,864 budget even though each frame is legal alone.
  const frames: FrameSpec[] = [];
  for (let i = 0; i < 8; i++) frames.push({ w: 1, h: 1, indices: [0] });
  const result = decodeGif(buildGif({ w: 2900, h: 2900, gct: PAL4, frames }));
  assert(!result.ok, "8 frames of 2900x2900 must trip the total budget");
  assert(!result.ok && /total pixels/.test(result.reason), `reason names the total: ${(result as { reason?: string }).reason}`);
  assert(2900 * 2900 * 8 > IMAGE_LIMITS.maxPixels, "test premise: canvas + 7 frames exceed the budget");
  assert(2900 * 2900 * 7 < IMAGE_LIMITS.maxPixels, "test premise: canvas + 6 frames fit the budget");
});

// One frame's worth of worst-case LZW: ~27 KiB of codes expanding to the full
// 8192 * 8192 pixel budget. Shared by the budget regressions below.
const KWKWK_64MPX = kwkwkLadderLzw(8192 * 8192);

test("budget charges frame RECTS: a 1x1 canvas cannot carry 8192x8192 rects", () => {
  // Regression for the decode-bomb: the old accumulator charged width*height
  // — held at 1 by the canvas — while the LZW work and allocation were fw*fh,
  // so 614 such frames decoded 41 billion pixels over 124 s and returned ok.
  // Two frames pin the fix, and the FIRST must already trip the budget,
  // before any LZW runs, because canvas + rect exceeds maxPixels.
  const frames: FrameSpec[] = [
    { w: 8192, h: 8192, rawLzw: KWKWK_64MPX, minCodeSize: 2 },
    { w: 8192, h: 8192, rawLzw: KWKWK_64MPX, minCodeSize: 2 },
  ];
  const t0 = performance.now();
  const result = decodeGif(buildGif({ w: 1, h: 1, gct: PAL4, frames }));
  const ms = performance.now() - t0;
  assert(!result.ok, "decode-bomb must be rejected");
  assert(!result.ok && /total pixels/.test(result.reason), `reason names the budget: ${(result as { reason?: string }).reason}`);
  // The old code spent ~210 ms of LZW per frame here; rejection without any
  // LZW work is sub-millisecond, so 250 ms only trips if the check moved.
  assert(ms < 250, `rejection took ${ms.toFixed(1)} ms — LZW ran before the budget check`);
});

test("decodeGifFirstFrame rejects a rect that dwarfs its canvas", () => {
  // Regression for the thumbnail path: the old early-out fired only AFTER
  // frame 0's LZW had allocated and filled 64 Mpx of indices (280 MB RSS) to
  // produce a 1x1 result. The budget now trips before lzwDecode, so the fast
  // path is cheap for hostile shapes, not just friendly ones.
  const bytes = buildGif({
    w: 1,
    h: 1,
    gct: PAL4,
    frames: [{ w: 8192, h: 8192, rawLzw: KWKWK_64MPX, minCodeSize: 2 }],
  });
  assertEqual(decodeGifFirstFrame(bytes), null, "no thumbnail from a decode-bomb");
  const full = decodeGif(bytes);
  assert(!full.ok && /total pixels/.test(full.reason), "full decode rejects it too");
});

test("a canvas that consumes the whole budget cannot also emit a frame", () => {
  // Regression for the peak-memory shape: an 8192x8192 canvas passes the
  // header check with zero budget left, and the old code then held canvas,
  // snapshot and LZW indices live at once — 788 MB peak from a 27 KiB file,
  // 3x the documented bound. With the canvas charged up front, the first
  // frame fails the budget before its LZW allocates anything.
  const result = decodeGif(
    buildGif({
      w: 8192,
      h: 8192,
      gct: PAL4,
      frames: [{ w: 8192, h: 8192, rawLzw: KWKWK_64MPX, minCodeSize: 2 }],
    }),
  );
  assert(!result.ok, "must fail");
  assert(!result.ok && /total pixels/.test(result.reason), `reason names the budget: ${(result as { reason?: string }).reason}`);
});

test("a disposal-3 restore copy counts against the budget while it is live", () => {
  // 25 Mpx canvas + 25 Mpx snapshot fits the 67.1 Mpx budget, but disposal 3
  // holds a third canvas-sized copy during compositing — 300 MB live for a
  // GIF the old accounting priced at 100 MB. The same frame with disposal 1
  // must still decode: the fix prices the restore copy, it does not ban
  // large frames.
  const ladder25M = kwkwkLadderLzw(5000 * 5000);
  const bytes = (disposal: number): Uint8Array =>
    buildGif({
      w: 5000,
      h: 5000,
      gct: PAL4,
      frames: [{ w: 5000, h: 5000, rawLzw: ladder25M, minCodeSize: 2, gce: { disposal } }],
    });
  const d3 = decodeGif(bytes(3));
  assert(!d3.ok, "disposal 3 must trip the budget at this size");
  assert(!d3.ok && /total pixels/.test(d3.reason), `reason names the budget: ${(d3 as { reason?: string }).reason}`);
  const d1 = decodeGif(bytes(1));
  assert(d1.ok, `disposal 1 at the same size fits: ${(d1 as { reason?: string }).reason ?? ""}`);
});

test("a rect larger than the canvas still decodes when the budget allows (clip path)", () => {
  // Guard against over-rejection: the fix must price big rects, not ban
  // them. A 4 Mpx rect over a 1 Mpx canvas charges 5 Mpx — well inside the
  // budget — and the ladder stream decodes to all-index-0, so the clipped
  // canvas comes out solid RED.
  const gif = mustDecode(
    buildGif({
      w: 1000,
      h: 1000,
      gct: PAL4,
      frames: [{ w: 4000, h: 1000, rawLzw: kwkwkLadderLzw(4000 * 1000), minCodeSize: 2 }],
    }),
    "clip-budget",
  );
  assertEqual(gif.frames.length, 1, "frame count");
  assertPixel(gif.frames[0].pixels, 0, 0, opaque(RED), "clip-budget");
  assertPixel(gif.frames[0].pixels, 999, 999, opaque(RED), "clip-budget");
});

console.log("\n\x1b[1mGIF decoder — first-frame fast path\x1b[0m\n");

test("decodeGifFirstFrame agrees byte-for-byte with frames[0] (synthetic)", () => {
  const bytes = buildGif({
    w: 3,
    h: 3,
    gct: PAL16,
    frames: [
      { w: 3, h: 3, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
      { w: 1, h: 1, indices: [15] },
    ],
  });
  const full = mustDecode(bytes, "first-frame");
  const first = decodeGifFirstFrame(bytes);
  assert(first !== null, "first frame decodes");
  assertEqual(first!.width, full.frames[0].pixels.width, "width");
  assertEqual(first!.height, full.frames[0].pixels.height, "height");
  assert(
    Buffer.compare(Buffer.from(first!.data.buffer, first!.data.byteOffset, first!.data.length),
      Buffer.from(full.frames[0].pixels.data.buffer, full.frames[0].pixels.data.byteOffset, full.frames[0].pixels.data.length)) === 0,
    "pixel data identical",
  );
});

test("decodeGifFirstFrame agrees with the full decode on both fixture GIFs", () => {
  for (const path of [TESTSRC_GIF, SINTEL_GIF]) {
    const bytes = new Uint8Array(readFileSync(path));
    const full = mustDecode(bytes, path);
    const first = decodeGifFirstFrame(bytes);
    assert(first !== null, `${path}: first frame decodes`);
    let diff = 0;
    for (let i = 0; i < first!.data.length; i++) {
      if (first!.data[i] !== full.frames[0].pixels.data[i]) diff++;
    }
    assertEqual(diff, 0, `${path}: differing bytes vs frames[0]`);
  }
});

// ─── Ground truth: ffmpeg ─────────────────────────────────

function findFfmpegDir(): string | null {
  // Homebrew on Apple silicon, then Intel/Linuxbrew, then trust PATH.
  for (const dir of ["/opt/homebrew/bin", "/usr/local/bin"]) {
    if (existsSync(join(dir, "ffmpeg")) && existsSync(join(dir, "ffprobe"))) return dir;
  }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "";
  } catch {
    return null;
  }
}

interface GroundTruthStats {
  frames: number;
  mae: [number, number, number, number];
  maxDiff: number;
  decodeMs: number;
}

/**
 * Decode `gifPath` with our decoder AND with ffmpeg, and compare every frame
 * pixel-for-pixel. Palette-to-RGB expansion is exact on both sides, so the
 * mean absolute error should be zero — anything else means the LZW output or
 * the disposal compositing diverged.
 *
 * Pixels this decoder leaves fully transparent are EXCLUDED: ffmpeg seeds
 * never-painted canvas with the declared background colour and expands
 * transparent indices to white-with-alpha-0, where this decoder keeps both
 * at [0,0,0,0] for the renderer to composite (the choice is documented at
 * the canvas allocation in gif.ts). That is a canvas-seed convention, not
 * compositing, and comparing it unmasked would fail any GIF whose first
 * frame does not cover the canvas — which is why every painted pixel is
 * still compared strictly.
 */
function compareAgainstFfmpeg(gifPath: string, ffmpegDir: string, label: string): GroundTruthStats {
  const bytes = new Uint8Array(readFileSync(gifPath));
  const t0 = performance.now();
  const gif = mustDecode(bytes, label);
  const decodeMs = performance.now() - t0;

  const refDir = mkdtempSync(join(tmpdir(), "gif-decode-ref-"));
  try {
    execFileSync(join(ffmpegDir, "ffmpeg"), [
      "-v", "error",
      "-i", gifPath,
      "-vsync", "0", // one PNG per coded frame, no duplication to a nominal rate
      join(refDir, "ref-%03d.png"),
    ]);
    const refs = readdirSync(refDir).filter((f) => f.endsWith(".png")).sort();
    assertEqual(gif.frames.length, refs.length, `${label}: frame count vs ffmpeg`);

    const sums = [0, 0, 0, 0];
    let maxDiff = 0;
    let samples = 0;
    for (let i = 0; i < refs.length; i++) {
      const ref = decodeImage(join(refDir, refs[i]));
      if (!ref.ok) throw new Error(`${label}: reference PNG ${refs[i]} failed to decode: ${ref.detail}`);
      const mine = gif.frames[i].pixels;
      assertEqual(mine.width, ref.pixels.width, `${label} frame ${i}: width`);
      assertEqual(mine.height, ref.pixels.height, `${label} frame ${i}: height`);
      const a = mine.data;
      const b = ref.pixels.data;
      for (let p = 0; p < a.length; p += 4) {
        if (a[p + 3] === 0) continue; // canvas seed, not compositing — see docblock
        for (let ch = 0; ch < 4; ch++) {
          const d = Math.abs(a[p + ch] - b[p + ch]);
          sums[ch] += d;
          if (d > maxDiff) maxDiff = d;
        }
        samples++;
      }
    }
    if (samples === 0) throw new Error(`${label}: every pixel was transparent; nothing was compared`);
    return {
      frames: refs.length,
      mae: [sums[0] / samples, sums[1] / samples, sums[2] / samples, sums[3] / samples],
      maxDiff,
      decodeMs,
    };
  } finally {
    rmSync(refDir, { recursive: true, force: true });
  }
}

/** Per-frame delays as ffprobe reports them, run through the same clamp we apply. */
function ffprobeDelaysMs(gifPath: string, ffmpegDir: string): number[] {
  const csv = execFileSync(
    join(ffmpegDir, "ffprobe"),
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "frame=duration_time", "-of", "csv=p=0", gifPath],
    { encoding: "utf8" },
  );
  return csv
    .split("\n")
    .map((line) => line.trim().replace(/,+$/, ""))
    .filter((line) => line.length > 0)
    .map((line) => {
      const seconds = Number(line);
      if (!Number.isFinite(seconds)) throw new Error(`ffprobe emitted a non-numeric duration: ${JSON.stringify(line)}`);
      // The GIF demuxer's timebase is 1/100 s, so this recovers the exact GCE
      // centisecond value; the clamp then matches normalizeGifDelayMs.
      return normalizeGifDelayMs(Math.round(seconds * 100));
    });
}

console.log("\n\x1b[1mGIF decoder — ground truth vs ffmpeg\x1b[0m\n");

const FFMPEG_DIR = findFfmpegDir();
const measurements: string[] = [];

if (FFMPEG_DIR === null) {
  console.log("  \x1b[33m- skipped: no ffmpeg binary found (synthetic sections above still ran)\x1b[0m");
} else {
  const fixtures: Array<[string, string, number]> = [
    [TESTSRC_GIF, "testsrc-48x32-8f", 8],
    [SINTEL_GIF, "sintel-3s", 36],
  ];

  for (const [path, label, expectedFrames] of fixtures) {
    test(`${label}: frames match ffmpeg's composited output (MAE ~0)`, () => {
      const stats = compareAgainstFfmpeg(path, FFMPEG_DIR, label);
      assertEqual(stats.frames, expectedFrames, `${label}: frame count`);
      const mae = stats.mae.map((v) => v.toFixed(6)).join("/");
      const gif = mustDecode(new Uint8Array(readFileSync(path)), label);
      const peak = gif.frames.length * gif.width * gif.height * 4;
      measurements.push(
        `${label}: ${stats.frames} frames, decode ${stats.decodeMs.toFixed(1)} ms, ` +
          `MAE r/g/b/a ${mae}, max |diff| ${stats.maxDiff}, frames memory ${(peak / 1024).toFixed(0)} KiB`,
      );
      console.log(`    ${measurements[measurements.length - 1]}`);
      for (let ch = 0; ch < 4; ch++) {
        assert(stats.mae[ch] < 0.01, `${label}: channel ${ch} MAE ${stats.mae[ch]} is not ~0`);
      }
    });

    test(`${label}: per-frame delays match ffprobe -show_frames`, () => {
      const expected = ffprobeDelaysMs(path, FFMPEG_DIR);
      const gif = mustDecode(new Uint8Array(readFileSync(path)), label);
      assertEqual(gif.frames.length, expected.length, `${label}: frame count vs ffprobe`);
      for (let i = 0; i < expected.length; i++) {
        assertEqual(gif.frames[i].delayMs, expected[i], `${label}: frame ${i} delayMs`);
      }
    });
  }

  test("partial first frame + transparent holes: painted pixels match ffmpeg exactly", () => {
    // Both repo fixtures open with a full-canvas opaque frame, which is the
    // only reason an unmasked comparison ever held: ffmpeg seeds pixels no
    // frame paints with the declared background colour, where this decoder
    // keeps them transparent for the renderer to composite. This shape —
    // frame 0 covering a third of the canvas, frame 1 punching transparent
    // holes — exercises that seed difference directly, so the masked harness
    // has to do real work for the MAE assertion to hold.
    const bytes = buildGif({
      w: 3,
      h: 2,
      gct: PAL4,
      bg: 3,
      frames: [
        { w: 2, h: 1, indices: [0, 1] },
        { x: 1, y: 0, w: 2, h: 2, indices: [2, 3, 3, 2], gce: { transparentIndex: 3, delayCs: 5 } },
      ],
    });
    const dir = mkdtempSync(join(tmpdir(), "gif-decode-synth-"));
    try {
      const path = join(dir, "partial-first-frame.gif");
      writeFileSync(path, bytes);
      const stats = compareAgainstFfmpeg(path, FFMPEG_DIR, "partial-first-frame");
      assertEqual(stats.frames, 2, "frame count vs ffmpeg");
      for (let ch = 0; ch < 4; ch++) {
        assert(stats.mae[ch] < 0.01, `channel ${ch} MAE ${stats.mae[ch]} is not ~0`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("sintel-3s: first-frame fast path is cheaper than the full decode", () => {
    const bytes = new Uint8Array(readFileSync(SINTEL_GIF));
    const t0 = performance.now();
    const full = decodeGif(bytes);
    const fullMs = performance.now() - t0;
    const t1 = performance.now();
    const first = decodeGifFirstFrame(bytes);
    const firstMs = performance.now() - t1;
    assert(full.ok && first !== null, "both paths decode");
    measurements.push(`sintel-3s: full decode ${fullMs.toFixed(1)} ms, first frame only ${firstMs.toFixed(1)} ms`);
    console.log(`    ${measurements[measurements.length - 1]}`);
    // Frame 0 is ~1/36th of the LZW work; anything close to the full decode
    // would mean the early-out is not early. Generous 0.75 bound so timer
    // noise on a loaded machine cannot flake the suite.
    assert(firstMs < fullMs * 0.75 + 2, `first-frame ${firstMs} ms vs full ${fullMs} ms`);
  });
}

// ═════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
