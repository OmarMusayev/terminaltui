/**
 * The .tvf frame pack: every frame of a video, pre-decoded to an
 * independently-decodable JPEG, in one file with a table of byte offsets.
 *
 * WHY A CONTAINER AT ALL. Playback runs inside the same synchronous render pass
 * as everything else — `renderBlock()` returns `string[]`, there is no await to
 * hide work behind. Pulling frame N out of an MP4 at frame time is not an
 * option (a demux plus an inter-frame decode chain, in another process), and
 * neither is holding the decoded video in memory (1253 frames of 854x480 RGBA
 * is 2 GB). A pack costs one `open` + `read` and turns "give me frame N" into
 * an integer lookup and a `subarray`, which is the only shape the render pass
 * can afford. The extraction is paid once, offline, by the packer.
 *
 * WHY JPEG PER FRAME AND NOT AN INTER-FRAME CODEC. Seeking. Scrubbing back one
 * frame, looping, or resuming a paused player must never require replaying
 * frames from the last keyframe, so every frame is a keyframe. That costs disk
 * (roughly 3-6x an h264 encode) and buys O(1) random access with no decoder
 * state at all — a player is `frameAt(i)` plus the existing synchronous JPEG
 * decoder, with nothing to reset when the user seeks.
 *
 * WHY THE READER IS TOTAL. `decodePack` and `openPack` never throw. A .tvf on
 * disk is a CACHE ARTEFACT: it can be half-written by a killed packer, left
 * over from an older format version, truncated by a full disk, or simply
 * corrupt, and the caller finds out about it inside the render pass where a
 * throw kills the frame (and, mid-write to the terminal, leaves the screen in
 * whatever state the exception interrupted). Every failure is a
 * `{ ok: false, reason }` the caller can render as alt text. Same contract, and
 * the same reasoning, as `decodeImage()` in src/image/decode.ts.
 *
 * THE OFFSETS ARE NEVER TRUSTED. They come from the same untrusted file as the
 * bytes they index, so validation is not a formality: strictly increasing, zero
 * first, exactly `frameCount + 1` of them, last one exactly the payload length.
 * Those four together mathematically bound every offset inside the payload,
 * which is what makes `frameAt` incapable of handing back a window onto memory
 * it does not own. `frameAt` re-checks anyway, because a `TvfPack` can be built
 * by hand and not every caller comes through `decodePack`.
 *
 * WIRE FORMAT
 *   0   "TVF1"                    4 bytes ASCII
 *   4   headerLength              u32LE
 *   8   header                    headerLength bytes of UTF-8 JSON
 *   8+n payload                   frames back to back, no padding, no framing
 * The header carries the frame boundaries, so the payload needs no framing of
 * its own — a length prefix per frame would be a second source of truth about
 * where frame N starts, and two sources of truth is one too many.
 */

import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";

export const TVF_MAGIC = "TVF1";

/** "TVF1" as bytes, so sniffing never allocates a string from untrusted input. */
const MAGIC_BYTES = [0x54, 0x56, 0x46, 0x31];

/** Magic + u32LE header length. Nothing below this can be a pack. */
const PREAMBLE_BYTES = 8;

/**
 * Ceiling on the JSON header, checked before it is turned into a string.
 *
 * The header is ~8.5 bytes per frame (an offset, a comma, and for a GIF a
 * delay), so 16 MiB is on the order of a million frames — eleven hours at 24
 * fps, far past anything this renderer will ever play. It exists so a `u32`
 * length field that says 4 GB is rejected by arithmetic rather than by an
 * allocation, in the one window where the file has not been validated yet.
 */
const MAX_HEADER_BYTES = 16 * 1024 * 1024;

/**
 * Ceiling on a pack read off disk by `openPack`.
 *
 * 854x480 at JPEG q75 measures ~40 KB per frame, so 512 MiB is ~13,000 frames,
 * about nine minutes at 24 fps. A pack past that is a packer bug or a hostile
 * file, and either way reading it synchronously would stall the render loop for
 * long enough to look like a hang.
 */
/**
 * Largest pack `openPack` will read, and therefore the largest `encodePack`
 * will emit. Exported so every other entry point into a pack applies the SAME
 * ceiling — a file that loads through one door and is refused at another is
 * the asymmetry this constant exists to prevent.
 */
export const MAX_PACK_BYTES = 512 * 1024 * 1024;

/**
 * Read granularity for `sha1File`. 1 MiB keeps a 4 GB source out of RAM while
 * still amortising the syscall to nothing; the hash is the same either way.
 */
const SHA1_CHUNK_BYTES = 1024 * 1024;

