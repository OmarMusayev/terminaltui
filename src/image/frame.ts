/**
 * Resizable image frames — the pure arithmetic behind a frame the viewer grows
 * and shrinks at runtime.
 *
 * The point of the feature is that a terminal image is sampled PER CELL: the
 * engine resamples the source into a `cols x rows` sub-cell grid, so a frame
 * two cells wider is not an upscale of the old picture, it is a new resample
 * with more samples in it. Growing the frame therefore buys real resolution.
 * `pixelCacheKey()` already carries `cols x rows` and `subW x subH`, so a new
 * size is a new cache entry and the L1 grid is rebuilt from the decoded source
 * rather than stretched.
 *
 * WHY THIS IS A MODULE AND NOT A COUPLE OF LOCAL HELPERS: the frame's current
 * size is consumed in two places that must agree to the row, every frame —
 * `renderBlock`'s image case (what gets drawn) and `flex-engine`'s
 * `estimateBlockHeight` (what layout reserves for it). When those two disagree
 * every `FocusRect` below the image lands at the wrong Y and the arrow keys
 * misroute; that is the same defect class as the old `case "image": return 10`.
 * Both call {@link framedImageBlock} and {@link frameHintRows} here, so they
 * cannot drift.
 *
 * The same argument brought page-fit sizing here (`fitPage`, at the bottom of
 * the file). It is a different feature — the PAGE decides the size, not the
 * viewer — but it has the identical two-consumer shape and the identical
 * failure mode if the two drift, and it is spent through the same trick:
 * rewriting the block before geometry runs rather than teaching geometry a new
 * argument.
 *
 * Everything is PURE in its arguments: no I/O, no runtime state, no header
 * probe. The one thing this module deliberately does NOT do is turn a column
 * count into a row count — that is `geometry.imageCellSize()`'s job and it
 * needs the source header. This module hands geometry a `width` and a row cap
 * and lets it derive the aspect-correct height, so there is exactly one place
 * where CELL_ASPECT is applied.
 */

import type { ContentBlock, ImageBlock, VideoBlock } from "../config/types.js";
import { focusSlots } from "../core/block-taxonomy.js";
import { MAX_IMAGE_COLS, hasBorder } from "./geometry.js";

/**
 * Narrowest a frame may shrink to, in image cells.
 *
 * Eight cells is roughly where a quadrant-tier image stops being a picture and
 * starts being four coloured smudges; below it the block is indistinguishable
 * from a rendering bug.
 */
export const FRAME_MIN_COLS = 8;

/**
 * Cells added or removed per keypress.
 *
 * Four, not one: at the quadrant tier one cell is two sub-pixels, so a
 * single-cell step is often invisible and the viewer concludes the key does
 * nothing. Four cells is one visible jump per press and still lands on a wide
 * range of sizes within a handful of presses.
 */
export const FRAME_STEP_COLS = 4;

/**
 * Rows a resizable image spends on its hint line.
 *
 * Charged whether or not the block is focused, deliberately. `flex-engine` has
 * no idea which block is focused, so a hint that appeared only on focus would
 * make the block's height focus-dependent and every rect below it would jump by
 * one row as focus moved through the page.
 */
export const FRAME_HINT_ROWS = 1;

/** Rows AND columns a drawn frame border adds to the block footprint. */
const FRAME_BORDER_CHROME = 2;

/**
 * The space a frame may expand into.
 *
 * `availWidth` is the block's horizontal allocation — `ctx.width` for the
 * renderer, `availWidth` for the estimator's walk. `availRows` is the vertical
 * budget the frame must stay inside: the enclosing panel's inner height when
 * there is one, else the page's layout height. Both sides must derive it the
 * same way or the two disagree about when growth stops.
 */
export interface FrameLimits {
  /** Cells available to the whole block horizontally. */
  availWidth: number;
  /** Rows available to the whole block vertically. Undefined = uncapped. */
  availRows?: number;
}

/**
 * Whether a block is an image that opted in to runtime resizing.
 *
 * The opt-in is load-bearing and not a style preference: focusability is
 * type-keyed everywhere else in the framework, so making every image focusable
 * would insert a focus slot into every existing page that shows one, shifting
 * every index below it and breaking the ordering pinned by
 * test/focus-contract.test.ts. Only `resizable: true` buys the slot.
 */
