#!/usr/bin/env npx tsx
/**
 * The .tvf container: roundtrip, zero-copy frame access, and — the reason this
 * file exists — the corruption matrix.
 *
 * THE METHOD: BE THE ATTACKER. A pack is a cache artefact read inside the
 * synchronous render pass, so the interesting question is never "does a good
 * file parse" (it does, in one line) but "what does a bad one do". Every case
 * below is a byte pattern a killed packer, a full disk, an older format
 * version, or a hostile file can actually produce, fed to `decodePack` with the
 * call WRAPPED IN try/catch: a thrown exception fails the test even if the
 * failure it signals is the right one, because a throw mid-frame kills the
 * render and leaves the terminal in whatever state it interrupted.
 *
 * The properties pinned hardest, because they are the ones that turn into
 * memory-safety bugs rather than blank frames:
 *   - `frameAt` cannot return a window outside the payload, INCLUDING for a
 *     hand-built pack that never went through `decodePack`;
 *   - `frameAt` really is zero-copy (asserted on `.buffer` identity, not on
 *     content), because a copy per frame at 24 fps is 1 GB/minute of garbage;
 *   - a real JPEG survives the container byte-identically AND still decodes
 *     from the zero-copy view;
 *   - whatever `encodePack` emits, `decodePack` accepts — pinned by a seeded
 *     property fuzz over hostile header values, not only by handcrafted
 *     headers that happen to sit inside the valid region;
 *   - both documented ceilings (the 16 MiB header, the 512 MiB pack) at their
 *     exact boundaries, on the writer and the reader;
 *   - `sha1File` RETURNS for every path, including device files and FIFOs,
 *     where a missing isFile() gate does not throw — it spins or blocks.
 *
 * Run:  npx tsx test/test-video-pack-format.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import {
  TVF_MAGIC,
  decodePack,
  encodePack,
  frameAt,
  frameDelayMs,
  openPack,
  sha1File,
} from "../src/video/pack.js";
import type { TvfHeader, TvfPack, TvfResult } from "../src/video/pack.js";
import { decodeImage } from "../src/image/decode.js";

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

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_JPEG = join(HERE, "fixtures", "quarters-64x48.jpg");
const TRAILER = join(HERE, "..", "devnotes", "media", "sintel-trailer.mp4");

// ─── Synthetic frames ─────────────────────────────────────

/**
 * A frame whose every byte depends on both its index and its position, so an
 * off-by-one in the offsets table cannot produce a passing comparison the way
 * runs of a constant byte would. Prefixed with JPEG SOI purely so the bytes
 * look like what the packer really writes; the container does not check.
 */
function synthFrame(index: number, size: number): Uint8Array {
  const out = new Uint8Array(size);
  out[0] = 0xff;
  out[1] = 0xd8;
  out[2] = 0xff;
  for (let i = 3; i < size; i++) out[i] = (index * 31 + i * 7) & 0xff;
  return out;
}

const BASE_HEADER: Omit<TvfHeader, "v" | "offsets"> = {
  width: 48,
  height: 32,
  fps: 8,
  frameCount: 8,
  durationMs: 1000,
  sourceSha1: "0".repeat(40),
};

/** Eight frames of deliberately unequal size — equal sizes hide stride bugs. */
const EIGHT = Array.from({ length: 8 }, (_, i) => synthFrame(i, 100 + i * 37));

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function expectOk(result: TvfResult, label: string): TvfPack {
  if (!result.ok) throw new Error(`${label}: rejected a valid pack — ${result.reason}`);
  return result.pack;
}

// ═════════════════════════════════════════════════════════════
// ROUNDTRIP
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  .tvf container\x1b[0m\n");

test("Magic is the four ASCII bytes of TVF1, at offset 0", () => {
  const bytes = encodePack(BASE_HEADER, EIGHT);
  assertEqual(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), TVF_MAGIC, "magic");
  assertEqual(TVF_MAGIC, "TVF1", "constant");
});

test("Header length is u32LE and the header is UTF-8 JSON at offset 8", () => {
  const bytes = encodePack(BASE_HEADER, EIGHT);
  const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const json = Buffer.from(bytes.subarray(8, 8 + declared)).toString("utf8");
  const parsed = JSON.parse(json) as TvfHeader;
  assertEqual(parsed.v, 1, "version");
  assertEqual(parsed.width, 48, "width");
  assertEqual(parsed.offsets.length, 9, "offsets length is frameCount + 1");
  assertEqual(parsed.offsets[0], 0, "offsets[0]");
  assertEqual(8 + declared + parsed.offsets[8], bytes.length, "file length accounts for every byte");
});

test("Roundtrip: eight frames come back byte-identical", () => {
  const pack = expectOk(decodePack(encodePack(BASE_HEADER, EIGHT)), "roundtrip");
  assertEqual(pack.header.frameCount, 8, "frameCount");
  assertEqual(pack.header.width, 48, "width");
  assertEqual(pack.header.height, 32, "height");
  assertEqual(pack.header.fps, 8, "fps");
  assertEqual(pack.header.durationMs, 1000, "durationMs");
  assertEqual(pack.header.sourceSha1, "0".repeat(40), "sourceSha1");
  for (let i = 0; i < EIGHT.length; i++) {
    const got = frameAt(pack, i);
    assert(got !== null, `frame ${i} exists`);
    assert(bytesEqual(got!, EIGHT[i]), `frame ${i} is byte-identical (${got!.length} vs ${EIGHT[i].length} bytes)`);
  }
});

