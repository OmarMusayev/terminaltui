/**
 * Pure-TypeScript animated GIF decoder. Zero dependencies, fully synchronous.
 *
 * This module exists so animation works on machines with no ffmpeg: stills
 * already decode in-process (decode.ts), and GIF is the one animated format
 * small enough to decode correctly by hand. Everything on npm that handles
 * animated GIF either pulls in native code, ships a WASM blob, or gets the
 * LZW edge cases wrong — and the render pass this feeds is synchronous by
 * design, so an async decoder would be unusable anyway.
 *
 * The failure contract mirrors decode.ts for the same load-bearing reason:
 * bytes arrive from a user's disk or the network, and a throw here would take
 * down the whole render loop for one bad byte. Every malformed, truncated or
 * oversized input comes back as `{ ok: false, reason }`; the entry points
 * carry a belt-and-braces try/catch exactly like decodeImage().
 *
 * Frames are emitted as FULL canvas snapshots, already composited per the
 * disposal chain — never the raw sub-rect. A GIF frame is usually a small
 * dirty rectangle over the previous frame (both fixture GIFs in this repo are
 * encoded that way), so a consumer handed sub-rects would have to reimplement
 * disposal itself, and disposal is precisely the part everyone gets wrong.
 * The cost is frames*width*height*4 bytes of output. IMAGE_LIMITS.maxPixels
 * bounds every pixel buffer the decode holds — the persistent canvas, each
 * emitted snapshot, and each frame's LZW output, whose rect is independent of
 * the canvas — so peak memory tracks the limit instead of a multiple of it,
 * and a frame rect far larger than its canvas cannot smuggle unbounded LZW
 * work past a canvas-sized accumulator.
 *
 * Strictness decisions, chosen over browser leniency on purpose:
 *   - Input that ends before the trailer byte fails, even if whole frames
 *     decoded first. Browsers render truncated GIFs progressively; a TUI has
 *     no progressive path, and "half the animation, silently" is a worse
 *     outcome for a config-driven page than a visible alt box.
 *   - LZW data that runs dry before filling its frame fails rather than
 *     leaving a partial rect.
 * Leniencies kept, because real encoders ship them: stray 0x00 padding bytes
 * between blocks are skipped, a missing END code is fine once every pixel is
 * produced, and disposal 4 is read as "restore previous" (Netscape's original
 * documentation was off by one and encoders copied it; Chromium does the
 * same).
 */

import { IMAGE_LIMITS } from "./types.js";
import type { PixelBuffer } from "./types.js";

export interface GifFrame {
  /** Full canvas, RGBA, composited per disposal — never the frame's sub-rect. */
  pixels: PixelBuffer;
  /** Normalised milliseconds; see normalizeGifDelayMs. */
  delayMs: number;
}

export interface GifImage {
  width: number;
  height: number;
  frames: GifFrame[];
  /** NETSCAPE2.0 iteration count. 0 means loop forever, and is the default. */
  loopCount: number;
}

export type GifDecodeResult =
  | { ok: true; gif: GifImage }
  | { ok: false; reason: string };

// ─── Format constants ─────────────────────────────────────
// Block introducers and labels from the GIF89a specification (sections 20-26).

const EXTENSION = 0x21;
const IMAGE_SEPARATOR = 0x2c;
const TRAILER = 0x3b;
const GRAPHIC_CONTROL_LABEL = 0xf9;
const APPLICATION_LABEL = 0xff;

/** LZW codes are at most 12 bits (spec appendix F), so 2^12 table entries. */
const MAX_CODES = 4096;

/**
 * Normalise a Graphic Control Extension delay (centiseconds) to milliseconds.
 *
 * Real-world GIFs encode 0 — and, less often, 1 — to mean "as fast as
 * possible", a relic of early Netscape animating at whatever speed the
 * machine managed. Honouring the literal value would spin the scheduler at
 * hundreds of frames per second, so every modern browser clamps both to
 * 10 cs, and any player that doesn't will render those GIFs visibly wrong
 * relative to what their authors saw. Same clamp here: <= 1 cs becomes
 * 100 ms.
 */
export function normalizeGifDelayMs(delayCs: number): number {
  return delayCs <= 1 ? 100 : delayCs * 10;
}

// ─── LZW ──────────────────────────────────────────────────

type LzwResult = { ok: true; indices: Uint8Array } | { ok: false; reason: string };

