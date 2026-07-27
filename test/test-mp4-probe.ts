/**
 * Unit tests for the MP4/MOV dimension probe (src/video/mp4-probe.ts).
 *
 * Three things are being pinned here, and only the first is ordinary.
 *
 * 1. AGREEMENT WITH ffprobe. The probe exists to replace a subprocess, so the
 *    subprocess is the oracle: every dimension, duration and frame rate below
 *    is read out of ffprobe at test time rather than hard-coded, and a fixture
 *    re-encoded tomorrow re-derives its own expectations.
 *
 * 2. THE BYTE BUDGET. "Cheaper than readFileSync" is the entire reason this
 *    module was written instead of a four-line slurp, and an unasserted
 *    performance claim rots. The trailer is 4.4 MB with its `moov` at the tail;
 *    the walk is held to a hard ceiling and the suite prints what it actually
 *    cost.
 *
 * 3. THE SPEC EDGES, SYNTHETICALLY. 64-bit box sizes, `size == 0`, version 1
 *    headers and a `tkhd` of 0x0 do not appear in any fixture on this machine
 *    and cannot be conjured by re-encoding one, so the second half of this file
 *    BUILDS MP4s byte by byte. That builder is also the only way to assert the
 *    failure paths precisely: "no video track" has to mean a container that is
 *    otherwise perfectly well formed, not a truncated file that would fail for
 *    six other reasons.
 *
 * The rotation cases run twice — once against matrices this file writes, once
 * against files `ffmpeg -display_rotation` writes — because a hand-built matrix
 * proves the branch and only a real muxer proves the branch is the one real
 * muxers trigger.
 *
 * Run:  npx tsx test/test-mp4-probe.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { execFileSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  probeMp4,
  probeMp4Bytes,
  mp4ProbeStats,
  resetMp4ProbeStats,
} from "../src/video/mp4-probe.js";

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

function section(name: string): void {
  console.log(`\n\x1b[1m  ${name}\x1b[0m\n`);
}

let skipped = 0;

/**
 * A test that needs an external binary.
 *
 * Skipped rather than failed when the binary is missing. The ffprobe-oracle
 * cases are the load-bearing ones in this file and they must RUN on a
 * development machine — but a CI box without ffmpeg installed has not found a
 * bug in the probe, and reporting one there would train people to ignore this
 * suite. The skip is printed, loudly enough to notice if it ever becomes
 * permanent.
 */
function testNeeding(tool: string | null, name: string, fn: (tool: string) => void): void {
  if (tool === null) {
    skipped++;
    console.log(`  \x1b[33m-\x1b[0m ${name} \x1b[2m(skipped: tool not installed)\x1b[0m`);
    return;
  }
  test(name, () => fn(tool));
}

/** Notes printed with the summary: measured numbers worth reading, not assertions. */
const notes: string[] = [];

// ─── Paths ────────────────────────────────────────────────

// Resolved from this file, not from the cwd: run-all.ts and a bare
// `npx tsx test/test-mp4-probe.ts` disagree about `process.cwd()`.
// `fileURLToPath` rather than `.pathname`, which yields "/C:/..." on Windows.
const REPO = fileURLToPath(new URL("..", import.meta.url));
const TESTSRC_MP4 = join(REPO, "test/fixtures/video/testsrc-64x48-10fps.mp4");
const SINTEL_5S = join(REPO, "devnotes/media/sintel-5s.mp4");
const SINTEL_TRAILER = join(REPO, "devnotes/media/sintel-trailer.mp4");
const TESTSRC_GIF = join(REPO, "test/fixtures/video/testsrc-48x32-8f.gif");
const GRADIENT_PNG = join(REPO, "test/fixtures/gradient-200x100.png");

const scratch = mkdtempSync(join(tmpdir(), "mp4-probe-"));

// ─── ffprobe oracle ───────────────────────────────────────

/**
 * Locate an ffmpeg-suite binary. Homebrew's prefix first because that is where
 * it lives on this project's development machines, then the usual system
 * prefixes, then bare on PATH.
 */
function resolveTool(name: string): string | null {
  for (const candidate of [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    name,
  ]) {
    try {
      execFileSync(candidate, ["-version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Next candidate. A missing binary and a non-executable one are the same
      // outcome here.
    }
  }
  return null;
}

const FFPROBE = resolveTool("ffprobe");
const FFMPEG = resolveTool("ffmpeg");

interface Truth {
  width: number;
  height: number;
  durationMs: number;
  fps: number;
}

/**
 * Ground truth for one file, straight out of ffprobe.
 *
 * Reads the VIDEO STREAM's duration rather than the container's. They agree on
 * every fixture here, but they are computed from different boxes — the stream's
 * comes from `mdhd`, which is what the probe reads — so using the stream's
 * keeps a disagreement between the two from being blamed on the probe.
 *
 * `r_frame_rate` arrives as a rational ("24/1"); it is left as a ratio and
 * divided here rather than parsed as a float, because 30000/1001 must not be
 * rounded twice.
 */
function ffprobeTruth(ffprobe: string, path: string): Truth {
  const out = execFileSync(
    ffprobe,
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration,r_frame_rate",
      "-of", "default=noprint_wrappers=1",
      path,
    ],
    { encoding: "utf8" },
  );
  const fields = new Map<string, string>();
  for (const line of out.trim().split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) fields.set(line.slice(0, eq), line.slice(eq + 1));
  }
  const rate = (fields.get("r_frame_rate") ?? "0/1").split("/");
  return {
    width: Number(fields.get("width")),
    height: Number(fields.get("height")),
    durationMs: Math.round(Number(fields.get("duration")) * 1000),
    fps: Math.round((Number(rate[0]) / Number(rate[1])) * 1000) / 1000,
  };
}

