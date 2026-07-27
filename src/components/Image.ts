/**
 * Image block renderer — the integration point where the cell engine under
 * `src/image/` becomes visible on screen.
 *
 * Everything here is SYNCHRONOUS. `renderImage()` runs inside the render pass
 * and never awaits: header probing, decoding, resampling, dithering and ANSI
 * emission are all sync, and both cache levels are plain Maps. The report
 * measured a from-scratch decode of a 1600x1000 PNG at 27 ms and a full
 * uncached frame at 52 ms; the L2 cache turns every subsequent frame into one
 * `Map.get`, which is what makes this affordable at 60 fps.
 *
 * Two invariants hold across every code path and are the reason the file is
 * shaped the way it is:
 *
 *  1. **Row count is fixed by the header, not by success.** Loading, loaded,
 *     decode-failure, unsupported-format and resolve-failure all emit exactly
 *     `geometry.blockRows` rows. Layout must not shift when pixels arrive or
 *     fail to, or every `FocusRect` below the image moves and the arrow keys
 *     misroute (report §3.3).
 *  2. **It never throws.** A malformed image is a content bug, not a reason to
 *     kill a frame, so the whole body is wrapped and any escape lands in the
 *     alt-text box.
 *
 * THE KITTY PIXEL PATH sits on top of that without disturbing either invariant.
 * It returns the SAME number of rows as the cell tiers would (the placeholder
 * grid is `geom.rows` strings of `geom.cols` display columns), and every way it
 * can fail — an unreachable runtime, an image too wide for the diacritic table,
 * a decode error — falls back to the cell ladder rather than throwing or
 * emitting a short block. What it cannot do from inside a synchronous render is
 * write its own megabyte of base64: `renderBlock()` composes `string[]` and
 * `cutToWidth` would shred that payload at the first `m`. So the transmission
 * is HANDED TO THE RUNTIME through `graphicsPlace()` and written after the
 * frame, through the unfiltered pipe. See `setGraphicsSink()`.
 */

import type { RenderContext } from "./base.js";
import type { ImageBlock } from "../config/types.js";
import type { BorderStyle } from "../style/borders.js";
import type { Theme } from "../style/theme.js";
import type {
  ImageAlign,
  ImageHeader,
  ImageMode,
  ImageRenderOptions,
  ImageTier,
  PixelBuffer,
  RGB,
  SubCellGrid,
} from "../image/types.js";

import {
  imageCellSize as computeCellSize,
  subCellGridSize,
  type ImageCropRect,
  type ImageGeometry,
} from "../image/geometry.js";
import { KITTY_TIER, deriveCapabilities, selectTier, type RenderTier } from "../image/tier.js";
import { decodeImage, readHeader } from "../image/decode.js";
import { resampleToGrid } from "../image/resample.js";
import { ditherGrid, resolveDither } from "../image/dither.js";
import { renderAltBox, renderCells } from "../image/render.js";
import {
  imageSourceOf,
  resolveImagePath,
  type ResolvedImage,
  type ResolvedImageOk,
} from "../image/resolve.js";
import {
  cloneGrid,
  deleteKittyImage,
  getKittyImage,
  getPixelGrid,
  getSerialRows,
  imageIdentity,
  isContentIdentity,
  pixelCacheKey,
  serialCacheKey,
  setKittyImage,
  setPixelGrid,
  setSerialRows,
} from "../image/cache.js";
import { getGraphicsCapability } from "../image/capability.js";
import { canPlaceholder, encodePlacement, encodeTransmit, nextImageId } from "../image/kitty.js";

import { fgColor, getColorMode, hexToRgb, reset } from "../style/colors.js";
import { getBorderChars } from "../style/borders.js";
import { detectTerminal } from "../helpers/detect-terminal.js";

// ─── Project root ─────────────────────────────────────────

/**
 * Fallback root for relative image paths.
 *
 * Both real callers now pass their root EXPLICITLY — `renderImage` gets it from
 * `runtime-block-render.ts` and the layout estimator gets it through
 * `computeFocusPositions(..., projectDirOf(rt))`. That is what makes two
 * `TUIRuntime`s for different projects in one process (ssh-server.ts permits up
 * to 100) resolve their own assets instead of fighting over one variable.
 *
 * This remains only for the public `imageCellSize()` called with no root at all,
 * and for the very first layout pass before a runtime exists. With neither, both
 * sides fall back to `process.cwd()` — which they also agree on.
 */
let lastProjectDir: string | undefined;