/**
 * Decode a GIF LZW stream (sub-blocks already concatenated) into exactly
 * `npix` palette indices.
 *
 * Codes are packed LSB-first. The width starts at minCodeSize+1 and grows to
 * at most 12 bits; growth happens when the table reaches the current code
 * space, which the decoder tracks one step BEHIND the encoder — that lag is
 * why a valid stream may contain a code equal to the next free slot (the
 * KwKwK case: the string is oldCode's expansion plus its own first byte).
 * Most encoders rarely emit it, so a decoder that omits the branch still
 * plays most GIFs — right up until one that doesn't.
 *
 * A CLEAR code resets table and width mid-stream; once the table saturates at
 * 4096 the encoder may simply keep using it without clearing ("deferred
 * clear"), so saturation is not an error, it just stops growth.
 */
function lzwDecode(src: Uint8Array, minCodeSize: number, npix: number): LzwResult {
  // Spec range is 2..8, but 1 appears in the wild for bicolour images (an
  // initial code width of 2), and 11 is the largest value whose initial
  // width still fits the 12-bit ceiling.
  if (minCodeSize < 1 || minCodeSize > 11) {
    return { ok: false, reason: `lzw: minimum code size ${minCodeSize} outside 1..11` };
  }

  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;

  const prefix = new Uint16Array(MAX_CODES);
  const suffix = new Uint8Array(MAX_CODES);
  // A chain can never be longer than the table, so one table-sized stack
  // suffices and the expansion loop needs no bounds check.
  const stack = new Uint8Array(MAX_CODES);
  const indices = new Uint8Array(npix);

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let available = endCode + 1;
  let oldCode = -1;
  let first = 0;
  let datum = 0;
  let bits = 0;
  let op = 0;
  let sp = 0;

  for (let i = 0; i < src.length && op < npix; i++) {
    datum |= src[i] << bits;
    bits += 8;

    while (bits >= codeSize) {
      const code = datum & codeMask;
      datum >>= codeSize;
      bits -= codeSize;

      if (code === clearCode) {
        codeSize = minCodeSize + 1;
        codeMask = (1 << codeSize) - 1;
        available = endCode + 1;
        oldCode = -1;
        continue;
      }
      if (code === endCode) {
        return op === npix
          ? { ok: true, indices }
          : { ok: false, reason: `lzw: end code after ${op} of ${npix} pixels` };
      }

      if (oldCode === -1) {
        // The first code after a clear names a single literal; anything else
        // would reference a table entry that cannot exist yet.
        if (code >= clearCode) {
          return { ok: false, reason: "lzw: first code after clear is not a literal" };
        }
        indices[op++] = code;
        oldCode = code;
        first = code;
        continue;
      }

      const inCode = code;
      let cur = code;
      if (cur === available) {
        // KwKwK: the encoder is one table entry ahead of us, and this code IS
        // that entry — oldCode's string followed by its own first byte.
        // Pushed before the chain walk so it pops last, i.e. lands at the end.
        stack[sp++] = first;
        cur = oldCode;
      } else if (cur > available) {
        return { ok: false, reason: `lzw: code ${cur} references beyond table size ${available}` };
      }

      // Expand the chain. Prefix links strictly decrease, so this terminates,
      // and roots sit below clearCode while clear/end never enter the table.
      while (cur > endCode) {
        stack[sp++] = suffix[cur];
        cur = prefix[cur];
      }
      first = cur;
      stack[sp++] = cur;

      if (available < MAX_CODES) {
        prefix[available] = oldCode;
        suffix[available] = first;
        available++;
        // The next code is read one bit wider once the table fills the
        // current code space. 12 is the spec's hard width ceiling.
        if (available > codeMask && codeSize < 12) {
          codeSize++;
          codeMask = (1 << codeSize) - 1;
        }
      }
      oldCode = inCode;

      while (sp > 0) {
        const value = stack[--sp];
        if (op < npix) indices[op++] = value;
      }
      if (op >= npix) break;
    }
  }

  return op === npix
    ? { ok: true, indices }
    : { ok: false, reason: `lzw: data exhausted after ${op} of ${npix} pixels` };
}

// ─── Interlacing ──────────────────────────────────────────

/**
 * Map sequential decoded rows to their canvas rows for an interlaced frame.
 * Four passes (spec appendix E): every 8th row from 0, every 8th from 4,
 * every 4th from 2, every 2nd from 1.
 */
function interlaceRows(h: number): Int32Array {
  const rows = new Int32Array(h);
  let i = 0;
  for (let y = 0; y < h; y += 8) rows[i++] = y;
  for (let y = 4; y < h; y += 8) rows[i++] = y;
  for (let y = 2; y < h; y += 4) rows[i++] = y;
  for (let y = 1; y < h; y += 2) rows[i++] = y;
  return rows;
}

// ─── Parser ───────────────────────────────────────────────

