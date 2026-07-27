/**
 * Single source of truth for the frame geometry of a rendered page.
 *
 * Every constant here is numerically identical to the literals it replaced —
 * introducing this module changes no rendered output.
 */

/** Maximum width of the centered content column (was `Math.min(width, 100)`). */
export const CONTENT_MAX_WIDTH = 100;
/** Header block of a content page: blank + title row + rule + scroll-hint. */
export const HEADER_LINES = 4;
/** Footer block of a content page: below-hint + rule + keybar. */
export const FOOTER_LINES = 3;
/** The `:command` / notification row written by writeToTerminal over the last line. */
export const STATUS_ROW = 1;
/** Minimum height budget handed to layout blocks. */
export const MIN_LAYOUT_HEIGHT = 10;

/** Width of the centered content column. */
export function contentWidth(columns: number): number {
  return Math.min(columns, CONTENT_MAX_WIDTH);
}

/**
 * Width handed to block renderers: contentWidth minus the 1-col
 * focus-indicator gutter (" " or "▌") prepended to every content line.
 */
export function blockRenderWidth(columns: number): number {
  return Math.max(1, contentWidth(columns) - 1);
}

/**
 * Width a `fitPage` image is composed against: the whole terminal.
 *
 * Every other block lives inside the centred content column, which is capped at
 * CONTENT_MAX_WIDTH so long prose does not run to a 200-column measure. That cap
 * is a TYPOGRAPHIC one and a picture is not type: applied to a page-fit image it
 * pinned the picture at 99 columns, and since `contain` derives rows from
 * columns, the row budget the page had just granted could not be spent — a
 * 1080x709 source saturated at 34 rows and left 22 rows of the screen black on a
 * 90-row window, the dead band growing one row per terminal row after that.
 *
 * A page-fit image therefore composes edge to edge and is positioned against the
 * terminal rather than the column (renderContentPage writes its rows without the
 * usual left pad). Nothing else on the page moves.
 */
export function pageFitWidth(columns: number): number {
  return Math.max(1, Math.floor(columns));
}

/**
 * Height budget given to layout blocks (columns/rows/grid/panel/row) and the
 * focus-rect walk. rows − (HEADER_LINES + FOOTER_LINES + STATUS_ROW) === rows − 8,
 * numerically identical to the previous inline literals.
 */
export function layoutAvailHeight(rows: number): number {
  return Math.max(MIN_LAYOUT_HEIGHT, rows - (HEADER_LINES + FOOTER_LINES + STATUS_ROW));
}

/**
 * Scroll viewport of the content page body (rows − 7). Intentionally one more
 * than layoutAvailHeight: the status row overlays the last line, it doesn't
 * shrink the viewport.
 */
export function viewportHeight(rows: number): number {
  return Math.max(1, rows - HEADER_LINES - FOOTER_LINES);
}
