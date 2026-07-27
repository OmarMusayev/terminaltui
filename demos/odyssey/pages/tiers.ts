import { col, divider, image, markdown, row } from "../../../src/index.js";
import type { ImageMode } from "../../../src/index.js";

export const metadata = { label: "Approved print stocks", order: 3 };

const SRC = "./assets/odysseus.jpg";

/**
 * Three across, so all six stocks are one scroll instead of three screens.
 *
 * At 99 content columns a span-4 cell is ~31 wide; 28 leaves a column of air
 * either side and keeps every label on one line. A label that wraps pushes its
 * own picture down a row and breaks the alignment the comparison depends on —
 * which is why the stock names below are short and the commentary lives in the
 * prose, not in the headings.
 *
 * The still is landscape, so 28 columns derives only 9 rows; two bands of
 * three fit comfortably where the portrait Pillars source needed more.
 */
const W = 28;

const STOCKS: Array<{ mode: ImageMode; stock: string }> = [
  { mode: "quadrant", stock: "15-perf 70mm IMAX" },
  { mode: "half", stock: "5-perf 65mm" },
  { mode: "braille", stock: "monochrome dupe" },
  { mode: "solid", stock: "Super 8" },
  { mode: "shading", stock: "newsprint halftone" },
  { mode: "ascii", stock: "a bootleg" },
];

export default function Tiers() {
  return [
    markdown(
      "The same negative, struck at the same width to every stock the laboratory still runs, so the " +
      "only variable is the print. Your terminal was inspected at launch and assigned the highest " +
      "stock it can carry: on kitty and Ghostty that is roughly two hundred real pixels a cell, in " +
      "Apple Terminal it is four. The projector tells you which one it chose on the first page. " +
      "The rest are shown here for the record, and as a warning.",
    ),
    divider("in descending order of respect"),
    // row(), not columns(): a columns() block reserves the whole layout height
    // whatever its tallest cell needs, which leaves dead rows under every pair.
    // row() trims its trailing blanks, so each band is exactly as tall as the
    // pictures in it, and cells wrap three per line at span 4 — two at sm, one
    // at xs, so a narrow window still reads.
    row(
      STOCKS.map((s) =>
        col(
          [
            markdown(`### ${s.stock}`),
            image(SRC, { width: W, mode: s.mode, alt: `${s.mode} print` }),
          ],
          { span: 4, sm: 6, xs: 12 },
        ),
      ),
      { gap: 1 },
    ),
    markdown(
      "Top band: the stocks that fit more than one sample in a character. Bottom band: the ones " +
      "that cannot. The monochrome dupe packs the most samples of all — eight to a cell — and " +
      "spends every one of them on a single ink, which is why it wins on title cards and loses " +
      "catastrophically on a face in a helmet.",
    ),
  ];
}
