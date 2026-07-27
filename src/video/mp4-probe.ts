/**
 * Synchronous MP4/MOV dimension probe over positioned reads.
 *
 * WHY THIS FILE EXISTS: a video block has to fix its ROW COUNT before the first
 * pixel is decoded. Rows are reserved by the layout pass, and every focus rect
 * below a block moves when that block's height changes — the arrow keys are
 * routed off those rects, so a video whose height arrives one frame late does
 * not merely reflow, it misroutes input. The row count comes from the aspect
 * ratio, so width and height must be known synchronously, inside the same
 * render pass that reserves the rows.
 *
 * That rules out both obvious answers. `ffprobe` is a subprocess: a fork per
 * block plus an async boundary the synchronous renderer has nowhere to await.
 * `readFileSync` is worse than it looks — the 4.4 MB trailer fixture keeps its
 * `moov`, the only box carrying dimensions, at byte 4,332,917, AFTER a 4.3 MB
 * `mdat`. A prefix read finds nothing there, so "read the first N bytes"
 * degrades to "read the whole file" for exactly the files where that hurts.
 *
 * So this walks the ISO-BMFF box tree with positioned reads and steps over
 * `mdat` by its DECLARED SIZE rather than reading it. Measured on that same
 * trailer, M4 Max, warm cache: 16 us and 8,192 bytes in two `readSync` calls,
 * against 370 us and 4,372,373 bytes for `readFileSync` and 18.2 ms for one
 * `ffprobe` fork. Three orders of magnitude, and none of it grows with the
 * video's length — a two-hour film costs the same as a five-second clip.
 *
 * Never throws. A missing file, a directory, an empty file, a PNG renamed to
 * .mp4 — all of them are `null`, because the caller's fallback is identical for
 * every one of them and an exception thrown inside the render pass is not a
 * fallback.
 */

import { closeSync, openSync, readSync, statSync } from "node:fs";

// ─── Public shape ─────────────────────────────────────────

/**
 * What the container alone can say about a video track.
 *
 * `width`/`height` are DISPLAY dimensions. A `tkhd` matrix encoding a 90 or 270
 * degree rotation has already been applied by swapping them, because geometry
 * derives its row count from the aspect the viewer sees, not the aspect the
 * encoder stored — a portrait phone clip whose samples are landscape would
 * otherwise reserve rows for a shape that never appears on screen.
 *
 * `durationMs` and `fps` are optional because a fragmented or live-streamed MP4
 * legitimately declares neither in `moov`, and neither is needed to lay out a
 * frame.
 */
export interface Mp4Info {
  width: number;
  height: number;
  durationMs?: number;
  fps?: number;
}

// ─── Tunables ─────────────────────────────────────────────

/**
 * Bytes per positioned read.
 *
 * Box headers are 8 or 16 bytes and they arrive in RUNS — everything this
 * probe needs from a `moov` lives in the first kilobyte or so of it — so a
 * syscall per header would be dozens of reads to move a few hundred bytes. One
 * page-sized window amortises a whole run of siblings into a single `readSync`,
 * and the walk only jumps far enough to miss the window when it steps over an
 * `mdat`. Measured on the 4.4 MB trailer (two traks, 39 KB of `moov`): 4096
 * costs 2 reads / 8192 bytes, 1024 costs 2 reads / 2048, 512 costs 3 reads /
 * 1536. The bytes are noise at any of those sizes, so this is sized for the
 * files that are NOT the fixtures — a fat `elst` or a codec-configuration-heavy
 * `stsd` pushes the fields apart, and a page of slack absorbs that without a
 * second syscall.
 */
const CHUNK_BYTES = 4096;

/**
 * Cap on siblings scanned at one nesting level.
 *
 * Every box advances the cursor by at least its 8-byte header, so the walk
 * terminates on garbage regardless — but on a multi-gigabyte file "terminates"
 * could mean 500 million iterations of a loop that will find nothing. A real
 * `moov` has tens of children per level; four thousand is slack, not a budget.
 */
const MAX_SIBLINGS = 4096;

/**
 * Cap on `stts` run-length entries summed for the frame rate.
 *
 * Constant-rate video has exactly one entry. Variable-rate video out of a phone
 * has a few hundred. 4096 entries is 32 KB of table, past which the running
 * average is already far more precise than a row count can use.
 */
const MAX_STTS_ENTRIES = 4096;

