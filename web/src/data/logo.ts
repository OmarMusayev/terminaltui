/**
 * The chosen mark, as a 16x16 pixel grid.
 *
 * A tiling window-manager layout, drawn full bleed: a full-height master pane
 * down the middle, a bar across the top, and side bands whose horizontal splits
 * deliberately fail to line up across the gutters. The accent marks a focused
 * pane, which is a real state in a real tiling WM and a real state in this
 * framework's own layout engine.
 *
 * Drawn by hand in the pixel editor, after a generated exploration of 25 marks
 * across five territories, 28 refinements, and a further 36 variants inside the
 * tiling territory failed to produce anything worth keeping. The drawing was
 * then diagnosed by four lenses and refined along five mandates; the full
 * record is at /logo/mark/ and /logo/tiling/.
 *
 * Six cells separate this from the original drawing, and both edits close a
 * defect rather than change the design:
 *
 *   - Rows 0-1, column 4 cleared. The top-left pane was 5 wide where every other
 *     pane is 4, which left the column 4-5 gutter one cell wide across those two
 *     rows. It now runs 2 cells for all 16 rows.
 *   - Row 13, columns 0-3 cleared. The left band's lower gutter was a single row.
 *     It is now rows 12-13.
 *
 * Both gutters had to reach 2 cells because one cell is one device pixel at
 * favicon size. Rows 12-13 rather than 11-12 because a 2x2 block of this grid
 * becomes one output pixel at 8px and blocks start on even rows: 12-13 sits
 * inside one block and renders exactly, where 11-12 straddles two and renders
 * grey. Every interval in the mark is now even, in both axes.
 *
 * Measured: 168 occupied cells (65.6%: 144 ink, 24 accent); centre of mass
 * (7.64, 7.21) against a field
 * centre of (7.5, 7.5); thinnest feature 2 cells; narrowest gutter 2 cells;
 * zero impure blocks at 8px, so light and dark are the same
 * drawing at every size.
 *
 * Swapping the identity is a one-line change: replace this grid. Everything
 * that draws the mark — nav, footer, favicon, logo pages — reads from here.
 *
 * '.' transparent · '#' ink · '+' accent
 */
export const MARK: readonly string[] = [
  "####..##########",
  "####..##########",
  "......##########",
  "......##########",
  "####..####......",
  "####..####......",
  "####..####..++++",
  "####..####..++++",
  "####..####..++++",
  "####..####..++++",
  "####..####......",
  "####..####......",
  "......####..####",
  "......####..####",
  "++++..####..####",
  "++++..####..####",
];

export const MARK_NAME = "trim-and-shrink-accent";

/**
 * The knockout tile build.
 *
 * The primary mark already bleeds to all four edges, so unlike a letterform it
 * needs no separate solid-ground version — it is its own tile. Kept as an alias
 * so callers asking for a tile still get something correct, and so the
 * distinction stays visible if the identity is ever swapped for a mark that
 * does need one.
 */
export const MARK_TILE: readonly string[] = MARK;