export interface TvfHeader {
  v: 1;
  /** Pixel width of every frame in the pack. Frames are pre-scaled to one size. */
  width: number;
  height: number;
  /** Nominal constant frame rate. The fallback for `frameDelayMs`. */
  fps: number;
  frameCount: number;
  durationMs: number;
  /**
   * `frameCount + 1` byte offsets into the payload. Frame `i` is
   * `[offsets[i], offsets[i+1])`; `offsets[0]` is 0 and the last entry is the
   * payload length, so the table doubles as the frame-size table.
   */
  offsets: number[];
  /**
   * SHA-1 of the ORIGINAL source file. Staleness detection: an edited source
   * hashes differently, so the pack is rebuilt rather than played. mtime would
   * be cheaper and is what the image cache uses, but a pack survives across
   * machines and checkouts, where mtime is noise and content is not.
   */
  sourceSha1: string;
  /**
   * Per-frame delays, `frameCount` of them. Present only for variable-rate
   * sources — a GIF sets a delay per frame and real GIFs use that, so a single
   * `fps` would drift. Absent for constant-rate video, where storing 1253 copies
   * of the same number would be pure header weight.
   */
  delaysMs?: number[];
}

export interface TvfPack {
  header: TvfHeader;
  /**
   * The frame bytes, as a VIEW onto the buffer the pack was decoded from — not
   * a copy. `frameAt` sub-views this again, so playing a 50 MB pack allocates
   * nothing per frame.
   */
  payload: Uint8Array;
}

/** Total result type: the reader reports failure, it does not raise it. */
export type TvfResult = { ok: true; pack: TvfPack } | { ok: false; reason: string };