/**
 * Per-probe ceilings on box headers parsed and bytes pulled off disk.
 *
 * `MAX_SIBLINGS` bounds one LEVEL, but levels multiply: a crafted `moov`
 * holding hundreds of traks, each stuffed with thousands of padding boxes,
 * keeps every level under its sibling cap while the product runs to millions
 * of headers and tens of megabytes of window reads — measured at 273 ms on an
 * M4 Max, sixteen frame budgets spent inside the render pass this probe exists
 * to protect. A real probe is three orders of magnitude smaller on both axes
 * (the 4.4 MB trailer: 23 boxes, 8,192 bytes), so these ceilings are slack for
 * any file a muxer wrote and a hard stop for one built to be walked. Blowing
 * either aborts the whole probe to null rather than returning whatever was
 * parsed before the stop: a file shaped like that has forfeited trust in the
 * parts of it that looked normal.
 */
const MAX_BOXES_PER_PROBE = 65536;
const MAX_BYTES_PER_PROBE = 1 << 20;

/**
 * Plausibility bounds on the frame rate computed from `stts`.
 *
 * A corrupt table produces rates like 4.29 billion fps (a one-sample run under
 * an all-ones timescale), and a caller scheduling frames on `1000 / fps` ms
 * turns that into a zero-length interval. 1000 clears 960 fps — the fastest
 * consumer slow-motion rate — with margin; 0.001 is one frame per ~17 minutes,
 * slower than any timelapse a player would schedule. Outside the range the
 * rate is treated exactly like an absent `stts`, per the rule in `parseStts`:
 * an absent frame rate is a documented outcome, a wrong one silently desyncs
 * playback.
 */
const MIN_PLAUSIBLE_FPS = 0.001;
const MAX_PLAUSIBLE_FPS = 1000;

/**
 * 16.16 fixed-point one. `tkhd` stores the matrix entries a, b, c, d in 16.16
 * and u, v, w in 2.30; only the first four decide whether the axes swap, so the
 * 2.30 entries are never read.
 */
const FIXED_16_16_ONE = 65536;

/**
 * Tolerance for "this matrix entry is zero", in 16.16 units.
 *
 * ffmpeg writes exact zeros, but a transcoder that round-trips the matrix
 * through floating point leaves a few units of dust. 1/256 of one unit is three
 * orders of magnitude below any scale factor a real matrix carries, so it
 * separates "rotated" from "not" without ever misreading a genuine scale.
 */
const MATRIX_EPSILON = FIXED_16_16_ONE / 256;

/**
 * `duration` in `mvhd`/`mdhd` when the writer does not know it. Version 0 uses
 * the 32-bit all-ones; treating it as a real number would report a 49-day clip.
 */
const DURATION_UNKNOWN_32 = 0xffffffff;

/**
 * Top-level box types that mean "this is plausibly ISO-BMFF".
 *
 * The gate is here rather than on a magic-byte prefix because MP4 has no magic
 * number — `ftyp` is merely conventional, and QuickTime files written before it
 * existed open with `moov`, `wide` or a bare `mdat`. Checking that the FIRST
 * box has a known top-level type is the closest equivalent, and it is what
 * rejects a renamed PNG: those eight bytes parse as a 2.3 GB box of type
 * "\r\n\x1a\n", which is in no allowlist.
 */
const TOP_LEVEL_TYPES = new Set([
  "ftyp", "styp", "moov", "moof", "mdat", "free", "skip", "wide", "junk",
  "pnot", "meta", "mfra", "sidx", "ssix", "prft", "emsg", "uuid", "pict",
]);

// ─── Observability ────────────────────────────────────────

/**
 * Cumulative read accounting.
 *
 * Exists so the test suite can assert the byte budget rather than trust it: the
 * whole justification for this file over `readFileSync` is the number in
 * `bytesRead`, and an unasserted performance claim rots. Cumulative across
 * probes, reset explicitly — the same shape as `imageCacheStats()`.
 */
export interface Mp4ProbeStats {
  /** Bytes pulled off DISK. `probeMp4Bytes` reads none: its slices are views. */
  bytesRead: number;
  /** `readSync` calls issued. */
  reads: number;
  /** Box headers parsed, across every source. */
  boxes: number;
}

const stats: Mp4ProbeStats = { bytesRead: 0, reads: 0, boxes: 0 };