export function isResizableImage(block: ContentBlock): block is ImageBlock {
  return block.type === "image" && (block as ImageBlock).resizable === true;
}

/**
 * Focus slots a block occupies — `focusSlots()` plus the resizable-image slot.
 *
 * `block-taxonomy.focusSlots()` decides focusability from the block TYPE alone,
 * which cannot express "an image, but only when `resizable` is set". Every
 * walker that assigns focus indices (collectFocusItems, countFocusSlots,
 * flex-engine's rect walk, the panel-title search in runtime-input) must call
 * THIS function instead, or the semantic walk and the geometry walk drift apart
 * by one at the first resizable image on the page.
 *
 * Additive rather than a replacement: "image" is not in FOCUSABLE_TYPES, so the
 * two terms can never both be non-zero.
 */
export function focusSlotsOf(block: ContentBlock): number {
  return focusSlots(block) + (isResizableImage(block) ? 1 : 0) + (isControlledVideo(block) ? 1 : 0);
}

/**
 * A video that asked for a transport, which is the only video that takes a
 * focus slot and the only one that draws a control row.
 *
 * Exactly parallel to {@link isResizableImage}, and it exists here rather than
 * only in the renderer for the same reason: every walker that assigns focus
 * indices must agree with every walker that reserves rows, and the way they
 * stay in agreement is by asking the same function.
 */
export function isControlledVideo(block: ContentBlock): block is VideoBlock {
  return block.type === "video" && (block as VideoBlock).controls === true;
}

/**
 * Rows a block spends on chrome below the picture: one for a resizable image's
 * resize hint, one for a video's transport, else 0.
 */
export function frameHintRows(block: ContentBlock): number {
  if (isResizableImage(block)) return FRAME_HINT_ROWS;
  if (isControlledVideo(block)) return 1;
  return 0;
}

/**
 * Rows/columns this block's border adds.
 *
 * Calls `geometry.hasBorder()` rather than restating it: the two used to be
 * separate implementations of the same predicate, kept in step by a comment,
 * and extending the border vocabulary (a per-side spec, say — `PanelBlock`
 * already has one) would have made this reserve two fewer columns than
 * geometry draws. Only ever used to RESERVE room; geometry remains the
 * authority on whether a border is actually drawn (it drops the border in
 * allocations too narrow to hold one, which can only make the real footprint
 * smaller than this estimate).
 */
function borderChrome(block: ImageBlock | VideoBlock): number {
  return hasBorder(block.border) ? FRAME_BORDER_CHROME : 0;
}

/**
 * Widest the image AREA may grow, given the horizontal budget.
 *
 * The border is subtracted because `width` sizes the image area while
 * `availWidth` budgets the whole block, and `MAX_IMAGE_COLS` (99) caps it
 * because that is the widest a block can be inside the centred content column.
 */
export function maxFrameCols(block: ImageBlock, limits: FrameLimits): number {
  const avail = Number.isFinite(limits.availWidth)
    ? Math.floor(limits.availWidth)
    : MAX_IMAGE_COLS;
  return Math.max(1, Math.min(avail - borderChrome(block), MAX_IMAGE_COLS));
}

/**
 * Clamp a candidate frame width into the legal range.
 *
 * The floor yields to the ceiling rather than fighting it: in a 6-column slot
 * there is no width that is both >= 8 and <= 6, and rendering a block wider
 * than its allocation is the worse of the two failures.
 */