function fail(reason: string): TvfResult {
  return { ok: false, reason };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// One decoder for the process. `fatal: false` matters: invalid UTF-8 in a
// corrupt header becomes U+FFFD and fails at `JSON.parse`, where the failure is
// already handled, instead of throwing out of the decode.
const utf8 = new TextDecoder("utf-8", { fatal: false });

// ─── Writing ──────────────────────────────────────────────

/**
 * Reconcile a caller-supplied delay table with the frames that actually exist.
 *
 * A packer gets its delay list from probing the source and its frames from
 * decoding it, and those two counts disagree more often than not — ffprobe's
 * `nb_frames` is an estimate for most containers, and a GIF with a malformed
 * trailer yields fewer frames than its metadata claims. Rejecting that would
 * turn a recoverable extraction into no pack at all, so the FRAMES win and the
 * table is trimmed or extended to match. A non-finite entry (a probe that
 * emitted `N/A`) falls back to the nominal rate for that frame only.
 */
function normaliseDelays(delays: number[] | undefined, frameCount: number, fps: number): number[] | undefined {
  if (delays === undefined) return undefined;
  if (!Array.isArray(delays)) return undefined;
  const nominal = 1000 / fps;
  const out = new Array<number>(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const raw = delays[i];
    out[i] = typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : nominal;
  }
  return out;
}

/**
 * Build a pack from frames already encoded as JPEG.
 *
 * `frameCount` in the supplied header is ADVISORY and is overwritten with
 * `frames.length` — the offsets table is the only thing that can be right about
 * how many frames a pack contains, and a probe-derived count that disagrees is
 * the common case, not the exceptional one (see `normaliseDelays`).
 *
 * The invariant this function holds, and which the suite pins: whatever it
 * returns, `decodePack` accepts. Everything recoverable is normalised rather
 * than rejected. What is not recoverable throws: no frames at all, a zero-byte
 * frame (an extractor that produced no output for that timestamp — the
 * container has no way to represent "this frame is missing" and a player has
 * nothing to draw), nonsensical geometry, a header the reader's own validator
 * would refuse, and a pack past the ceiling `openPack` enforces. Those are
 * packer bugs, they surface offline, and they must not be written to disk to
 * be discovered later inside a render pass.
 *
 * The payload is NOT checked for JPEG magic. The container is deliberately
 * agnostic about what a frame is — the only thing it promises is that frame `i`
 * comes back exactly as it went in — and enforcing SOI here would buy nothing a
 * failed decode does not already catch while blocking any later codec change.
 */
export function encodePack(header: Omit<TvfHeader, "v" | "offsets">, frames: Uint8Array[]): Uint8Array {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new RangeError("encodePack: no frames — a pack with nothing to play is not a pack");
  }
  const width = Math.trunc(header.width);
  const height = Math.trunc(header.height);
  // Safe-integer, not merely finite, because that is what `headerFault` demands
  // of the reader: a finite 1e21 truncates to itself, sails through an isFinite
  // test, and mints a pack `decodePack` then refuses as "bad width".
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`encodePack: nonsensical frame size ${header.width}x${header.height}`);
  }
  if (!Number.isFinite(header.fps) || header.fps <= 0) {
    throw new RangeError(`encodePack: nonsensical fps ${header.fps}`);
  }

  const frameCount = frames.length;
  const offsets = new Array<number>(frameCount + 1);
  offsets[0] = 0;
  let total = 0;
  for (let i = 0; i < frameCount; i++) {
    const frame = frames[i];
    if (!(frame instanceof Uint8Array) || frame.byteLength === 0) {
      throw new RangeError(`encodePack: frame ${i} is empty — the extractor produced no bytes for it`);
    }
    total += frame.byteLength;
    offsets[i + 1] = total;
  }

  const durationMs = Number.isFinite(header.durationMs) && header.durationMs >= 0
    ? header.durationMs
    : (frameCount * 1000) / header.fps;

  // Key order is for humans: `head -c 200 clip.tvf` shows the geometry before
  // it disappears into ten kilobytes of offsets.
  const full: TvfHeader = {
    v: 1,
    width,
    height,
    fps: header.fps,
    frameCount,
    durationMs,
    sourceSha1: typeof header.sourceSha1 === "string" ? header.sourceSha1 : "",
    offsets,
  };
  const delaysMs = normaliseDelays(header.delaysMs, frameCount, header.fps);
  if (delaysMs !== undefined) full.delaysMs = delaysMs;

  // The writer submits its own header to the READER's validator before a byte
  // is laid down. This is the invariant above — whatever this function returns,
  // `decodePack` accepts — enforced mechanically rather than by keeping two
  // hand-written validators in agreement, and it catches what the scalar checks
  // cannot see coming: a denormal fps turns the durationMs fallback and the
  // nominal delay into Infinity, which JSON.stringify would silently serialise
  // as `null` for `decodePack` to refuse at render time.
  const fault = headerFault(full, total);
  if (fault !== null) {
    throw new RangeError(`encodePack: header would be rejected by decodePack — ${fault}`);
  }

  const headerBytes = Buffer.from(JSON.stringify(full), "utf8");
  const packBytes = PREAMBLE_BYTES + headerBytes.length + total;
  // `openPack` refuses anything past MAX_PACK_BYTES, so writing it would mint
  // a file that decodes from memory but is permanently unplayable from disk —
  // exactly the deferred failure this function exists to surface offline. The
  // window is real: ffmpeg's 512 MiB spawnSync maxBuffer lets a payload land
  // within one header's length of the reader's ceiling. Checked before the
  // output allocation so refusing a 4 GB pack costs arithmetic, not memory.
  if (packBytes > MAX_PACK_BYTES) {
    throw new RangeError(
      `encodePack: ${packBytes} bytes exceeds the ${MAX_PACK_BYTES}-byte ceiling openPack enforces`,
    );
  }
  const out = new Uint8Array(packBytes);
  out[0] = MAGIC_BYTES[0];
  out[1] = MAGIC_BYTES[1];
  out[2] = MAGIC_BYTES[2];
  out[3] = MAGIC_BYTES[3];
  const n = headerBytes.length;
  out[4] = n & 0xff;
  out[5] = (n >>> 8) & 0xff;
  out[6] = (n >>> 16) & 0xff;
  out[7] = (n >>> 24) & 0xff;
  out.set(headerBytes, PREAMBLE_BYTES);
  const base = PREAMBLE_BYTES + n;
  for (let i = 0; i < frameCount; i++) out.set(frames[i], base + offsets[i]);
  return out;
}

// ─── Reading ──────────────────────────────────────────────

/** True when every element is a number in `[min, ∞)` and safely integral. */
function isSafeIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validate a parsed header against the payload it claims to describe.
 *
 * Returns the reason it is unusable, or null when it is sound. Split out so the
 * ordering of the checks is readable: shape, then scalars, then the offsets
 * table, which is the only part that can cause an out-of-bounds read.
 */