/**
 * The CURRENT probe's spend against the per-probe ceilings. Module-level
 * rather than threaded through every parser because a probe is synchronous
 * and single-threaded end to end — `probeSource` is the only entry point and
 * it resets both before walking. Distinct from `stats`, which is cumulative
 * across probes and belongs to the test suite, not to enforcement.
 */
let probeBoxes = 0;
let probeBytes = 0;

function budgetBlown(): boolean {
  return probeBoxes > MAX_BOXES_PER_PROBE || probeBytes > MAX_BYTES_PER_PROBE;
}

/** Snapshot of the read accounting since the last reset. */
export function mp4ProbeStats(): Mp4ProbeStats {
  return { ...stats };
}

/** Zero the read accounting. */
export function resetMp4ProbeStats(): void {
  stats.bytesRead = 0;
  stats.reads = 0;
  stats.boxes = 0;
}

// ─── Byte sources ─────────────────────────────────────────

/**
 * A random-access window onto some bytes.
 *
 * The walk is identical for a file and for a buffer, so both parsers are one
 * parser behind this interface. `read` returns null rather than throwing or
 * returning a short buffer: a short read at the end of a truncated file is the
 * common case, and every caller's response to it is "give up on this box".
 */
interface ByteSource {
  readonly size: number;
  /**
   * Exactly `len` bytes at `offset`, or null if they are not all available.
   *
   * The result is a VIEW and the next `read` may overwrite it — `FileSource`
   * hands back a slice of one reused window. Every caller must pull the fields
   * it wants out of a buffer before issuing another read; `nextBox` decoding
   * the type and 32-bit size before it fetches a 64-bit `largesize` is the one
   * place that ordering is load-bearing rather than incidental.
   */
  read(offset: number, len: number): Buffer | null;
}

/**
 * A file read through one reusable page-sized window.
 *
 * The window is what makes the sibling walk cheap: `nextBox` reads 8 bytes,
 * then the box body read lands 8 bytes later, then the next sibling's header
 * lands after that — all inside one `readSync` until the walk steps over an
 * `mdat` and jumps megabytes. Requests larger than the window bypass it, so a
 * pathological box body can never silently truncate.
 */
class FileSource implements ByteSource {
  private readonly window = Buffer.allocUnsafe(CHUNK_BYTES);
  private windowStart = -1;
  private windowLen = 0;

  constructor(
    private readonly fd: number,
    readonly size: number,
  ) {}

  read(offset: number, len: number): Buffer | null {
    if (offset < 0 || len <= 0 || offset + len > this.size) return null;
    // A blown budget already dooms the probe to null in `probeSource`, so
    // refusing every further read — cached window hits included — just makes
    // the walk unwind to that null without spending another syscall.
    if (budgetBlown()) return null;

    if (
      this.windowStart >= 0 &&
      offset >= this.windowStart &&
      offset + len <= this.windowStart + this.windowLen
    ) {
      const from = offset - this.windowStart;
      return this.window.subarray(from, from + len);
    }

    if (len > CHUNK_BYTES) {
      const direct = Buffer.allocUnsafe(len);
      return this.fill(direct, offset, len) === len ? direct : null;
    }

    const want = Math.min(CHUNK_BYTES, this.size - offset);
    const got = this.fill(this.window, offset, want);
    this.windowStart = offset;
    this.windowLen = got;
    return got >= len ? this.window.subarray(0, len) : null;
  }

  /**
   * Loop until `want` bytes land or the file ends. `readSync` is allowed to
   * return short even away from EOF, and a single call that happened to stop at
   * a page boundary would look exactly like a truncated file.
   */
  private fill(into: Buffer, offset: number, want: number): number {
    let got = 0;
    while (got < want) {
      const n = readSync(this.fd, into, got, want - got, offset + got);
      stats.reads++;
      if (n <= 0) break;
      stats.bytesRead += n;
      probeBytes += n;
      got += n;
    }
    return got;
  }
}

/** Bytes already in memory. Every slice is a view, so nothing is copied. */
class BufferSource implements ByteSource {
  private readonly buf: Buffer;
  readonly size: number;

  constructor(bytes: Uint8Array) {
    this.buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.size = bytes.byteLength;
  }

  read(offset: number, len: number): Buffer | null {
    if (offset < 0 || len <= 0 || offset + len > this.size) return null;
    return this.buf.subarray(offset, offset + len);
  }
}

// ─── Box walking ──────────────────────────────────────────