export function clampFrameCols(cols: number, block: ImageBlock, limits: FrameLimits): number {
  const hi = maxFrameCols(block, limits);
  const lo = Math.min(FRAME_MIN_COLS, hi);
  if (!Number.isFinite(cols)) return lo;
  const n = Math.floor(cols);
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * The row cap a resizable frame renders under: the block's own `maxHeight`, or
 * the vertical budget minus the hint row and the border, whichever is smaller.
 *
 * A resizable frame is capped to the visible area even at page level, where an
 * ordinary image is free to run off the bottom and be scrolled to. That is
 * deliberate: you cannot judge a frame you are actively resizing if growing it
 * pushes its own bottom edge off the screen, and `+` would appear to do nothing
 * while the top of the picture stayed put.
 */
export function frameRowCap(block: ImageBlock, limits: FrameLimits): number | undefined {
  const declared = normDim(block.maxHeight);
  const budget = limits.availRows;
  if (budget === undefined || !Number.isFinite(budget)) return declared;
  const room = Math.max(1, Math.floor(budget) - FRAME_HINT_ROWS - borderChrome(block));
  return declared !== undefined && declared < room ? declared : room;
}

/**
 * The block to hand `imageCellSize()` / `renderImage()` — the declared block
 * with the viewer's frame width applied and the row cap tightened.
 *
 * Returns the ORIGINAL object whenever nothing needs overriding, so a plain
 * image (and a resizable one nobody has touched, in an uncapped slot) keeps
 * byte-identical behaviour and allocates nothing per frame.
 *
 * @param block   The authored image block.
 * @param stored  The viewer's frame width in cells, or undefined for "as
 *                declared" — which is also what `0` (reset) restores.
 * @param limits  The space the frame may occupy.
 */
export function framedImageBlock(
  block: ImageBlock,
  stored: number | undefined,
  limits: FrameLimits,
): ImageBlock {
  if (block.resizable !== true) return block;
  const width = stored === undefined ? block.width : clampFrameCols(stored, block, limits);
  const maxHeight = frameRowCap(block, limits);
  if (width === block.width && maxHeight === block.maxHeight) return block;
  return { ...block, width, maxHeight };
}

// ─── Page-fit images ──────────────────────────────────────

/**
 * Whether a block is an image that opted in to page-fit sizing.
 *
 * `resizable` wins outright rather than combining: that flag means "the VIEWER
 * decides how big this is", and silently overruling a size somebody just chose
 * with `+` is worse than ignoring an authoring hint. It also keeps the two
 * vertical clamps from stacking — {@link frameRowCap} already subtracts
 * FRAME_HINT_ROWS, and a second budget on top would charge for the hint row
 * twice.
 */
export function isPageFitImage(block: ContentBlock): block is ImageBlock | VideoBlock {
  if (block.type === "video") return (block as VideoBlock).fitPage === true;
  return (
    block.type === "image" &&
    (block as ImageBlock).fitPage === true &&
    (block as ImageBlock).resizable !== true
  );
}

/**
 * What the page set aside for one `fitPage` image.
 *
 * Both numbers are published by the renderer and read back by the layout
 * estimator (see PAGE_FIT_GRANTS in runtime-block-render.ts), because neither is
 * derivable from what the estimator can see:
 *
 * - `rows` is `viewport - (rows every sibling actually drew)`, and only the
 *   render loop has drawn them.
 * - `cols` is the WHOLE terminal, not the estimator's `availWidth`. The walk is
 *   seeded with `blockRenderWidth(columns)` — the centred content column, one
 *   less for the focus gutter — and a page-fit image is deliberately composed
 *   outside that column, so there is no arithmetic that recovers one from the
 *   other.
 */
export interface PageFitGrant {
  /** Rows the block may occupy in total, border included. */
  rows: number;
  /**
   * Columns the block may occupy in total, border included — and simultaneously
   * its `maxCols` ceiling, so the page's allocation is the only limit.
   */
  cols: number;
}

/**
 * The block to hand `imageCellSize()` / `renderImage()` for a page-fit image:
 * the declared block with the page's leftover rows applied as a row cap.
 *
 * WHY `maxHeight` RATHER THAN AN `availHeight` ARGUMENT. Rewriting the block is
 * exactly equivalent, and it is the only channel that does not have side
 * effects. In `geometry.imageCellSize()`:
 *
 *     availRows = availHeight !== undefined ? floor(availHeight) - border
 *                                           : MAX_IMAGE_ROWS
 *     rowCap    = clamp(min(maxHeight ?? MAX_IMAGE_ROWS, availRows), 1, MAX)
 *
 * `rowCap` is the ONLY thing either input feeds (`border` and the column budget
 * depend on `availWidth` alone), so setting `maxHeight = budget - border - hint`
 * with `availHeight` left undefined produces the identical `rowCap`, hence the
 * identical cols and blockRows. `hint` is normally zero; a controlled video
 * spends one row on its transport. The image equivalence is swept over budgets
 * 1..60 x bordered/unbordered x width {undefined, 96, 40} x all three fits, and
 * the controlled-video case is swept separately in
 * test/image-page-fit.test.ts.
 *
 * The equivalence is what lets the budget ride ON THE BLOCK instead of in
 * `RenderContext`. Populating `ctx.panelHeight` at page level — the obvious
 * alternative — would ALSO hard-truncate the composed rows (Image.ts's
 * `compose`) and re-cap every resizable frame through `frameLimitsOf`, i.e. it
 * would change behaviour for images that never opted in.
 *
 * Returns the ORIGINAL object on every path that changes nothing, exactly as
 * {@link framedImageBlock} does, so a plain image allocates nothing per frame.
 * The two transforms compose in either order: each is the identity on the
 * other's opt-in.
 *
 * @param block      The authored image block.
 * @param budgetRows Rows the whole block may occupy, border included, or
 *                   undefined for "no grant" — which is what every caller that
 *                   is not the page loop passes.
 */
export function pageFitImageBlock<T extends ImageBlock | VideoBlock>(
  block: T,
  budgetRows: number | undefined,
): T {
  if (!isPageFitImage(block)) return block;
  if (budgetRows === undefined || !Number.isFinite(budgetRows)) return block;
  // Floored at 1 rather than 0: geometry clamps rows to >= 1 anyway, and a
  // bordered block cannot go below 3 rows at all (the border is dropped only on
  // a WIDTH shortfall), so at a tiny leftover the page scrolls by a row or two
  // instead of the image vanishing. That is the better failure.
  const room = Math.max(
    1,
    Math.floor(budgetRows) - borderChrome(block) - frameHintRows(block),
  );
  const declared = normDim(block.maxHeight);
  const maxHeight = declared !== undefined && declared < room ? declared : room;
  if (maxHeight === block.maxHeight) return block;
  return { ...block, maxHeight };
}

/**
 * Rows a page-fit image's BLOCK occupies once padded out to its grant.
 *
 * `contain` preserves the source aspect, so a picture routinely cannot spend its
 * whole grant: a wide source runs out of rows to need long before it runs out of
 * rows to have. A 1080x709 frame at 135 columns wants 46 rows and will not take
 * a 57th whatever it is offered.
 *
 * The surplus is kept INSIDE the block rather than left at the bottom of the
 * page, for two reasons. Visually, a top-aligned page dumps it as one black band
 * under the last block — 22 rows of it on a 90-row window — which reads as a
 * truncated page; held here it becomes symmetric margin around the picture, and
 * the blocks below stay where the composition puts them. Structurally, it means
 * a granted image occupies EXACTLY the rows the page set aside for it, so the
 * layout estimator can reserve the grant without re-deriving anything, and no
 * focus rect below it can drift.
 *
 * `Math.max` rather than the grant alone: at a grant smaller than the block's
 * floor (a bordered image cannot go below 3 rows) the picture wins and the page
 * scrolls by a row or two, which is the honest failure and the one
 * {@link pageFitImageBlock} already chose.
 *
 * @param drawnRows Rows the image itself occupies, border included.
 * @param grant Rows the page set aside, or undefined for "no grant" — in which
 *   case there is nothing to pad to and the picture stands alone.
 */
export function pageFitBlockRows(drawnRows: number, grant: number | undefined): number {
  if (grant === undefined || !Number.isFinite(grant)) return drawnRows;
  const room = Math.floor(grant);
  return room > drawnRows ? room : drawnRows;
}

/** Blank rows above the picture inside its grant. The remainder goes below. */
export function pageFitLeadRows(drawnRows: number, grant: number | undefined): number {
  return (pageFitBlockRows(drawnRows, grant) - drawnRows) >> 1;
}

/**
 * Apply `steps` resize steps to the current frame width and clamp the result.
 *
 * The caller is expected to feed the returned width back through
 * `framedImageBlock` + `imageCellSize` and store what geometry ACTUALLY
 * produced: when the row cap binds, geometry hands back fewer columns than
 * asked for, and storing the request instead of the result would leave the
 * frame's stored width running ahead of what is on screen — several presses of
 * `-` would then do nothing at all before the picture moved.
 */
export function stepFrameCols(
  current: number,
  steps: number,
  block: ImageBlock,
  limits: FrameLimits,
): number {
  return clampFrameCols(current + steps * FRAME_STEP_COLS, block, limits);
}

/**
 * Normalise an author-supplied cell dimension. Same rule as geometry.ts:
 * absent, non-finite and non-positive all mean "unspecified".
 */
function normDim(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  return n >= 1 ? n : undefined;
}
