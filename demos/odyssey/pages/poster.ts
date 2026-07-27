import { centerBanner, image, renderBanner, stringWidth } from "../../../src/index.js";
// Deep import, deliberately — same licence the rest of this demo takes.
// `gradientLines` is what runtime-render.ts uses to colour the site banner
// (runtime-render.ts:107); `renderBanner` declares a `gradient` option but does
// not apply it, so calling renderBanner alone gives flat text. Reaching for the
// same function the runtime reaches for is the only way to make a page banner
// look like the site banner, and it keeps this demo off a widened public API.
import { gradientLines } from "../../../src/style/gradient.js";
import type { ContentBlock, CustomRenderContext } from "../../../src/index.js";

export const metadata = { label: "Odysseus Terminal Movie Session", order: 0 };

const SRC = "./assets/odysseus.jpg";

/**
 * A one-sheet has to fit on one screen. A poster you have to scroll is not a
 * poster, it is a web page.
 *
 * This page used to hold two hand-tuned numbers — a 96-cell frame width and a
 * headline font — both chosen by rendering the page in ONE window and looking at
 * it. Both were wrong at every other window size, and the failure was silent:
 * the page simply scrolled, which is the one thing a poster may not do. Every
 * size on this page is now derived from the rows the terminal actually has.
 *
 * Two mechanisms, one principle:
 *
 * - The picture asks for `fitPage: true`. The page composes everything else
 *   first and hands the image whatever rows are left; geometry back-solves the
 *   column count from the source aspect. There is no width here at all.
 * - The type picks its FACE from a ladder, using the row budget the runtime
 *   hands every `custom` block (`CustomRenderContext.availRows`). Where there is
 *   room the headline is set in the display face; where there is not, it steps
 *   down rather than pushing the picture off the bottom.
 *
 * Both re-derive on every frame, so a resize (or a font-size change, which is
 * the same thing seen from the terminal) re-fits the page instead of breaking
 * it.
 */

/**
 * The headline ladder, tallest first. Every rung was chosen by rendering all
 * fourteen bundled fonts and looking at them.
 *
 * `Block` (4 rows) is the top rung, and the ceiling is the point: on a one-sheet
 * the photograph is the poster and the words caption it. `ANSI Shadow` sat here
 * first and is the more handsome face — solid letterforms with a drop shadow,
 * the only bundled font that is not line art assembled from punctuation — but at
 * 6 rows a line it spends 18 rows on three words, and every one of those rows
 * comes off the picture, which the type budget hands over whole. Capping the
 * ladder here is therefore the same edit as enlarging the photograph; there is
 * no separate size to set.
 *
 * `Block` is built from block characters (U+2580–259F), and Apple Terminal
 * leaves hairline gaps between adjacent block cells, so it renders there as
 * slightly quilted rather than solid. Its letters are solid AREAS though, and a
 * hairline seam that merely quilts a solid face makes a line-art face
 * illegible — which is why it beats the same-height `Calvin S`.
 *
 * `Small` (3 rows) below it is a compromise that only gets used when the window
 * cannot hold `Block`. That is the whole point of a ladder — the alternative at
 * those sizes is not a prettier font, it is a poster that scrolls. It is pure
 * ASCII and the most compact bundled face, but it draws `I` as a closed box, so
 * "AS INTENDED" loses a little.
 *
 * Ruled out at every height: `Slant` and `Calvin S` are assembled from `/`, `_`
 * and `>`, which have to tile across cell boundaries to form a stroke and
 * visibly come apart when rendered. `DOS Rebel`, `Ghost`, `Bloody`,
 * `Electronic`, `Larry 3D`, `Colossal` and `Isometric1` are 7–11 rows and too
 * wide for the content column at any of these strings.
 *
 * Below the last rung, `renderBanner` degrades to the plain string on its own
 * (see `fitBanner`), which is one row — the bottom of the ladder, and what keeps
 * this page fitting a 20-row window.
 */
const HEADLINE_FONTS = ["Block", "Small"];

/**
 * The imprint ladder. `Small` is deliberately absent: its closed-box `I` turns
 * TERMINALTUI.DEV into TERMONALTUO.DEV, which is disqualifying for something
 * meant to be typed into a browser. Plain text is the honest fallback.
 */
const IMPRINT_FONTS = ["Block"];

