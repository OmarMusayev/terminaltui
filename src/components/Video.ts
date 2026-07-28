/**
 * Video block renderer — where a frame pack becomes moving cells.
 *
 * Deliberately shaped like `src/components/Image.ts`, and bound by the same
 * four invariants, because a video IS an image that changes: the geometry, the
 * tier ladder, the resampler, the glyph fitter and the alt box are all the
 * still-image ones. What is new here is only the clock, and the fact that the
 * pixels come out of a pack rather than off disk.
 *
 * The invariants, restated because breaking them is subtle:
 *
 *  1. **Synchronous.** `renderVideo` runs inside the render pass and never
 *     awaits. The frame's JPEG is decoded right here, measured at ~0.6 ms.
 *  2. **Row count fixed before any pixel exists.** The pack header carries
 *     width and height, so geometry is solved on the first pass and every
 *     subsequent state — playing, paused, packing, missing, corrupt — returns
 *     exactly `geom.blockRows` rows. A block that changed height between
 *     frames would move every focus rect below it 12 times a second.
 *  3. **Never throws.** A truncated pack is content, not a reason to kill the
 *     terminal.
 *  4. **No new write path.** Rows go back through `renderBlock` into
 *     `writeToTerminal`'s row diff like every other block. Video does not own
 *     the screen.
 *
 * THE KITTY TIER IS DELIBERATELY NOT USED FOR MOTION. `kitty.ts` forbids
 * re-transmitting onto a live image id, so each frame would cost a delete plus
 * a full transmit — measured at 1.5-1.9 MB per frame, 37-44 MiB/s at 24 fps.
 * The quadrant tier draws the same picture for 52 KiB. Pixels are strictly
 * better only when the picture is STILL, which is why `selectTier` is asked
 * for a cell tier here and a paused video is free to be a real image.
 */

import type { RenderContext } from "./base.js";
import type { VideoBlock } from "../config/types.js";
import type { BorderStyle } from "../style/borders.js";
import type { Theme } from "../style/theme.js";
import type {
  ImageAlign, ImageHeader, ImageMode, ImageRenderOptions, ImageTier, PixelBuffer, RGB,
} from "../image/types.js";

import { imageCellSize as computeCellSize, hasBorder, type ImageGeometry } from "../image/geometry.js";
import { subCellFactor } from "../image/types.js";
import { deriveCapabilities, selectTier } from "../image/tier.js";
import { decodeImage } from "../image/decode.js";
import { resampleToGrid } from "../image/resample.js";
import { resolveDither } from "../image/dither.js";
import { renderAltBox, renderCells } from "../image/render.js";
import { getBorderChars } from "../style/borders.js";
import { fgColor, dim, getColorMode, hexToRgb, reset } from "../style/colors.js";
import { stringWidth } from "./base.js";

import { getGraphicsSink } from "./Image.js";
import { getGraphicsCapability } from "../image/capability.js";
import { canPlaceholder, encodePlacement, encodeTransmit, nextImageId } from "../image/kitty.js";
import {
  VideoPlayer, registerPlayer, type PixelPlacement, type Repaintable,
} from "../video/player.js";
import { resolveSource, type VideoSourceOk } from "../video/source.js";

// ─── Player registry ──────────────────────────────────────

/**
 * Players keyed by (runtime, block key).
 *
 * Keyed on the runtime as well as the block because `ssh-server.ts` permits up
 * to 100 concurrent runtimes in one process, each with its own terminal size,
 * colour mode and viewer pressing space at a different moment. A registry
 * keyed by block alone would have two sessions sharing one playhead.
 */
const PLAYERS = new WeakMap<Repaintable, Map<string, VideoPlayer>>();

function playerFor(
  rt: Repaintable,
  key: string,
  source: VideoSourceOk,
  block: VideoBlock,
): VideoPlayer {
  let byKey = PLAYERS.get(rt);
  if (!byKey) { byKey = new Map(); PLAYERS.set(rt, byKey); }

  const existing = byKey.get(key);
  // Re-key on the resolved pack path so that editing a config to point at a
  // different clip replaces the player rather than playing the old one.
  if (existing && existing.sourceKey === source.key) return existing;

  const player = new VideoPlayer(source.bytes ?? source.packPath ?? "", {
    fps: block.fps,
    loop: block.loop,
    autoplay: block.autoplay === true,
    poster: block.poster,
    frozen: videoDisabled(),
  });
  player.sourceKey = source.key;
  byKey.set(key, player);
  registerPlayer(rt, player);
  return player;
}

