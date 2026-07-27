import { FRAME_MIN_COLS, image, markdown, table } from "../../../src/index.js";

export const metadata = { label: "Choose your gauge", order: 2 };

const SRC = "./assets/odysseus.jpg";

/**
 * Start at the floor, on purpose.
 *
 * `FRAME_MIN_COLS` is 8, which derives 3 rows — small enough that the picture
 * is genuinely unreadable, which is the joke's setup. The payoff only exists
 * if there is somewhere to climb from, and a page that opened at IMAX would
 * have no bit at all. The heading says the keys are live and the frame arrives
 * focused, so nobody is stranded at Super 8.
 */
const START_COLS = FRAME_MIN_COLS;

/**
 * The ladder, as film gauges. Every width is reachable: the frame steps by
 * `FRAME_STEP_COLS` (4) and every rung below is 8 + a multiple of 4.
 *
 * The top rung is 64, which derives 21 rows and 23 with the border. It is
 * reachable on an ordinary window BECAUSE almost nothing sits above the
 * picture on this page — the frame is clamped so it can never push its own
 * bottom edge off screen, so every row of prose above it lowers the ceiling.
 * That is why the ladder table is printed BELOW the image and the intro is one
 * sentence.
 */
const RUNGS: Array<[cols: number, gauge: string, verdict: string]> = [
  [8, "Super 8", "a home gauge; the director was not consulted"],
  [16, "16mm reversal", "the grain is now larger than the helmet"],
  [24, "35mm Academy, 1.375:1", "what the studio would like you to settle for"],
  [36, "Super 35, extracted to 2.39:1", "resolution spent on shape; declined"],
  [48, "5-perf 65mm", "the crest resolves and he stops talking"],
  [64, "15-perf 65mm IMAX, 1.43:1", "correct; do not go back down"],
];

export default function Formats() {
  return [
    markdown(
      "### The gauge ladder: + strikes a larger negative, - steps down, 0 returns to Super 8\n" +
      "The frame below is already focused, so the keys are live.",
    ),
    image(SRC, {
      width: START_COLS,
      border: true,
      resizable: true,
      alt: "THE ODYSSEY (2026) — gauge test",
    }),
    markdown(
      "A press of `+` does not enlarge the print. It returns to the original element and samples it " +
      "again into a larger grid, which is a new negative struck at a bigger gauge rather than an " +
      "optical blow-up. The ladder runs as follows. The director's position on where you should " +
      "stop is not ambiguous.",
    ),
    table(
      ["Columns", "Gauge", "Assessment"],
      RUNGS.map(([cols, gauge, verdict]) => [String(cols), gauge, verdict]),
    ),
    markdown(
      "### Nothing on this page is being magnified\n" +
      "Climb it and the crest separates from the sky, the eye slits open into two distinct voids, " +
      "and the lion heads on the breastplate resolve into lions, none of which was on screen a " +
      `moment ago. Downward the ladder stops at ${FRAME_MIN_COLS} columns, the smallest gauge this ` +
      "laboratory is willing to certify. Upward it stops at whatever your window still holds, so " +
      "the ceiling is a property of your furniture rather than of the film. Make the terminal " +
      "bigger. He has been saying this for twenty years.",
    ),
  ];
}
