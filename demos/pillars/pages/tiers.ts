import { col, divider, image, markdown, row } from "../../../src/index.js";
import type { ImageMode } from "../../../src/index.js";

export const metadata = { label: "Every tier, side by side", order: 3 };

const SRC = "./assets/pillars.jpg";

/**
 * Three across, so all six tiers are one scroll instead of three screens.
 *
 * At 99 content columns a span-4 cell is ~31 wide; 28 leaves a column of air
 * either side so neighbouring pictures read as separate objects, and keeps
 * every label on one line — a label that wraps pushes its own image down a row
 * and breaks the alignment the comparison depends on.
 */
const W = 28;

const TIERS: Array<{ mode: ImageMode; note: string }> = [
  { mode: "quadrant", note: "2x2, fg + bg" },
  { mode: "half", note: "1x2, fg + bg" },
  { mode: "braille", note: "2x4, one pen" },
  { mode: "solid", note: "1x1, bg only" },
  { mode: "shading", note: "1x1, fg ramp" },
  { mode: "ascii", note: "1x1, no colour" },
];

export default function Tiers() {
  return [
    markdown(
      "The same JPEG through every cell tier, at the same width, so only the technique changes. " +
      "`mode` pins one; left alone, `\"auto\"` negotiates from colour depth, Unicode coverage, and " +
      "whether a multiplexer is in the way.",
    ),
    divider("sub-cells per character"),
    // row(), not columns(): a columns() block reserves the WHOLE layout height
    // whatever its tallest cell needs, so the previous three-pair version left
    // a block of dead rows under each pair (measured: 8 blank rows under a
    // 21-row image on a 44-row terminal) and ran to three screens. row() trims
    // its trailing blank lines, so each band is exactly as tall as the pictures
    // in it, and cells wrap three per line at span 4 — two at sm, one at xs, so
    // a narrow window still reads.
    row(
      TIERS.map((t) =>
        col(
          [
            // A heading, not `**bold**`: inline emphasis is stripped before
            // styling by the text renderer, so it would render flat. Headings
            // come out in the theme accent, which is what separates the six
            // labels from the body copy above and below them.
            markdown(`### ${t.mode} — ${t.note}`),
            image(SRC, { width: W, mode: t.mode, alt: `${t.mode} tier` }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
      ),
      { gap: 1 },
    ),
    markdown(
      "Top row: the tiers that fit more than one sample in a character. Bottom row: the ones that " +
      "cannot. `braille` packs the most samples of all — eight — but spends them on a single " +
      "foreground colour, which is why it wins on line art and loses badly on a photograph.",
    ),
  ];
}
