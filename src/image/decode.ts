/**
 * Synchronous image decoding with zero native dependencies.
 *
 * The whole render pass is synchronous (`renderBlock()` returns `string[]`),
 * so decoding has to be too: `pngjs` and `jpeg-js` were chosen precisely
 * because both expose sync entry points (§4.5 of the exploration report —
 * pngjs 8.5 ms on 400x225, jpeg-js 14.7 ms on 200x133). Nothing in this file
 * awaits, and nothing in it throws: every failure is a `DecodeResult` with
 * `ok: false` so the caller can fall straight through to the alt-text tier.
 *
 * Format is decided by MAGIC BYTES, never by file extension — a `.png` that
 * is really a JPEG must still render.
 */

import { createRequire } from "node:module";
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { IMAGE_LIMITS } from "./types.js";
import type {
  DecodeFailure,
  DecodeResult,
  ImageFormat,
  ImageHeader,
  PixelBuffer,
} from "./types.js";

// ─── Tunables ─────────────────────────────────────────────

/**
 * Bytes read off disk for a header-only probe. 64 KiB clears an EXIF segment
 * (capped at 64 KiB by the spec) so the JPEG SOF marker is almost always in
 * range without touching the pixel payload.
 */
const HEADER_PREFIX_BYTES = 64 * 1024;

/**
 * A JPEG carrying a multi-segment ICC profile can push SOF past 64 KiB. One
 * bounded retry covers that without ever reading a whole file to find two
 * uint16s.
 */
const HEADER_RETRY_BYTES = 1024 * 1024;

// ─── Lazy CJS decoders ────────────────────────────────────
//
// `createRequire` rather than a static import for two reasons: pngjs ships no
// type declarations (a bare `import` is a hard TS7016 error), and requiring
// lazily keeps the decoders off the cold-start path of every app that never
// renders an image.

interface PngSyncModule {
  sync: {
    read(
      buffer: Buffer,
      options?: { skipRescale?: boolean },
    ): { width: number; height: number; data: unknown };
  };
}

interface JpegModule {
  decode(
    data: Buffer,
    opts: {
      useTArray: true;
      formatAsRGBA?: boolean;
      tolerantDecoding?: boolean;
      maxResolutionInMP?: number;
    },
  ): { width: number; height: number; data: unknown };
}

const requireHere = createRequire(import.meta.url);

let pngModule: PngSyncModule | null = null;
let jpegModule: JpegModule | null = null;

function loadPng(): PngSyncModule {
  if (pngModule === null) {
    pngModule = (requireHere("pngjs") as { PNG: PngSyncModule }).PNG;
  }
  return pngModule;
}

function loadJpeg(): JpegModule {
  if (jpegModule === null) {
    jpegModule = requireHere("jpeg-js") as JpegModule;
  }
  return jpegModule;
}

// ─── Magic bytes ──────────────────────────────────────────

function has(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (offset + bytes.length > buf.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Identify a container from its leading bytes. Returns `"unknown"` when
 * nothing matches — the file extension is never consulted.
 */
export function sniffFormat(buf: Buffer): ImageFormat {
  if (has(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (has(buf, 0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (has(buf, 0, [0x47, 0x49, 0x46, 0x38])) return "gif"; // "GIF8" (87a/89a)
  if (has(buf, 0, [0x42, 0x4d])) return "bmp"; // "BM"
  // "RIFF" .... "WEBP"
  if (has(buf, 0, [0x52, 0x49, 0x46, 0x46]) && has(buf, 8, [0x57, 0x45, 0x42, 0x50])) {
    return "webp";
  }
  return "unknown";
}

// ─── Header parsing ───────────────────────────────────────

function parsePngHeader(buf: Buffer): ImageHeader | null {
  // 8-byte signature, then a chunk length, then "IHDR" at 12 and the two
  // big-endian uint32 dimensions at 16 and 20.
  if (buf.length < 24) return null;
  if (!has(buf, 12, [0x49, 0x48, 0x44, 0x52])) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    format: "png",
  };
}

function parseJpegHeader(buf: Buffer): ImageHeader | null {
  const len = buf.length;
  let i = 2; // past SOI
  while (i + 3 < len) {
    if (buf[i] !== 0xff) {
      i++; // resync: padding or a malformed segment length landed us mid-stream
      continue;
    }
    let marker = buf[i + 1];
    // Any number of 0xFF fill bytes may precede the marker code.
    while (marker === 0xff && i + 2 < len) {
      i++;
      marker = buf[i + 1];
    }
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // EOI, or entropy-coded data begins — no frame header will follow.
    if (marker === 0xd9 || marker === 0xda) return null;

    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) return null;

    // SOF0..SOF15 minus DHT (C4), JPG (C8) and DAC (CC): baseline, extended,
    // progressive, lossless and arithmetic frames all declare size the same way.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 > len) return null; // truncated prefix — caller may retry longer
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        format: "jpeg",
      };
    }
    i += 2 + segLen;
  }
  return null;
}

function parseGifHeader(buf: Buffer): ImageHeader | null {
  // Logical screen descriptor: little-endian uint16 pair at byte 6.
  if (buf.length < 10) return null;
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
    format: "gif",
  };
}

function parseBmpHeader(buf: Buffer): ImageHeader | null {
  if (buf.length < 26) return null;
  const dibSize = buf.readUInt32LE(14);
  if (dibSize === 12) {
    // BITMAPCOREHEADER: signed int16 dimensions.
    return { width: buf.readInt16LE(18), height: Math.abs(buf.readInt16LE(20)), format: "bmp" };
  }
  // BITMAPINFOHEADER and later. A negative height means a top-down bitmap.
  return {
    width: buf.readInt32LE(18),
    height: Math.abs(buf.readInt32LE(22)),
    format: "bmp",
  };
}

function parseWebpHeader(buf: Buffer): ImageHeader | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: keyframe sync code 9D 01 2A, then two 14-bit dimensions.
    if (!has(buf, 23, [0x9d, 0x01, 0x2a])) return null;
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      format: "webp",
    };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      format: "webp",
    };
  }
  if (chunk === "VP8X") {
    // Extended: 24-bit little-endian canvas dimensions minus one.
    return {
      width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
      format: "webp",
    };
  }
  return null;
}