/**
 * Set the root relative image paths resolve against.
 *
 * Call this once at startup (from the runtime, as soon as the project
 * directory is known) so the very first layout pass sizes images against the
 * same root the renderer will use. Passing `undefined` is a no-op rather than a
 * clear, because a page rendered without a root must not erase a root a
 * file-based project already established.
 */
export function setImageProjectDir(dir: string | undefined): void {
  if (typeof dir === "string" && dir.length > 0) lastProjectDir = dir;
}

// ─── Graphics sink ────────────────────────────────────────

/**
 * The half of the kitty path that the renderer cannot do itself: getting a
 * megabyte of base64 to the terminal.
 *
 * Implemented by `TUIRuntime`. Everything about it is arranged so that
 * `renderBlock()` stays synchronous and side-effect-light — the call records an
 * intent, allocates nothing, and returns immediately; the runtime decides
 * whether the payload is actually owed (it is not, on any frame after the
 * first) and writes it through `writeOutput()` AFTER the frame lands.
 */
export interface GraphicsSink {
  /**
   * Declare that image `id` appears in the frame currently being composed.
   *
   * @param id The kitty image id carried by the placement rows.
   * @param transmit Builds the complete transmission for that id. A THUNK, not
   *   a string: the runtime invokes it only when this terminal has not already
   *   received the image, so a steady-state frame never builds the megabyte of
   *   base64 at all. That is what makes "transmit exactly once per (image,
   *   size, terminal)" a property of the runtime rather than a rule every
   *   caller has to remember, and it is why the payload is never resident in
   *   any cache. It may throw; the runtime records the id as dead and this
   *   method returns false on every later frame.
   * @returns True when the pixel path is still viable for this id. FALSE means
   *   the transmission has already been attempted and failed, so the caller
   *   MUST demote to the cell tiers — placement cells addressing pixels that
   *   will never arrive are a permanent rectangle of tofu, which is the one
   *   thing `renderBody`'s "every kitty failure is a demotion" promise forbids.
   */
  graphicsPlace(id: number, transmit: () => string): boolean;
}

/**
 * The runtime currently rendering, or null outside a render.
 *
 * A module-level slot swapped around a SYNCHRONOUS render, exactly like
 * `setColorMode()` in style/colors.ts and for the same reason: `renderImage()`
 * is reached through `renderBlock()`, whose signature is fixed by
 * runtime-block-render.ts, so there is no parameter to thread a runtime
 * through. AsyncLocalStorage (`currentRuntime()`) was the alternative and is
 * strictly worse here — the whole render pass is synchronous, so a
 * set/restore pair is exact, whereas the ALS store is empty whenever `render()`
 * is called from outside the chain `start()` forked (unit tests, embedders).
 *
 * Null is a supported state: it means "cells", never a crash.
 */
let graphicsSink: GraphicsSink | null = null;

/**
 * Install the sink for one render pass and return the previous one.
 *
 * Callers MUST restore in a `finally`, or a runtime that threw mid-frame would
 * keep receiving another session's placements.
 */
export function setGraphicsSink(sink: GraphicsSink | null): GraphicsSink | null {
  const prev = graphicsSink;
  graphicsSink = sink;
  return prev;
}

/**
 * The client's pty-req TERM for the session being rendered; undefined for a
 * local run, where `process.env.TERM` is authoritative.
 *
 * Same module-level session slot as `graphicsSink` and `setColorMode()`, and
 * swapped by the runtime in the same place, for the same reason: `renderBlock`'s
 * signature is fixed and the whole pass is synchronous.
 */
let sessionTermType: string | undefined;

/**
 * Publish the terminal identity the next render pass belongs to, returning the
 * previous value so the caller can restore it in a `finally`.
 *
 * Without this the cell ladder negotiated every SSH client against the SERVER's
 * environment: `deriveCapabilities()` takes a `termType` precisely so a remote
 * session stops consulting the daemon's `TERM`/`TMUX`/`STY`, and production
 * never passed it, so report §7.4's "unrecognised remote TERM falls back to
 * half blocks" rule could not fire and a server running under tmux made every
 * client conservative.
 */
export function setImageTermType(termType: string | undefined): string | undefined {
  const prev = sessionTermType;
  sessionTermType = termType;
  return prev;
}

// ─── Kitty pixel geometry ─────────────────────────────────