function headerFault(raw: unknown, payloadLength: number): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return "header is not a JSON object";
  }
  const h = raw as Record<string, unknown>;

  if (h.v !== 1) return `unsupported pack version ${JSON.stringify(h.v)} (this build reads v1)`;
  if (!isSafeIndex(h.width) || h.width <= 0) return `bad width ${JSON.stringify(h.width)}`;
  if (!isSafeIndex(h.height) || h.height <= 0) return `bad height ${JSON.stringify(h.height)}`;
  if (typeof h.fps !== "number" || !Number.isFinite(h.fps) || h.fps <= 0) {
    return `bad fps ${JSON.stringify(h.fps)}`;
  }
  if (typeof h.durationMs !== "number" || !Number.isFinite(h.durationMs) || h.durationMs < 0) {
    return `bad durationMs ${JSON.stringify(h.durationMs)}`;
  }
  if (typeof h.sourceSha1 !== "string") return "sourceSha1 is missing or not a string";

  const frameCount = h.frameCount;
  // Zero frames is rejected rather than tolerated: an empty pack can only come
  // from a packer that failed, and every caller of this module is easier to
  // write when `ok: true` guarantees there is something to draw.
  if (!isSafeIndex(frameCount) || frameCount < 1) {
    return `bad frameCount ${JSON.stringify(frameCount)}`;
  }

  const offsets = h.offsets;
  if (!Array.isArray(offsets)) return "offsets is missing or not an array";
  if (offsets.length !== frameCount + 1) {
    return `frameCount ${frameCount} disagrees with offsets length ${offsets.length}`;
  }
  if (offsets[0] !== 0) return `offsets[0] is ${JSON.stringify(offsets[0])}, must be 0`;
  // Strictly increasing, not merely non-decreasing: equal neighbours would mean
  // a zero-byte frame, which no decoder can turn into pixels.
  for (let i = 0; i < offsets.length; i++) {
    const at = offsets[i];
    if (!isSafeIndex(at)) return `offsets[${i}] is ${JSON.stringify(at)}, not a byte offset`;
    if (i > 0 && at <= offsets[i - 1]) {
      return `offsets are not strictly increasing at ${i} (${offsets[i - 1]} then ${at})`;
    }
  }
  // With offsets[0] === 0, strict increase, and this equality, every offset is
  // provably inside the payload — that is the whole bounds proof for `frameAt`.
  const end = offsets[frameCount];
  if (end !== payloadLength) {
    return `offsets end at ${end} but the payload is ${payloadLength} bytes`;
  }

  if (h.delaysMs !== undefined) {
    const delays = h.delaysMs;
    if (!Array.isArray(delays)) return "delaysMs is present but not an array";
    if (delays.length !== frameCount) {
      return `delaysMs has ${delays.length} entries for ${frameCount} frames`;
    }
    for (let i = 0; i < delays.length; i++) {
      const d = delays[i];
      if (typeof d !== "number" || !Number.isFinite(d) || d < 0) {
        return `delaysMs[${i}] is ${JSON.stringify(d)}, not a delay`;
      }
    }
  }
  return null;
}

/**
 * Parse a pack from bytes already in memory. Never throws.
 *
 * The returned `payload` is a view onto `bytes`, so the caller must keep that
 * buffer alive for as long as it plays the pack — which it does for free by
 * holding the `TvfPack`.
 */