// ─── MP4 builder ──────────────────────────────────────────
//
// Enough ISO-BMFF to exercise every branch the probe has. Nothing here is a
// playable file — there are no real samples — but every box the probe reads is
// byte-exact, which is the only property under test.

function u8(...values: number[]): Buffer {
  return Buffer.from(values);
}

function u16(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(value, 0);
  return b;
}

function u32(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value, 0);
  return b;
}

function i32(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(value, 0);
  return b;
}

function u64(value: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(value), 0);
  return b;
}

function fourcc(type: string): Buffer {
  return Buffer.from(type, "latin1");
}

/** A box with an ordinary 32-bit size field. */
function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(body.length + 8), fourcc(type), body]);
}

/** A box declaring `size == 1`, pushing the real size into a trailing u64. */
function box64(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(1), fourcc(type), u64(body.length + 16), body]);
}

/** A box declaring `size == 0`: "I run to the end of my container." */
function boxToEnd(type: string, ...payload: Buffer[]): Buffer {
  return Buffer.concat([u32(0), fourcc(type), ...payload]);
}

/** 16.16 fixed point, the unit the tkhd matrix and dimensions are stored in. */
function fixed16(value: number): Buffer {
  return i32(Math.round(value * 65536));
}

/**
 * The four rotations, as (a, b, c, d) — the only matrix entries that decide
 * whether the axes swap. Values copied from what `ffmpeg -display_rotation`
 * actually wrote into the fixtures built at the bottom of this file.
 */
const MATRIX_ROT = {
  0: [1, 0, 0, 1],
  90: [0, -1, 1, 0],
  180: [-1, 0, 0, -1],
  270: [0, 1, -1, 0],
} as const;

function matrix(a: number, b: number, c: number, d: number): Buffer {
  // {a, b, u; c, d, v; x, y, w} — u, v, w are 2.30 and w is 1.0, i.e. 0x40000000.
  return Buffer.concat([
    fixed16(a), fixed16(b), u32(0),
    fixed16(c), fixed16(d), u32(0),
    u32(0), u32(0), u32(0x40000000),
  ]);
}

function mvhd(version: 0 | 1, timescale: number, duration: number): Buffer {
  const times =
    version === 1
      ? Buffer.concat([u64(0), u64(0), u32(timescale), u64(duration)])
      : Buffer.concat([u32(0), u32(0), u32(timescale), u32(duration)]);
  return box(
    "mvhd",
    u8(version, 0, 0, 0),
    times,
    u32(0x00010000), // rate 1.0
    u16(0x0100), // volume 1.0
    Buffer.alloc(10), // reserved
    matrix(1, 0, 0, 1),
    Buffer.alloc(24), // pre_defined
    u32(2), // next_track_ID
  );
}

function tkhd(
  version: 0 | 1,
  width: number,
  height: number,
  rot: readonly [number, number, number, number] = MATRIX_ROT[0],
): Buffer {
  const times =
    version === 1
      ? Buffer.concat([u64(0), u64(0), u32(1), u32(0), u64(0)])
      : Buffer.concat([u32(0), u32(0), u32(1), u32(0), u32(0)]);
  return box(
    "tkhd",
    u8(version, 0, 0, 3), // flags: enabled | in movie
    times,
    Buffer.alloc(8), // reserved
    u16(0), u16(0), u16(0), u16(0), // layer, alternate_group, volume, reserved
    matrix(rot[0], rot[1], rot[2], rot[3]),
    fixed16(width),
    fixed16(height),
  );
}

function mdhd(version: 0 | 1, timescale: number, duration: number): Buffer {
  const times =
    version === 1
      ? Buffer.concat([u64(0), u64(0), u32(timescale), u64(duration)])
      : Buffer.concat([u32(0), u32(0), u32(timescale), u32(duration)]);
  return box("mdhd", u8(version, 0, 0, 0), times, u16(0x55c4), u16(0)); // "und"
}

function hdlr(handler: string): Buffer {
  return box(
    "hdlr",
    u32(0),
    u32(0),
    fourcc(handler),
    Buffer.alloc(12),
    Buffer.from("probe\0", "latin1"),
  );
}

/** An `stsd` holding one avc1 VisualSampleEntry, the fallback dimension source. */
function stsd(width: number, height: number): Buffer {
  const entry = box(
    "avc1",
    Buffer.alloc(6), // reserved
    u16(1), // data_reference_index
    u16(0), u16(0), // pre_defined, reserved
    Buffer.alloc(12), // pre_defined[3]
    u16(width),
    u16(height),
    u32(0x00480000), u32(0x00480000), // 72 dpi
    u32(0),
    u16(1), // frame_count
    Buffer.alloc(32), // compressorname
    u16(0x0018), // depth
    i32(-1), // pre_defined
  );
  return box("stsd", u32(0), u32(1), entry);
}

/** `stts` from run-length (count, delta) pairs. */
function stts(runs: ReadonlyArray<readonly [number, number]>): Buffer {
  const entries = runs.map(([count, delta]) => Buffer.concat([u32(count), u32(delta)]));
  return box("stts", u32(0), u32(runs.length), ...entries);
}

interface TrakSpec {
  handler: string;
  tkhdWidth: number;
  tkhdHeight: number;
  version?: 0 | 1;
  rotation?: 0 | 90 | 180 | 270;
  /** Dimensions in the sample entry, which differ from tkhd only on purpose. */
  stsdWidth?: number;
  stsdHeight?: number;
  timescale?: number;
  duration?: number;
  runs?: ReadonlyArray<readonly [number, number]>;
  /** Omit `stbl` entirely, i.e. a track with no sample tables at all. */
  noStbl?: boolean;
}