/**
 * Pixels sampled per terminal cell for the kitty tier.
 *
 * The terminal scales our buffer to the `c` x `r` cell box we ask for, so this
 * only decides how much detail is available to that scaler. 10x20 is the
 * report's §6 "Step 3" fallback for cell pixel size, and matching it makes the
 * transmitted buffer roughly 1:1 with the physical cells on a typical display —
 * enough that no upscaling blur appears, without paying for detail the terminal
 * will immediately throw away.
 *
 * This is also what makes a resizable image frame IMPROVE as it grows: the cell
 * count rises, so the sampled resolution rises with it, at constant quality per
 * cell. The cell tiers get the same property for free from their sub-cell
 * factor; this is the pixel path's version of it.
 */
const KITTY_CELL_PX = { w: 10, h: 20 } as const;

/**
 * Ceiling on transmitted pixels, before base64.
 *
 * Transmission is the one genuinely expensive part of this protocol (report
 * §3.5.1) and it is paid over the SSH channel in serve mode. 1.2M pixels is
 * ~3.6 MB of RGB and ~4.8 MB on the wire — already a lot, and it takes a
 * 99-column image 60 rows tall to reach it. Beyond that the sampling factor is
 * scaled down uniformly rather than the image being refused, because a slightly
 * softer picture is a far better failure than no picture.
 */
const KITTY_MAX_PIXELS = 1_200_000;

/**
 * Source-buffer size for a `cols` x `rows` kitty placement.
 *
 * Never returns fewer samples than cells: at the clamp, one pixel per cell is
 * still a valid (if pointless) image, and a zero would make `encodeTransmit`
 * throw inside a render.
 */
function kittyPixelSize(cols: number, rows: number): { width: number; height: number } {
  let width = cols * KITTY_CELL_PX.w;
  let height = rows * KITTY_CELL_PX.h;
  const total = width * height;
  if (total > KITTY_MAX_PIXELS) {
    const scale = Math.sqrt(KITTY_MAX_PIXELS / total);
    width = Math.max(cols, Math.floor(width * scale));
    height = Math.max(rows, Math.floor(height * scale));
  }
  return { width, height };
}

// ─── Header memo ──────────────────────────────────────────

/**
 * Headers keyed by source identity.
 *
 * `readHeader()` is deliberately un-memoised in decode.ts (0.01 ms, but it is
 * still an `openSync`/`readSync` pair) and the report assigns the memo to the
 * caller. The key carries `(path, mtimeMs, size)` from `imageIdentity()`, whose
 * own 1000 ms stat throttle is what keeps this from syscalling per frame; an
 * edited file re-keys itself with no invalidation logic anywhere.
 */
const HEADER_MEMO = new Map<string, ImageHeader | null>();
const HEADER_MEMO_CAP = 256;

function headerFor(resolved: ResolvedImageOk): ImageHeader | null {
  const id = imageIdentity(resolved.path);
  const key = isContentIdentity(id.path) ? id.path : `${id.path}:${id.mtimeMs}:${id.size}`;
  const hit = HEADER_MEMO.get(key);
  if (hit !== undefined) return hit;

  let header: ImageHeader | null = null;
  try {
    header = readHeader(imageSourceOf(resolved));
  } catch {
    // readHeader is documented never to throw; treat any surprise as "unknown
    // dimensions" so the block still reserves a deterministic box.
    header = null;
  }

  if (HEADER_MEMO.size >= HEADER_MEMO_CAP) {
    const oldest = HEADER_MEMO.keys().next().value;
    if (oldest !== undefined) HEADER_MEMO.delete(oldest);
  }
  HEADER_MEMO.set(key, header);
  return header;
}

/** Drop the memoised headers. Tests that rewrite a fixture in place need this. */
export function clearImageHeaderCache(): void {
  HEADER_MEMO.clear();
}

// ─── Options ──────────────────────────────────────────────

/**
 * Translate a block into the engine's option shape.
 *
 * `mode: "blocks"` is the published legacy spelling of the half-block tier and
 * is mapped rather than dropped — it is API, and a page that used it must keep
 * rendering. `"ascii"` and `"braille"` were already tier names and pass through
 * untouched.
 */
function optionsOf(block: ImageBlock): ImageRenderOptions {
  return {
    width: block.width,
    height: block.height,
    maxHeight: block.maxHeight,
    fit: block.fit,
    align: block.align,
    mode: normalizeMode(block.mode),
    dither: block.dither,
    alt: block.alt,
    background: block.background,
    invert: block.invert,
    charset: block.charset,
    border: block.border,
  };
}

