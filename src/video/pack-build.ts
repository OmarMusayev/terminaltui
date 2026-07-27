/**
 * Building a `.tvf` frame pack from a real video file.
 *
 * This module is the reason playback is cheap. Everything expensive about
 * showing a moving picture in a terminal — demuxing, inter-frame decoding,
 * scaling a 854x480 raster down to a 200x56 sub-cell grid — happens here,
 * once, ahead of time. What survives into the pack is a run of small,
 * independently-decodable JPEGs already close to the size they will be drawn
 * at, which the renderer turns into cells in about 1.4 ms.
 *
 * NOTHING IN HERE RUNS AT RENDER TIME. It is called by the `video pack` CLI
 * and by the dev server's auto-pack, both of which are allowed to spawn
 * processes and take a second. `src/video/player.ts` imports none of it.
 *
 * Two ingest paths, and the split matters more than it looks:
 *
 *   .gif  -> decoded by `src/image/gif.ts`, resampled and re-encoded here, in
 *            pure TypeScript with zero installed tooling. This is the path
 *            that lets someone `npm install terminaltui` and have video work.
 *   else  -> handed to ffmpeg, which demuxes and scales in C far better than
 *            anything here could. ffmpeg is required for mp4/mov/webm, at
 *            PACK time only.
 *
 * WHY MJPEG rather than raw RGBA: a 400x225 raw frame is 360 KB, so the
 * sintel trailer would pack to 450 MB. The same frame as a q=5 JPEG is about
 * 11 KB, and jpeg-js decodes it in 0.6 ms — comfortably inside a frame budget
 * that is 41.6 ms at 24 fps. Storage is 40x smaller for a decode cost the
 * pipeline does not notice.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import jpeg from "jpeg-js";

import { encodePack, sha1File, type TvfHeader } from "./pack.js";
import { decodeGif } from "../image/gif.js";
import { resampleToGrid } from "../image/resample.js";
import type { PixelBuffer } from "../image/types.js";

/**
 * Default pack width in PIXELS.
 *
 * The quadrant tier samples 2 sub-pixels per cell horizontally, and the
 * framework clamps content to 99 columns, so the widest sub-cell grid a video
 * is ever drawn into is 198 px. 400 is a touch over 2x that: enough
 * oversampling that the box filter has real information to average at any
 * width up to full-screen, without paying for detail the glyph fitter throws
 * away regardless.
 *
 * The cost is linear in area — 400 px wide packs the sintel trailer to about
 * 7 MB where 200 px gives 2 MB and visibly softens past a 50-column block.
 */
export const DEFAULT_PACK_WIDTH = 400;

/**
 * Default frames per second.
 *
 * 12 rather than the source's 24 because the wire, not the CPU, is the limit:
 * a full-width truecolor quadrant frame is ~52 KiB, so 24 fps asks a terminal
 * emulator to parse 1.26 MiB/s of SGR sequences indefinitely. 12 halves that
 * and still reads as motion. Raise it per-block with `fps` when the block is
 * small.
 */
export const DEFAULT_PACK_FPS = 12;

/** JPEG quality. 5 on ffmpeg's 2-31 scale (lower is better) ~ 85 on jpeg-js's 0-100. */
export const DEFAULT_PACK_QUALITY = 5;

export interface PackOptions {
  /** Target width in pixels; height follows the source aspect. */
  width?: number;
  fps?: number;
  /** ffmpeg's -q:v, 2 (best) to 31. Mapped onto jpeg-js's scale for GIF sources. */
  quality?: number;
  /** Seconds into the source to start. */
  start?: number;
  /** Seconds of source to take. */
  duration?: number;
  /** Path to the ffmpeg binary. Default: TERMINALTUI_FFMPEG, else "ffmpeg". */
  ffmpeg?: string;
}

export type PackBuildResult =
  | { ok: true; bytes: Uint8Array; header: TvfHeader; via: "gif" | "ffmpeg" }
  | { ok: false; reason: string; hint?: string };

/** Sources we hand to ffmpeg rather than decoding ourselves. */
const FFMPEG_EXTENSIONS = new Set([
  ".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg", ".wmv", ".flv", ".ogv",
]);

export function ffmpegBinary(opts: PackOptions = {}): string {
  return opts.ffmpeg ?? process.env.TERMINALTUI_FFMPEG ?? "ffmpeg";
}

/** True when the binary answers `-version`. Cheap enough to call before packing. */
export function hasFfmpeg(opts: PackOptions = {}): boolean {
  const probe = spawnSync(ffmpegBinary(opts), ["-version"], { stdio: "ignore" });
  return probe.status === 0;
}

// ─── Entry point ──────────────────────────────────────────

/**
 * Build a pack from any supported source.
 *
 * Never throws. A missing file, absent ffmpeg, an unreadable GIF and a source
 * with no video track all come back as `{ ok: false, reason, hint }`, because
 * the dev server calls this from inside a request that must not die — and
 * because `hint` is what the alt box shows the user, so it has to carry the
 * remedy rather than a stack trace.
 */