function trak(spec: TrakSpec): Buffer {
  const version = spec.version ?? 0;
  const timescale = spec.timescale ?? 600;
  const duration = spec.duration ?? 600;
  const stblBox = spec.noStbl
    ? Buffer.alloc(0)
    : box(
        "stbl",
        stsd(spec.stsdWidth ?? spec.tkhdWidth, spec.stsdHeight ?? spec.tkhdHeight),
        stts(spec.runs ?? [[timescale / 25, 25] as const]),
        box("stsc", u32(0), u32(0)),
        box("stsz", u32(0), u32(0), u32(0)),
        box("stco", u32(0), u32(0)),
      );
  return box(
    "trak",
    tkhd(version, spec.tkhdWidth, spec.tkhdHeight, MATRIX_ROT[spec.rotation ?? 0]),
    box("edts", box("elst", u32(0), u32(0))),
    box(
      "mdia",
      mdhd(version, timescale, duration),
      hdlr(spec.handler),
      box("minf", box("vmhd", u32(0), u16(0), Buffer.alloc(6)), stblBox),
    ),
  );
}

interface MovieSpec {
  traks: Buffer[];
  version?: 0 | 1;
  timescale?: number;
  duration?: number;
  /** Bytes of filler in the `mdat` the `moov` has to be found past. */
  mdatBytes?: number;
  /** `moov` before `mdat` (Apple's faststart ordering) instead of after. */
  moovFirst?: boolean;
  /** Declare `mdat` with a 64-bit `largesize`. */
  mdat64?: boolean;
  /** Declare the LAST box with `size == 0`, i.e. "runs to end of file". */
  lastBoxToEnd?: boolean;
}

function movie(spec: MovieSpec): Uint8Array {
  const ftyp = box("ftyp", fourcc("isom"), u32(512), fourcc("isom"), fourcc("mp41"));
  const moovBody = [
    mvhd(spec.version ?? 0, spec.timescale ?? 1000, spec.duration ?? 1000),
    ...spec.traks,
  ];
  const filler = Buffer.alloc(spec.mdatBytes ?? 64, 0x7f);

  if (spec.moovFirst) {
    const moov = box("moov", ...moovBody);
    const mdat = spec.lastBoxToEnd
      ? boxToEnd("mdat", filler)
      : spec.mdat64
        ? box64("mdat", filler)
        : box("mdat", filler);
    return new Uint8Array(Buffer.concat([ftyp, moov, mdat]));
  }

  const mdat = spec.mdat64 ? box64("mdat", filler) : box("mdat", filler);
  const moov = spec.lastBoxToEnd ? boxToEnd("moov", ...moovBody) : box("moov", ...moovBody);
  return new Uint8Array(Buffer.concat([ftyp, mdat, moov]));
}

/** A movie holding exactly one ordinary 320x180 video track. */
function simpleMovie(layout: Omit<MovieSpec, "traks"> = {}): Uint8Array {
  return movie({
    traks: [trak({ handler: "vide", tkhdWidth: 320, tkhdHeight: 180 })],
    ...layout,
  });
}

function write(name: string, bytes: Uint8Array): string {
  const path = join(scratch, name);
  writeFileSync(path, bytes);
  return path;
}

// ─── Fixtures vs ffprobe ──────────────────────────────────

section("Real fixtures, ffprobe as ground truth");

const REAL_FIXTURES: ReadonlyArray<readonly [string, string]> = [
  ["testsrc-64x48-10fps.mp4", TESTSRC_MP4],
  ["sintel-5s.mp4", SINTEL_5S],
  ["sintel-trailer.mp4", SINTEL_TRAILER],
];

for (const [label, path] of REAL_FIXTURES) {
  testNeeding(FFPROBE, `${label}: dimensions, duration and fps all match ffprobe`, (ffprobe) => {
    const truth = ffprobeTruth(ffprobe, path);
    const info = probeMp4(path);
    assert(info !== null, `${label}: probe returned null`);
    assertEqual(info!.width, truth.width, `${label} width`);
    assertEqual(info!.height, truth.height, `${label} height`);
    assertEqual(info!.durationMs, truth.durationMs, `${label} durationMs`);
    assertEqual(info!.fps, truth.fps, `${label} fps`);
  });
}

test("probeMp4Bytes and probeMp4 both return the pinned sintel-5s truth", () => {
  // Pinned literals, not one code path against the other: both forms share
  // one walk, so "they agree" is vacuously true of any regression that breaks
  // them identically — including both returning null. 854x480, 5000 ms, 24
  // fps is what ffprobe reports for this fixture.
  const expected = '{"width":854,"height":480,"durationMs":5000,"fps":24}';
  const bytes = new Uint8Array(readFileSync(SINTEL_5S));
  assertEqual(JSON.stringify(probeMp4Bytes(bytes)), expected, "buffer form");
  assertEqual(JSON.stringify(probeMp4(SINTEL_5S)), expected, "path form");
});

// ─── The byte budget ──────────────────────────────────────

section("Byte budget");

/**
 * Ceiling for the 4.4 MB trailer. Not a tight fit around the measured number —
 * a tight fit would fail on the next fixture with a fatter `stsd` and teach
 * nobody anything. 256 KB is the point past which "positioned reads" has
 * stopped being meaningfully different from "read the file".
 */
const BUDGET_BYTES = 256 * 1024;