interface GraphicControl {
  disposal: number;
  delayCs: number;
  /** Palette index treated as transparent, or -1 when the flag is unset. */
  transparentIndex: number;
}

function failWith(reason: string): GifDecodeResult {
  return { ok: false, reason };
}

function decodeInternal(bytes: Uint8Array, firstFrameOnly: boolean): GifDecodeResult {
  const len = bytes.length;

  // Header (6 bytes) + logical screen descriptor (7 bytes).
  if (len < 13) return failWith(`header truncated: ${len} bytes`);
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x38) {
    return failWith("not a GIF: missing GIF8 signature");
  }
  // "7a" or "9a" — anything else is a container we have no business guessing at.
  if ((bytes[4] !== 0x37 && bytes[4] !== 0x39) || bytes[5] !== 0x61) {
    return failWith(`unknown GIF version ${String.fromCharCode(bytes[4], bytes[5])}`);
  }

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  if (width === 0 || height === 0) return failWith(`degenerate canvas ${width}x${height}`);
  if (width * height > IMAGE_LIMITS.maxPixels) {
    return failWith(`canvas ${width}x${height} exceeds ${IMAGE_LIMITS.maxPixels} pixels`);
  }

  const lsdPacked = bytes[10];
  const backgroundIndex = bytes[11];
  // bytes[12] is the pixel aspect ratio; nothing has honoured it in decades.

  let pos = 13;
  let globalTable: Uint8Array | null = null;
  if (lsdPacked & 0x80) {
    const entries = 2 << (lsdPacked & 0x07);
    const end = pos + entries * 3;
    if (end > len) return failWith("global colour table truncated");
    globalTable = bytes.subarray(pos, end);
    pos = end;
  }

  // The persistent canvas every frame composites onto. Starts fully
  // transparent: pixels no frame ever paints stay invisible, and the
  // downstream renderer composites them over the theme background.
  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames: GifFrame[] = [];
  let loopCount = 0;
  let gce: GraphicControl | null = null;
  let sawTrailer = false;
  // Every buffer the decode holds is charged against IMAGE_LIMITS.maxPixels,
  // starting with the canvas itself. Each emitted frame then charges the
  // LARGER of the canvas (its snapshot) and its rect (its LZW output): the
  // two are independent axes — a 1x1 canvas can carry an 8192x8192 rect — so
  // charging only one leaves the other unbounded, which is how a 16 MiB file
  // of full-budget rects once decoded 41 billion pixels while the accumulator
  // sat at 614. Charging the canvas up front also means a canvas that IS the
  // whole budget can never emit a frame, keeping peak memory (canvas +
  // snapshots + LZW indices) at the limit instead of 3x it.
  let totalPixels = width * height;

  /** Walk length-prefixed sub-blocks to past the 0x00 terminator, or -1 if truncated. */
  const skipSubBlocks = (p: number): number => {
    while (p < len) {
      const size = bytes[p++];
      if (size === 0) return p;
      p += size;
    }
    return -1;
  };

  while (pos < len) {
    const block = bytes[pos++];

    if (block === TRAILER) {
      sawTrailer = true;
      break;
    }

    // Sloppy encoders pad with stray zero bytes between blocks; browsers skip
    // them, and failing here would reject files that render everywhere else.
    if (block === 0x00) continue;

    if (block === EXTENSION) {
      if (pos >= len) return failWith("extension introducer at end of data");
      const label = bytes[pos++];

      if (label === GRAPHIC_CONTROL_LABEL) {
        // Fixed layout: size (4), packed, delay lo, delay hi, transparent index.
        if (pos + 5 > len) return failWith("graphic control extension truncated");
        if (bytes[pos] >= 4) {
          const packed = bytes[pos + 1];
          let disposal = (packed >> 2) & 0x07;
          // 4 means "restore previous" to a family of encoders that copied
          // Netscape's off-by-one documentation; Chromium reads it the same
          // way. 5..7 are undefined, treated as unspecified.
          if (disposal === 4) disposal = 3;
          else if (disposal > 4) disposal = 0;
          gce = {
            disposal,
            delayCs: bytes[pos + 2] | (bytes[pos + 3] << 8),
            transparentIndex: (packed & 0x01) !== 0 ? bytes[pos + 4] : -1,
          };
        }
        const next = skipSubBlocks(pos);
        if (next < 0) return failWith("graphic control extension truncated");
        pos = next;
        continue;
      }

      if (label === APPLICATION_LABEL) {
        // 11-byte identifier sub-block, then data sub-blocks. The only one
        // that matters is the loop count; ANIMEXTS1.0 is NETSCAPE2.0 under a
        // different registration and uses the identical payload.
        if (pos + 12 <= len && bytes[pos] === 11) {
          let id = "";
          for (let i = 0; i < 11; i++) id += String.fromCharCode(bytes[pos + 1 + i]);
          if (id === "NETSCAPE2.0" || id === "ANIMEXTS1.0") {
            const dp = pos + 12;
            // Data sub-block: length 3, sub-id 1, uint16le iteration count.
            // 0 iterations means loop forever, which is also our default.
            if (dp + 4 <= len && bytes[dp] === 3 && bytes[dp + 1] === 1) {
              loopCount = bytes[dp + 2] | (bytes[dp + 3] << 8);
            }
          }
        }
        const next = skipSubBlocks(pos);
        if (next < 0) return failWith("application extension truncated");
        pos = next;
        continue;
      }

      // Comment (0xFE), plain text (0x01), anything registered later: opaque
      // sub-blocks with nothing the canvas needs.
      const next = skipSubBlocks(pos);
      if (next < 0) return failWith(`extension 0x${label.toString(16)} truncated`);
      pos = next;
      continue;
    }

    if (block !== IMAGE_SEPARATOR) {
      return failWith(`unknown block 0x${block.toString(16)} at offset ${pos - 1}`);
    }

    // ── Image descriptor ────────────────────────────────
    if (pos + 9 > len) return failWith("image descriptor truncated");
    const left = bytes[pos] | (bytes[pos + 1] << 8);
    const top = bytes[pos + 2] | (bytes[pos + 3] << 8);
    const fw = bytes[pos + 4] | (bytes[pos + 5] << 8);
    const fh = bytes[pos + 6] | (bytes[pos + 7] << 8);
    const idPacked = bytes[pos + 8];
    pos += 9;

    if (fw === 0 || fh === 0) return failWith(`degenerate frame rect ${fw}x${fh}`);
    if (fw * fh > IMAGE_LIMITS.maxPixels) {
      return failWith(`frame ${fw}x${fh} exceeds ${IMAGE_LIMITS.maxPixels} pixels`);
    }

    let table = globalTable;
    if (idPacked & 0x80) {
      const entries = 2 << (idPacked & 0x07);
      const end = pos + entries * 3;
      if (end > len) return failWith("local colour table truncated");
      table = bytes.subarray(pos, end);
      pos = end;
    }
    if (table === null) {
      return failWith(`frame ${frames.length} has neither a local nor a global colour table`);
    }

    if (pos >= len) return failWith("LZW minimum code size missing");
    const minCodeSize = bytes[pos++];

    // Concatenate the data sub-blocks: the LZW bit stream runs straight
    // across sub-block boundaries, so the block structure is pure framing.
    // First pass validates and measures, second copies.
    let dataLen = 0;
    let scan = pos;
    for (;;) {
      if (scan >= len) return failWith(`frame ${frames.length} image data truncated`);
      const size = bytes[scan++];
      if (size === 0) break;
      dataLen += size;
      scan += size;
      if (scan > len) return failWith(`frame ${frames.length} image data truncated`);
    }
    const data = new Uint8Array(dataLen);
    let out = 0;
    for (let p = pos; ; ) {
      const size = bytes[p++];
      if (size === 0) break;
      data.set(bytes.subarray(p, p + size), out);
      out += size;
      p += size;
    }
    pos = scan;

    // Charged and checked BEFORE lzwDecode allocates or fills anything, so a
    // frame that would bust the budget costs nothing. A disposal-3 frame also
    // holds a canvas-sized restore copy while it composites; that copy is
    // transient — freed before the next frame — so it joins the check but not
    // the running total.
    totalPixels += Math.max(width * height, fw * fh);
    const transientPixels = gce !== null && gce.disposal === 3 ? width * height : 0;
    if (totalPixels + transientPixels > IMAGE_LIMITS.maxPixels) {
      return failWith(
        `frame ${frames.length} takes the decode past ${IMAGE_LIMITS.maxPixels} total pixels ` +
          `(canvas ${width}x${height}, rect ${fw}x${fh})`,
      );
    }

    const lzw = lzwDecode(data, minCodeSize, fw * fh);
    if (!lzw.ok) return failWith(`frame ${frames.length}: ${lzw.reason}`);
    const indices = lzw.indices;

    const disposal = gce !== null ? gce.disposal : 0;
    const transparent = gce !== null ? gce.transparentIndex : -1;

    // Disposal 3 restores the canvas as it was BEFORE this frame drew, so the
    // snapshot happens here — and only for disposal 3, because copying every
    // frame would double the decode's memory traffic for nothing.
    const saved = disposal === 3 ? canvas.slice() : null;

    // ── Composite the sub-rect onto the persistent canvas ──
    const rowMap = (idPacked & 0x40) !== 0 ? interlaceRows(fh) : null;
    const tableEntries = table.length / 3;
    for (let r = 0; r < fh; r++) {
      const y = top + (rowMap !== null ? rowMap[r] : r);
      // Encoders exist that write rects past the canvas edge; clip like every
      // renderer does rather than reject.
      if (y >= height) continue;
      const srcRow = r * fw;
      for (let c = 0; c < fw; c++) {
        const x = left + c;
        if (x >= width) break;
        const idx = indices[srcRow + c];
        if (idx === transparent) continue;
        // An index past the palette is undefined; leaving the canvas pixel
        // (i.e. treating it as transparent) is the least-wrong rendering.
        if (idx >= tableEntries) continue;
        const t = idx * 3;
        const d = (y * width + x) * 4;
        canvas[d] = table[t];
        canvas[d + 1] = table[t + 1];
        canvas[d + 2] = table[t + 2];
        canvas[d + 3] = 255;
      }
    }

    frames.push({
      pixels: { data: canvas.slice(), width, height },
      delayMs: normalizeGifDelayMs(gce !== null ? gce.delayCs : 0),
    });

    if (firstFrameOnly) {
      return { ok: true, gif: { width, height, frames, loopCount } };
    }

    // ── Apply this frame's disposal, ready for the next ──
    if (disposal === 2) {
      // Restore-to-background. ffmpeg's decoder — the ground truth this
      // module is verified against, and the other half of this repo's video
      // path — fills with the global background colour, falling back to
      // transparent when the frame declared transparency. Browsers always
      // clear to transparent instead; the divergence only shows for the rare
      // opaque-background disposal-2 GIF, where following ffmpeg keeps our
      // two animation paths pixel-identical.
      const opaque =
        transparent < 0 && globalTable !== null && backgroundIndex < globalTable.length / 3;
      const bt = backgroundIndex * 3;
      const br = opaque ? globalTable![bt] : 0;
      const bg = opaque ? globalTable![bt + 1] : 0;
      const bb = opaque ? globalTable![bt + 2] : 0;
      const ba = opaque ? 255 : 0;
      const yEnd = Math.min(top + fh, height);
      const xEnd = Math.min(left + fw, width);
      for (let y = top; y < yEnd; y++) {
        for (let x = left; x < xEnd; x++) {
          const d = (y * width + x) * 4;
          canvas[d] = br;
          canvas[d + 1] = bg;
          canvas[d + 2] = bb;
          canvas[d + 3] = ba;
        }
      }
    } else if (disposal === 3 && saved !== null) {
      canvas.set(saved);
    }
    // Disposal 0 (unspecified) and 1 (leave in place): the canvas stands.

    gce = null; // a GCE governs exactly the one image that follows it
  }

  // The trailer is required even after complete frames: end-of-data without
  // it means the file was cut, and "half the animation, silently" is the
  // failure mode this module exists to avoid.
  if (!sawTrailer) return failWith("data ended before trailer");
  if (frames.length === 0) return failWith("no image data before trailer");

  return { ok: true, gif: { width, height, frames, loopCount } };
}