function parseHeader(buf: Buffer): ImageHeader | null {
  let header: ImageHeader | null;
  switch (sniffFormat(buf)) {
    case "png":  header = parsePngHeader(buf);  break;
    case "jpeg": header = parseJpegHeader(buf); break;
    case "gif":  header = parseGifHeader(buf);  break;
    case "bmp":  header = parseBmpHeader(buf);  break;
    case "webp": header = parseWebpHeader(buf); break;
    default:     header = null;
  }
  // A zero or negative dimension is a broken container, not a 0-cell image.
  if (header === null || header.width <= 0 || header.height <= 0) return null;
  return header;
}

/** Read the first `bytes` bytes of a file. Returns null on any I/O failure. */
function readPrefix(path: string, bytes: number): Buffer | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.allocUnsafe(bytes);
    const read = readSync(fd, buf, 0, bytes, 0);
    return read < bytes ? buf.subarray(0, read) : buf;
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
 * Parse an image's dimensions from its header alone, without decoding pixels.
 *
 * This is what lets the renderer reserve the correct number of rows on frame 1
 * for the price of one 64 KiB read: layout needs `width`/`height` long before
 * the RGBA buffer exists. Returns null for unrecognised or truncated headers.
 *
 * @param source Absolute path, or a buffer already in memory.
 */
export function readHeader(source: string | Buffer): ImageHeader | null {
  if (typeof source !== "string") return parseHeader(source);

  const prefix = readPrefix(source, HEADER_PREFIX_BYTES);
  if (prefix === null) return null;

  const header = parseHeader(prefix);
  if (header !== null) return header;

  // Only JPEG can legitimately hide its frame header past 64 KiB, and only
  // when there was more file to read.
  if (prefix.length < HEADER_PREFIX_BYTES || sniffFormat(prefix) !== "jpeg") return null;

  const extended = readPrefix(source, HEADER_RETRY_BYTES);
  return extended === null ? null : parseHeader(extended);
}

// ─── Decoding ─────────────────────────────────────────────

/** Per-call overrides for the byte and pixel budgets in `IMAGE_LIMITS`. */
export interface DecodeOptions {
  /** Max encoded bytes read off disk. Default `IMAGE_LIMITS.maxSourceBytes`. */
  maxSourceBytes?: number;
  /** Max decoded pixels (width * height). Default `IMAGE_LIMITS.maxPixels`. */
  maxPixels?: number;
}