test(`sintel-trailer.mp4 (4.4 MB, moov at tail) reads under ${BUDGET_BYTES} bytes`, () => {
  resetMp4ProbeStats();
  const info = probeMp4(SINTEL_TRAILER);
  const cost = mp4ProbeStats();
  assert(info !== null, "probe returned null");
  const onDisk = statSync(SINTEL_TRAILER).size;
  notes.push(
    `sintel-trailer.mp4: ${onDisk} bytes on disk, ${cost.bytesRead} read ` +
      `in ${cost.reads} readSync calls across ${cost.boxes} boxes ` +
      `(${((cost.bytesRead / onDisk) * 100).toFixed(3)}% of the file)`,
  );
  assert(
    cost.bytesRead < BUDGET_BYTES,
    `read ${cost.bytesRead} bytes, budget is ${BUDGET_BYTES}`,
  );
});

test("read cost is bounded by the box tree, not by the file size", () => {
  resetMp4ProbeStats();
  probeMp4(TESTSRC_MP4);
  const small = mp4ProbeStats();
  resetMp4ProbeStats();
  probeMp4(SINTEL_TRAILER);
  const large = mp4ProbeStats();
  notes.push(
    `testsrc-64x48-10fps.mp4: ${statSync(TESTSRC_MP4).size} bytes on disk, ` +
      `${small.bytesRead} read in ${small.reads} readSync calls`,
  );
  // The 2687-byte fixture is smaller than one read window, so reading all of
  // it is the floor. A file 1627x larger is allowed to cost a few more windows
  // and is not allowed to cost 1627x.
  assert(
    large.bytesRead <= small.bytesRead * 8,
    `small ${small.bytesRead}, large ${large.bytesRead}: cost is scaling with file size`,
  );
});

test("probeMp4Bytes honours a view's byteOffset", () => {
  // A Uint8Array handed in by a caller is very often a subarray of a larger
  // pool, and `Buffer.from(view.buffer, ...)` silently reads from offset 0 if
  // the byteOffset is dropped.
  const bytes = simpleMovie({ mdatBytes: 4096 });
  const pool = new Uint8Array(bytes.length + 1000);
  pool.set(bytes, 777);
  const view = pool.subarray(777, 777 + bytes.length);
  assertEqual(view.byteOffset, 777, "the view really is offset");
  assertEqual(probeMp4Bytes(view)?.width, 320, "width through an offset view");
});

test("probeMp4Bytes reads zero bytes off disk", () => {
  const bytes = new Uint8Array(readFileSync(SINTEL_TRAILER));
  resetMp4ProbeStats();
  probeMp4Bytes(bytes);
  assertEqual(mp4ProbeStats().bytesRead, 0, "in-memory probe disk bytes");
});

test("a crafted moov of nested padding aborts to null in bounded work", () => {
  // 40 decoy traks of 4000 empty `free` boxes each: every LEVEL stays under
  // the sibling cap while the product runs to ~160k headers, with a perfectly
  // valid video trak waiting behind the padding. The budget is enforced in
  // the walk, not merely measured: past the per-probe ceiling (65536 boxes)
  // the whole probe aborts to null, valid trak and all — a probe that walks
  // adversarial trees to completion has no bound at all, and a scaled-up
  // version of this file costs 16 frame budgets inside the render pass.
  const pad: Buffer[] = [];
  for (let i = 0; i < 4000; i++) pad.push(box("free"));
  const decoy = box("trak", ...pad);
  const traks: Buffer[] = [];
  for (let i = 0; i < 40; i++) traks.push(decoy);
  traks.push(trak({ handler: "vide", tkhdWidth: 320, tkhdHeight: 180 }));
  const bytes = movie({ traks });

  resetMp4ProbeStats();
  assertEqual(probeMp4Bytes(bytes), null, "crafted tree aborts to null");
  const cost = mp4ProbeStats();
  assert(
    cost.boxes <= 66000,
    `parsed ${cost.boxes} box headers; the per-probe ceiling is 65536`,
  );

  // The same tree from disk: the abort must cap the syscall spend too.
  resetMp4ProbeStats();
  assertEqual(
    probeMp4(write("padded.mp4", bytes)),
    null,
    "crafted tree from disk aborts to null",
  );
  assert(
    mp4ProbeStats().bytesRead <= 2 * 1024 * 1024,
    `read ${mp4ProbeStats().bytesRead} bytes walking a crafted tree`,
  );
});

// ─── Never throws ─────────────────────────────────────────

section("Never throws, always null");

test("missing file", () => {
  assertEqual(probeMp4(join(scratch, "does-not-exist.mp4")), null, "missing");
});

test("a directory", () => {
  const dir = join(scratch, "adirectory.mp4");
  mkdirSync(dir, { recursive: true });
  assertEqual(probeMp4(dir), null, "directory");
});

test("empty file", () => {
  assertEqual(probeMp4(write("empty.mp4", new Uint8Array(0))), null, "empty");
});

test("a PNG renamed to .mp4", () => {
  const path = join(scratch, "actually-a-png.mp4");
  copyFileSync(GRADIENT_PNG, path);
  assertEqual(probeMp4(path), null, "renamed PNG");
});

test("a GIF renamed to .mp4", () => {
  const path = join(scratch, "actually-a-gif.mp4");
  copyFileSync(TESTSRC_GIF, path);
  assertEqual(probeMp4(path), null, "renamed GIF");
});

test("seven bytes", () => {
  assertEqual(probeMp4(write("tiny.mp4", new Uint8Array([1, 2, 3, 4, 5, 6, 7]))), null, "tiny");
});

