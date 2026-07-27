/**
 * kitty graphics protocol encoder — Unicode-placeholder variant.
 *
 * Emits real pixels on kitty, Ghostty, WezTerm and Konsole while leaving the
 * frame pipeline completely untouched. Pure and synchronous: strings in,
 * strings out, no I/O, no terminal reads, no state beyond an id counter.
 *
 * WHY PLACEHOLDERS AND NOT DIRECT PLACEMENT
 * A directly-placed image is anchored to the cursor and lives OUTSIDE the text
 * grid. This framework composes each frame as `string[]` and writes it through
 * a per-row differ that erases every changed row with `\x1b[2K`; the spec says
 * text-erase commands must not touch graphics, so a directly-placed image would
 * survive the erase, ignore scrolling, ignore Panel clipping, and hang over the
 * next page forever (report §4.2, "the erase-semantics trap" — `doNavigate`
 * issues no clear and no invalidation at all). Placeholder cells are ORDINARY
 * TEXT: they diff, scroll, clip under `cutToWidth`, centre under `pad`, survive
 * tmux, and vanish with the text that carried them. This is the only pixel
 * protocol that needs zero change to `writeToTerminal`.
 *
 * THE SHAPE OF THE OUTPUT
 *   1. `encodeTransmit` — one APC escape (chunked) carrying the raw pixels and
 *      creating a VIRTUAL placement. Written out of band via `rt.writeOutput`,
 *      never inside `lines: string[]`: base64 in a frame row would be shredded
 *      by `cutToWidth` (report §3.2).
 *   2. `encodePlacement` — `rows` strings of `cols` placeholder cells. These
 *      DO go in the frame, because they measure exactly `cols` columns.
 *   3. `encodeDelete` — frees the image on navigation or cache eviction.
 *
 * TWO PREREQUISITES OUTSIDE THIS FILE
 *   - `charWidth` must return 0 for every entry of the row/column diacritic
 *     table; 18 of the first 48 do not today (report §3.2).
 *   - The image-id foreground colour must be emitted LITERALLY. `fgColorRgb`
 *     routes through `rgbTo256` whenever `colorMode === "256"` — which is set
 *     for an SSH client reporting `xterm-256color` that is really kitty — and
 *     quantizing the colour destroys the id. This file writes the SGR by hand
 *     for exactly that reason.
 */

import type { PixelBuffer } from "./types.js";
import { MAX_PLACEHOLDER_CELLS, diacriticFor } from "./kitty-diacritics.js";

export { MAX_PLACEHOLDER_CELLS } from "./kitty-diacritics.js";

/**
 * U+10EEEE, the placeholder character. One cell wide, in a Private Use plane,
 * a surrogate pair in JS (`𐻮`) but a single codepoint on the wire.
 */
export const PLACEHOLDER_CHAR = "\u{10EEEE}";

/**
 * Largest usable image id.
 *
 * The id travels in the placeholder's 24-bit foreground colour. kitty allows a
 * fourth byte via a THIRD diacritic, but capping at 0xFFFFFF means three bytes
 * always suffice, so every placeholder cell is exactly `PLACEHOLDER + row +
 * column` — no conditional third mark, no branch, no chance of emitting one
 * where the terminal does not expect it.
 */
export const MAX_IMAGE_ID = 0xffffff;

/** Max base64 bytes in a single escape. Fixed by the protocol. */
const CHUNK_BYTES = 4096;

/**
 * Application Programming Command introducer and String Terminator.
 * ST (`\x1b\\`) only — BEL is stripped by the write path's C0 filter (§3.2).
 */
const APC = "\x1b_G";
const ST = "\x1b\\";

/**
 * Literal SGR reset, deliberately NOT the `reset` binding from style/colors.ts.
 * That binding becomes `""` when `colorMode === "none"`, and since the id
 * foreground colour above is emitted unconditionally, a conditional terminator
 * would leak the id colour into the rest of the row.
 */
const SGR_RESET = "\x1b[0m";

