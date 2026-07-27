/**
 * The chosen mark, as a 16x16 pixel grid.
 *
 * `baseline-a-refined` — a lowercase 't' whose foot extends into a rule, with a
 * block cursor resting on it. The letterform and the command line are the same
 * stroke, and the accent is the caret rather than decoration, which is the only
 * place in the identity where a second colour earns its keep.
 *
 * Chosen from 25 first-round candidates across five territories and 28 refined
 * variants. The full exploration, including the runners-up and the critiques,
 * is at /logo/.
 *
 * Swapping the identity is a one-line change: replace this grid. Everything
 * that draws the mark — nav, footer, favicon, logo page — reads from here.
 *
 * '.' transparent · '#' ink · '+' accent
 */
export const MARK: readonly string[] = [
  "................",
  "................",
  ".....##.........",
  ".....##.........",
  "..########......",
  "..########......",
  ".....##.........",
  ".....##.........",
  ".....##.........",
  ".....##.....++..",
  ".....##.....++..",
  ".....#########..",
  ".....#########..",
  "................",
  "................",
  "................",
];

export const MARK_NAME = "baseline-a-refined";

/**
 * The knockout tile build, for contexts where a mark on a transparent ground
 * disappears — an app icon, or an avatar against an unknown background.
 */
export const MARK_TILE: readonly string[] = [
  "................",
  ".##############.",
  ".##############.",
  ".#####..#######.",
  ".#####..#######.",
  ".###......#####.",
  ".###......#####.",
  ".#####..#######.",
  ".#####..#######.",
  ".#####..#######.",
  ".#####..#######.",
  ".#####.....++##.",
  ".#####.....++##.",
  ".##############.",
  ".##############.",
  "................",
];