test("random bytes", () => {
  const junk = new Uint8Array(4096);
  // Deterministic, so a failure is reproducible. Multiplier and modulus from
  // Numerical Recipes' quick-and-dirty LCG.
  let seed = 12345;
  for (let i = 0; i < junk.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    junk[i] = seed & 0xff;
  }
  assertEqual(probeMp4(write("junk.mp4", junk)), null, "random bytes");
  assertEqual(probeMp4Bytes(junk), null, "random bytes, in memory");
});

test("a valid file truncated to its first 1 KB (moov gone)", () => {
  const head = new Uint8Array(readFileSync(SINTEL_TRAILER).subarray(0, 1024));
  assertEqual(probeMp4(write("truncated.mp4", head)), null, "truncated");
});

test("a valid file truncated MID-moov", () => {
  const full = readFileSync(SINTEL_TRAILER);
  // moov starts at 4,332,917; keep its header and 200 bytes of children.
  const cut = new Uint8Array(full.subarray(0, 4332917 + 200));
  assertEqual(probeMp4(write("mid-moov.mp4", cut)), null, "truncated mid-moov");
});

test("empty and undersized Uint8Arrays", () => {
  assertEqual(probeMp4Bytes(new Uint8Array(0)), null, "zero length");
  assertEqual(probeMp4Bytes(new Uint8Array(4)), null, "four bytes");
  assertEqual(probeMp4Bytes(new Uint8Array(64)), null, "all zeroes");
});

test("a box whose declared size is a 4 GB lie", () => {
  const lying = Buffer.concat([
    u32(0xffffffff), fourcc("ftyp"), fourcc("isom"),
  ]);
  assertEqual(probeMp4Bytes(new Uint8Array(lying)), null, "oversize box");
});

test("a 64-bit size larger than Number.MAX_SAFE_INTEGER", () => {
  const lying = Buffer.concat([
    u32(1), fourcc("mdat"), Buffer.from("ffffffffffffffff", "hex"),
    box("moov", mvhd(0, 1000, 1000)),
  ]);
  assertEqual(probeMp4Bytes(new Uint8Array(lying)), null, "u64 overflow");
});

// ─── Box tree edges ───────────────────────────────────────

section("Box tree edges");

test("moov at the TAIL, after a 4 MB mdat", () => {
  // The shape of all three real fixtures, at a size where a prefix read would
  // plausibly have been "good enough" and is not.
  const bytes = simpleMovie({ mdatBytes: 4 * 1024 * 1024 });
  const path = write("tail-moov.mp4", bytes);
  resetMp4ProbeStats();
  const info = probeMp4(path);
  assert(info !== null, "probe returned null");
  assertEqual(info!.width, 320, "width");
  assertEqual(info!.height, 180, "height");
  assert(
    mp4ProbeStats().bytesRead < 64 * 1024,
    `read ${mp4ProbeStats().bytesRead} bytes past a 4 MB mdat`,
  );
});

test("moov FIRST (faststart ordering)", () => {
  const info = probeMp4Bytes(simpleMovie({ moovFirst: true, mdatBytes: 4096 }));
  assertEqual(info?.width, 320, "width");
  assertEqual(info?.height, 180, "height");
});

test("64-bit mdat (size == 1, u64 largesize) is stepped over", () => {
  const info = probeMp4Bytes(simpleMovie({ mdat64: true, mdatBytes: 100_000 }));
  assertEqual(info?.width, 320, "width");
  assertEqual(info?.height, 180, "height");
});

test("64-bit mdat, moov first", () => {
  const info = probeMp4Bytes(
    simpleMovie({ moovFirst: true, mdat64: true, mdatBytes: 100_000 }),
  );
  assertEqual(info?.width, 320, "width");
});

test("size == 0 on the trailing moov means 'to end of file'", () => {
  const info = probeMp4Bytes(simpleMovie({ lastBoxToEnd: true, mdatBytes: 2048 }));
  assertEqual(info?.width, 320, "width");
  assertEqual(info?.height, 180, "height");
});

test("size == 0 on a trailing mdat does not swallow a preceding moov", () => {
  const info = probeMp4Bytes(
    simpleMovie({ moovFirst: true, lastBoxToEnd: true, mdatBytes: 2048 }),
  );
  assertEqual(info?.width, 320, "width");
});

