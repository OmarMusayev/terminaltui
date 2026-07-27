import { divider, getColorMode, image, markdown } from "../../../src/index.js";
// Deep imports, deliberately — same reasoning as demos/pillars/pages/home.ts.
// The projection certificate below is the joke AND the proof: it claims the
// terminal was "inspected at launch and assigned a print stock", and that is
// only funny if it is literally what happened. A hardcoded string would be a
// lie in a demo whose entire premise is fidelity. Safe because the demo runs
// from source, so these resolve to the modules the running framework loaded.
import { getGraphicsCapability } from "../../../src/image/capability.js";
import { KITTY_TIER, deriveCapabilities, selectTier } from "../../../src/image/tier.js";
import { detectTerminal } from "../../../src/helpers/detect-terminal.js";
import type { RenderTier } from "../../../src/image/tier.js";
import type { ColorMode } from "../../../src/index.js";

export const metadata = { label: "The presentation", order: 1 };

const SRC = "./assets/odysseus.jpg";

/**
 * Hero width in cells.
 *
 * The still is landscape (1080x709), which is cheap in rows — a cell frame
 * costs about one row per three columns, so 60 cells derives 20 rows and 22
 * with the border. That is what makes a genuinely large hero affordable here,
 * where the portrait Pillars source could not go past 48.
 *
 * The certificate sits ABOVE the picture and the programme notes BELOW it, so
 * a short window still shows the verdict and the top of the frame rather than
 * a wall of prose and no photograph.
 */
const HERO_COLS = 60;

export default function Home() {
  const print = projectionCertificate();
  return [
    markdown(
      // `###` is the only markdown the text renderer colours — inline `**` is
      // stripped before styling — so the headings here are the only lines that
      // land in the theme accent.
      "### Viewing Odysseus the way Christopher Nolan intended\n" +
      `${print.stock}\n` +
      `${print.inspection}`,
    ),
    image(SRC, {
      width: HERO_COLS,
      border: true,
      alt: "THE ODYSSEY (2026) — frame enlargement",
    }),
    markdown(
      "THE ODYSSEY (2026), dir. Christopher Nolan. Reel 4, frame 92,116. 15-perf 65mm negative, " +
      "contact print, 1.43:1. Projector alignment checked in person.",
    ),
    divider("programme notes"),
    markdown(
      "This frame was photographed on 15-perf 65mm negative, contact-printed to 70mm, and brought " +
      "to this terminal with no digital intermediate at any stage. It is exhibited at the full " +
      "1.43:1 aperture, uncropped, at the largest gauge this window will accept. A character cell " +
      "carries four sub-pixels and exactly two independent colours, one foreground and one " +
      "background, which is the entire colour latitude the format permits, and the cell spends one " +
      "of the two on the lion heads without being asked to. The blocking you can see where the sky " +
      "changes slowly is grain. It was not added in post. It is the emulsion committing.",
    ),
    markdown(
      "The director asks that you view this on the largest screen available to you. If the window " +
      "is not maximised, maximise it. If you are on a laptop, connect the laptop to something " +
      "larger. Twelve terminal emulators in the world are certified to project this at full gauge, " +
      "and yours is very likely not among them; it remains the correct way to see the film. Under " +
      "no circumstances watch this on a phone. The presentation is silent, the format carrying no " +
      "audio track of any kind, which makes this the first time a Christopher Nolan production has " +
      "been exhibited in its intended dynamic range.",
    ),
  ];
}

/** The stock this terminal was assigned, and the evidence behind it. */
interface Certificate {
  /** The print stock, as a heading line. */
  stock: string;
  /** What the projectionist actually observed, in the detector's own words. */
  inspection: string;
}

/**
 * Re-run the exact negotiation `renderBody()` in components/Image.ts runs, and
 * report it as a laboratory certificate.
 *
 * Three live inputs: the colour mode published for this session, whether
 * non-ASCII glyphs may be emitted, and the graphics verdict settled at startup.
 * The `termType` argument Image.ts threads for an SSH client is omitted for the
 * same reason as in the Pillars demo — a page cannot reach that session slot,
 * and for a local `dev` run it is `undefined` on both sides.
 */
function projectionCertificate(): Certificate {
  const graphics = getGraphicsCapability();
  const colorMode = getColorMode();
  const term = detectTerminal();
  const tier = selectTier("auto", deriveCapabilities(colorMode, term.unicode), graphics);

  return {
    stock: `### Struck for this projector: ${STOCK[tier] ?? "no print — the lamp is out"}`,
    // The detector's own words, trimmed at the semicolon so the line fits on
    // one row at 99 columns; the longest reason in capability.ts carries an
    // aside there, never the reason itself.
    inspection:
      `Inspected at launch: ${graphics.reason.split(";")[0]}. ` +
      `Colour latitude: ${LATITUDE[colorMode]}.`,
  };
}

/**
 * A print stock per tier, ordered by how much of the negative survives.
 *
 * The pixel path outranks every cell tier because it is not a print at all —
 * it is the negative itself, ~200 real pixels a cell against quadrant's four.
 * Hard limit ~85 characters: these are rendered as heading lines, which the
 * text renderer emits without wrapping.
 */
const STOCK: Partial<Record<RenderTier, string>> = {
  [KITTY_TIER]: "the original 65mm negative, projected directly",
  quadrant: "a 15-perf 70mm IMAX contact print",
  half: "5-perf 65mm — widely exhibited, quietly resented",
  braille: "a monochrome dupe — eight samples, one ink, no argument",
  solid: "Super 8 — one colour a cell, projected on a bedsheet",
  shading: "a newsprint halftone — a ramp of ink where colour was",
  ascii: "a bootleg, filmed off a laptop — luminance only",
};

/** Colour depth, described the way a laboratory would describe stock. */
const LATITUDE: Record<ColorMode, string> = {
  truecolor: "24-bit, the full aperture",
  "256": "256 entries, a release print",
  "16": "16 inks, a reduction print",
  none: "none — this is a silent-era standard",
};
