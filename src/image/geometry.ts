/**
 * Image geometry — the single authority for how many terminal cells an image
 * block occupies.
 *
 * Two independent multipliers turn pixels into cells, and the pre-existing
 * implementation applied one of them twice: `ascii/image.ts:140` scaled the
 * pixel target by 0.5 for the cell aspect and then the renderers stepped `y`
 * by 2 (blocks) or 4 (braille) for the sub-cell layout, so every sub-cell mode
 * came out 2x vertically squashed. This module owns exactly ONE of them —
 * CELL_ASPECT, the shape of a character cell. The tier's sub-cell factor is a
 * separate multiplier applied by `subCellGridSize()` below and is never folded
 * into the cell counts.
 *
 * The function is PURE in (header, options, availWidth, availHeight). That is
 * what makes the reserved row count identical across the loading, loaded,
 * error and no-decoder states: all four call it with the same header from the
 * synchronous header probe, so nothing reflows when pixels arrive.
 *
 * No I/O, no runtime state, no escape sequences.
 */

import { CELL_ASPECT, IMAGE_LIMITS, subCellFactor } from "./types.js";
import type {
  CellGeometry,
  ImageFit,
  ImageHeader,
  ImageRenderOptions,
  ImageTier,
} from "./types.js";
import type { BorderStyle } from "../style/borders.js";
import { CONTENT_MAX_WIDTH } from "../core/layout-constants.js";

/**
 * Widest an image may ever be. A content page centres its column at
 * CONTENT_MAX_WIDTH and then hands block renderers one column less for the
 * focus-indicator gutter (`blockRenderWidth()` in layout-constants.ts), so 99
 * is the true ceiling on a full-width page. Clamping here too means a caller
 * that passes a raw terminal width cannot produce a block that overflows the
 * content column.
 */
export const MAX_IMAGE_COLS = CONTENT_MAX_WIDTH - 1;

/**
 * Tallest an image may ever be. IMAGE_LIMITS.maxCells is expressed as
 * 100 x 200 cells, so 200 rows is the row half of that budget.
 */
export const MAX_IMAGE_ROWS = Math.floor(IMAGE_LIMITS.maxCells / CONTENT_MAX_WIDTH);

/**
 * Source edge assumed when no header is available. Square pixels, because a
 * square source yields a 2:1 cell box (rows = cols * 1 * CELL_ASPECT) — the
 * sane default the layout reserves before anything has been probed.
 */
export const DEFAULT_SOURCE_EDGE = 256;

/** Source-pixel region an image samples. Full frame unless `fit: "cover"`. */
export interface ImageCropRect {
  /** Left edge of the sampled region, in SOURCE pixels. */
  sx: number;
  /** Top edge of the sampled region, in SOURCE pixels. */
  sy: number;
  /** Width of the sampled region, in SOURCE pixels. Always >= 1. */
  sw: number;
  /** Height of the sampled region, in SOURCE pixels. Always >= 1. */
  sh: number;
}

/**
 * Everything the renderer and the layout estimator need to agree on.
 *
 * Extends CellGeometry additively, so anything typed against the shared
 * contract keeps working — `cols`/`rows` are the image area alone.
 */
export interface ImageGeometry extends CellGeometry {
  /** Total block footprint including the optional frame border. */
  blockCols: number;
  /** Total block rows including the optional frame border. What layout reserves. */
  blockRows: number;
  /**
   * Source-pixel region to sample. Meaningful ONLY for `fit: "cover"`.
   *
   * For every other fit this is the full frame *as the header reported it*, and
   * the header can be absent (DEFAULT_SOURCE_EDGE is assumed) or simply wrong —
   * so the renderer must not apply it as a crop outside "cover". Applying it
   * unconditionally hard-cut a 400x100 JPEG with an unreadable header to its
   * top-left 256x256 pixels.
   */
  crop: ImageCropRect;
  /** Resolved fit, so the renderer does not have to re-default it. */
  fit: ImageFit;
  /** True when no usable header was available and DEFAULT_SOURCE_EDGE was assumed. */
  estimated: boolean;
}

