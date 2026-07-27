import { getColorMode, image, markdown } from "../../../src/index.js";
// Deep imports, deliberately. The graphics verdict and the tier ladder are the
// engine's internals and are not on the public surface — but this page's whole
// job is to PROVE that detection happened, and a hardcoded string would prove
// nothing. Reading the same three functions the renderer reads is the only
// honest way to say what is on screen. Safe here because the demo runs from
// source (`npx tsx src/cli/index.ts dev demos/pillars/config.ts`), so these
// resolve to the very modules the running framework loaded; a bundled build
// would give this file its own copy of that module state.
import { getGraphicsCapability } from "../../../src/image/capability.js";
import { deriveCapabilities, selectTier, KITTY_TIER } from "../../../src/image/tier.js";
import { detectTerminal } from "../../../src/helpers/detect-terminal.js";
import type { RenderTier } from "../../../src/image/tier.js";
import type { ColorMode } from "../../../src/index.js";

export const metadata = { label: "The image", order: 1 };

const SRC = "./assets/pillars.jpg";

/**
 * Width of the hero frame, in cells.
 *
 * The source is portrait (1280x1335), so a cell frame costs about one row per
 * two columns: 48 cells derives 25 rows, 27 with the border.
 *
 * A page has no way to ask how many rows the window has, so this cannot adapt —
 * and on anything under about 32 rows the picture runs off the bottom and is
 * scrolled to, which is ordinary. What must NOT scroll off is the verdict,
 * because it is the only thing on the page that proves detection ran and names
 * the path in use. So the verdict is printed ABOVE the image rather than
 * below it: at 24 rows the reader sees which technique is on screen and the top
 * of the picture, instead of a truncated photograph and no explanation.
 */
const HERO_COLS = 48;

export default function Home() {
  const drawn = activePath();
  return [
    markdown(
      // `###` is the only markdown the text renderer actually colours: inline
      // `**bold**` is stripped before styling, so it would have been silent
      // noise. A heading line is emitted verbatim in the theme accent, which is
      // what makes the one line that matters here read as a verdict.
      `### ▸ ${drawn.headline}\n` +
      `${drawn.why}\n` +
      `${drawn.elsewhere}`,
    ),
    image(SRC, {
      width: HERO_COLS,
      border: true,
      alt: "Pillars of Creation — Hubble WFC3/UVIS, 2014",
    }),
    markdown(
      "Pillars of Creation — Hubble WFC3/UVIS, 2014. NASA/ESA/Hubble Heritage. Public domain.",
    ),
  ];
}

/** What the renderer decided, and why — read live, never assumed. */
interface ActivePath {
  /** The technique actually on screen. */
  headline: string;
  /** The evidence the detector acted on, in its own words. */
  why: string;
  /** What the SAME block would draw somewhere else. */
  elsewhere: string;
}

/**
 * Re-run the exact negotiation `renderBody()` in components/Image.ts runs.
 *
 * Three inputs, all live: the colour mode the runtime published for this
 * session, whether non-ASCII glyphs may be emitted, and the graphics verdict
 * the runtime settled at startup (env ladder, plus an active probe on a local
 * TTY that names no terminal we recognise).
 *
 * The `termType` argument Image.ts threads for an SSH client is deliberately
 * omitted: a page function cannot reach that session slot, and for the local
 * `dev` run this demo is written for it is `undefined` on both sides, which
 * makes this call byte-identical to the renderer's.
 */
function activePath(): ActivePath {
  const graphics = getGraphicsCapability();
  const colorMode = getColorMode();
  const term = detectTerminal();
  const tier = selectTier("auto", deriveCapabilities(colorMode, term.unicode), graphics);

  const pixels = tier === KITTY_TIER;
  return {
    headline: headlineFor(tier, colorMode),
    // The detector's own words, not a paraphrase, and short enough to land on
    // ONE row at 99 columns — which is what pins the caption's height, and so
    // the hero's width. Trimmed at the semicolon: the longest reason in
    // capability.ts carries an aside there, never the reason itself.
    why: `Why: ${graphics.reason.split(";")[0]}.`,
    elsewhere: pixels
      ? "On Apple Terminal, inside tmux or over a plain SSH login this same block draws coloured cells."
      : "Open this same page in kitty or Ghostty and this same block becomes a real bitmap.",
  };
}

/**
 * One sentence naming the technique.
 *
 * Hard limit ~90 characters: this is rendered as a markdown HEADING, and the
 * text renderer emits heading lines without wrapping them. The longest of these
 * is the kitty one at 84.
 */
function headlineFor(tier: RenderTier, colorMode: ColorMode): string {
  const colours = COLOUR_NAMES[colorMode];
  switch (tier) {
    case KITTY_TIER:
      return "kitty graphics protocol — one real bitmap, sent once, addressed by placeholder cells";
    case "quadrant":
      return `quadrant cells — four sub-pixels per character, ${colours}`;
    case "half":
      return `half blocks — two sub-pixels per character, ${colours}`;
    case "solid":
      return `solid cells — one background colour per character, ${colours}`;
    case "shading":
      return `shading ramp — one foreground colour per character, ${colours}`;
    case "braille":
      return "braille dots — eight sub-pixels per character, sharing one pen";
    case "ascii":
      return "ASCII ramp — luminance only, no colour emitted at all";
    default:
      return "alt text — image rendering is switched off for this session";
  }
}

const COLOUR_NAMES: Record<ColorMode, string> = {
  truecolor: "24-bit truecolour",
  "256": "the 256-colour xterm palette",
  "16": "16 ANSI colours",
  none: "no colour",
};