/** The player for a block key, without creating one. Used by input handling. */
export function existingPlayer(rt: Repaintable, key: string): VideoPlayer | undefined {
  return PLAYERS.get(rt)?.get(key);
}

/**
 * `TERMINALTUI_VIDEO=off` freezes every video on its poster; `paused` is the
 * same thing but leaves the transport working.
 *
 * `off` is what the test emulator and VHS inject. A screen that changes on its
 * own can never be declared idle, so without this switch a single autoplaying
 * demo would hang `waitForIdle` for its full timeout and take the whole demo
 * suite down with it.
 */
export function videoDisabled(): boolean {
  const v = (process.env.TERMINALTUI_VIDEO ?? "").toLowerCase().trim();
  return v === "off" || v === "none" || v === "0" || v === "false";
}

// ─── Options ──────────────────────────────────────────────

function optionsOf(block: VideoBlock): ImageRenderOptions {
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

/** `"blocks"` is the original published spelling of the half tier. */
function normalizeMode(mode: VideoBlock["mode"]): ImageMode | undefined {
  if (mode === undefined) return undefined;
  return mode === "blocks" ? "half" : mode;
}

function borderStyleOf(opts: ImageRenderOptions, ctx: RenderContext): BorderStyle {
  if (typeof opts.border === "string") return opts.border;
  return (ctx.borderStyle as BorderStyle | undefined) ?? "rounded";
}

function backgroundOf(opts: ImageRenderOptions, theme: Theme): RGB {
  const hex = opts.background ?? theme.bg;
  return (hex ? hexToRgb(hex) : null) ?? { r: 0, g: 0, b: 0 };
}

// ─── Geometry ─────────────────────────────────────────────

/**
 * The block's size in cells.
 *
 * Exported because the layout estimator in `flex-engine.ts` must reserve the
 * same number of rows this renderer will draw — it walks the tree
 * independently, and the two answers disagreeing is the documented
 * `case "image": return 10` defect that this shape exists to avoid.
 */
export function videoCellSize(
  block: VideoBlock,
  availWidth: number,
  availHeight?: number,
  projectDir?: string,
  maxCols?: number,
): ImageGeometry {
  const source = resolveSource(block.path, projectDir);
  const header: ImageHeader | null = source.size
    ? { width: source.size.width, height: source.size.height, format: "jpeg" }
    : null;
  return computeCellSize(header, optionsOf(block), availWidth, availHeight, maxCols);
}

/** Total rows the block occupies, transport row included. */
export function videoBlockRows(
  block: VideoBlock,
  availWidth: number,
  availHeight?: number,
  projectDir?: string,
  maxCols?: number,
): number {
  return videoCellSize(block, availWidth, availHeight, projectDir, maxCols).blockRows +
    (block.controls === true ? 1 : 0);
}

// ─── Entry point ──────────────────────────────────────────

export interface VideoRenderDeps {
  /** The runtime, for the player registry and the frame clock. */
  rt: Repaintable;
  /** Stable per-block identity — `rt.getBlockKey(block)`. */
  blockKey: string;
  /** Page the block lives on, so navigation can pause it. */
  pageId?: string | null;
  /** Monotonic render counter, for departure sweeping. */
  renderSeq?: number;
  projectDir?: string;
  maxCols?: number;
  focused?: boolean;
}

/**
 * Render one frame of a video block.
 *
 * Mirrors `renderImage`: solve geometry, try the body, fall back to the alt
 * box, then compose to the block footprint. Every return path is
 * `geom.blockRows` (+1 for controls) rows tall.
 */
export function renderVideo(
  block: VideoBlock,
  ctx: RenderContext,
  deps: VideoRenderDeps,
): string[] {
  const width = Math.max(0, Math.floor(ctx.width));
  const opts = optionsOf(block);
  const align: ImageAlign = opts.align ?? "center";

  let geom: ImageGeometry;
  let rows: string[];
  let player: VideoPlayer | null = null;

  try {
    geom = videoCellSize(block, width, ctx.panelHeight, deps.projectDir, deps.maxCols);
  } catch {
    geom = computeCellSize(null, opts, width, ctx.panelHeight, deps.maxCols);
  }

  try {
    const source = resolveSource(block.path, deps.projectDir);
    if (!source.ok) {
      rows = altRows(block, opts, geom, ctx, source.reason);
    } else {
      player = playerFor(deps.rt, deps.blockKey, source, block);
      player.renderSeq = deps.renderSeq ?? player.renderSeq;
      // Assigned only when the caller SUPPLIED one. `??` would be wrong here:
      // the home page's id is legitimately `null`, and `null ?? old` keeps the
      // old value — so a video on the home page would never be paused when the
      // viewer navigated away from it.
      if (deps.pageId !== undefined) player.pageId = deps.pageId;
      rows = frameRowsFor(player, block, opts, geom, ctx);
    }
  } catch (e) {
    rows = altRows(block, opts, geom, ctx, (e as Error).message);
  }

  const composed = compose(rows, geom, width, align, ctx);
  if (block.controls === true) {
    composed.push(transportRow(player, geom, width, align, ctx, deps.focused === true));
  }
  return composed;
}

/**
 * The success path: decode the current frame and fit it to cells.
 *
 * The memo key carries everything that can change the bytes — frame index,
 * geometry, tier, colour mode — so a repaint triggered by anything other than
 * the clock returns the IDENTICAL array instance and costs nothing downstream.
 */
function frameRowsFor(
  player: VideoPlayer,
  block: VideoBlock,
  opts: ImageRenderOptions,
  geom: ImageGeometry,
  ctx: RenderContext,
): string[] {
  if (player.loadError !== null) {
    return altRows(block, opts, geom, ctx, player.loadError);
  }

  // Read once per render: `colorMode` is a module-level value the runtime swaps
  // per SSH session, and it must not change between keying the memo and
  // emitting against it.
  const colorMode = getColorMode();
  const tier = motionTier(opts.mode ?? "auto", colorMode);
  if (tier === "alt") return altRows(block, opts, geom, ctx, "tier=alt");

  const frame = player.currentFrame();
  const key = `${frame}|${geom.cols}x${geom.rows}|${tier}|${colorMode}|${opts.invert ? 1 : 0}`;
  const cached = player.cachedRows(key);
  if (cached) {
    // A memo hit on the CELL path is self-contained and can be returned as is.
    // On the PIXEL path it is not: the rows reference an image the terminal
    // holds, and the runtime deletes any image that stops being placed. So the
    // placement has to be re-declared on every hit — the same "every frame,
    // unconditionally" rule the still-image path follows — or a repaint
    // between two clock ticks frees the pixels the rows on screen point at and
    // the picture stops after a frame or two.
    const placement = player.cachedPlacement(key);
    if (placement === null) return cached;
    if (getGraphicsSink()?.graphicsPlace(placement.id, placement.transmit) === true) return cached;
    // The id died (its transmission failed). Rebuild rather than keep pointing
    // at it — the next block re-negotiates and may land on cells.
    player.invalidateRows();
  }

  const bytes = player.frameBytes(frame);
  if (!bytes) return player.lastGoodRows ?? altRows(block, opts, geom, ctx, "no frame");

  const decoded = decodeImage(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
  if (!decoded.ok) {
    // A single corrupt frame re-shows the last good one rather than flashing an
    // alt box mid-playback. Same instance, so it costs zero wire bytes.
    return player.lastGoodRows ?? altRows(block, opts, geom, ctx, decoded.detail);
  }

  // Real pixels, where the terminal can draw them. Tried BEFORE the cell path
  // and falls through to it on any refusal, so nothing here can cost a frame.
  const pixels = pixelRows(decoded.pixels, geom, opts.mode ?? "auto");
  if (pixels !== null) {
    return player.putRows(key, frameIfAsked(pixels.rows, geom, opts, ctx), pixels.placement);
  }

  const factor = subCellFactor(tier);
  const background = backgroundOf(opts, ctx.theme);
  const grid = {
    data: resampleToGrid(decoded.pixels, geom.cols * factor.x, geom.rows * factor.y, {
      background, invert: opts.invert,
    }),
    subW: geom.cols * factor.x,
    subH: geom.rows * factor.y,
    cols: geom.cols,
    rows: geom.rows,
    tier,
  };

  const body = renderCells(grid, tier, {
    ...opts,
    dither: resolveDither(opts.dither ?? "auto", colorMode),
  }, ctx.theme);

  return player.putRows(key, frameIfAsked(body, geom, opts, ctx));
}

/**
 * Transmit one frame as real pixels and return its placement rows, or null to
 * fall through to cells.
 *
 * I ORIGINALLY RULED THIS OUT ON A NUMBER THAT DESCRIBED A DIFFERENT CODE PATH.
 * The still-image path resamples a source UP to `cols*10 x rows*20` before
 * transmitting — for a 200x56-cell block that is 2000x1120, 11.4 MB a frame,
 * 137 MiB/s at 12 fps, which is obviously impossible and is what "video must
 * be cells" was based on.
 *
 * A video frame does not need any of that. The pack frame is already about the
 * right size, and kitty's `s`/`v` (source pixel dimensions) are independent of
 * `c`/`r` (the cell footprint) — the terminal scales it. Transmitting the pack
 * frame at its NATIVE size measures 351 KB, 0.40 ms, and 4.1 MiB/s at 12 fps.
 * That is about 7x the cell path's bytes and completely unremarkable for a
 * local pty, in exchange for actual pixels instead of quadrant glyphs.
 *
 * A FRESH ID EVERY FRAME, deliberately: `kitty.ts` documents that
 * re-transmitting onto a live id is unspecified (kitty issue #8701). The
 * runtime's own departure sweep deletes the previous id once it stops being
 * placed, so this costs one ~26-byte delete per frame and no new lifecycle.
 * The id space is 9.1M wide — 105 hours of continuous 24 fps playback.
 *
 * The kitty image CACHE is deliberately not used. It is a byte-LRU sized for
 * stills; one entry per frame fills it in seconds and then evicts continuously,
 * firing eviction callbacks for ids the sweep has already retired.
 */
function pixelRows(
  pixels: PixelBuffer,
  geom: ImageGeometry,
  mode: ImageMode,
): { rows: string[]; placement: PixelPlacement } | null {
  // An explicitly pinned tier means the author wants that tier, including in
  // snapshot tests where a transmission would make output machine-dependent.
  if (mode !== "auto") return null;
  if (videoDisabled()) return null;

  const sink = getGraphicsSink();
  if (sink === null) return null; // rendering outside a frame (unit test, embedder)
  if (getGraphicsCapability()?.kittyPlaceholders !== true) return null;

  // One row and one column diacritic from a 297-entry table addresses a
  // placement cell, so that is a hard ceiling on both dimensions. Refuse rather
  // than clamp: a clamped index maps two image rows onto one terminal row and
  // draws a plausible-but-wrong picture.
  if (!canPlaceholder(geom.cols, geom.rows)) return null;

  // Never send more pixels than the terminal can put on screen. A cell is
  // roughly 10x20 px, so the block displays at about cols*10 x rows*20; every
  // pixel past that is bytes the terminal throws away during its own downscale.
  // Usually a no-op — a pack frame is normally SMALLER than its footprint, and
  // kitty upscales it — but it is what stops a 4K pack transmitting 12 MB a
  // frame into a block that is 200 cells wide.
  const sent = fitToDisplay(pixels, geom.cols * KITTY_CELL_PX.w, geom.rows * KITTY_CELL_PX.h);

  const id = nextImageId();
  // The thunk is invoked at most once per id, by the runtime, after the frame.
  // `sent` is captured rather than re-derived because unlike a still there is
  // no source to go back to — the buffer IS the frame, and it is released with
  // the closure as soon as the runtime has used it.
  const transmit = () => encodeTransmit(id, sent, geom.cols, geom.rows);
  if (!sink.graphicsPlace(id, transmit)) return null;
  return { rows: encodePlacement(id, geom.cols, geom.rows), placement: { id, transmit } };
}

/** Nominal kitty cell size in pixels. Same estimate `Image.ts` transmits against. */
const KITTY_CELL_PX = { w: 10, h: 20 } as const;

/** Box-filter a frame down to at most `maxW` x `maxH`, preserving aspect. */
function fitToDisplay(px: PixelBuffer, maxW: number, maxH: number): PixelBuffer {
  const scale = Math.min(1, maxW / px.width, maxH / px.height);
  if (scale >= 1) return px;
  const w = Math.max(1, Math.round(px.width * scale));
  const h = Math.max(1, Math.round(px.height * scale));
  return {
    data: resampleToGrid(px, w, h, { background: { r: 0, g: 0, b: 0 } }),
    width: w,
    height: h,
  };
}

/**
 * Pick a CELL tier for motion.
 *
 * `selectTier` is asked without the graphics gate, so it can never answer
 * "kitty" — see the file docblock. Everything below that rung is unchanged, so
 * a 16-colour terminal or a multiplexer degrades exactly as it does for stills.
 */
function motionTier(mode: ImageMode, colorMode: ReturnType<typeof getColorMode>): ImageTier {
  const caps = deriveCapabilities(
    colorMode === "truecolor" || colorMode === "256" || colorMode === "16" ? colorMode : "none",
    true,
  );
  const tier = selectTier(mode, caps);
  return tier === "kitty" ? "quadrant" : tier;
}

// ─── Transport ────────────────────────────────────────────

/**
 * The one extra row `controls: true` buys.
 *
 * Deliberately a single row: the block's height is load-bearing for every
 * focus rect below it, so the transport cannot grow or shrink with state. It
 * shows position and the keys, and dims when the block is not focused so the
 * page does not look like it has a live widget on it when it does not.
 */
function transportRow(
  player: VideoPlayer | null,
  geom: ImageGeometry,
  width: number,
  align: ImageAlign,
  ctx: RenderContext,
  focused: boolean,
): string {
  const total = player?.frameCount ?? 0;
  const at = player ? player.currentFrame() + 1 : 0;
  const glyph = player?.playing === true ? "▶" : "⏸";
  const pos = total > 0 ? `${glyph} ${String(at).padStart(String(total).length, " ")}/${total}` : glyph;

  // A progress bar sized to the picture, so the transport reads as part of it.
  const barWidth = Math.max(0, geom.blockCols - stringWidth(pos) - 2);
  const filled = total > 1 && barWidth > 0
    ? Math.round((at - 1) / (total - 1) * barWidth)
    : 0;
  const bar = barWidth > 0
    ? "━".repeat(filled) + "─".repeat(Math.max(0, barWidth - filled))
    : "";

  const body = `${pos} ${bar}`;
  const tinted = focused
    ? fgColor(ctx.theme.accent) + body + reset
    : dim + body + reset;

  const slack = Math.max(0, width - geom.blockCols);
  const left = align === "center" ? slack >> 1 : align === "right" ? slack : 0;
  return (left > 0 ? " ".repeat(left) : "") + tinted;
}

// ─── Shared with Image.ts in spirit, duplicated in code ───
// These are small, and importing them would mean exporting Image.ts's private
// helpers purely so a sibling could reuse four lines each.

function altRows(
  block: VideoBlock,
  opts: ImageRenderOptions,
  geom: ImageGeometry,
  ctx: RenderContext,
  _detail?: string,
): string[] {
  const label = opts.alt?.trim() || basename(block.path);
  return renderAltBox(
    label,
    { cols: geom.blockCols, rows: geom.blockRows },
    ctx.theme,
    borderStyleOf(opts, ctx),
  );
}

function basename(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  const parts = clean.split(/[\\/]/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].length > 0) return parts[i];
  }
  return "video";
}