export function buildPack(src: string, opts: PackOptions = {}): PackBuildResult {
  try {
    if (!existsSync(src)) return { ok: false, reason: `no such file: ${src}` };
    const ext = extname(src).toLowerCase();
    if (ext === ".gif") return packGif(src, opts);
    if (FFMPEG_EXTENSIONS.has(ext) || ext === "") return packViaFfmpeg(src, opts);
    return {
      ok: false,
      reason: `unsupported source type "${ext}"`,
      hint: "supported: .gif (no tooling needed), .mp4/.mov/.webm/.mkv (needs ffmpeg)",
    };
  } catch (e) {
    return { ok: false, reason: `pack failed: ${(e as Error).message}` };
  }
}

/** Write a built pack to disk, creating parent directories. */
export function writePack(outPath: string, bytes: Uint8Array): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
}

// ─── GIF: pure TypeScript, no tooling ─────────────────────

/**
 * Pack a GIF without spawning anything.
 *
 * The per-frame delays are carried through into the pack's `delaysMs` table
 * rather than being averaged into a single fps. Real GIFs are routinely
 * variable-rate — a title card held for a second between frames at 40 ms — and
 * flattening that to a mean rate is the difference between a loop that reads
 * as intentional and one that reads as broken.
 */
function packGif(src: string, opts: PackOptions): PackBuildResult {
  const raw = readFileSync(src);
  const decoded = decodeGif(new Uint8Array(raw));
  if (!decoded.ok) return { ok: false, reason: `gif decode failed: ${decoded.reason}` };

  const gif = decoded.gif;
  if (gif.frames.length === 0) return { ok: false, reason: "gif contains no frames" };

  const targetW = Math.max(2, Math.round(opts.width ?? DEFAULT_PACK_WIDTH));
  const scale = Math.min(1, targetW / gif.width);
  // Even dimensions: JPEG chroma subsampling halves both axes, and an odd edge
  // costs a column of mush for nothing.
  const w = Math.max(2, evenize(Math.round(gif.width * scale)));
  const h = Math.max(2, evenize(Math.round(gif.height * scale)));

  const quality = jpegQualityFor(opts.quality ?? DEFAULT_PACK_QUALITY);
  const frames: Uint8Array[] = [];
  const delaysMs: number[] = [];

  for (const frame of gif.frames) {
    frames.push(encodeJpeg(resizePixels(frame.pixels, w, h), quality));
    delaysMs.push(frame.delayMs);
  }

  const durationMs = delaysMs.reduce((a, b) => a + b, 0);
  // The nominal rate is only a fallback for consumers that ignore the table.
  const fps = durationMs > 0 ? (frames.length * 1000) / durationMs : DEFAULT_PACK_FPS;

  return {
    ok: true,
    via: "gif",
    ...finish({ width: w, height: h, fps, frameCount: frames.length, durationMs,
                sourceSha1: sha1File(src), delaysMs }, frames),
  };
}

// ─── Everything else: ffmpeg at pack time ─────────────────

/**
 * Pack via ffmpeg, reading an MJPEG stream off its stdout.
 *
 * `-f image2pipe -vcodec mjpeg` gives back exactly the concatenated JPEGs the
 * pack format wants, so there is no intermediate format and no temp directory
 * full of numbered PNGs. The frames are split back apart by scanning for JPEG
 * markers, which is safe here because ffmpeg emits one complete image per
 * frame with nothing between them.
 *
 * `scale=w:-2` keeps the source aspect and forces an even height, and the
 * `fps` filter resamples the frame rate properly (duplicating or dropping)
 * rather than just relabelling timestamps.
 */
function packViaFfmpeg(src: string, opts: PackOptions): PackBuildResult {
  const bin = ffmpegBinary(opts);
  const width = Math.max(2, evenize(Math.round(opts.width ?? DEFAULT_PACK_WIDTH)));
  const fps = opts.fps ?? DEFAULT_PACK_FPS;
  const quality = opts.quality ?? DEFAULT_PACK_QUALITY;

  const args: string[] = ["-v", "error"];
  // -ss before -i seeks by keyframe, which is fast and accurate enough here.
  if (opts.start !== undefined) args.push("-ss", String(opts.start));
  if (opts.duration !== undefined) args.push("-t", String(opts.duration));
  args.push(
    "-i", src,
    "-an", "-sn", "-dn",
    "-vf", `fps=${fps},scale=${width}:-2:flags=lanczos`,
    "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", String(quality),
    "-",
  );

  // 512 MB ceiling: the sintel trailer packs to ~7 MB, so anything approaching
  // this is a source nobody should be embedding in a terminal page anyway.
  const run = spawnSync(bin, args, { maxBuffer: 512 * 1024 * 1024 });

  if (run.error) {
    const missing = (run.error as NodeJS.ErrnoException).code === "ENOENT";
    return {
      ok: false,
      reason: missing ? `ffmpeg not found (tried "${bin}")` : `ffmpeg failed: ${run.error.message}`,
      hint: missing
        ? "install ffmpeg (brew install ffmpeg), or set TERMINALTUI_FFMPEG to its path. GIF sources need no tooling."
        : undefined,
    };
  }
  if (run.status !== 0) {
    const err = (run.stderr?.toString() ?? "").trim().split("\n").slice(-3).join(" ");
    return { ok: false, reason: `ffmpeg exited ${run.status}: ${err || "no output"}` };
  }

  const frames = splitMjpeg(new Uint8Array(run.stdout));
  if (frames.length === 0) {
    return { ok: false, reason: "ffmpeg produced no frames — is there a video track?" };
  }

  const dims = jpegDimensions(frames[0]);
  if (!dims) return { ok: false, reason: "could not read dimensions from the first packed frame" };

  return {
    ok: true,
    via: "ffmpeg",
    ...finish({
      width: dims.width, height: dims.height, fps,
      frameCount: frames.length,
      durationMs: Math.round((frames.length / fps) * 1000),
      sourceSha1: sha1File(src),
    }, frames),
  };
}