// ─── Entry points ─────────────────────────────────────────

/**
 * Decode a complete animated GIF. Fully synchronous, never throws.
 *
 * Frames come back as full composited canvases with normalised delays.
 * IMAGE_LIMITS.maxPixels bounds the total decoded size — working canvas,
 * frame snapshots and per-frame LZW output together — across all frames.
 */
export function decodeGif(bytes: Uint8Array): GifDecodeResult {
  try {
    return decodeInternal(bytes, false);
  } catch (err) {
    // Belt and braces, same as decodeImage(): contractually incapable of throwing.
    return failWith(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Decode only the first frame — the cheap path for thumbnails and for a
 * static fallback when animation is off. Parsing stops the moment frame 0 is
 * composited, so a 1000-frame GIF costs one frame's LZW work — and that one
 * frame is budget-checked before its LZW runs, so a rect that dwarfs its
 * canvas fails outright instead of decoding the full pixel budget to produce
 * a thumbnail. Because frame 0 composites onto a fresh canvas its pixels are
 * byte-identical to `frames[0]` of the full decode.
 */
export function decodeGifFirstFrame(bytes: Uint8Array): PixelBuffer | null {
  try {
    const result = decodeInternal(bytes, true);
    return result.ok && result.gif.frames.length > 0 ? result.gif.frames[0].pixels : null;
  } catch {
    return null;
  }
}