interface Box {
  /** Four-character type code. */
  type: string;
  /** First byte after the header — where the payload starts. */
  body: number;
  /** One past the last byte of the box. */
  end: number;
}

/**
 * True for a byte that may appear in a four-character code. 0xA9 is the
 * copyright sign QuickTime puts in front of its metadata atoms ("©nam"), and it
 * appears at top level inside `udta` on files ffmpeg writes.
 */
function isTypeByte(b: number): boolean {
  return (b >= 0x20 && b <= 0x7e) || b === 0xa9;
}

/**
 * Parse the box header at `offset`, bounded by `limit`.
 *
 * Returns null at or past the limit and for any header that cannot be trusted.
 * The one invariant every caller depends on: a non-null result always has
 * `end > offset`, so a sibling loop cannot spin.
 */
function nextBox(src: ByteSource, offset: number, limit: number): Box | null {
  if (offset < 0 || offset + 8 > limit) return null;
  const head = src.read(offset, 8);
  if (head === null) return null;

  for (let i = 4; i < 8; i++) {
    if (!isTypeByte(head[i])) return null;
  }
  const type = String.fromCharCode(head[4], head[5], head[6], head[7]);

  let size = head.readUInt32BE(0);
  let body = offset + 8;

  if (size === 1) {
    // 64-bit: the real size is a u64 immediately after the type.
    const large = src.read(offset + 8, 8);
    if (large === null) return null;
    const big = large.readBigUInt64BE(0);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(big);
    body = offset + 16;
    if (size < 16) return null;
  } else if (size === 0) {
    // "Extends to the end of the enclosing container." Only ever legal for the
    // last box, and taking the container's end is the only reading that keeps
    // the walk terminating.
    size = limit - offset;
  } else if (size < 8) {
    return null;
  }

  stats.boxes++;
  probeBoxes++;
  // Charged AFTER the header validated so garbage does not inflate the count,
  // checked before returning so the millionth box of a crafted tree is the
  // one that never comes back. Returning null here reads to every caller as
  // "no more boxes", which unwinds the whole walk without a special path.
  if (budgetBlown()) return null;
  // A declared size that overruns the container is malformed. Clamping rather
  // than rejecting lets a truncated-but-otherwise-valid file still yield the
  // boxes it does have; the next `nextBox` hits the limit and stops cleanly.
  const end = Math.min(offset + size, limit);
  if (end <= offset || body > end) return null;
  return { type, body, end };
}

/** First child of the given type in `[start, limit)`, or null. */
function findBox(src: ByteSource, start: number, limit: number, type: string): Box | null {
  let offset = start;
  for (let i = 0; i < MAX_SIBLINGS; i++) {
    const box = nextBox(src, offset, limit);
    if (box === null) return null;
    if (box.type === type) return box;
    offset = box.end;
  }
  return null;
}

/** Walk a chain of nested single boxes, e.g. mdia > minf > stbl. */
function descend(src: ByteSource, parent: Box, path: readonly string[]): Box | null {
  let box: Box | null = parent;
  for (const type of path) {
    if (box === null) return null;
    box = findBox(src, box.body, box.end, type);
  }
  return box;
}

// ─── Header records ───────────────────────────────────────

/**
 * `mvhd` and `mdhd` share their first fields, and the only difference between
 * versions is the width of creation/modification/duration. Version 0 packs them
 * as u32, version 1 as u64 with the timescale still u32 between them.
 */
interface TimedHeader {
  timescale: number;
  /** In `timescale` units. Zero when the writer declared it unknown. */
  duration: number;
}

function parseTimedHeader(src: ByteSource, box: Box | null): TimedHeader | null {
  if (box === null) return null;
  const version = src.read(box.body, 1);
  if (version === null) return null;

  if (version[0] === 1) {
    const b = src.read(box.body + 20, 12);
    if (b === null) return null;
    const timescale = b.readUInt32BE(0);
    const duration = b.readBigUInt64BE(4);
    if (timescale === 0) return null;
    // The 64-bit "unknown" sentinel is all-ones; anything past 2^53 is also
    // unusable as a JS number, and both mean the same thing to the caller.
    const usable = duration <= BigInt(Number.MAX_SAFE_INTEGER);
    return { timescale, duration: usable ? Number(duration) : 0 };
  }

  const b = src.read(box.body + 12, 8);
  if (b === null) return null;
  const timescale = b.readUInt32BE(0);
  const duration = b.readUInt32BE(4);
  if (timescale === 0) return null;
  return { timescale, duration: duration === DURATION_UNKNOWN_32 ? 0 : duration };
}

