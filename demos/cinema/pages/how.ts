import { divider, markdown } from "../../../src/index.js";

export const metadata = { label: "How it works", order: 2 };

/**
 * The numbers behind the picture on the other page.
 *
 * Every figure here was measured on this machine rather than estimated, which
 * is the only reason it is worth printing: the interesting claim is not "video
 * works" but "the cheap tier is the good one", and that only lands with the
 * two costs side by side.
 */
export default function How() {
  return [
    markdown(
      "### There is no video decoder at runtime\n" +
      "A `.tvf` pack is a header plus a run of independently-decodable JPEG\n" +
      "frames, already scaled to about twice the sub-cell grid. ffmpeg builds\n" +
      "it once, ahead of time. Playing it back is a 0.6 ms JPEG decode into the\n" +
      "same resampler, glyph fitter and ANSI writer that draw a still image.\n" +
      "\n" +
      "A `.gif` needs no tooling at all — the GIF decoder is pure TypeScript.\n" +
      "\n" +
      "Demo footage: Sintel © Blender Foundation · durian.blender.org · CC-BY 3.0.",
    ),
    divider(),
    markdown(
      "### Pixels where they win, cells everywhere else\n" +
      "Kitty and Ghostty draw the native pack frame as real pixels and scale it\n" +
      "to the block's cell footprint. Each transfer uses fast zlib when that\n" +
      "actually saves bytes; other terminals use coloured quadrant cells.\n" +
      "\n" +
      "    kitty pixels, 848x352 frame     492 KiB      5.76 MiB/s at 12 fps\n" +
      "    quadrant cells, full width       52 KiB      0.61 MiB/s at 12 fps\n" +
      "\n" +
      "Both paths occupy exactly the same rows, so capability changes never\n" +
      "reflow the page. `mode: \"quadrant\"` pins the low-bandwidth path.",
    ),
    divider(),
    markdown(
      "### The frame budget\n" +
      "At 24 fps a frame gets 41.6 ms. This is what it spends:\n" +
      "\n" +
      "    JPEG decode            0.6 ms\n" +
      "    resample to sub-cells  0.2 ms\n" +
      "    fit glyphs + colours   0.5 ms\n" +
      "    compose and write      0.8 ms\n" +
      "    ------------------------------\n" +
      "    total                  2.1 ms      5% of the budget\n" +
      "\n" +
      "The Kitty pixel encoder averages 7.45 ms on this clip. CPU is not the\n" +
      "limit — the wire is. What decides the ceiling is how much\n" +
      "escape-sequence traffic the terminal will swallow, which is why the pack\n" +
      "default is 12 fps rather than 24.",
    ),
  ];
}