/**
 * Glyph set for this block's frame AND for its alt box.
 *
 * One function so the two can never disagree: the alt box used to hardcode
 * "rounded" while the frame honoured the site style, so a block's border flipped
 * shape the moment its asset went missing.
 */
function borderStyleOf(opts: ImageRenderOptions, ctx: RenderContext): BorderStyle {
  if (typeof opts.border === "string" && opts.border !== "none") return opts.border;
  return (ctx.borderStyle as BorderStyle | undefined) ?? "rounded";
}

function normalizeMode(mode: ImageBlock["mode"]): ImageMode | undefined {
  if (mode === undefined) return undefined;
  return mode === "blocks" ? "half" : mode;
}

// ─── Geometry (shared with the layout estimator) ───────────

/**
 * Size an image block in terminal cells, resolving and probing its source.
 *
 * This is the public wrapper the design report's §7.3 advertises, and the
 * single function both `renderImage()` and `flex-engine.ts`'s height estimator
 * call — so the estimator and the renderer agree by construction rather than by
 * a hardcoded constant that drifted (the old `case "image": return 10;` was
 * short by five rows at a 99-column content width).
 *
 * `cols`/`rows` are the image area; `blockCols`/`blockRows` include the optional
 * frame border and are what layout must reserve.
 *
 * @param block The image block.
 * @param availWidth Cells available to the whole block horizontally.
 * @param availHeight Cells available vertically — a Panel's inner height, i.e.
 *   exactly `ctx.panelHeight`. It is HONOURED (geometry turns it into a row
 *   cap), so `flex-engine.ts` must pass the same value the renderer will see or
 *   the estimate is too tall inside any panel.
 * @param projectDir Root for relative paths. Defaults to the last root the
 *   renderer was given, then to `process.cwd()`.
 * @param maxCols Column ceiling, overriding {@link MAX_IMAGE_COLS}. The default
 *   ceiling is 99 — the width of the centred content column — which is correct
 *   for every block that lives INSIDE that column and wrong for the one kind
 *   that does not: a `fitPage` image, which the page composes against the whole
 *   terminal. Without this a page-fit image on a tall window saturated at 99
 *   columns and could not spend the rows it had been granted, leaving a quarter
 *   of the screen black. Callers that pass nothing keep the 99-column ceiling
 *   exactly as before.
 */
export function imageCellSize(
  block: ImageBlock,
  availWidth: number,
  availHeight?: number,
  projectDir?: string,
  maxCols?: number,
): ImageGeometry {
  const opts = optionsOf(block);
  let header: ImageHeader | null = null;
  try {
    const resolved = resolveImagePath(block.path, projectDir ?? lastProjectDir);
    if (resolved.ok) header = headerFor(resolved);
  } catch {
    // Any surprise from path arithmetic falls back to the estimated square
    // placeholder, which still yields a deterministic 2:1 box.
  }
  return computeCellSize(header, opts, availWidth, availHeight, maxCols);
}

/**
 * Rows an image block occupies, frame included.
 *
 * The number `flex-engine.ts` must return: it counts the border, so a framed
 * image does not offset every sibling's focus rect by two rows.
 */
export function imageBlockHeight(
  block: ImageBlock,
  availWidth: number,
  availHeight?: number,
  projectDir?: string,
  maxCols?: number,
): number {
  return imageCellSize(block, availWidth, availHeight, projectDir, maxCols).blockRows;
}

// ─── Render ───────────────────────────────────────────────

/**
 * Render an image block to terminal rows.
 *
 * Exact contract, because a caller composing these rows into a fixed-width slot
 * needs it and the two halves of this file used to state it differently:
 *
 * - Returns exactly `imageCellSize(block, ctx.width, ctx.panelHeight).blockRows`
 *   rows. `compose()` truncates to `ctx.panelHeight` as a backstop, but geometry
 *   already budgeted it, so that only fires on a caller mismatch.
 * - Each row is `align`'s LEFT pad plus `geom.blockCols` display columns. There
 *   is no trailing pad — `writeToTerminal` erases every row it rewrites, so
 *   trailing spaces are bytes on the wire that change nothing. A centred
 *   20-column image in a 40-column allocation therefore yields 30-column rows.
 * - Every row ends with `reset`.
 * - Never throws.
 *
 * @param block The image block.
 * @param ctx Render context. `width` is the block's allocation, `panelHeight`
 *   the enclosing Panel cell's inner height when there is one.
 * @param projectDir Root for relative paths; also remembered so the layout
 *   estimator resolves against the same root.
 * @param maxCols Column ceiling, as on {@link imageCellSize}. Whatever the
 *   caller passes here it must ALSO pass to `imageBlockHeight`, or layout and
 *   render disagree about the block's row count.
 */
