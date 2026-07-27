import {
  col, columns, divider, image, markdown, panel, quote, row, spacer, table, text,
} from "../../../src/index.js";
import type { ImageMode } from "../../../src/index.js";

export const metadata = { label: "Images", order: 5 };

/**
 * Resolved against the PROJECT root — the directory holding config.ts — and
 * never against the shell's cwd. That is why this page renders the same
 * whether you launch it from the repo root, from demos/, or over SSH.
 */
const SRC = "./assets/og-image.png";

/** Every comparison block below is this wide, so only the tier changes. */
const TIER_WIDTH = 44;

interface Tier {
  mode: ImageMode;
  title: string;
  /** Sub-cell grid, and how many colours the tier can put in one cell. */
  shape: string;
  /** Kept under 44 columns so no cell in the grid wraps to a second line. */
  note: string;
}

const TIERS: Tier[] = [
  { mode: "quadrant", title: "quadrant", shape: "2x2 sub-cells, fg + bg", note: "The default. Four pixels a cell. 3,497 B" },
  { mode: "half",     title: "half",     shape: "1x2 sub-cells, fg + bg", note: "Needs only U+2580. 3,223 B" },
  { mode: "solid",    title: "solid",    shape: "1x1 cell, bg only",      note: "Zero glyph coverage. 2,172 B" },
  { mode: "shading",  title: "shading",  shape: "1x1 cell, fg only",      note: "Ramp ' ·:░▒▓█'. 2,443 B" },
  { mode: "ascii",    title: "ascii",    shape: "1x1 cell, no colour",    note: "Ramp ' .:-=+*#%@'. 1,064 B" },
  { mode: "braille",  title: "braille",  shape: "2x4 sub-cells, one pen", note: "Line art, not photographs. 2,761 B" },
];

export default function Images() {
  return [
    markdown("**Real images in the terminal.** No sixel, no kitty protocol, no `sharp`. A PNG is decoded synchronously, box-filtered onto a sub-cell grid, and fitted to Unicode block glyphs with a foreground and a background colour per cell. It works over SSH, inside tmux, and on Apple Terminal."),
    spacer(),

    divider("The default tier — quadrant"),
    image(SRC, {
      width: 64,
      border: true,
      alt: "og-image.png — terminaltui, Next.js for the terminal",
    }),
    markdown("A 1600x1000 PNG at **64x20 cells**. The aspect ratio is corrected for the fact that a terminal cell is about twice as tall as it is wide, so nothing is squashed. The row count is taken from the PNG header on the *first* frame, before a single pixel is decoded — which is why the text under an image never jumps when the picture arrives."),
    spacer(),

    divider(`One image, six tiers, all ${TIER_WIDTH} cells wide`),
    markdown("`mode` pins a tier. Left alone (`\"auto\"`) the renderer negotiates the best one your terminal can actually draw, from colour depth, Unicode coverage, and whether a multiplexer is in the way. Compare them directly:"),
    row(
      TIERS.map((t) =>
        col(
          [
            markdown(`**${t.title}** — \`${t.shape}\``),
            image(SRC, { width: TIER_WIDTH, mode: t.mode, align: "left", alt: `${t.title} tier` }),
            markdown(t.note),
            spacer(),
          ],
          { span: 6, xs: 12 },
        ),
      ),
      { gap: 1 },
    ),
    markdown("Byte counts are the real UTF-8 payload of each 44x14 block in 256-colour mode. Neighbouring cells that quantize to the same colour reuse the pen instead of re-emitting it, which is what keeps a photograph cheap enough to redraw every frame."),
    spacer(),

    divider("When it cannot decode"),
    markdown("A missing file, an unreadable format, a remote URL, or a path outside the project degrades to an **alt box occupying exactly the rows the layout already reserved** — so nothing below it moves."),
    image("./assets/nonexistent-cover.png", {
      width: 52,
      height: 5,
      fit: "fill",
      alt: "assets/nonexistent-cover.png - not found",
    }),
    markdown("GIF, WebP and BMP land here too for now: their headers parse, so the reservation is right, but no synchronous decoder for them is bundled. PNG and JPEG need nothing installed."),
    spacer(),

    divider("The API"),
    markdown("One import, one call. `image(\"./assets/og-image.png\")` fills the available width and keeps the aspect ratio. The hero above is `image(SRC, { width: 64, border: true })`. Every option:"),
    table(
      ["option", "default", "what it does"],
      [
        ["width", "fills the block", "Width in cells; the height follows the source aspect."],
        ["height", "from the aspect", "Cells tall. Exact only with fit \"fill\" or \"cover\"."],
        ["maxHeight", "none", "Hard cap on the derived row count."],
        ["fit", "contain", "contain fits inside, cover crops, fill stretches."],
        ["align", "center", "left, center or right inside the block."],
        ["mode", "auto", "quadrant, half, solid, shading, ascii, braille."],
        ["dither", "auto", "Ordered Bayer in 256/16 colour, off in truecolor."],
        ["border", "false", "Themed border (true, or a style name). Adds 2 cols + 2 rows."],
        ["alt", "the file name", "Label for the box shown when it cannot decode."],
        ["background", "theme background", "Hex colour composited under transparency."],
        ["invert", "false", "Flip luminance, for light-background terminals."],
        ["charset", "\" .:-=+*#%@\"", "The ramp used by mode \"ascii\"."],
        ["resizable", "false", "Viewer resizes with +/-. Makes the block focusable."],
        ["fitPage", "false", "Take the rows the page has left, instead of a fixed width."],
      ],
    ),
    text("Also standalone, same engine: asciiImage(path, { width, mode, color }) returns string[] you can print anywhere."),
    spacer(),

    divider("It composes — an image inside panel()"),
    panel({
      title: "panel() · fit \"cover\" crops to fill the pane",
      border: true,
      padding: 1,
      content: [
        image(SRC, {
          width: 90,
          height: 22,
          fit: "cover",
          alt: "og-image.png cover-cropped inside a panel",
        }),
        markdown("The image takes the panel's **inner** width, not the page width, and is clipped by the panel's own scroll window like any other block. `fit: \"cover\"` fills the box and crops the overflow; `\"contain\"` — the default — fits the whole picture inside it."),
      ],
    }),
    spacer(),

    divider("…and inside columns()"),
    columns([
      panel({
        title: "columns() — image pane",
        border: true,
        padding: 1,
        content: [
          image(SRC, {
            width: 44,
            height: 22,
            fit: "cover",
            alt: "og-image.png inside a column",
          }),
          markdown("44 cells wide, cropped to 22 rows — sized to the pane, not to the page."),
        ],
      }),
      panel({
        title: "columns() — text pane",
        border: true,
        padding: 1,
        content: [
          markdown("Two panes, one layout pass."),
          spacer(),
          markdown("- Decoding is **synchronous**, so the pixels are on screen in the first paint — no spinner, no placeholder frame, no reflow."),
          spacer(),
          markdown("- Both panes are measured together, so the image cannot push its neighbour out of alignment."),
          spacer(),
          markdown("- Decoded pixels and emitted rows are cached separately, keyed by geometry and by colour mode, so two SSH clients at different colour depths share one decode."),
          spacer(),
          markdown("- Resize the window and it re-fits: geometry is recomputed from the header, not from the last render."),
        ],
      }),
    ]),
    spacer(),

    quote("The picture is the point, but the row count is the feature. Sizing an image from its header on frame one is what lets a synchronous terminal renderer draw photographs without the page ever jumping.", "devnotes/terminal-image-rendering-exploration.md"),
  ];
}