/**
 * Id origin. Ids are chosen by the client, not the terminal: letting the
 * terminal allocate requires `I=` plus READING its reply, and report §6.1
 * establishes that unsolicited replies land in the app's stdin and get
 * dispatched as keystrokes. Starting well away from 1 keeps us clear of the
 * low ids other programs on the same terminal hand out first. The value spells
 * "tui" in ASCII (0x74 0x75 0x69), which makes our escapes obvious in a dump.
 */
const ID_ORIGIN = 0x747569;
let idCounter = ID_ORIGIN;

/**
 * Allocate the next image id.
 *
 * Wraps back to the origin at `MAX_IMAGE_ID`, which gives ~9.1M ids before
 * reuse — far beyond any session's cache churn. Re-transmitting onto a LIVE id
 * is unspecified (kitty issue #8701: Ghostty updates, kitty does not), so
 * callers must `encodeDelete` the old id and take a fresh one rather than
 * overwrite in place.
 */
export function nextImageId(): number {
  const id = idCounter;
  idCounter = id >= MAX_IMAGE_ID ? ID_ORIGIN : id + 1;
  return id;
}

/**
 * @internal Test-only: rewind the id counter so encoder tests are
 * deterministic. Not re-exported from the public index.
 */
export function __resetImageIds(): void {
  idCounter = ID_ORIGIN;
}

/** True when a `cols` x `rows` image is addressable by the diacritic table. */
export function canPlaceholder(cols: number, rows: number): boolean {
  return (
    Number.isInteger(cols) && Number.isInteger(rows) &&
    cols >= 1 && rows >= 1 &&
    cols <= MAX_PLACEHOLDER_CELLS && rows <= MAX_PLACEHOLDER_CELLS
  );
}

/**
 * The literal 24-bit SGR carrying image id `id` in the foreground colour.
 *
 * Written by hand rather than through `fgColorRgb`, which quantizes to the
 * 256-colour cube under a capped colour mode and would corrupt the id.
 */
export function imageIdColor(id: number): string {
  return `\x1b[38;2;${(id >>> 16) & 0xff};${(id >>> 8) & 0xff};${id & 0xff}m`;
}

function assertId(id: number): void {
  if (!Number.isInteger(id) || id < 1 || id > MAX_IMAGE_ID) {
    throw new RangeError(`kitty image id ${id} out of range 1..${MAX_IMAGE_ID}`);
  }
}

function assertGeometry(cols: number, rows: number): void {
  if (!canPlaceholder(cols, rows)) {
    throw new RangeError(
      `kitty placeholder geometry ${cols}x${rows} out of range 1..${MAX_PLACEHOLDER_CELLS}`,
    );
  }
}

/**
 * True when every pixel is fully opaque, so the alpha channel can be dropped.
 *
 * Worth the scan: `f=24` is 25% fewer bytes than `f=32` before base64, and the
 * transmission is the only part of this protocol that is expensive over SSH
 * (report §3.5.1). Bails on the first transparent pixel.
 */
function isOpaque(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0xff) return false;
  }
  return true;
}

/** Drop the alpha byte of every pixel, RGBA -> RGB. */
function toRgb(data: Uint8ClampedArray, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount * 3);
  for (let p = 0, s = 0, d = 0; p < pixelCount; p++, s += 4, d += 3) {
    out[d] = data[s]!;
    out[d + 1] = data[s + 1]!;
    out[d + 2] = data[s + 2]!;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  // View, not copy: the pixel buffer is already the largest allocation in the
  // image path and duplicating it here would double peak memory per image.
  return Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)
    .toString("base64");
}

/**
 * Transmit `pixels` as image `id` and create a virtual placement `cols` x
 * `rows` cells in size, ready for `encodePlacement`.
 *
 * Returns every chunk concatenated into one string. Write it through the
 * unfiltered output pipe (`rt.writeOutput`), NOT as a frame row.
 *
 * Control data:
 *   `a=T` transmit and display — with `U=1` the display half creates a VIRTUAL
 *         placement, drawing nothing until placeholder cells appear. The spec
 *         explicitly allows folding the `a=p,U=1` step into `a=T`.
 *   `t=d` direct, base64 in band. The only medium that survives an SSH hop —
 *         `t=f`/`t=t`/`t=s` all name a path in the TERMINAL's filesystem.
 *   `f=24|32` raw RGB / RGBA, so `s` and `v` (source pixel dimensions) are
 *         mandatory; `f=100` (PNG) would let the terminal read them itself but
 *         we hold decoded pixels, not a file.
 *   `q=2` suppress OK *and* error replies. Not cosmetic: any reply is written
 *         to the app's stdin and would be dispatched as keystrokes (§6.1).
 *   `m=1` on every chunk but the last, which carries `m=0`.
 */