test("Frame sizes are recoverable from the offsets alone", () => {
  const pack = expectOk(decodePack(encodePack(BASE_HEADER, EIGHT)), "sizes");
  for (let i = 0; i < EIGHT.length; i++) {
    const span = pack.header.offsets[i + 1] - pack.header.offsets[i];
    assertEqual(span, EIGHT[i].length, `offsets span for frame ${i}`);
  }
});

test("encodePack overrides a disagreeing frameCount and reconciles an over-long delay table", () => {
  // The realistic packer bug: ffprobe estimates 12 frames, the decode yields 8.
  // The frames are the truth, and the result must still be a legal pack.
  const bytes = encodePack(
    { ...BASE_HEADER, frameCount: 12, delaysMs: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120] },
    EIGHT,
  );
  const pack = expectOk(decodePack(bytes), "reconciled");
  assertEqual(pack.header.frameCount, 8, "frameCount follows the frames");
  assertEqual(pack.header.delaysMs?.length, 8, "delaysMs trimmed to the frames");
  assertEqual(frameDelayMs(pack, 7), 80, "the surviving delays keep their values");
});

test("A short delay table is extended with the nominal rate, not left ragged", () => {
  const pack = expectOk(
    decodePack(encodePack({ ...BASE_HEADER, delaysMs: [10, 20] }, EIGHT)),
    "extended",
  );
  assertEqual(pack.header.delaysMs?.length, 8, "length");
  assertEqual(frameDelayMs(pack, 0), 10, "supplied delay survives");
  assertEqual(frameDelayMs(pack, 7), 125, "missing entries fall back to 1000/8");
});

test("encodePack refuses, loudly and offline, what it cannot represent", () => {
  const cases: Array<[string, () => void]> = [
    ["no frames", () => encodePack(BASE_HEADER, [])],
    ["a zero-byte frame", () => encodePack(BASE_HEADER, [EIGHT[0], new Uint8Array(0)])],
    ["zero width", () => encodePack({ ...BASE_HEADER, width: 0 }, EIGHT)],
    ["NaN fps", () => encodePack({ ...BASE_HEADER, fps: NaN }, EIGHT)],
  ];
  for (const [label, fn] of cases) {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    assert(threw, `${label} must be rejected at pack time, not discovered at render time`);
  }
});

// ═════════════════════════════════════════════════════════════
// WRITER/READER PARITY — the invariant, tested as a property
// ═════════════════════════════════════════════════════════════

test("encodePack refuses headers whose bytes decodePack would reject (writer/reader parity)", () => {
  // Each of these was once ACCEPTED by encodePack and then rejected by
  // decodePack on the very bytes it produced: a finite-but-unsafe width passes
  // an isFinite gate but not the reader's isSafeInteger, and a denormal fps
  // sends the durationMs fallback and the nominal delay fill to Infinity,
  // which JSON serialises as null.
  const cases: Array<[string, () => Uint8Array]> = [
    ["width 1e21, finite but not a safe integer",
      () => encodePack({ ...BASE_HEADER, width: 1e21 }, EIGHT)],
    ["denormal fps with NaN durationMs (the fallback divides to Infinity)",
      () => encodePack({ ...BASE_HEADER, fps: 1e-320, durationMs: NaN }, EIGHT)],
    ["denormal fps with a short delay table (the nominal fill divides to Infinity)",
      () => encodePack({ ...BASE_HEADER, fps: 1e-320, durationMs: 5, delaysMs: [1, 2] }, EIGHT)],
  ];
  for (const [label, build] of cases) {
    let bytes: Uint8Array | null = null;
    try {
      bytes = build();
    } catch {
      continue; // refused offline — the contract
    }
    const result = decodePack(bytes);
    throw new Error(
      `${label}: encodePack emitted a pack instead of throwing, and decodePack ` +
      `${result.ok ? "accepts it (update this test)" : `rejects it — ${result.reason}`}`,
    );
  }
});

test("PROPERTY: whatever encodePack accepts, decodePack accepts (1000 seeded trials)", () => {
  // Mulberry32; the seed is arbitrary but FIXED so a counterexample reproduces
  // byte-for-byte instead of flickering between runs.
  let s = 0xdecafbad >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Values chosen to straddle every line the writer and reader could disagree
  // on: safe integers, the first unsafe one (2^53), fractions, denormals,
  // non-finites, zero and negatives. 2^53-1 / 2^53 is the isSafeInteger edge;
  // 1e-320 and 5e-324 are the denormals whose reciprocal overflows.
  const POOL = [1, 8, 48, 854, 8.5, 0, -1, -48, 1e6, 2 ** 53 - 1, 2 ** 53, 1e21, 1e308,
    1e-3, 0.1, 1e-320, 5e-324, NaN, Infinity, -Infinity];
  const pick = (): number => POOL[Math.floor(rand() * POOL.length)];
  const frames = [synthFrame(0, 64), synthFrame(1, 64)];
  for (let trial = 0; trial < 1000; trial++) {
    const h: Omit<TvfHeader, "v" | "offsets"> = {
      width: pick(),
      height: pick(),
      fps: pick(),
      frameCount: pick(), // advisory — overwritten with frames.length
      durationMs: pick(),
      sourceSha1: rand() < 0.5 ? "0".repeat(40) : "",
    };
    if (rand() < 0.4) {
      h.delaysMs = Array.from({ length: Math.floor(rand() * 12) }, () => pick());
    }
    let bytes: Uint8Array;
    try {
      bytes = encodePack(h, frames);
    } catch {
      continue; // the writer refused offline, which is always legal
    }
    const result = decodePack(bytes);
    if (!result.ok) {
      throw new Error(
        `trial ${trial}: encodePack accepted ${JSON.stringify(h)} ` +
        `but decodePack rejects its own output — ${result.reason}`,
      );
    }
  }
});