/**
 * Size an image block in terminal cells.
 *
 * Contract details that matter to callers:
 * - `opts.width` / `opts.height` / `opts.maxHeight` size the IMAGE area.
 *   `availWidth` / `availHeight` budget the whole BLOCK, frame included.
 * - "contain" (default) never letterboxes. It returns the largest
 *   aspect-correct box that satisfies every constraint, so the block simply
 *   occupies fewer cells rather than padding rows of background.
 * - "cover" fills the requested box exactly and returns the centred source
 *   crop that the resampler must sample instead of the full frame.
 * - "fill" ignores the source aspect entirely and stretches.
 * - Never returns zero or negative: cols and rows are always >= 1.
 *
 * @param header Probed dimensions, or null when the source has not been read
 *   (or could not be). Null still yields a deterministic geometry.
 * @param opts The block's public options.
 * @param availWidth Cells available to the block horizontally.
 * @param availHeight Cells available to the block vertically. Optional.
 * @param maxCols Override for {@link MAX_IMAGE_COLS}. The default ceiling is a
 *   PAGE-layout constraint (the content column), so a caller that is not
 *   rendering into one — `asciiImage()`, which is a standalone utility — passes
 *   its own. `IMAGE_LIMITS.maxCells` still applies either way.
 */
export function imageCellSize(
  header: ImageHeader | null,
  opts: ImageRenderOptions,
  availWidth: number,
  availHeight?: number,
  maxCols?: number,
): ImageGeometry {
  const fit: ImageFit = opts.fit ?? "contain";

  const colCeiling =
    maxCols !== undefined && Number.isFinite(maxCols) && maxCols >= 1
      ? Math.floor(maxCols)
      : MAX_IMAGE_COLS;
  const availCols = Number.isFinite(availWidth) ? Math.floor(availWidth) : colCeiling;
  // The border is dropped rather than shrunk when the allocation cannot hold a
  // bordered 1x1 image. Clamping the IMAGE to >= 1 and then adding 2 back made a
  // framed block 3 columns wide inside a 1-column slot, which is the one path
  // where the "rows are exactly blockCols wide" invariant failed — a columns
  // layout truncated it with an ellipsis, and at page level it simply overran.
  const border = hasBorder(opts.border) && availCols - 2 >= 1 ? 2 : 0;

  const known =
    header != null &&
    Number.isFinite(header.width) &&
    Number.isFinite(header.height) &&
    header.width >= 1 &&
    header.height >= 1;
  const srcW = known ? Math.floor(header.width) : DEFAULT_SOURCE_EDGE;
  const srcH = known ? Math.floor(header.height) : DEFAULT_SOURCE_EDGE;

  // Rows per column for the full source. CELL_ASPECT is applied HERE and
  // nowhere else in the pipeline.
  const cellRatio = (srcH / srcW) * CELL_ASPECT;

  const colBudget = clampInt(availCols - border, 1, colCeiling);

  const availRows =
    availHeight !== undefined && Number.isFinite(availHeight)
      ? Math.floor(availHeight) - border
      : MAX_IMAGE_ROWS;
  const rowCap = clampInt(
    Math.min(normDim(opts.maxHeight) ?? MAX_IMAGE_ROWS, availRows),
    1,
    MAX_IMAGE_ROWS,
  );

  const reqRows = normDim(opts.height);
  let cols = clampInt(normDim(opts.width) ?? colBudget, 1, colBudget);
  let rows: number;

  if (fit === "contain") {
    // Aspect is preserved, so an explicit height is a ceiling to fit inside,
    // not a box to pad out to.
    const cap = Math.min(rowCap, reqRows ?? rowCap);
    rows = rowsForCols(cols, cellRatio);
    if (rows > cap) {
      cols = colsWithinRowCap(cap, cellRatio, cols);
      rows = Math.min(rowsForCols(cols, cellRatio), cap);
    }
  } else {
    // "cover" and "fill" both occupy the requested box exactly; they differ
    // only in how the source is mapped into it (crop vs stretch).
    rows = clampInt(reqRows ?? rowsForCols(cols, cellRatio), 1, rowCap);
  }

  // Guardrail, not a normal path: MAX_IMAGE_COLS x MAX_IMAGE_ROWS is already
  // inside the budget, so this only fires if the ceilings above ever diverge
  // from IMAGE_LIMITS.
  if (cols * rows > IMAGE_LIMITS.maxCells) {
    const k = Math.sqrt(IMAGE_LIMITS.maxCells / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }

  const crop =
    fit === "cover"
      ? coverCrop(srcW, srcH, cols, rows)
      : { sx: 0, sy: 0, sw: srcW, sh: srcH };

  return {
    cols,
    rows,
    blockCols: cols + border,
    blockRows: rows + border,
    crop,
    fit,
    estimated: !known,
  };
}

/**
 * Rows the whole block occupies, frame included — the number the layout
 * estimator must return so every sibling's focus rect lands correctly.
 */
export function imageBlockRows(
  header: ImageHeader | null,
  opts: ImageRenderOptions,
  availWidth: number,
  availHeight?: number,
): number {
  return imageCellSize(header, opts, availWidth, availHeight).blockRows;
}

/**
 * Sub-cell sampling grid for a cell geometry at a given tier.
 *
 * This is the SECOND multiplier, kept deliberately separate from the cell
 * aspect above: quadrant samples 2x2 per cell, half 1x2, braille 2x4, and the
 * flat tiers 1x1. Feed the result straight to `resampleToGrid(pixels, subW,
 * subH, ...)`; do not scale it again for aspect.
 */
export function subCellGridSize(
  geom: CellGeometry,
  tier: ImageTier,
): { subW: number; subH: number } {
  const factor = subCellFactor(tier);
  return {
    subW: Math.max(1, geom.cols * factor.x),
    subH: Math.max(1, geom.rows * factor.y),
  };
}

// ─── Internals ───────────────────────────────────

/**
 * Whether an image's `border` option asks for a frame.
 *
 * Mirrors the `boolean | BorderStyle` convention `card`, `table` and `panel`
 * already use: `true` means "the site's style", a style name overrides it, and
 * `"none"` is an explicit no.
 *
 * Exported because `image/frame.ts` needs the SAME answer to reserve the two
 * columns a border costs. It used to carry its own copy with a comment asking
 * the next editor to keep the two in step — the exact arrangement this
 * workflow's palette module was created to abolish. One predicate, one place.
 */
export function hasBorder(border: boolean | BorderStyle | undefined): boolean {
  return border === true || (typeof border === "string" && border !== "none");
}

/** Rows a column count implies at a given rows-per-column ratio. */
function rowsForCols(cols: number, cellRatio: number): number {
  const rows = Math.round(cols * cellRatio);
  return rows >= 1 ? rows : 1;
}

/**
 * Widest column count whose derived rows still fit `cap`.
 *
 * Solved by search rather than by `cap / cellRatio` because the inverse of a
 * rounded function is not the rounding of the inverse: at cap 14 a ratio that
 * maps 28 cols to 15 rows would otherwise be handed straight back and blow the
 * cap. Floor-seeded, so it converges in one or two steps.
 */
function colsWithinRowCap(cap: number, cellRatio: number, maxCols: number): number {
  let cols = clampInt(Math.floor(cap / cellRatio), 1, maxCols);
  while (cols > 1 && rowsForCols(cols, cellRatio) > cap) cols--;
  while (cols < maxCols && rowsForCols(cols + 1, cellRatio) <= cap) cols++;
  return cols;
}

/**
 * Centred source crop for `fit: "cover"`.
 *
 * The cell box is converted back into square-pixel space before comparing
 * aspects — a cols x rows box of half-height cells is `cols` wide and
 * `rows / CELL_ASPECT` tall in pixels — so the crop and the cell grid agree on
 * exactly one aspect ratio.
 */
function coverCrop(srcW: number, srcH: number, cols: number, rows: number): ImageCropRect {
  const targetRatio = rows / (cols * CELL_ASPECT); // source height / width
  const srcRatio = srcH / srcW;

  let sw = srcW;
  let sh = srcH;
  if (srcRatio > targetRatio) {
    sh = clampInt(Math.round(srcW * targetRatio), 1, srcH);
  } else if (srcRatio < targetRatio) {
    sw = clampInt(Math.round(srcH / targetRatio), 1, srcW);
  }

  return {
    sx: Math.floor((srcW - sw) / 2),
    sy: Math.floor((srcH - sh) / 2),
    sw,
    sh,
  };
}

/**
 * Normalise an author-supplied cell dimension.
 *
 * Absent, non-finite and non-positive all mean "unspecified" rather than
 * "zero": `width: 0` from a bad expression should fill the available width,
 * not render a 1-cell sliver nobody can see.
 */
function normDim(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  const n = Math.floor(v);
  return n >= 1 ? n : undefined;
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  const n = Math.floor(v);
  return n < lo ? lo : n > hi ? hi : n;
}