export function encodeTransmit(
  id: number,
  pixels: PixelBuffer,
  cols: number,
  rows: number,
): string {
  assertId(id);
  assertGeometry(cols, rows);

  const { data, width, height } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`kitty transmit needs a non-empty image, got ${width}x${height}`);
  }
  const pixelCount = width * height;
  if (data.length !== pixelCount * 4) {
    throw new RangeError(
      `kitty transmit: buffer is ${data.length} bytes, expected ${pixelCount * 4} for ${width}x${height} RGBA`,
    );
  }

  const opaque = isOpaque(data);
  const format = opaque ? 24 : 32;
  const payload = opaque
    ? toRgb(data, pixelCount)
    : new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
  const b64 = toBase64(payload);

  // Chunk on a multiple of 4 (CHUNK_BYTES is 4096) so no non-final chunk ever
  // splits a base64 quantum — the protocol requires that, and a split quantum
  // decodes to garbage on terminals that concatenate before decoding.
  const chunkCount = Math.max(1, Math.ceil(b64.length / CHUNK_BYTES));
  const parts: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const slice = b64.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    const more = i < chunkCount - 1 ? 1 : 0;
    // Control keys go on the FIRST chunk ONLY. Repeating them on a
    // continuation makes kitty treat the chunk as a new command and drop the
    // transfer — the single most common implementation bug in this protocol.
    const control = i === 0
      ? `a=T,U=1,i=${id},f=${format},t=d,s=${width},v=${height},c=${cols},r=${rows},q=2,m=${more}`
      : `m=${more},q=2`;
    parts.push(`${APC}${control};${slice}${ST}`);
  }
  return parts.join("");
}

/**
 * The placeholder cells for image `id`, one string per terminal row.
 *
 * Each row is `imageIdColor(id)` + `cols` copies of `U+10EEEE` carrying the row
 * diacritic then the column diacritic, terminated by a literal SGR reset. Every
 * row measures exactly `cols` display columns.
 *
 * kitty permits ELIDING the column diacritic (and the row diacritic) on a run
 * of cells that continues the previous one, which would shrink a row by ~2/3.
 * The explicit form is emitted anyway: it is self-describing, it round-trips
 * through a decoder cell-for-cell, and elision is only correct while the run is
 * contiguous — which stops being true the moment `cutToWidth` clips a row in
 * the middle. Revisit only with a measured byte problem.
 */
export function encodePlacement(id: number, cols: number, rows: number): string[] {
  assertId(id);
  assertGeometry(cols, rows);

  const fg = imageIdColor(id);
  // Column marks are identical on every row, so look them up once.
  const columnMarks: string[] = new Array(cols);
  for (let c = 0; c < cols; c++) columnMarks[c] = diacriticFor(c);

  const out: string[] = new Array(rows);
  for (let r = 0; r < rows; r++) {
    // Row mark first, then column mark — that order is the wire format.
    const cellPrefix = PLACEHOLDER_CHAR + diacriticFor(r);
    let line = fg;
    for (let c = 0; c < cols; c++) line += cellPrefix + columnMarks[c]!;
    out[r] = line + SGR_RESET;
  }
  return out;
}

/**
 * Delete image `id` and free its pixel data.
 *
 * `d=I` is the UPPERCASE variant: the lowercase `d=i` drops placements but
 * leaves the data in the terminal's store (kitty and Ghostty default to a
 * 320 MB per-buffer quota), so only the uppercase form actually reclaims it.
 * Call on navigation and on cache eviction.
 */
export function encodeDelete(id: number): string {
  assertId(id);
  return `${APC}a=d,d=I,i=${id},q=2${ST}`;
}
