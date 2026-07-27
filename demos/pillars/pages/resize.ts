import { FRAME_MIN_COLS, FRAME_STEP_COLS, image, imageCellSize, markdown } from "../../../src/index.js";

export const metadata = { label: "Resize the frame", order: 2 };

const SRC = "./assets/pillars.jpg";

/**
 * Deliberately small. The ceiling is whatever the window still fits, so on a
 * comfortably-sized terminal this frame can roughly double before it saturates
 * — and the page is about the DIFFERENCE between the two ends, not either end.
 */
const START_COLS = 32;

export default function Resize() {
  // Ask the engine for the declared frame's row count instead of writing it
  // down: `imageCellSize` is the same function the layout engine calls, header
  // probe included, so the arithmetic in the copy below cannot drift from what
  // the hint row prints. Aspect correction stays in geometry.ts, where it
  // belongs, and this page never re-derives it.
  const startRows = imageCellSize({ type: "image", path: SRC, width: START_COLS }, START_COLS).rows;
  return [
    markdown(
      "The frame below is yours, and it is already focused — the keys work straight away.\n" +
      // A heading line, because it is the only markdown the text renderer
      // actually colours (inline `**`/`` ` `` are stripped before styling).
      // Kept short: heading lines are emitted without wrapping.
      `###  + or =  grow by ${FRAME_STEP_COLS} cells   ·   -  shrink   ·   0  back to ${START_COLS}\n` +
      "The row under the picture always shows the frame's current size.",
    ),
    image(SRC, {
      width: START_COLS,
      border: true,
      resizable: true,
      alt: "Pillars of Creation — resizable frame",
    }),
    markdown(
      "### Nothing is being magnified\n" +
      "The engine samples the source once per sub-cell, so a wider frame is not the same pixels drawn " +
      "larger — it is a fresh resample into a bigger grid. On the default quadrant tier this frame " +
      `starts as a ${START_COLS * 2}x${startRows * 2} grid of samples, and twice the width is four ` +
      "times the samples; on kitty the transmitted bitmap grows with the frame the same way. Detail " +
      "that had nowhere to land appears: the gap between the tall left pillar and the one beside it " +
      "opens up, the bright star off the left edge separates from the dust around it, and the ragged " +
      // Structure and detail improve on EVERY colour depth, which is the claim
      // the cell path can honour. Colour is a separate axis and the 256-colour
      // xterm palette cannot express most of this photograph's chroma at any
      // frame size — an earlier draft promised the background nebula's teal
      // "stops being one flat wash", which is simply false on Apple Terminal.
      "edge of the near pillar resolves from a smooth curve into the lumpy silhouette it really is.\n" +
      `Down, it stops at ${FRAME_MIN_COLS} cells. Up, it stops at whatever this window still fits, so ` +
      "growing the frame can never push its own bottom edge off screen — make the terminal bigger and " +
      "the ceiling moves with it.",
    ),
  ];
}