export function renderImage(
  block: ImageBlock,
  ctx: RenderContext,
  projectDir?: string,
  maxCols?: number,
): string[] {
  setImageProjectDir(projectDir);

  const width = Math.max(0, Math.floor(ctx.width));
  const opts = optionsOf(block);
  const align: ImageAlign = opts.align ?? "center";

  let geom: ImageGeometry;
  try {
    geom = imageCellSize(block, width, ctx.panelHeight, projectDir, maxCols);
  } catch {
    // computeCellSize is pure and total, so this is unreachable in practice;
    // the fallback exists so a future change there can never crash a frame.
    geom = computeCellSize(null, opts, width, ctx.panelHeight, maxCols);
  }

  // Both branches return rows at the FULL block footprint (blockCols x
  // blockRows): the success path frames its image area, the alt box draws its
  // own border at the block's outer size. Framing is therefore never applied
  // twice — an earlier version framed in `compose` and double-framed every
  // framed block that fell back to alt text.
  let rows: string[];
  try {
    rows = renderBody(block, opts, geom, ctx, projectDir ?? lastProjectDir);
  } catch {
    rows = altRows(block, opts, geom, ctx);
  }

  return compose(rows, geom, width, align, ctx);
}

/**
 * The success path, plus every failure that resolves to alt text.
 *
 * Kept separate from `renderImage` so the outer `try` guards composition too
 * (framing and padding are pure string work, but a crash there would be just as
 * fatal to the frame).
 *
 * @returns Rows at the block footprint — `geom.blockRows` rows of
 *   `geom.blockCols` display columns, border included when `frame` is set.
 */
function renderBody(
  block: ImageBlock,
  opts: ImageRenderOptions,
  geom: ImageGeometry,
  ctx: RenderContext,
  root: string | undefined,
): string[] {
  const theme = ctx.theme;

  const resolved: ResolvedImage = resolveImagePath(block.path, root);
  if (!resolved.ok) return altRows(block, opts, geom, ctx);

  // Read ONCE per render. `colorMode` is a module-level `let` that the runtime
  // swaps per SSH session; it must not be re-read between the cache key and the
  // emission it keys. `getGraphicsCapability()` has the same shape — the
  // runtime publishes it per session — and is likewise read exactly once.
  const colorMode = getColorMode();
  // `sessionTermType` is undefined for a local run, which makes both calls
  // byte-identical to the no-argument form; for a serve session it is what
  // keeps the negotiation about the CLIENT's terminal.
  const caps = deriveCapabilities(
    colorMode,
    detectTerminal({ termType: sessionTermType }).unicode,
    sessionTermType,
  );
  const bg = backgroundOf(opts, theme);

  let negotiated: RenderTier = selectTier(opts.mode ?? "auto", caps, getGraphicsCapability());
  if (negotiated === KITTY_TIER) {
    const placement = kittyRows(resolved, opts, geom, bg);
    if (placement !== null) return frameIfAsked(placement, geom, opts, ctx);
    // Every kitty failure is a DEMOTION, never an error: no runtime to carry
    // the transmission, a footprint the diacritic table cannot address, or a
    // source that would not decode. Re-negotiate with the gate withheld and
    // draw the picture the cell engine would have drawn.
    negotiated = selectTier(opts.mode ?? "auto", caps);
  }
  // "kitty" cannot survive the line above (the second call is passed no gate),
  // but the union does not know that; folding it in with "alt" narrows the type
  // AND keeps a future re-negotiation change from silently reaching the cell
  // engine with a tier it has no glyphs for.
  if (negotiated === "alt" || negotiated === KITTY_TIER) return altRows(block, opts, geom, ctx);
  const tier: ImageTier = negotiated;

  const { subW, subH } = subCellGridSize(geom, tier);

  // The rect that will ACTUALLY be sampled — computed once so the cache key and
  // `cropPixels` below can never disagree. Only "cover" crops; for every other
  // fit `geom.crop` is the full frame in HEADER coordinates, which are fictional
  // whenever no header was readable (DEFAULT_SOURCE_EDGE) and would otherwise
  // hard-crop a decoded image to its top-left 256x256 pixels.
  const crop = geom.fit === "cover" ? geom.crop : undefined;

  const pixelKey = pixelCacheKey({
    path: resolved.path,
    cols: geom.cols,
    rows: geom.rows,
    subW,
    subH,
    tier,
    crop,
    background: bg,
    invert: opts.invert,
  });
  const serialKey = serialCacheKey({
    pixelKey,
    tier,
    colorMode,
    dither: opts.dither ?? "auto",
    charset: opts.charset,
  });

  // The hot path: one Map.get returning the EXACT array instance the previous
  // frame used, so the per-row diff in runtime-terminal.ts writes nothing.
  // Nothing below this line runs on a steady-state frame. The array is SHARED —
  // frameIfAsked builds a new array around it and never mutates it.
  const cached = getSerialRows(serialKey);
  if (cached !== undefined) return frameIfAsked(cached, geom, opts, ctx);

  let grid = getPixelGrid(pixelKey);
  if (grid === undefined) {
    const decoded = decodeImage(imageSourceOf(resolved));
    if (!decoded.ok) return altRows(block, opts, geom, ctx);

    const source = crop === undefined ? decoded.pixels : cropPixels(decoded.pixels, crop);
    const data = resampleToGrid(source, subW, subH, { background: bg, invert: opts.invert });
    grid = { data, subW, subH, cols: geom.cols, rows: geom.rows, tier };
    setPixelGrid(pixelKey, grid);
  }

  // ditherGrid mutates in place and its result depends on the colour mode,
  // which is deliberately absent from the L1 key so two SSH sessions at
  // different modes share one decode. Dithering the cached instance would let a
  // 256-colour session poison a truecolor one — always clone first.
  const kind = opts.dither ?? "auto";
  let fitted: SubCellGrid = grid;
  if (resolveDither(kind, colorMode) !== "none") {
    fitted = cloneGrid(grid);
    ditherGrid(fitted.data, fitted.subW, fitted.subH, colorMode, kind);
  }

  const emitted = renderCells(fitted, tier, opts, theme);
  setSerialRows(serialKey, emitted);
  return frameIfAsked(emitted, geom, opts, ctx);
}