function compose(
  rows: string[],
  geom: ImageGeometry,
  width: number,
  align: ImageAlign,
  ctx: RenderContext,
): string[] {
  const slack = Math.max(0, width - geom.blockCols);
  const left = align === "center" ? slack >> 1 : align === "right" ? slack : 0;
  const lead = left > 0 ? " ".repeat(left) : "";

  const out: string[] = new Array(rows.length) as string[];
  for (let i = 0; i < rows.length; i++) out[i] = lead + rows[i];
  return out;
}

function frameIfAsked(
  rows: string[],
  geom: ImageGeometry,
  opts: ImageRenderOptions,
  ctx: RenderContext,
): string[] {
  if (!hasBorder(opts.border) || geom.blockCols <= geom.cols) return rows;

  const chars = getBorderChars(borderStyleOf(opts, ctx));
  const edge = fgColor(ctx.theme.border);
  const inner = geom.cols;

  const out: string[] = [];
  out.push(edge + chars.topLeft + chars.horizontal.repeat(inner) + chars.topRight + reset);
  const body = rows.length > geom.rows ? rows.slice(0, geom.rows) : rows;
  for (const row of body) {
    out.push(edge + chars.vertical + reset + row + edge + chars.vertical + reset);
  }
  for (let i = body.length; i < geom.rows; i++) {
    out.push(edge + chars.vertical + reset + " ".repeat(inner) + edge + chars.vertical + reset);
  }
  out.push(edge + chars.bottomLeft + chars.horizontal.repeat(inner) + chars.bottomRight + reset);
  return out;
}