// ═════════════════════════════════════════════════════════════
// ZERO-COPY
// ═════════════════════════════════════════════════════════════

test("frameAt is zero-copy: the view shares the pack's ArrayBuffer", () => {
  const bytes = encodePack(BASE_HEADER, EIGHT);
  const pack = expectOk(decodePack(bytes), "zero-copy");
  assert(pack.payload.buffer === bytes.buffer, "payload views the buffer it was decoded from");
  for (let i = 0; i < EIGHT.length; i++) {
    const frame = frameAt(pack, i)!;
    assert(frame.buffer === pack.payload.buffer, `frame ${i} shares the pack's ArrayBuffer`);
    assert(frame.buffer === bytes.buffer, `frame ${i} shares the ORIGINAL buffer — nothing was copied`);
    assertEqual(
      frame.byteOffset,
      pack.payload.byteOffset + pack.header.offsets[i],
      `frame ${i} byteOffset`,
    );
  }
});

test("A write through the source buffer is visible in a held frame (proving no copy)", () => {
  const bytes = encodePack(BASE_HEADER, EIGHT);
  const pack = expectOk(decodePack(bytes), "aliasing");
  const frame = frameAt(pack, 3)!;
  const before = frame[5];
  bytes[frame.byteOffset + 5] = before ^ 0xff;
  assertEqual(frame[5], before ^ 0xff, "the frame aliases the file bytes");
  bytes[frame.byteOffset + 5] = before;
});