// ─── Shared helpers ───────────────────────────────────────

function finish(
  header: Omit<TvfHeader, "v" | "offsets">,
  frames: Uint8Array[],
): { bytes: Uint8Array; header: TvfHeader } {
  const bytes = packFrames(frames, header);
  return { bytes, header: { v: 1, ...header, offsets: offsetsOf(frames) } };
}

/**
 * Wrap already-encoded JPEG frames in a pack.
 *
 * Exported so the ASYNCHRONOUS packer in `source.ts` — which runs ffmpeg as a
 * background child rather than through `spawnSync` — assembles its output with
 * exactly this code path rather than a second copy of it.
 */
export function packFrames(
  frames: Uint8Array[],
  header: Omit<TvfHeader, "v" | "offsets">,
): Uint8Array {
  return encodePack(header, frames);
}

function offsetsOf(frames: Uint8Array[]): number[] {
  const offsets = [0];
  let at = 0;
  for (const f of frames) offsets.push((at += f.length));
  return offsets;
}

function evenize(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/**
 * ffmpeg's -q:v runs 2 (best) to 31 (worst); jpeg-js's runs 0 to 100 the other
 * way. Map so the two ingest paths produce comparable-looking packs from the
 * same `--quality` flag.
 */
function jpegQualityFor(ffmpegQ: number): number {
  const clamped = Math.min(31, Math.max(2, ffmpegQ));
  return Math.round(100 - ((clamped - 2) / 29) * 55); // 2 -> 100, 31 -> 45
}

function resizePixels(src: PixelBuffer, w: number, h: number): PixelBuffer {
  if (src.width === w && src.height === h) return src;
  // Opaque black under any residual alpha: a pack frame is a photograph, and
  // JPEG has no alpha channel to carry transparency into anyway.
  const data = resampleToGrid(src, w, h, { background: { r: 0, g: 0, b: 0 } });
  return { data, width: w, height: h };
}

function encodeJpeg(px: PixelBuffer, quality: number): Uint8Array {
  const encoded = jpeg.encode(
    { data: Buffer.from(px.data.buffer, px.data.byteOffset, px.data.length), width: px.width, height: px.height },
    quality,
  );
  return new Uint8Array(encoded.data);
}

/**
 * Split a concatenated MJPEG byte stream into individual images.
 *
 * Scans for SOI (FFD8) and cuts at the following EOI (FFD9). Entropy-coded
 * JPEG data byte-stuffs any FF it emits as FF00, and every other FFxx inside
 * the stream is a real marker, so an FFD9 encountered at the top level is
 * genuinely the end of an image — this does not need a full JPEG parser.
 */
export function splitMjpeg(buf: Uint8Array): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8) { i++; continue; }
    const start = i;
    let j = i + 2;
    while (j < buf.length - 1) {
      if (buf[j] === 0xff && buf[j + 1] === 0xd9) break;
      j++;
    }
    if (j >= buf.length - 1) break; // truncated trailing image: drop it
    frames.push(buf.subarray(start, j + 2));
    i = j + 2;
  }
  return frames;
}

/**
 * Read width/height out of a JPEG's SOFn segment.
 *
 * Cheaper and more direct than decoding the frame just to learn its size, and
 * it keeps `packViaFfmpeg` honest: the dimensions recorded in the header are
 * the ones ffmpeg actually produced, not the ones we asked it for.
 */
export function jpegDimensions(jpg: Uint8Array): { width: number; height: number } | null {
  if (jpg.length < 4 || jpg[0] !== 0xff || jpg[1] !== 0xd8) return null;
  let i = 2;
  while (i < jpg.length - 8) {
    if (jpg[i] !== 0xff) { i++; continue; }
    const marker = jpg[i + 1];
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (jpg[i + 2] << 8) | jpg[i + 3];
    if (len < 2) return null;
    // SOF0..SOF15, excluding the DHT/JPG/DAC markers that share the range.
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: (jpg[i + 5] << 8) | jpg[i + 6], width: (jpg[i + 7] << 8) | jpg[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}
