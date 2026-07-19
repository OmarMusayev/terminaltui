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