/**
 * The kitty tier: real pixels behind a grid of placeholder cells.
 *
 * Returns `geom.rows` strings of exactly `geom.cols` display columns — the same
 * shape the cell tiers return, so framing, alignment, clipping and the row diff
 * all work on it unchanged — or `null` to mean "demote to cells".
 *
 * The transmission is derived at most ONCE per (source, size, crop, background)
 * across the whole process and cached with its placement rows and its image id
 * as one unit. Per FRAME this function costs a `Map.get` plus one
 * `graphicsPlace()` call that returns immediately on every frame after the
 * first; per TERMINAL the runtime pays the base64 exactly once, because it —
 * not this function — tracks what each terminal has already received.
 *
 * @returns Placement rows, or null when the pixel path is not usable here.
 */
function kittyRows(
  resolved: ResolvedImageOk,
  opts: ImageRenderOptions,
  geom: ImageGeometry,
  bg: RGB,
): string[] | null {
  // No runtime to carry the payload — a unit test calling renderImage()
  // directly, or an embedder that renders outside a frame. Cells are correct
  // there; placement cells without a transmission are a grid of tofu.
  const sink = graphicsSink;
  if (sink === null) return null;

  // kitty addresses a placement cell with one row diacritic and one column
  // diacritic from a 297-entry table, so that is a hard ceiling on BOTH
  // dimensions. Gate here rather than letting the encoders throw: they refuse
  // out-of-range input by design (a clamped index maps two image rows onto one
  // terminal row and renders a plausible-but-wrong picture), and the render
  // path must stay throw-free.
  if (!canPlaceholder(geom.cols, geom.rows)) return null;

  const crop = geom.fit === "cover" ? geom.crop : undefined;
  const { width, height } = kittyPixelSize(geom.cols, geom.rows);

  // Same key function as the cell tiers, with the SOURCE PIXEL dimensions in
  // subW/subH and `tier: "kitty"`. That gives two properties for free: an
  // edited file re-keys itself through `imageIdentity()`'s mtime, and a resize
  // produces a different key — so a growing frame allocates a NEW image id
  // rather than re-transmitting onto a live one, which kitty and Ghostty
  // disagree about (kitty issue #8701).
  const key = pixelCacheKey({
    path: resolved.path,
    cols: geom.cols,
    rows: geom.rows,
    subW: width,
    subH: height,
    tier: KITTY_TIER,
    crop,
    background: bg,
    invert: opts.invert,
  });

  let image = getKittyImage(key);
  if (image === undefined) {
    // Decode once here to establish that the source is usable AT ALL: a broken
    // file must demote to cells now, not throw later inside the thunk when the
    // runtime is already committed to a placement.
    const pixels = kittyPixels(resolved, opts, crop, bg, width, height);
    if (pixels === null) return null;

    // Handed to the FIRST call of the thunk and released immediately after, so
    // an image appearing on screen decodes once rather than twice (the runtime
    // always invokes the thunk on the frame that creates the entry — the id is
    // brand new, so no terminal can already hold it). Every LATER call
    // re-derives: retaining the buffer would pin megabytes per cached image for
    // the life of the entry, which is the exact cost the thunk exists to avoid.
    let pending: PixelBuffer | null = pixels;

    const id = nextImageId();
    image = {
      id,
      cols: geom.cols,
      rows: geom.rows,
      transmit: () => {
        const buffer = pending ?? kittyPixels(resolved, opts, crop, bg, width, height);
        pending = null; // released before the encode, so a throw cannot pin it
        if (buffer === null) throw new Error("kitty: source no longer decodable");
        return encodeTransmit(id, buffer, geom.cols, geom.rows);
      },
      placement: encodePlacement(id, geom.cols, geom.rows),
    };
    setKittyImage(key, image);
  }

  // Every frame, unconditionally. The runtime deduplicates against what THIS
  // terminal has received, and it is also what tells the runtime the image is
  // still on screen — an id that stops being placed is an id that gets deleted.
  //
  // A false answer means this id's transmission was attempted and failed (the
  // source stopped decoding between frames). Drop the cache entry so the next
  // frame re-derives from scratch rather than resurrecting a known-dead one,
  // and return null so `renderBody` re-negotiates down to the cell ladder.
  if (!sink.graphicsPlace(image.id, image.transmit)) {
    deleteKittyImage(key);
    return null;
  }

  // Shared, like every cached row array: `frameIfAsked` builds a new array
  // around it and never mutates it.
  return image.placement;
}