interface TkhdInfo {
  /** 16.16 fixed point resolved to a real number. Zero is legal and means
   *  "look in the sample entry". */
  width: number;
  height: number;
  /** True when the matrix maps x onto y, i.e. a 90 or 270 degree rotation. */
  swapped: boolean;
}

function parseTkhd(src: ByteSource, box: Box | null): TkhdInfo | null {
  if (box === null) return null;
  const version = src.read(box.body, 1);
  if (version === null) return null;

  // Body layout is fixed by the spec, so the matrix offset follows from the
  // version alone: v0 packs three u32 times, v1 packs two u64 times and a u64
  // duration, a 12-byte difference. Deriving it from the version rather than
  // measuring back from the box end means a writer that appends a private
  // extension is parsed correctly instead of silently off by its length.
  const matrixAt = box.body + (version[0] === 1 ? 52 : 40);
  const b = src.read(matrixAt, 44);
  if (b === null) return null;

  // Matrix is {a, b, u; c, d, v; x, y, w} in row order.
  const a = b.readInt32BE(0);
  const bb = b.readInt32BE(4);
  const c = b.readInt32BE(12);
  const d = b.readInt32BE(16);

  // A rotation of 90 or 270 degrees zeroes the diagonal and fills the
  // anti-diagonal; 0 and 180 do the reverse. Testing the SHAPE rather than
  // matching the four canonical matrices also catches a rotation combined with
  // a flip or a scale, which is what a phone that mirrors its front camera
  // writes.
  const swapped =
    Math.abs(a) < MATRIX_EPSILON &&
    Math.abs(d) < MATRIX_EPSILON &&
    (Math.abs(bb) > MATRIX_EPSILON || Math.abs(c) > MATRIX_EPSILON);

  return {
    width: b.readUInt32BE(36) / FIXED_16_16_ONE,
    height: b.readUInt32BE(40) / FIXED_16_16_ONE,
    swapped,
  };
}

/**
 * Dimensions from the first entry of `stsd`.
 *
 * The fallback for a `tkhd` of 0x0, which is what a track written without a
 * display size looks like. These are the CODED dimensions — no matrix, no
 * aspect correction — so they are second choice, not first.
 */
function parseStsdDimensions(src: ByteSource, stbl: Box): { width: number; height: number } | null {
  const stsd = findBox(src, stbl.body, stbl.end, "stsd");
  if (stsd === null) return null;
  // version/flags (4) + entry_count (4), then the first SampleEntry. The
  // count is READ, not skipped: an stsd declaring zero entries has no sample
  // entry, and the bytes where one would sit belong to whatever box follows —
  // parsing them anyway reports dimensions out of a neighbour's payload.
  const head = src.read(stsd.body, 8);
  if (head === null || head.readUInt32BE(4) === 0) return null;
  const entry = stsd.body + 8;
  // SampleEntry is size(4) type(4) reserved(6) data_reference_index(2) = 16;
  // VisualSampleEntry then adds pre_defined(2) reserved(2) pre_defined[3](12)
  // before the two u16 dimensions. Bounded by the stsd box, not the buffer:
  // `ByteSource.read` only rejects reads past the FILE, and past `stsd.end`
  // the bytes are a sibling's, not a sample entry's.
  if (entry + 36 > stsd.end) return null;
  const b = src.read(entry + 32, 4);
  if (b === null) return null;
  return { width: b.readUInt16BE(0), height: b.readUInt16BE(2) };
}

interface SttsSummary {
  /** Absent when the table is missing, empty, unreadable, or implausible. */
  fps?: number;
  /** Total media ticks across the WHOLE table. Absent whenever any entry went
   *  unsummed — capped, truncated, or unreadable — because a partial sum
   *  understates the duration rather than approximating it. */
  durationTicks?: number;
}

/**
 * Frame rate and total duration from the time-to-sample table.
 *
 * `stts` is a run-length list of (sample_count, sample_delta) in media
 * timescale units, so summing both columns gives frames and their exact total
 * duration — which is the true average rate even for variable-rate video, and
 * is exact for the constant-rate case rather than a ratio of two rounded
 * seconds. The tick total is also the most trustworthy duration the container
 * has: it IS the samples' own lengths, where `mdhd`'s duration is a separate
 * field the muxer fills in — and ffmpeg fills it one frame interval long when
 * transcoding from GIF, an error worth 12.5% at 8 fps. Falls back to nothing
 * rather than guessing: an absent frame rate is a documented outcome, a wrong
 * one silently desyncs playback — which is also why a rate outside the
 * plausible band is dropped as if the table were absent.
 */