/** The three headline lines, as one phrase set in one face. */
const HEADLINES = ["WATCHING", "ODYSSEUS", "AS INTENDED"];

const IMPRINT = "TRY: TERMINALTUI.DEV";

/**
 * Rows the page spends on neither type nor picture.
 *
 * The page renderer pushes one blank line after every top-level block and pops
 * the last, so five blocks cost four; the third headline carries one trailing
 * blank of its own to open a gap above the picture. Derived here rather than
 * guessed, so adding a block to the page cannot silently make it scroll.
 */
const CHROME_ROWS = (5 - 1) + 1;

/**
 * Share of the page reserved for the picture before the type gets to bid.
 *
 * A third, and never fewer than five rows. This is the one aesthetic judgement
 * on the page, and it is a PROPORTION rather than a window size, which is the
 * difference that matters: it holds at every terminal height. Below roughly a
 * 30-row window it is what takes the headline down to plain text — a five-row
 * smudge of a photograph is not a poster either.
 *
 * Note this is a FLOOR the type may not eat into, not the picture's actual
 * size. The picture is handed every row the type did not spend, so the way to
 * make it bigger is to set the type smaller — see `HEADLINE_FONTS`. Raising
 * this number alone would only starve the type at small windows.
 */
const PICTURE_SHARE = 3;
const PICTURE_MIN_ROWS = 5;

/**
 * Sky-white into the nord accent, which is the same washed blue as the
 * overcast behind the ships — the title reads as part of the photograph.
 */
const TITLE_GRADIENT = ["#eceff4", "#88c0d0", "#5e81ac"];

/**
 * Red for the name itself, so one word carries the whole poster.
 *
 * Red over yellow because the frame is already cold — steel blue and overcast —
 * and its only warm notes are the crimson plume behind the helmet and the gold
 * medallions. Gold is spoken for by the imprint below; taking the plume's red
 * instead gives the name the strongest contrast available against both the
 * picture and the blue lines above and below it, and keeps the two warm accents
 * on the page distinct rather than competing.
 */
const NAME_GRADIENT = ["#ff5f56", "#c1121f"];

/**
 * Gold, taken off the lion-head medallions on the breastplate — the page's
 * other warm accent, kept for the imprint alone.
 */
const IMPRINT_GRADIENT = ["#d8c48a", "#c8a951"];

export default function Poster() {
  return [
    // Tight leading — the three words are one phrase and should read as one
    // block, so only the last carries a trailing blank. All three consult the
    // SAME budget and the same widest-line measurement, so they always come back
    // in one face; a headline that changed size line by line would read as a
    // rendering fault.
    bigText(HEADLINES[0], TITLE_GRADIENT, headlineFace, { trailing: 0 }),
    bigText(HEADLINES[1], NAME_GRADIENT, headlineFace, { trailing: 0 }),
    bigText(HEADLINES[2], TITLE_GRADIENT, headlineFace),
    // No width. The page grants this block the rows nothing else claimed and
    // the whole terminal to spend them across; geometry derives the columns from
    // the photograph's own aspect. On a tall window that means a picture wider
    // than the 100-column content column the type is set in — deliberately, and
    // the one place on the page where that happens: a one-sheet's picture bleeds
    // to the edge, and the alternative (pinning it to the prose measure) left a
    // quarter of the screen black at the very window sizes shrinking the font
    // produces.
    //
    // Deliberately NOT `resizable`, unchanged: resizability makes the frame
    // focusable, and a focusable block draws the focus gutter down the left
    // margin plus a "+/- resize" hint row under the picture. Neither belongs on
    // a one-sheet. (It would also make `fitPage` inert — the viewer's chosen
    // size wins over the page's.)
    image(SRC, {
      fitPage: true,
      border: true,
      alt: "THE ODYSSEY (2026) — one-sheet",
    }),
    bigText(IMPRINT, IMPRINT_GRADIENT, imprintFace, { trailing: 0 }),
  ];
}

// ─── Type sizing ──────────────────────────────────────────

/**
 * Rows the type may spend in total, given the page's row budget.
 *
 * Everything the picture is not, less the page's own blank lines. Clamped at 0
 * so a window too short for anything still returns a number the ladder can
 * refuse rather than a negative one it would misread.
 */