/**
 * Decode and resample a source to exactly `width` x `height` RGBA pixels, ready
 * for `encodeTransmit`, or null when it will not decode.
 *
 * The resampler composites alpha against `bg`, so the result is opaque and goes
 * out as `f=24` — 25% fewer bytes than RGBA, on the one part of this protocol
 * that is genuinely expensive.
 */
function kittyPixels(
  resolved: ResolvedImageOk,
  opts: ImageRenderOptions,
  crop: ImageCropRect | undefined,
  bg: RGB,
  width: number,
  height: number,
): PixelBuffer | null {
  const decoded = decodeImage(imageSourceOf(resolved));
  if (!decoded.ok) return null;
  const source = crop === undefined ? decoded.pixels : cropPixels(decoded.pixels, crop);
  const data = resampleToGrid(source, width, height, { background: bg, invert: opts.invert });
  // resampleToGrid degrades to an empty array for a degenerate request rather
  // than throwing; encodeTransmit would reject that, so catch it here.
  if (data.length !== width * height * 4) return null;
  return { data, width, height };
}

/**
 * The alt-text box, sized to the WHOLE block footprint.
 *
 * `renderAltBox` draws its own border, so it is handed `blockCols`/`blockRows`
 * rather than the image area — a framed block and its alt box then occupy
 * exactly the same rectangle and nothing below either shifts.
 *
 * It is bordered even when `border` is false, deliberately: a decode failure has
 * to be visible. The STYLE is the block's, so the box does not change shape
 * depending on whether the asset was readable.
 */
function altRows(
  block: ImageBlock,
  opts: ImageRenderOptions,
  geom: ImageGeometry,
  ctx: RenderContext,
): string[] {
  const label = opts.alt?.trim() || basename(block.path);
  return renderAltBox(
    label,
    { cols: geom.blockCols, rows: geom.blockRows },
    ctx.theme,
    borderStyleOf(opts, ctx),
  );
}

/** Last path segment, for the default alt label. Handles `data:` sources too. */
function basename(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  if (clean.startsWith("data:")) return "image";
  const parts = clean.split(/[\\/]/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].length > 0) return parts[i];
  }
  return "image";
}

/** Composited background: explicit option, else the theme's, else black. */
function backgroundOf(opts: ImageRenderOptions, theme: Theme): RGB {
  return hexToRgb(opts.background ?? theme.bg ?? "#000000") ?? { r: 0, g: 0, b: 0 };
}

// ─── Composition ──────────────────────────────────────────