function fail(reason: DecodeFailure, detail: string): DecodeResult {
  return { ok: false, reason, detail };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type LoadedBytes = { ok: true; bytes: Buffer } | { ok: false; result: DecodeResult };

/**
 * Get the encoded bytes, enforcing the source budget BEFORE any read so a
 * hostile 2 GB file is rejected by its stat, not by an OOM.
 */
function loadBytes(source: string | Buffer, maxSourceBytes: number): LoadedBytes {
  if (typeof source !== "string") {
    if (source.byteLength > maxSourceBytes) {
      return {
        ok: false,
        result: fail("too-large", `${source.byteLength} source bytes exceeds ${maxSourceBytes}`),
      };
    }
    return { ok: true, bytes: source };
  }

  let size: number;
  try {
    const stat = statSync(source);
    if (!stat.isFile()) {
      return { ok: false, result: fail("not-found", `not a regular file: ${source}`) };
    }
    size = stat.size;
  } catch (err) {
    return { ok: false, result: fail("not-found", errorText(err)) };
  }

  if (size > maxSourceBytes) {
    return {
      ok: false,
      result: fail("too-large", `${size} source bytes exceeds ${maxSourceBytes}`),
    };
  }

  try {
    return { ok: true, bytes: readFileSync(source) };
  } catch (err) {
    return { ok: false, result: fail("not-found", errorText(err)) };
  }
}

/**
 * Normalise a decoder's output to 8-bit RGBA.
 *
 * pngjs already de-palettes, expands greyscale and rescales 16-bit samples
 * (`format-normaliser.js`), and jpeg-js returns RGBA under `formatAsRGBA` —
 * but both are verified here rather than assumed, and the 16-bit `Uint16Array`
 * shape pngjs produces under `skipRescale` is handled explicitly.
 *
 * Byte-typed inputs are wrapped as a zero-copy view; nothing downstream
 * mutates the buffer.
 */
function toRgba(data: unknown, width: number, height: number): Uint8ClampedArray | null {
  const expected = width * height * 4;
  if (data instanceof Uint8ClampedArray) {
    return data.length === expected ? data : null;
  }
  if (data instanceof Uint8Array) {
    // Buffer is a Uint8Array subclass, so this covers pngjs and jpeg-js both.
    if (data.length !== expected) return null;
    return new Uint8ClampedArray(data.buffer, data.byteOffset, expected);
  }
  if (data instanceof Uint16Array) {
    if (data.length !== expected) return null;
    const out = new Uint8ClampedArray(expected);
    for (let i = 0; i < expected; i++) out[i] = data[i] >> 8;
    return out;
  }
  return null;
}

function finish(
  format: ImageFormat,
  width: number,
  height: number,
  data: unknown,
  maxPixels: number,
): DecodeResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return fail("corrupt", `${format}: nonsensical dimensions ${width}x${height}`);
  }
  if (width * height > maxPixels) {
    return fail("too-large", `${width}x${height} exceeds ${maxPixels} pixels`);
  }
  const rgba = toRgba(data, width, height);
  if (rgba === null) {
    return fail("corrupt", `${format}: decoder returned an unexpected pixel layout`);
  }
  const pixels: PixelBuffer = { data: rgba, width, height };
  return { ok: true, pixels, format };
}

function decodePng(bytes: Buffer, maxPixels: number): DecodeResult {
  let png: { width: number; height: number; data: unknown };
  try {
    // No `skipRescale`: we want pngjs's 16-bit -> 8-bit normalisation.
    png = loadPng().sync.read(bytes);
  } catch (err) {
    return fail("corrupt", `png: ${errorText(err)}`);
  }
  return finish("png", png.width, png.height, png.data, maxPixels);
}

function decodeJpeg(bytes: Buffer, maxPixels: number): DecodeResult {
  let raw: { width: number; height: number; data: unknown };
  try {
    raw = loadJpeg().decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      // Truncated or slightly out-of-spec JPEGs are common in the wild; a
      // partial image beats an alt-text box.
      tolerantDecoding: true,
      maxResolutionInMP: Math.max(1, Math.ceil(maxPixels / 1_000_000)),
    });
  } catch (err) {
    const text = errorText(err);
    // jpeg-js signals its own budget trips by throwing; those are "too-large",
    // not "corrupt", and the distinction changes the alt text the user sees.
    const reason: DecodeFailure = /maxResolution|maxMemory|memory|resolution/i.test(text)
      ? "too-large"
      : "corrupt";
    return fail(reason, `jpeg: ${text}`);
  }
  return finish("jpeg", raw.width, raw.height, raw.data, maxPixels);
}

/**
 * Decode an image to an RGBA pixel buffer. Fully synchronous, never throws.
 *
 * PNG and JPEG decode in-process. Every other outcome — missing file, oversize
 * source, unrecognised magic, a format with no bundled decoder, a decoder
 * throw — comes back as `{ ok: false }` for the caller to render as alt text.
 *
 * Budgets are checked against the *declared* header dimensions before the
 * decoder runs, because a 40 KB PNG can inflate to gigabytes of RGBA.
 *
 * @param source Absolute path, or encoded bytes already in memory.
 * @param opts   Optional budget overrides; defaults come from `IMAGE_LIMITS`.
 */
export function decodeImage(source: string | Buffer, opts: DecodeOptions = {}): DecodeResult {
  const maxSourceBytes = opts.maxSourceBytes ?? IMAGE_LIMITS.maxSourceBytes;
  const maxPixels = opts.maxPixels ?? IMAGE_LIMITS.maxPixels;

  try {
    const loaded = loadBytes(source, maxSourceBytes);
    if (!loaded.ok) return loaded.result;
    const bytes = loaded.bytes;

    const format = sniffFormat(bytes);
    if (format === "unknown") {
      const magic = bytes.subarray(0, 8).toString("hex");
      return fail("unsupported-format", `unrecognised magic bytes 0x${magic || "(empty)"}`);
    }

    // Decompression-bomb guard: reject on the declared size, pre-decode.
    const header = parseHeader(bytes);
    if (header !== null && header.width * header.height > maxPixels) {
      return fail("too-large", `${header.width}x${header.height} exceeds ${maxPixels} pixels`);
    }

    switch (format) {
      case "png":
        return decodePng(bytes, maxPixels);
      case "jpeg":
        return decodeJpeg(bytes, maxPixels);
      default:
        return fail(
          "no-decoder",
          `${format} has no synchronous decoder bundled (PNG and JPEG only)`,
        );
    }
  } catch (err) {
    // Belt and braces: this function is contractually incapable of throwing.
    return fail("corrupt", errorText(err));
  }
}