function parseStts(src: ByteSource, stbl: Box, timescale: number): SttsSummary {
  const stts = findBox(src, stbl.body, stbl.end, "stts");
  if (stts === null || timescale === 0) return {};

  const head = src.read(stts.body, 8);
  if (head === null) return {};
  const declared = head.readUInt32BE(4);
  const available = Math.floor((stts.end - stts.body - 8) / 8);
  const count = Math.min(declared, available, MAX_STTS_ENTRIES);

  let samples = 0;
  let ticks = 0;
  let summed = 0;
  for (; summed < count; summed++) {
    const e = src.read(stts.body + 8 + summed * 8, 8);
    if (e === null) break;
    const n = e.readUInt32BE(0);
    const delta = e.readUInt32BE(4);
    samples += n;
    ticks += n * delta;
  }
  if (samples === 0 || ticks === 0) return {};

  const summary: SttsSummary = {};
  const rate = (samples * timescale) / ticks;
  if (rate >= MIN_PLAUSIBLE_FPS && rate <= MAX_PLAUSIBLE_FPS) {
    // Three decimals: enough to keep 23.976 distinct from 24, and coarse
    // enough to erase the float dust that division leaves on an exact 24/1.
    summary.fps = Math.round(rate * 1000) / 1000;
  }
  if (summed === declared) summary.durationTicks = ticks;
  return summary;
}

// ─── Track selection ──────────────────────────────────────

interface VideoTrack {
  width: number;
  height: number;
  /** From the summed `stts`, then the track's `mdhd`. Zero when neither is
   *  usable. */
  durationMs: number;
  fps?: number;
}

/**
 * Dimensions and rate for one `trak`, or null if it is not a usable video
 * track.
 *
 * The handler type in `hdlr` is the gate, not the presence of a `tkhd` with
 * nonzero dimensions: an audio track carries a `tkhd` too, and a chapter or
 * timecode track can carry a plausible-looking one. `"vide"` is the only
 * handler whose samples are pixels.
 */
function parseVideoTrak(src: ByteSource, trak: Box): VideoTrack | null {
  const mdia = findBox(src, trak.body, trak.end, "mdia");
  if (mdia === null) return null;

  const hdlr = findBox(src, mdia.body, mdia.end, "hdlr");
  if (hdlr === null) return null;
  // version/flags (4) + pre_defined (4), then the handler four-character code.
  const handler = src.read(hdlr.body + 8, 4);
  if (handler === null || handler.toString("latin1") !== "vide") return null;

  const tkhd = parseTkhd(src, findBox(src, trak.body, trak.end, "tkhd"));
  const stbl = descend(src, mdia, ["minf", "stbl"]);

  // Rounded BEFORE the usability check, never after: `tkhd` is 16.16 fixed
  // point, so a corrupt raw value in [1, 0x7fff] decodes to a width strictly
  // between zero and half a pixel — nonzero enough to pass a pre-round guard,
  // zero once rounded. The caller divides by width, so a 0 must be
  // unrepresentable here, and a sub-half-pixel display size must take the
  // stsd fallback exactly like the 0x0 it effectively is. Rounded, not
  // floored: a track carrying a non-integer display width (an anamorphic
  // source corrected by the matrix) must not lose a column to truncation.
  let width = tkhd === null ? 0 : Math.round(tkhd.width);
  let height = tkhd === null ? 0 : Math.round(tkhd.height);
  if ((width < 1 || height < 1) && stbl !== null) {
    // The stsd dimensions are u16s, already integral.
    const coded = parseStsdDimensions(src, stbl);
    if (coded !== null) {
      width = coded.width;
      height = coded.height;
    }
  }
  if (width < 1 || height < 1) return null;

  if (tkhd !== null && tkhd.swapped) {
    const t = width;
    width = height;
    height = t;
  }

  const media = parseTimedHeader(src, findBox(src, mdia.body, mdia.end, "mdhd"));
  const timing =
    stbl === null || media === null ? null : parseStts(src, stbl, media.timescale);
  const fps = timing === null ? undefined : timing.fps;

  // The summed `stts` first, `mdhd` second. Both claim to be the media's
  // length, but only the sum is DERIVED from the samples; `mdhd` is a field
  // the muxer fills in separately, and ffmpeg writes it one frame interval
  // past the sum when transcoding from GIF — an error that scales as 1/fps
  // and contradicts the probe's own fps (durationMs * fps would count one
  // frame that does not exist). The sum is only trusted when the whole table
  // was summed; a capped or truncated table understates, and `mdhd` is the
  // better guess then.
  let durationMs = 0;
  if (media !== null) {
    if (timing !== null && timing.durationTicks !== undefined) {
      durationMs = Math.round((timing.durationTicks * 1000) / media.timescale);
    } else if (media.duration > 0) {
      durationMs = Math.round((media.duration * 1000) / media.timescale);
    }
  }

  return fps === undefined
    ? { width, height, durationMs }
    : { width, height, durationMs, fps };
}