/**
 * Align and clamp. Rows arrive at the block footprint already.
 *
 * Image rows are NEVER measured with `stringWidth()`: their width is exactly
 * `geom.blockCols` by construction, and feeding thousands of unique
 * high-entropy rows to that module-level memo grew the heap by 60 MB against
 * its documented 3 MB budget in the report's §3.4 experiment — process-wide,
 * shared across every SSH session.
 */
function compose(
  rows: string[],
  geom: ImageGeometry,
  width: number,
  align: ImageAlign,
  ctx: RenderContext,
): string[] {
  const slack = Math.max(0, width - geom.blockCols);
  const left = align === "center" ? slack >> 1 : align === "right" ? slack : 0;
  // Right padding is deliberately omitted: writeToTerminal erases each row it
  // rewrites, so trailing spaces are bytes on the wire that change nothing.
  const lead = left > 0 ? " ".repeat(left) : "";

  const out: string[] = new Array(rows.length) as string[];
  for (let i = 0; i < rows.length; i++) out[i] = lead + rows[i];

  // Defensive: geometry already budgeted availHeight, so this only fires if a
  // caller passes a panelHeight smaller than the one it sized the block with.
  const cap = ctx.panelHeight;
  if (cap !== undefined && Number.isFinite(cap) && out.length > cap) {
    out.length = Math.max(0, Math.floor(cap));
  }
  return out;
}

/** Border the image area when `border` is set, else hand the rows back unchanged. */
function frameIfAsked(
  rows: string[],
  geom: ImageGeometry,
  opts: ImageRenderOptions,
  ctx: RenderContext,
): string[] {
  return geom.blockCols > geom.cols ? frameRows(rows, geom, opts, ctx) : rows;
}

/** Wrap the image area in a themed border. Adds exactly two rows and two columns. */
function frameRows(
  rows: string[],
  geom: ImageGeometry,
  opts: ImageRenderOptions,
  ctx: RenderContext,
): string[] {
  const chars = getBorderChars(borderStyleOf(opts, ctx));
  const edge = fgColor(ctx.theme.border);
  const inner = geom.cols;

  const out: string[] = [];
  out.push(edge + chars.topLeft + chars.horizontal.repeat(inner) + chars.topRight + reset);
  const body = rows.length > geom.rows ? rows.slice(0, geom.rows) : rows;
  for (const row of body) {
    // `row` already ends with `reset`, so the closing border re-establishes the
    // border colour rather than inheriting the last cell's background.
    out.push(edge + chars.vertical + reset + row + edge + chars.vertical + reset);
  }
  for (let i = body.length; i < geom.rows; i++) {
    out.push(edge + chars.vertical + reset + " ".repeat(inner) + edge + chars.vertical + reset);
  }
  out.push(edge + chars.bottomLeft + chars.horizontal.repeat(inner) + chars.bottomRight + reset);
  return out;
}

// ─── Cropping ─────────────────────────────────────────────

/**
 * Sub-rectangle of a decoded buffer. Only ever called for `fit: "cover"` —
 * every other fit samples the full frame and skips this entirely, because
 * `geom.crop` is expressed in HEADER coordinates and the header can be absent
 * (a JPEG whose SOF sits past the 1 MiB probe) or simply wrong.
 *
 * `resampleToGrid()` takes no source rect, so the crop geometry.ts computed is
 * applied here by copying the region out.
 *
 * The crop is clamped to the buffer's ACTUAL dimensions, not the header's: a
 * truncated or mis-declared file would otherwise read past the end and fill the
 * image with zeroes.
 */
function cropPixels(pixels: PixelBuffer, crop: ImageCropRect): PixelBuffer {
  const sx = clampInt(crop.sx, 0, Math.max(0, pixels.width - 1));
  const sy = clampInt(crop.sy, 0, Math.max(0, pixels.height - 1));
  const sw = clampInt(crop.sw, 1, pixels.width - sx);
  const sh = clampInt(crop.sh, 1, pixels.height - sy);

  if (sx === 0 && sy === 0 && sw === pixels.width && sh === pixels.height) return pixels;

  const out = new Uint8ClampedArray(sw * sh * 4);
  const rowBytes = sw * 4;
  for (let y = 0; y < sh; y++) {
    const from = ((sy + y) * pixels.width + sx) * 4;
    out.set(pixels.data.subarray(from, from + rowBytes), y * rowBytes);
  }
  return { data: out, width: sw, height: sh };
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  const n = Math.floor(v);
  if (hi < lo) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}