test("version 1 mvhd / tkhd / mdhd", () => {
  const bytes = movie({
    version: 1,
    timescale: 1000,
    duration: 3000,
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 1920,
        tkhdHeight: 1080,
        version: 1,
        timescale: 90000,
        duration: 270000,
        runs: [[75, 3600]],
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 1920, "width");
  assertEqual(info?.height, 1080, "height");
  assertEqual(info?.durationMs, 3000, "durationMs");
  assertEqual(info?.fps, 25, "fps");
});

test("version 0 and version 1 traks in one movie", () => {
  const bytes = movie({
    traks: [
      trak({ handler: "soun", tkhdWidth: 0, tkhdHeight: 0, version: 1 }),
      trak({ handler: "vide", tkhdWidth: 640, tkhdHeight: 360, version: 0 }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 640, "width");
});

test("a moov holding only free/skip padding before the trak", () => {
  const bytes = movie({
    traks: [
      box("free", Buffer.alloc(64)),
      trak({ handler: "vide", tkhdWidth: 800, tkhdHeight: 600 }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 800, "width");
});

// ─── Track selection ──────────────────────────────────────

section("Track selection");

test("audio-only container is null, not an exception", () => {
  const bytes = movie({
    traks: [trak({ handler: "soun", tkhdWidth: 0, tkhdHeight: 0 })],
  });
  assertEqual(probeMp4Bytes(bytes), null, "audio only");
});

test("an audio trak carrying nonzero tkhd dimensions is still skipped", () => {
  // The reason handler type is the gate rather than "has dimensions": nothing
  // stops a muxer writing a display size on a non-visual track.
  const bytes = movie({
    traks: [trak({ handler: "soun", tkhdWidth: 1280, tkhdHeight: 720 })],
  });
  assertEqual(probeMp4Bytes(bytes), null, "audio trak with dimensions");
});

test("audio trak first, video second: the video one wins", () => {
  const bytes = movie({
    traks: [
      trak({ handler: "soun", tkhdWidth: 0, tkhdHeight: 0 }),
      trak({ handler: "vide", tkhdWidth: 854, tkhdHeight: 480 }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 854, "width");
  assertEqual(info?.height, 480, "height");
});

test("subtitle and timecode handlers are skipped", () => {
  for (const handler of ["sbtl", "text", "tmcd", "hint", "meta"]) {
    const bytes = movie({ traks: [trak({ handler, tkhdWidth: 100, tkhdHeight: 100 })] });
    assertEqual(probeMp4Bytes(bytes), null, `handler ${handler}`);
  }
});

test("two video traks: the first is used", () => {
  const bytes = movie({
    traks: [
      trak({ handler: "vide", tkhdWidth: 640, tkhdHeight: 480 }),
      trak({ handler: "vide", tkhdWidth: 1920, tkhdHeight: 1080 }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 640, "first video trak");
});

test("a video trak with no usable dimensions falls through to the next", () => {
  const bytes = movie({
    traks: [
      trak({ handler: "vide", tkhdWidth: 0, tkhdHeight: 0, stsdWidth: 0, stsdHeight: 0 }),
      trak({ handler: "vide", tkhdWidth: 1024, tkhdHeight: 768 }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 1024, "second video trak");
});

test("a trak with no mdia at all is skipped", () => {
  const bare = box("trak", tkhd(0, 640, 480));
  const bytes = movie({
    traks: [bare, trak({ handler: "vide", tkhdWidth: 720, tkhdHeight: 576 })],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 720, "skipped bare trak");
});

// ─── stsd fallback ────────────────────────────────────────

section("stsd fallback");

test("tkhd 0x0 falls back to the visual sample entry", () => {
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 0,
        tkhdHeight: 0,
        stsdWidth: 1280,
        stsdHeight: 720,
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 1280, "width from stsd");
  assertEqual(info?.height, 720, "height from stsd");
});

test("a nonzero tkhd WINS over a disagreeing stsd", () => {
  // tkhd is the display size and stsd is the coded size; an anamorphic track
  // has both and only the first is what the viewer sees.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 1024,
        tkhdHeight: 576,
        stsdWidth: 720,
        stsdHeight: 576,
      }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 1024, "tkhd preferred");
});

test("a non-integer tkhd width rounds rather than truncates", () => {
  const bytes = movie({
    traks: [trak({ handler: "vide", tkhdWidth: 853.5, tkhdHeight: 480 })],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 854, "rounded 16.16 width");
});

test("tkhd 0x0 with no stbl at all is null", () => {
  const bytes = movie({
    traks: [trak({ handler: "vide", tkhdWidth: 0, tkhdHeight: 0, noStbl: true })],
  });
  assertEqual(probeMp4Bytes(bytes), null, "no dimensions anywhere");
});

test("a sub-half-pixel tkhd width falls back to stsd, not to zero", () => {
  // 16.16 raw values 1..32767 decode to 0 < width < 0.5 px: nonzero enough to
  // slip a pre-round guard, zero once rounded — and the caller's row count
  // divides by width, so a probe that ever returns 0 hands it Infinity. A
  // display size that rounds below one pixel must take the same path as 0x0:
  // the coded dimensions.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 0.4,
        tkhdHeight: 240,
        stsdWidth: 320,
        stsdHeight: 240,
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 320, "width from stsd");
  assertEqual(info?.height, 240, "height from stsd");
});

test("a sub-half-pixel tkhd with a useless stsd is null, never width 0", () => {
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 0.4,
        tkhdHeight: 240,
        stsdWidth: 0,
        stsdHeight: 0,
      }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes), null, "no usable dimensions");
});

test("an stsd declaring zero entries yields null, not a neighbour's bytes", () => {
  // entry_count = 0 means there IS no sample entry. The bytes where one would
  // sit are a sibling `free` box whose payload holds 1920x1080 at exactly the
  // offset a VisualSampleEntry keeps its dimensions; a parser that skips the
  // count it just stepped over reports them as real.
  const emptyStsd = box("stsd", u32(0), u32(0));
  const decoy = box("free", Buffer.alloc(24), u16(1920), u16(1080));
  const t = box(
    "trak",
    tkhd(0, 0, 0),
    box(
      "mdia",
      mdhd(0, 600, 600),
      hdlr("vide"),
      box("minf", box("stbl", emptyStsd, decoy)),
    ),
  );
  assertEqual(probeMp4Bytes(movie({ traks: [t] })), null, "decoy inside stbl");
});

test("an empty stsd never reads past its own stbl", () => {
  // Same shape, but the empty stsd is the stbl's ONLY child, so the phantom
  // entry's dimension offset lands beyond stbl.end — in a box that follows
  // the whole trak. The read stays inside the buffer, which is exactly why
  // it needs the box bound: ByteSource.read cannot catch it.
  const emptyStsd = box("stsd", u32(0), u32(0));
  const t = box(
    "trak",
    tkhd(0, 0, 0),
    box("mdia", mdhd(0, 600, 600), hdlr("vide"), box("minf", box("stbl", emptyStsd))),
  );
  const bait = box("free", Buffer.alloc(24), u16(4242), u16(2424));
  assertEqual(probeMp4Bytes(movie({ traks: [t, bait] })), null, "bait beyond stbl");
});

// ─── Rotation ─────────────────────────────────────────────

section("Rotation (synthetic matrices)");

for (const [degrees, expectW, expectH] of [
  [0, 1920, 1080],
  [90, 1080, 1920],
  [180, 1920, 1080],
  [270, 1080, 1920],
] as const) {
  test(`${degrees} degree matrix -> ${expectW}x${expectH}`, () => {
    const bytes = movie({
      traks: [
        trak({ handler: "vide", tkhdWidth: 1920, tkhdHeight: 1080, rotation: degrees }),
      ],
    });
    const info = probeMp4Bytes(bytes);
    assertEqual(info?.width, expectW, `${degrees} width`);
    assertEqual(info?.height, expectH, `${degrees} height`);
  });
}

test("a rotated track falling back to stsd is swapped too", () => {
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 0,
        tkhdHeight: 0,
        stsdWidth: 1920,
        stsdHeight: 1080,
        rotation: 90,
      }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.width, 1080, "swapped stsd width");
});

test("a pure 2x scale is not mistaken for a rotation", () => {
  // The swap tests the matrix SHAPE, so this is the case that would break a
  // naive "a is not 1" check.
  const scaled = box(
    "trak",
    box(
      "tkhd",
      u8(0, 0, 0, 3),
      Buffer.concat([u32(0), u32(0), u32(1), u32(0), u32(0)]),
      Buffer.alloc(8),
      u16(0), u16(0), u16(0), u16(0),
      matrix(2, 0, 0, 2),
      fixed16(640),
      fixed16(360),
    ),
    box(
      "mdia",
      mdhd(0, 600, 600),
      hdlr("vide"),
      box("minf", box("stbl", stsd(640, 360), stts([[24, 25]]))),
    ),
  );
  const info = probeMp4Bytes(movie({ traks: [scaled] }));
  assertEqual(info?.width, 640, "scaled width");
  assertEqual(info?.height, 360, "scaled height");
});

// ─── Duration and fps ─────────────────────────────────────

section("Duration and frame rate");

test("constant rate: one stts run", () => {
  // 60 NTSC frames are 60 x 1001 = 60060 ticks at timescale 30000 — 2.002 s,
  // and the mdhd of a real NTSC file says the same 60060.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 640,
        tkhdHeight: 480,
        timescale: 30000,
        duration: 60060,
        runs: [[60, 1001]],
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.fps, 29.97, "NTSC 30000/1001");
  assertEqual(info?.durationMs, 2002, "durationMs");
});

test("an mdhd padded one frame past the stts sum: the sum wins", () => {
  // The shape ffmpeg writes when transcoding from GIF: stts says 8 samples x
  // 2048 ticks = 16384 = exactly 1000 ms at timescale 16384, while mdhd says
  // 18432 — one frame interval long, which is 12.5% at 8 fps and scales as
  // 1/fps. The sum is derived from the samples themselves and agrees with
  // ffprobe, the mvhd and the elst; an mdhd-first probe reports a duration
  // whose durationMs x fps counts a ninth frame that does not exist.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 48,
        tkhdHeight: 32,
        timescale: 16384,
        duration: 18432,
        runs: [[8, 2048]],
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.durationMs, 1000, "stts sum, not the padded mdhd");
  assertEqual(info?.fps, 8, "fps");
});

test("an implausible stts rate is dropped, not reported", () => {
  // An all-but-ones timescale against a one-tick table computes 4.29 billion
  // fps, and a caller scheduling frames on 1000/fps ms gets a zero-length
  // interval. A wrong rate gets the absent-stts treatment: fps undefined.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 320,
        tkhdHeight: 240,
        timescale: 0xfffffffe,
        duration: 1,
        runs: [[1, 1]],
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 320, "width survives");
  assertEqual(info?.fps, undefined, "fps absent");
});

test("variable rate: many stts runs average correctly", () => {
  // 30 frames at 1/60 s plus 30 at 1/20 s = 60 frames in 2 s = 30 fps.
  const bytes = movie({
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 640,
        tkhdHeight: 480,
        timescale: 600,
        duration: 1200,
        runs: [
          [30, 10],
          [30, 30],
        ],
      }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.fps, 30, "averaged fps");
});

test("an stts declaring more entries than the box holds is not trusted", () => {
  const lying = box("stts", u32(0), u32(9999), u32(24), u32(25));
  const t = box(
    "trak",
    tkhd(0, 640, 480),
    box(
      "mdia",
      mdhd(0, 600, 600),
      hdlr("vide"),
      box("minf", box("stbl", stsd(640, 480), lying)),
    ),
  );
  const info = probeMp4Bytes(movie({ traks: [t] }));
  assertEqual(info?.width, 640, "width survives");
  assertEqual(info?.fps, 24, "fps from the one real entry");
});

test("no stts: dimensions still come back, fps is absent", () => {
  const t = box(
    "trak",
    tkhd(0, 640, 480),
    box("mdia", mdhd(0, 600, 600), hdlr("vide"), box("minf", box("stbl", stsd(640, 480)))),
  );
  const info = probeMp4Bytes(movie({ traks: [t] }));
  assertEqual(info?.width, 640, "width");
  assertEqual(info?.fps, undefined, "fps absent");
});

test("mdhd duration of 0xFFFFFFFF (unknown) falls back to mvhd", () => {
  // noStbl: with sample tables present the stts sum would legitimately answer
  // first, so the mvhd fallback is for a track with NOTHING better to say.
  const bytes = movie({
    timescale: 1000,
    duration: 7000,
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 640,
        tkhdHeight: 480,
        timescale: 600,
        duration: 0xffffffff,
        noStbl: true,
      }),
    ],
  });
  assertEqual(probeMp4Bytes(bytes)?.durationMs, 7000, "mvhd fallback");
});

test("no duration anywhere: durationMs is absent, dimensions are not", () => {
  // noStbl, because an stts IS a duration — its tick total — so "no duration
  // anywhere" requires a track without sample tables, not just an mdhd of 0.
  const bytes = movie({
    timescale: 1000,
    duration: 0,
    traks: [
      trak({
        handler: "vide",
        tkhdWidth: 640,
        tkhdHeight: 480,
        timescale: 600,
        duration: 0,
        noStbl: true,
      }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 640, "width");
  assertEqual(info?.durationMs, undefined, "durationMs absent");
});

test("a zero timescale does not divide by zero", () => {
  const bytes = movie({
    traks: [
      trak({ handler: "vide", tkhdWidth: 640, tkhdHeight: 480, timescale: 0, duration: 600 }),
    ],
  });
  const info = probeMp4Bytes(bytes);
  assertEqual(info?.width, 640, "width");
  assert(
    info?.durationMs === undefined || Number.isFinite(info.durationMs),
    "durationMs is finite or absent",
  );
});

// ─── ffmpeg-written rotation ──────────────────────────────

section("Rotation (ffmpeg -display_rotation)");

/** Remux the 64x48 fixture with a display rotation baked into its tkhd matrix. */
function rotatedFixture(ffmpeg: string, degrees: number): string {
  const out = join(scratch, `rot${degrees}.mp4`);
  execFileSync(
    ffmpeg,
    ["-y", "-v", "error", "-display_rotation", String(degrees), "-i", TESTSRC_MP4, "-c", "copy", out],
    { stdio: "ignore" },
  );
  return out;
}

for (const [degrees, expectW, expectH] of [
  [90, 48, 64],
  [180, 64, 48],
  [270, 48, 64],
] as const) {
  testNeeding(FFMPEG, `ffmpeg -display_rotation ${degrees} -> ${expectW}x${expectH} displayed`, (ffmpeg) => {
    const info = probeMp4(rotatedFixture(ffmpeg, degrees));
    assert(info !== null, "probe returned null");
    // ffprobe reports the CODED size here (still 64x48) plus a rotation side
    // datum; the probe reports what a viewer sees, which is the swap applied.
    assertEqual(info!.width, expectW, `rot${degrees} width`);
    assertEqual(info!.height, expectH, `rot${degrees} height`);
    assertEqual(info!.fps, 10, `rot${degrees} fps survives the remux`);
  });
}

testNeeding(FFMPEG, "a GIF transcode's duration is the stts sum, not the padded mdhd", (ffmpeg) => {
  // ffmpeg transcoding the 8-frame, 1-second GIF fixture writes an mdhd one
  // frame interval long (18432 ticks for a 16384-tick clip at timescale
  // 16384); ffprobe, the mvhd, the elst and the stts sum all say 1000 ms. An
  // mdhd-first probe reports 1125 — the synthetic twin of this case lives in
  // the duration section, this one proves a real muxer writes the shape.
  const out = join(scratch, "gif-transcode.mp4");
  execFileSync(
    ffmpeg,
    ["-y", "-v", "error", "-i", TESTSRC_GIF, "-c:v", "libx264", "-pix_fmt", "yuv420p", out],
    { stdio: "ignore" },
  );
  const info = probeMp4(out);
  assert(info !== null, "probe returned null");
  assertEqual(info!.width, 48, "width");
  assertEqual(info!.height, 32, "height");
  assertEqual(info!.durationMs, 1000, "durationMs: 8 frames at 8 fps");
  assertEqual(info!.fps, 8, "fps");
});

testNeeding(FFMPEG, "ffmpeg-stripped video track (audio only) is null", (ffmpeg) => {
  const out = join(scratch, "audio-only.m4a");
  execFileSync(
    ffmpeg,
    ["-y", "-v", "error", "-i", SINTEL_TRAILER, "-vn", "-c:a", "copy", out],
    { stdio: "ignore" },
  );
  assertEqual(probeMp4(out), null, "audio-only remux");
});

// ─── Idempotence ──────────────────────────────────────────

section("Idempotence");

test("100 probes of the same file give the same answer and leak no fds", () => {
  const first = JSON.stringify(probeMp4(SINTEL_TRAILER));
  for (let i = 0; i < 100; i++) {
    assertEqual(JSON.stringify(probeMp4(SINTEL_TRAILER)), first, `probe ${i}`);
  }
  // If probeMp4 leaked a descriptor per call the default 256-fd limit would
  // already have been hit; opening one more proves it did not.
  const fd = openSync(SINTEL_TRAILER, "r");
  closeSync(fd);
});

test("100 probes of a missing file leak no fds either", () => {
  for (let i = 0; i < 100; i++) probeMp4(join(scratch, "nope.mp4"));
  const fd = openSync(SINTEL_TRAILER, "r");
  closeSync(fd);
});

// ─── Summary ──────────────────────────────────────────────

rmSync(scratch, { recursive: true, force: true });

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
for (const note of notes) console.log(`  \x1b[2m${note}\x1b[0m`);
if (skipped > 0) {
  console.log(`  \x1b[33m${skipped} skipped\x1b[0m \x1b[2m(ffmpeg/ffprobe not installed)\x1b[0m`);
}
console.log(
  `  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`,
);
console.log("");

if (failed > 0) process.exit(1);