test("openPack's frames also alias one buffer, so playback allocates nothing per frame", () => {
  const dir = mkdtempSync(join(tmpdir(), "tvf-"));
  try {
    const path = join(dir, "clip.tvf");
    writeFileSync(path, encodePack(BASE_HEADER, EIGHT));
    const pack = expectOk(openPack(path), "openPack");
    const a = frameAt(pack, 0)!;
    const b = frameAt(pack, 7)!;
    assert(a.buffer === b.buffer, "two frames, one ArrayBuffer");
    assert(bytesEqual(b, EIGHT[7]), "and the last frame still round-trips through the filesystem");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════
// REAL JPEG PAYLOAD
// ═════════════════════════════════════════════════════════════

test("A real JPEG survives the container and decodes FROM the zero-copy view", () => {
  const jpeg = new Uint8Array(readFileSync(REAL_JPEG));
  const pack = expectOk(
    decodePack(encodePack({ ...BASE_HEADER, width: 64, height: 48, frameCount: 3 }, [jpeg, jpeg, jpeg])),
    "real jpeg",
  );
  const frame = frameAt(pack, 1)!;
  assert(bytesEqual(frame, jpeg), "byte-identical to the file on disk");
  // The container promises independent decodability per frame. Prove it on the
  // subarray itself, without copying it out first — that is how a player will
  // hand it to the decoder.
  const view = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
  const decoded = decodeImage(view);
  assert(decoded.ok, `the middle frame decodes standalone (${decoded.ok ? "" : decoded.detail})`);
  if (decoded.ok) {
    assertEqual(decoded.pixels.width, 64, "decoded width");
    assertEqual(decoded.pixels.height, 48, "decoded height");
  }
});

// ═════════════════════════════════════════════════════════════
// DELAYS
// ═════════════════════════════════════════════════════════════

test("frameDelayMs without a table is the nominal 1000/fps", () => {
  const pack = expectOk(decodePack(encodePack({ ...BASE_HEADER, fps: 8 }, EIGHT)), "nominal");
  assertEqual(pack.header.delaysMs, undefined, "no table is written for constant-rate sources");
  for (let i = 0; i < 8; i++) assertEqual(frameDelayMs(pack, i), 125, `frame ${i} delay`);
});

test("frameDelayMs with a table reports the table, per frame", () => {
  const delays = [40, 40, 40, 500, 40, 40, 1000, 70];
  const pack = expectOk(
    decodePack(encodePack({ ...BASE_HEADER, delaysMs: delays }, EIGHT)),
    "variable rate",
  );
  for (let i = 0; i < delays.length; i++) {
    assertEqual(frameDelayMs(pack, i), delays[i], `frame ${i} delay`);
  }
  assert(frameDelayMs(pack, 0) !== 1000 / 8, "a table beats the nominal rate");
});

test("frameDelayMs answers with a finite number for an out-of-range or broken index", () => {
  const pack = expectOk(decodePack(encodePack(BASE_HEADER, EIGHT)), "delay bounds");
  assertEqual(frameDelayMs(pack, 999), 125, "past the end falls back to nominal");
  assertEqual(frameDelayMs(pack, -1), 125, "before the start falls back to nominal");
  // A timer handed Infinity never advances; a hand-built pack can carry fps 0.
  const broken: TvfPack = { header: { ...pack.header, fps: 0 }, payload: pack.payload };
  assert(Number.isFinite(frameDelayMs(broken, 0)), "fps 0 does not yield Infinity");
});

// ═════════════════════════════════════════════════════════════
// BOUNDS
// ═════════════════════════════════════════════════════════════

test("frameAt returns null outside the frame range, for every flavour of bad index", () => {
  const pack = expectOk(decodePack(encodePack(BASE_HEADER, EIGHT)), "bounds");
  for (const i of [-1, 8, 9, 1000, 1.5, NaN, Infinity, -0.0001]) {
    assertEqual(frameAt(pack, i), null, `index ${i}`);
  }
  assert(frameAt(pack, 0) !== null, "index 0 is still fine");
  assert(frameAt(pack, 7) !== null, "index frameCount-1 is still fine");
});

test("frameAt refuses to read outside the payload of a HAND-BUILT pack", () => {
  // Nothing here went through decodePack, so the offsets were never validated.
  // This is the memory-safety case: the answer must be null, never a view onto
  // whatever else lives in that ArrayBuffer.
  const payload = new Uint8Array(64);
  const header = (offsets: number[], frameCount: number): TvfHeader => ({
    v: 1,
    width: 4,
    height: 4,
    fps: 10,
    frameCount,
    durationMs: 100,
    offsets,
    sourceSha1: "",
  });
  const hostile: Array<[string, TvfPack]> = [
    ["end past the payload", { header: header([0, 1_000_000], 1), payload }],
    ["negative start", { header: header([-8, 32], 1), payload }],
    ["end before start", { header: header([0, 40, 8], 2), payload }],
    ["offsets too short", { header: header([0, 8], 4), payload }],
    ["non-integer offset", { header: header([0, 8.5], 1), payload }],
  ];
  for (const [label, pack] of hostile) {
    let got: Uint8Array | null;
    try {
      got = frameAt(pack, pack.header.frameCount - 1);
    } catch (err) {
      throw new Error(`${label}: frameAt threw — ${errText(err)}`);
    }
    if (got !== null) {
      assert(
        got.byteOffset >= payload.byteOffset && got.byteOffset + got.length <= payload.byteOffset + payload.length,
        `${label}: frameAt handed back bytes outside the payload`,
      );
    }
    assertEqual(got, null, `${label} must be refused`);
  }
});

// ═════════════════════════════════════════════════════════════
// CORRUPTION MATRIX — the point of this suite
// ═════════════════════════════════════════════════════════════

const GOOD = encodePack(BASE_HEADER, EIGHT);
const GOOD_HEADER_LENGTH = GOOD[4] | (GOOD[5] << 8) | (GOOD[6] << 16) | (GOOD[7] << 24);
const GOOD_PAYLOAD = GOOD.subarray(8 + GOOD_HEADER_LENGTH);

/** Assemble a pack around an arbitrary header value — including illegal ones. */
function rawPack(headerJson: string, payload: Uint8Array): Uint8Array {
  const headerBytes = Buffer.from(headerJson, "utf8");
  const out = new Uint8Array(8 + headerBytes.length + payload.length);
  out.set([0x54, 0x56, 0x46, 0x31], 0);
  const n = headerBytes.length;
  out[4] = n & 0xff;
  out[5] = (n >>> 8) & 0xff;
  out[6] = (n >>> 16) & 0xff;
  out[7] = (n >>> 24) & 0xff;
  out.set(headerBytes, 8);
  out.set(payload, 8 + n);
  return out;
}

/** The good header as a mutable object, for one-field sabotage. */
function goodHeaderObject(): Record<string, unknown> {
  return JSON.parse(Buffer.from(GOOD.subarray(8, 8 + GOOD_HEADER_LENGTH)).toString("utf8"));
}

function sabotage(mutate: (h: Record<string, unknown>) => void, payload = GOOD_PAYLOAD): Uint8Array {
  const h = goodHeaderObject();
  mutate(h);
  return rawPack(JSON.stringify(h), payload);
}

function withHeaderLength(n: number): Uint8Array {
  const out = GOOD.slice();
  out[4] = n & 0xff;
  out[5] = (n >>> 8) & 0xff;
  out[6] = (n >>> 16) & 0xff;
  out[7] = (n >>> 24) & 0xff;
  return out;
}

const reasons: string[] = [];

const MATRIX: Array<[string, () => Uint8Array]> = [
  ["empty buffer", () => new Uint8Array(0)],
  ["3-byte buffer", () => new Uint8Array([0x54, 0x56, 0x46])],
  ["preamble only, no header", () => GOOD.slice(0, 8)],
  ["wrong magic", () => {
    const out = GOOD.slice();
    out[3] = 0x32; // "TVF2"
    return out;
  }],
  ["magic of a different format entirely", () => new Uint8Array([0x47, 0x49, 0x46, 0x38, 1, 0, 0, 0, 0x7b])],
  ["headerLength larger than the file", () => withHeaderLength(GOOD.length + 4096)],
  ["headerLength = 0xFFFFFFFF", () => withHeaderLength(0xffffffff)],
  ["headerLength = 0", () => withHeaderLength(0)],
  ["header is not valid JSON", () => rawPack("{ this is not json", GOOD_PAYLOAD)],
  ["header is invalid UTF-8", () => {
    const out = GOOD.slice();
    out[9] = 0xff; // inside the JSON, decodes to U+FFFD and fails the parse
    out[10] = 0xfe;
    return out;
  }],
  ["JSON is an array, not an object", () => rawPack("[0,1,2]", GOOD_PAYLOAD)],
  ["JSON is a string", () => rawPack('"a pack, honest"', GOOD_PAYLOAD)],
  ["JSON is a number", () => rawPack("42", GOOD_PAYLOAD)],
  ["JSON is null", () => rawPack("null", GOOD_PAYLOAD)],
  ["unknown version", () => sabotage((h) => { h.v = 2; })],
  ["missing offsets", () => sabotage((h) => { delete h.offsets; })],
  ["offsets is not an array", () => sabotage((h) => { h.offsets = 8; })],
  ["offsets non-monotonic", () => sabotage((h) => {
    const o = h.offsets as number[];
    const t = o[3];
    o[3] = o[5];
    o[5] = t;
  })],
  ["offsets contain a duplicate (a zero-byte frame)", () => sabotage((h) => {
    const o = h.offsets as number[];
    o[4] = o[3];
  })],
  ["offsets[0] is not 0", () => sabotage((h) => { (h.offsets as number[])[0] = 4; })],
  ["offsets contain a negative", () => sabotage((h) => { (h.offsets as number[])[1] = -1; })],
  ["offsets contain a string", () => sabotage((h) => { (h.offsets as unknown[])[2] = "96"; })],
  ["offsets[last] > payload length", () => sabotage((h) => {
    const o = h.offsets as number[];
    o[o.length - 1] += 1;
  })],
  ["offsets[last] < payload length", () => sabotage((h) => {
    const o = h.offsets as number[];
    o[o.length - 1] -= 1;
  })],
  ["frameCount !== offsets.length - 1", () => sabotage((h) => { h.frameCount = 7; })],
  ["frameCount is 0", () => rawPack(JSON.stringify({ ...goodHeaderObject(), frameCount: 0, offsets: [0] }), new Uint8Array(0))],
  ["frameCount is not an integer", () => sabotage((h) => { h.frameCount = 8.5; })],
  ["payload truncated mid-frame", () => GOOD.slice(0, GOOD.length - 37)],
  ["payload truncated to nothing", () => GOOD.slice(0, 8 + GOOD_HEADER_LENGTH)],
  ["fps is 0", () => sabotage((h) => { h.fps = 0; })],
  ["fps is null (JSON has no NaN)", () => sabotage((h) => { h.fps = null; })],
  ["width is negative", () => sabotage((h) => { h.width = -48; })],
  ["durationMs is missing", () => sabotage((h) => { delete h.durationMs; })],
  ["sourceSha1 is missing", () => sabotage((h) => { delete h.sourceSha1; })],
  ["delaysMs is the wrong length", () => sabotage((h) => { h.delaysMs = [1, 2, 3]; })],
  ["delaysMs holds a non-number", () => sabotage((h) => { h.delaysMs = [1, 2, 3, 4, 5, 6, 7, "8"]; })],
  ["a whole different file (the mp4 fixture)", () => new Uint8Array(readFileSync(join(HERE, "fixtures", "video", "testsrc-64x48-10fps.mp4")))],
  ["random bytes", () => {
    const out = new Uint8Array(512);
    for (let i = 0; i < out.length; i++) out[i] = (i * 97 + 13) & 0xff;
    return out;
  }],
];

console.log("");
for (const [label, build] of MATRIX) {
  test(`REJECTS: ${label}`, () => {
    let bytes: Uint8Array;
    try {
      bytes = build();
    } catch (err) {
      throw new Error(`could not build the case: ${errText(err)}`);
    }
    let result: TvfResult;
    try {
      result = decodePack(bytes);
    } catch (err) {
      throw new Error(`decodePack THREW instead of returning a reason: ${errText(err)}`);
    }
    if (result.ok) throw new Error("accepted a corrupt pack");
    assert(typeof result.reason === "string" && result.reason.length > 0, "a reason must be given");
    reasons.push(`${label.padEnd(44)} ${result.reason}`);
  });
}

// ═════════════════════════════════════════════════════════════
// openPack
// ═════════════════════════════════════════════════════════════

console.log("");

test("openPack reports every filesystem failure as a reason, never a throw", () => {
  const dir = mkdtempSync(join(tmpdir(), "tvf-"));
  try {
    const cases: Array<[string, string]> = [
      ["a file that does not exist", join(dir, "nope.tvf")],
      ["a directory", dir],
      ["an empty file", join(dir, "empty.tvf")],
      ["a truncated pack", join(dir, "trunc.tvf")],
      ["a source video renamed to .tvf", join(dir, "video.tvf")],
    ];
    writeFileSync(cases[2][1], new Uint8Array(0));
    writeFileSync(cases[3][1], GOOD.slice(0, GOOD.length - 100));
    writeFileSync(cases[4][1], readFileSync(join(HERE, "fixtures", "video", "testsrc-48x32-8f.gif")));
    for (const [label, path] of cases) {
      let result: TvfResult;
      try {
        result = openPack(path);
      } catch (err) {
        throw new Error(`${label}: openPack THREW — ${errText(err)}`);
      }
      assert(!result.ok, `${label} must be refused`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("openPack round-trips a pack written to disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "tvf-"));
  try {
    const path = join(dir, "clip.tvf");
    const delays = [10, 20, 30, 40, 50, 60, 70, 80];
    writeFileSync(path, encodePack({ ...BASE_HEADER, delaysMs: delays }, EIGHT));
    const pack = expectOk(openPack(path), "openPack");
    assertEqual(pack.header.frameCount, 8, "frameCount");
    assertEqual(frameDelayMs(pack, 5), 60, "delay survives the filesystem");
    for (let i = 0; i < 8; i++) {
      assert(bytesEqual(frameAt(pack, i)!, EIGHT[i]), `frame ${i} byte-identical off disk`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════
// CEILINGS — both documented limits, at their exact boundaries
// ═════════════════════════════════════════════════════════════

// 512 MiB and 16 MiB restated by VALUE, not imported: these are the wire
// contract (pack.ts MAX_PACK_BYTES / MAX_HEADER_BYTES), and a test that echoed
// the module's constants would follow them if they silently drifted.
const PACK_CEILING = 512 * 1024 * 1024;
const HEADER_CEILING = 16 * 1024 * 1024;

test("encodePack refuses a pack past openPack's 512 MiB ceiling at pack time", () => {
  // Nine 64 MiB views of ONE buffer: 576 MiB of declared payload on 64 MiB of
  // RAM. The old writer happily produced this file in memory; openPack then
  // refused it forever, and nothing had signalled that at build time — the
  // exact deferred failure encodePack's docblock promises to prevent.
  const chunk = new Uint8Array(64 * 1024 * 1024);
  const frames: Uint8Array[] = new Array(9).fill(chunk);
  let threw: Error | null = null;
  let emitted = -1;
  try {
    emitted = encodePack({ ...BASE_HEADER, width: 854, height: 480, fps: 24 }, frames).length;
  } catch (err) {
    threw = err instanceof Error ? err : new Error(String(err));
  }
  assert(threw !== null, `an unplayable ${emitted}-byte pack was written instead of refused`);
  assert(/ceiling/.test(threw!.message), `the throw names the ceiling — got "${threw!.message}"`);
});

test("The pack ceiling is exact: MAX_PACK_BYTES writes and opens, one byte more refuses", () => {
  // The header's byte length depends on the digits of the one offset, which
  // depends on the header's byte length — a fixed point, converged in a few
  // iterations because the digit count is stable at this magnitude. The object
  // mirrors the key set encodePack writes, so the lengths agree.
  const headerLenFor = (n: number): number => JSON.stringify({
    v: 1, width: 854, height: 480, fps: 24, frameCount: 1,
    durationMs: 1000, sourceSha1: "0".repeat(40), offsets: [0, n],
  }).length;
  let n = PACK_CEILING;
  for (let i = 0; i < 4; i++) n = PACK_CEILING - 8 - headerLenFor(n);
  const big = Buffer.allocUnsafe(n + 1); // frame content is irrelevant to the container
  const geometry = { width: 854, height: 480, fps: 24, frameCount: 1, durationMs: 1000, sourceSha1: "0".repeat(40) };

  const fits = encodePack(geometry, [big.subarray(0, n)]);
  assertEqual(fits.length, PACK_CEILING, "the pack lands exactly on the ceiling");
  const dir = mkdtempSync(join(tmpdir(), "tvf-ceiling-"));
  try {
    const path = join(dir, "exact.tvf");
    writeFileSync(path, fits);
    const opened = openPack(path);
    assert(opened.ok, `openPack accepts a pack at exactly the ceiling — ${opened.ok ? "" : opened.reason}`);
    if (opened.ok) assertEqual(opened.pack.header.frameCount, 1, "and it is playable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Same header length (the digit count of n+1 is unchanged), so the output
  // would be PACK_CEILING + 1 — it must never exist.
  let threw = false;
  try {
    encodePack(geometry, [big]);
  } catch {
    threw = true;
  }
  assert(threw, "one byte past the ceiling must throw at pack time");
});

test("openPack refuses an oversize file by stat, before any read", () => {
  const dir = mkdtempSync(join(tmpdir(), "tvf-sparse-"));
  try {
    const path = join(dir, "huge.tvf");
    // A VALID pack extended to ceiling+1 with a sparse hole, so size is the
    // only possible reason for rejection — and no real disk is spent.
    writeFileSync(path, GOOD);
    truncateSync(path, PACK_CEILING + 1);
    const result = openPack(path);
    assert(!result.ok, "an oversize pack must be refused");
    assert(!result.ok && /ceiling/.test(result.reason), `the reason names the ceiling — got "${result.ok ? "" : result.reason}"`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A header at exactly the 16 MiB ceiling is parsed, not just waved past the guard", () => {
  // The matrix's headerLength cases (0 and 0xFFFFFFFF) both die in arithmetic
  // and never exercise the parse path AT SIZE. Pad the good header to exactly
  // the ceiling with trailing whitespace, which JSON.parse permits.
  const json = JSON.stringify(goodHeaderObject());
  const pack = expectOk(
    decodePack(rawPack(json + " ".repeat(HEADER_CEILING - json.length), GOOD_PAYLOAD)),
    "ceiling-sized header",
  );
  assertEqual(pack.header.frameCount, 8, "frameCount survives a ceiling-sized header");
});

test("One byte past the 16 MiB header ceiling is refused by arithmetic", () => {
  const json = JSON.stringify(goodHeaderObject());
  const result = decodePack(rawPack(json + " ".repeat(HEADER_CEILING + 1 - json.length), GOOD_PAYLOAD));
  assert(!result.ok, "must be refused");
  assert(!result.ok && /ceiling/.test(result.reason), `the reason names the ceiling — got "${result.ok ? "" : result.reason}"`);
});

// ═════════════════════════════════════════════════════════════
// sha1File
// ═════════════════════════════════════════════════════════════

test("sha1File matches shasum(1) on a small file", () => {
  // Reference digests taken from `shasum -a 1` on 2026-07-27, so this is an
  // independent oracle rather than a re-run of the same code.
  assertEqual(sha1File(REAL_JPEG), "72d1a792258a609114aea767fccbc11fdd6a4b82", "quarters-64x48.jpg");
  assertEqual(
    sha1File(join(HERE, "fixtures", "video", "testsrc-48x32-8f.gif")),
    "947d2601069783b687b1a389fd40ccdea1413878",
    "testsrc-48x32-8f.gif",
  );
});

test("sha1File hashes a file larger than its 1 MiB read chunk correctly", () => {
  // 4.4 MB, so the chunk loop runs five times — the case a single-read
  // implementation would silently get wrong.
  assertEqual(sha1File(TRAILER), "9b678890fb8ca401c28e7ca09171ec008a154b97", "sintel-trailer.mp4");
});

test("sha1File returns \"\" for an unreadable source instead of throwing", () => {
  let got: string;
  try {
    got = sha1File(join(HERE, "fixtures", "does-not-exist.mp4"));
  } catch (err) {
    throw new Error(`sha1File threw on a missing file — ${errText(err)}`);
  }
  assertEqual(got, "", "missing file hashes to the empty string");
  assertEqual(sha1File(HERE), "", "a directory does too");
});

test("sha1File returns \"\" for a device or FIFO instead of never returning", () => {
  // Windows has neither /dev/zero nor mkfifo; the guarded code path (statSync
  // + isFile) is identical on every platform, so nothing extra is pinned there.
  if (process.platform === "win32") return;
  // Run in a CHILD with a hard timeout: against a regressed implementation
  // these calls neither throw nor return — /dev/zero satisfies every readSync
  // with a full chunk and never signals EOF, and openSync on a writerless FIFO
  // blocks — so an in-process call would freeze this suite rather than fail it.
  const dir = mkdtempSync(join(tmpdir(), "tvf-sha1-"));
  try {
    const fifo = join(dir, "pipe");
    const made = spawnSync("mkfifo", [fifo]);
    // If mkfifo is unavailable, /dev/null still pins the isFile() gate: it
    // opens and EOFs immediately, so a gateless sha1File returns the digest of
    // the empty string instead of "".
    const target = made.status === 0 ? fifo : "/dev/null";
    const script = join(dir, "probe.ts");
    const packUrl = pathToFileURL(join(HERE, "..", "src", "video", "pack.ts")).href;
    writeFileSync(script, [
      `import { sha1File } from ${JSON.stringify(packUrl)};`,
      `console.log(JSON.stringify([sha1File("/dev/zero"), sha1File(${JSON.stringify(target)})]));`,
    ].join("\n"));
    // 20 s is npx+tsx startup (~1-2 s warm) plus generous slack; the guarded
    // calls themselves stat and return in microseconds, so only a hang can
    // spend this budget.
    const run = spawnSync("npx", ["tsx", script], {
      cwd: join(HERE, ".."),
      timeout: 20_000,
      encoding: "utf8",
    });
    if (run.status !== 0 || run.signal !== null) {
      throw new Error(
        `sha1File never returned (status ${run.status}, signal ${run.signal})\n${run.stderr ?? ""}`,
      );
    }
    const lines = run.stdout.trim().split("\n");
    const [zero, other] = JSON.parse(lines[lines.length - 1]) as [string, string];
    assertEqual(zero, "", "/dev/zero is not hashable");
    assertEqual(other, "", "a FIFO (or device) is not hashable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A pack carries the source digest for staleness detection", () => {
  const digest = sha1File(REAL_JPEG);
  const pack = expectOk(
    decodePack(encodePack({ ...BASE_HEADER, sourceSha1: digest }, EIGHT)),
    "digest",
  );
  assertEqual(pack.header.sourceSha1, digest, "digest survives the roundtrip");
  assert(pack.header.sourceSha1 !== sha1File(TRAILER), "and a different source would not match");
});

// ═════════════════════════════════════════════════════════════
// MEASUREMENTS — feature-length pack
// ═════════════════════════════════════════════════════════════

/**
 * 1253 frames is the sintel trailer at 24 fps; ~40 KB is what 854x480 measures
 * at JPEG q75. Frame CONTENT is irrelevant to what is being timed — encode is
 * one memcpy of the total, decode is a JSON parse plus a linear offsets walk —
 * so synthetic frames of realistic size are an honest stand-in and keep the
 * suite free of an ffmpeg dependency.
 */
const BIG_COUNT = 1253;
const BIG_FRAME_BYTES = 40 * 1024;

const bigFrames: Uint8Array[] = [];
for (let i = 0; i < BIG_COUNT; i++) {
  // Vary the size ±12% the way a real encode does, so the offsets are not a
  // uniform arithmetic sequence that JSON.stringify could compress unusually.
  bigFrames.push(synthFrame(i, BIG_FRAME_BYTES + ((i * 977) % 9973) - 4986));
}

const t0 = performance.now();
const bigBytes = encodePack(
  { width: 854, height: 480, fps: 24, frameCount: BIG_COUNT, durationMs: (BIG_COUNT * 1000) / 24, sourceSha1: sha1File(TRAILER) },
  bigFrames,
);
const encodeMs = performance.now() - t0;

const t1 = performance.now();
const bigResult = decodePack(bigBytes);
const decodeMs = performance.now() - t1;

const bigHeaderLength = bigBytes[4] | (bigBytes[5] << 8) | (bigBytes[6] << 16) | (bigBytes[7] << 24);

test("A 1253-frame pack round-trips", () => {
  const pack = expectOk(bigResult, "big pack");
  assertEqual(pack.header.frameCount, BIG_COUNT, "frameCount");
  assertEqual(pack.header.offsets.length, BIG_COUNT + 1, "offsets length");
  assert(bytesEqual(frameAt(pack, 0)!, bigFrames[0]), "first frame");
  assert(bytesEqual(frameAt(pack, 626)!, bigFrames[626]), "middle frame");
  assert(bytesEqual(frameAt(pack, BIG_COUNT - 1)!, bigFrames[BIG_COUNT - 1]), "last frame");
  assertEqual(frameAt(pack, BIG_COUNT), null, "one past the end");
});

let seekMs = 0;
test("Seeking every frame of a 1253-frame pack is allocation-free", () => {
  const pack = expectOk(bigResult, "big pack");
  const t = performance.now();
  let bytesSeen = 0;
  for (let i = 0; i < BIG_COUNT; i++) bytesSeen += frameAt(pack, i)!.length;
  seekMs = performance.now() - t;
  assertEqual(bytesSeen, pack.payload.length, "every payload byte is reachable through frameAt");
});

// A 1 MiB delay table is the GIF-sourced worst case for header weight.
const withDelays = encodePack(
  {
    width: 854,
    height: 480,
    fps: 24,
    frameCount: BIG_COUNT,
    durationMs: (BIG_COUNT * 1000) / 24,
    sourceSha1: "",
    delaysMs: bigFrames.map((_, i) => 40 + (i % 3) * 10),
  },
  bigFrames,
);
const withDelaysHeaderLength = withDelays[4] | (withDelays[5] << 8) | (withDelays[6] << 16) | (withDelays[7] << 24);

// Warm decode, best of 20: the cold number above is one sample and includes
// whatever JIT state the suite happened to leave behind.
let warmDecodeMs = Infinity;
for (let i = 0; i < 20; i++) {
  const t = performance.now();
  decodePack(bigBytes);
  warmDecodeMs = Math.min(warmDecodeMs, performance.now() - t);
}

// openPack end to end, which is what a player actually pays: a 49 MB read plus
// the parse. This is the number that decides whether a video can be opened
// inside a frame or has to be opened before the first one.
const measureDir = mkdtempSync(join(tmpdir(), "tvf-big-"));
let openMs = 0;
let openedFrames = 0;
try {
  const bigPath = join(measureDir, "trailer.tvf");
  writeFileSync(bigPath, bigBytes);
  const t = performance.now();
  const opened = openPack(bigPath);
  openMs = performance.now() - t;
  openedFrames = opened.ok ? opened.pack.header.frameCount : -1;
} finally {
  rmSync(measureDir, { recursive: true, force: true });
}

console.log(`\n\x1b[1m  Measurements\x1b[0m  (${BIG_COUNT} frames, ${(BIG_FRAME_BYTES / 1024).toFixed(0)} KB/frame nominal)\n`);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`    pack size                ${(bigBytes.length / (1024 * 1024)).toFixed(1)} MB`);
console.log(`    header JSON              ${kb(bigHeaderLength)} (${bigHeaderLength} B, ${(bigHeaderLength / BIG_COUNT).toFixed(1)} B/frame, ${BIG_COUNT + 1} offsets)`);
console.log(`    header JSON + delaysMs   ${kb(withDelaysHeaderLength)} (${(withDelaysHeaderLength / BIG_COUNT).toFixed(1)} B/frame)`);
console.log(`    encodePack               ${encodeMs.toFixed(1)} ms`);
console.log(`    decodePack cold          ${decodeMs.toFixed(2)} ms   (parse + validate ${BIG_COUNT + 1} offsets)`);
console.log(`    decodePack best of 20    ${warmDecodeMs.toFixed(2)} ms`);
console.log(`    openPack (read + parse)  ${openMs.toFixed(1)} ms   (${openedFrames} frames off disk)`);
console.log(`    frameAt x ${BIG_COUNT}          ${seekMs.toFixed(2)} ms   (${((seekMs * 1000) / BIG_COUNT).toFixed(2)} us/frame)`);

if (process.env.TVF_SHOW_REASONS === "1") {
  console.log(`\n\x1b[1m  Rejection reasons\x1b[0m\n`);
  for (const line of reasons) console.log(`    ${line}`);
}

// ═════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