// ─── Probe ────────────────────────────────────────────────

function probeSource(src: ByteSource): Mp4Info | null {
  probeBoxes = 0;
  probeBytes = 0;
  if (src.size < 8) return null;

  // Gate on the first box before walking anything: without this, a file of
  // random bytes whose first four happen to be small would be walked to its end
  // looking for a `moov` that cannot exist.
  const first = nextBox(src, 0, src.size);
  if (first === null || !TOP_LEVEL_TYPES.has(first.type)) return null;

  const moov = findBox(src, 0, src.size, "moov");
  if (moov === null) return null;

  const movie = parseTimedHeader(src, findBox(src, moov.body, moov.end, "mvhd"));

  let offset = moov.body;
  for (let i = 0; i < MAX_SIBLINGS; i++) {
    const box = nextBox(src, offset, moov.end);
    if (box === null) break;
    if (box.type === "trak") {
      const track = parseVideoTrak(src, box);
      if (track !== null) {
        const info: Mp4Info = { width: track.width, height: track.height };
        // The TRACK's duration, with `mvhd` only as a fallback. Both describe
        // the same clip, but `mvhd` is stated in the movie timescale, which
        // ffmpeg writes as 1000 — so it is pre-rounded to whole milliseconds:
        // the trailer fixture is 1253 frames at 24 fps, exactly 52208.333 ms,
        // and its `mvhd` says 52209 where the track's own tables divide once,
        // at full precision, to 52208 — the number ffprobe reports.
        if (track.durationMs > 0) {
          info.durationMs = track.durationMs;
        } else if (movie !== null && movie.duration > 0) {
          info.durationMs = Math.round((movie.duration * 1000) / movie.timescale);
        }
        if (track.fps !== undefined) info.fps = track.fps;
        // A found track does not redeem a blown budget: the abort exists so a
        // crafted tree costs bounded time, and "bounded time, then whatever
        // the walk happened to reach" would un-bound it again the moment the
        // payload is placed after the padding.
        return budgetBlown() ? null : info;
      }
    }
    offset = box.end;
  }
  // A container with no `"vide"` handler anywhere — an audio-only .m4a is the
  // normal case — is not a failure, it just has no dimensions to give.
  return null;
}

/**
 * Width, height and (when declared) duration and frame rate of the first video
 * track in an MP4/MOV file.
 *
 * Synchronous, and reads tens of kilobytes rather than the file: see the header
 * for why both of those are requirements rather than optimisations. Returns
 * null for anything unrecognised — a missing file, a directory, an empty file,
 * a still image with the wrong extension, or a container whose only tracks are
 * audio. Contractually incapable of throwing.
 *
 * @param path Filesystem path. The extension is never consulted; the box tree
 *   is the only evidence used.
 */
export function probeMp4(path: string): Mp4Info | null {
  let fd: number | null = null;
  try {
    const st = statSync(path);
    if (!st.isFile() || st.size < 8) return null;
    fd = openSync(path, "r");
    return probeSource(new FileSource(fd, st.size));
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * As `probeMp4`, for bytes already in memory.
 *
 * The walk is the same one; only the byte source differs. Slices are views into
 * the caller's buffer, so this copies nothing and — unlike the path form —
 * charges nothing to `mp4ProbeStats().bytesRead`.
 */
export function probeMp4Bytes(bytes: Uint8Array): Mp4Info | null {
  try {
    return probeSource(new BufferSource(bytes));
  } catch {
    return null;
  }
}