function typeBudget(availRows: number): number {
  const picture = Math.max(PICTURE_MIN_ROWS, Math.floor(availRows / PICTURE_SHARE));
  return Math.max(0, availRows - CHROME_ROWS - picture);
}

/**
 * The face all three headlines are set in.
 *
 * Split between the headlines and the imprint by LINE COUNT — three lines
 * against one — so the two blocks step down together instead of one of them
 * collapsing to plain text while the other stays enormous. Both blocks run this
 * same arithmetic from the same `availRows`, so they cannot disagree.
 */
function headlineFace(width: number, availRows: number): string | null {
  const budget = typeBudget(availRows);
  const share = Math.floor((budget * HEADLINES.length) / (HEADLINES.length + 1));
  // Measured against the WIDEST headline, not each line's own width: a face that
  // fits "WATCHING" but not "AS INTENDED" would set the phrase in two sizes.
  return pickFont(HEADLINE_FONTS, HEADLINES, width, Math.floor(share / HEADLINES.length));
}

/** The imprint's face, from the quarter of the budget the headlines left. */
function imprintFace(width: number, availRows: number): string | null {
  const budget = typeBudget(availRows);
  const share = budget - Math.floor((budget * HEADLINES.length) / (HEADLINES.length + 1));
  return pickFont(IMPRINT_FONTS, [IMPRINT], width, share);
}

/**
 * The tallest font in `ladder` that sets every one of `texts` inside `maxRows`
 * rows and `width` columns, or null for "nothing fits — set it as plain text".
 *
 * Memoised on the arguments because it is called once per headline block per
 * frame and each call renders the candidate faces to measure them. The key is
 * complete, and the answer is a pure function of it, so the cache can never go
 * stale; it is bounded by the handful of distinct window sizes one session sees.
 */
const FACE_MEMO = new Map<string, string | null>();

function pickFont(
  ladder: string[],
  texts: string[],
  width: number,
  maxRows: number,
): string | null {
  const key = `${ladder.join("|")} ${texts.join("|")} ${width} ${maxRows}`;
  const hit = FACE_MEMO.get(key);
  if (hit !== undefined) return hit;

  let chosen: string | null = null;
  for (const font of ladder) {
    const arts = texts.map((t) => renderBanner(t, { font }));
    const rows = Math.max(0, ...arts.map((a) => a.length));
    const cols = Math.max(0, ...arts.map((a) => Math.max(0, ...a.map(stringWidth))));
    if (rows <= maxRows && cols <= width) {
      chosen = font;
      break;
    }
  }
  FACE_MEMO.set(key, chosen);
  return chosen;
}

/**
 * A line of display type, centred in the content column and sized to the page.
 *
 * Returns a `custom` block rather than `markdown` because ASCII art has to
 * survive verbatim: the text renderer wraps on width and would fold a banner
 * line in half, and it strips inline emphasis, which would eat the escape codes
 * the gradient is made of. `custom` is also the only block that receives the
 * page's row budget, which is what makes the face selectable at all.
 *
 * The width guard is `renderBanner`'s own: handed a `maxWidth` it cannot meet,
 * it returns the plain string instead of a mangled banner, so the bottom of the
 * ladder needs no special case — a null face renders one plain, centred row.
 * `centerBanner` then centres whichever of the two came back.
 *
 * `ctx` is optional in the signature the framework declares, so the fallback
 * covers a caller that renders this block outside a page — the row budget then
 * degrades to "as much as the ladder wants", which is the pre-existing
 * behaviour.
 */
function bigText(
  text: string,
  gradient: string[],
  face: (width: number, availRows: number) => string | null,
  opts: { trailing?: number } = {},
): ContentBlock {
  const trailing = opts.trailing ?? 1;
  return {
    type: "custom",
    render: (width: number, _theme, ctx?: CustomRenderContext) => {
      const font = face(width, ctx?.availRows ?? Number.MAX_SAFE_INTEGER);
      const art = font === null ? [text] : renderBanner(text, { font }, width);
      // Gradient BEFORE centring: centerBanner measures with stringWidth,
      // which is ANSI-aware, so the padding is unaffected by the escapes —
      // and colouring after centring would run the ramp across the padding.
      return [...centerBanner(gradientLines(art, gradient), width), ...blank(trailing)];
    },
  };
}

function blank(n: number): string[] {
  return n > 0 ? new Array<string>(n).fill("") : [];
}