export function decodePack(bytes: Uint8Array): TvfResult {
  try {
    if (!(bytes instanceof Uint8Array)) return fail("not a byte buffer");
    if (bytes.length < PREAMBLE_BYTES) {
      return fail(`too short: ${bytes.length} bytes, a pack begins with ${PREAMBLE_BYTES}`);
    }
    for (let i = 0; i < MAGIC_BYTES.length; i++) {
      if (bytes[i] !== MAGIC_BYTES[i]) {
        const seen = Buffer.from(bytes.subarray(0, 4)).toString("hex");
        return fail(`bad magic 0x${seen}, expected "${TVF_MAGIC}"`);
      }
    }

    // u32LE by hand rather than through a DataView: `bytes` may be a view with
    // a non-zero byteOffset, and hand-rolling the shift is one line against
    // three chances to get that offset wrong.
    const headerLength =
      (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
    if (headerLength === 0) return fail("header length is 0");
    if (headerLength > MAX_HEADER_BYTES) {
      return fail(`header length ${headerLength} exceeds the ${MAX_HEADER_BYTES}-byte ceiling`);
    }
    if (PREAMBLE_BYTES + headerLength > bytes.length) {
      return fail(
        `header length ${headerLength} runs past the end of a ${bytes.length}-byte file`,
      );
    }

    const json = utf8.decode(bytes.subarray(PREAMBLE_BYTES, PREAMBLE_BYTES + headerLength));
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (err) {
      return fail(`header is not valid JSON: ${errorText(err)}`);
    }

    const payload = bytes.subarray(PREAMBLE_BYTES + headerLength);
    const faultText = headerFault(raw, payload.length);
    if (faultText !== null) return fail(faultText);

    return { ok: true, pack: { header: raw as TvfHeader, payload } };
  } catch (err) {
    // Belt and braces, exactly as decodeImage() does it: this function is
    // contractually incapable of throwing, and the caller is mid-frame.
    return fail(errorText(err));
  }
}

/**
 * Read and parse a pack from disk. Never throws.
 *
 * Synchronous by necessity — the render pass has no await — so the size is
 * checked against the stat before any read, and a missing, unreadable or
 * oversize file comes back as a reason rather than an exception.
 */
export function openPack(path: string): TvfResult {
  try {
    let size: number;
    try {
      const st = statSync(path);
      if (!st.isFile()) return fail(`not a regular file: ${path}`);
      size = st.size;
    } catch (err) {
      return fail(errorText(err));
    }
    if (size < PREAMBLE_BYTES) return fail(`too short: ${size} bytes`);
    if (size > MAX_PACK_BYTES) {
      return fail(`${size} bytes exceeds the ${MAX_PACK_BYTES}-byte pack ceiling`);
    }

    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch (err) {
      return fail(errorText(err));
    }
    return decodePack(bytes);
  } catch (err) {
    return fail(errorText(err));
  }
}

// ─── Frame access ─────────────────────────────────────────

/**
 * Frame `i`'s encoded bytes, or null when there is no such frame.
 *
 * Zero-copy: the result is a view sharing the pack's buffer, so seeking is an
 * allocation-free integer lookup and a 50 MB pack stays one allocation no
 * matter how long it plays. The caller must not mutate it.
 *
 * The bounds are re-derived here even though `decodePack` already proved them.
 * A `TvfPack` is a plain object — tests build them, and so will anything that
 * assembles a pack in memory instead of parsing one — so this function cannot
 * assume it is looking at a validated header. Failing to null is the difference
 * between a missing frame and a window onto unrelated heap.
 */
export function frameAt(pack: TvfPack, i: number): Uint8Array | null {
  if (!Number.isInteger(i) || i < 0 || i >= pack.header.frameCount) return null;
  const offsets = pack.header.offsets;
  if (!Array.isArray(offsets) || i + 1 >= offsets.length) return null;
  const start = offsets[i];
  const end = offsets[i + 1];
  if (!isSafeIndex(start) || !isSafeIndex(end)) return null;
  if (end < start || end > pack.payload.length) return null;
  return pack.payload.subarray(start, end);
}

/**
 * How long frame `i` should stay on screen, in milliseconds.
 *
 * The per-frame table when there is one, the nominal rate otherwise. No
 * clamping: browsers famously round a GIF delay of 0 or 10 ms up to 100 ms, but
 * that is playback policy and belongs to the packer or the player, not to the
 * container — this function's job is to report what the file says.
 *
 * Falls back for an out-of-range index rather than returning null, because the
 * only caller is a frame-timer that must always have a number to wait for.
 */
export function frameDelayMs(pack: TvfPack, i: number): number {
  const delay = pack.header.delaysMs?.[i] ?? 1000 / pack.header.fps;
  // A hand-built pack can carry fps 0; a timer given Infinity never advances.
  return typeof delay === "number" && Number.isFinite(delay) && delay >= 0 ? delay : 0;
}

// ─── Source identity ──────────────────────────────────────

/**
 * SHA-1 of a file's contents, lowercase hex, or "" when it cannot be read.
 *
 * SHA-1 rather than something modern because this is a cache key, not a
 * signature: collisions here would have to be engineered by someone who can
 * already write to the cache directory, and it is the fastest digest node
 * ships. Read in 1 MiB chunks so hashing a 4 GB source does not mean holding
 * 4 GB — `readFileSync` would also fail outright past Node's buffer ceiling.
 *
 * Returns "" instead of throwing so a staleness check can run on the render
 * path against a source that has since been deleted; "" matches no real digest,
 * so the pack is treated as stale, which is the safe direction to be wrong in.
 */
export function sha1File(path: string): string {
  let fd: number | null = null;
  try {
    // The same isFile() gate `openPack` applies, and here it is load-bearing
    // for TERMINATION, not just hygiene: /dev/zero satisfies every read with a
    // full chunk and never signals EOF, so the loop below would hash forever,
    // and openSync on a FIFO with no writer blocks before there is anything to
    // read. Neither path throws, so neither would ever reach the catch that
    // turns failure into "".
    if (!statSync(path).isFile()) return "";
    fd = openSync(path, "r");
    const hash = createHash("sha1");
    const buf = Buffer.allocUnsafe(SHA1_CHUNK_BYTES);
    for (;;) {
      const read = readSync(fd, buf, 0, SHA1_CHUNK_BYTES, null);
      if (read <= 0) break;
      hash.update(read === SHA1_CHUNK_BYTES ? buf : buf.subarray(0, read));
    }
    return hash.digest("hex");
  } catch {
    return "";
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
