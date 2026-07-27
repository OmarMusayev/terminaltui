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
      "A `.gif` needs no tooling at all — the GIF decoder is pure TypeScript.",
    ),
    divider(),
    markdown(
      "### Why cells and not pixels\n" +
      "Terminals with a graphics protocol draw real pixels, and for a still\n" +
      "image that is strictly better. For video it is not, because the protocol\n" +
      "forbids re-transmitting onto a live image id: every frame costs a delete\n" +
      "plus a full transmit.\n" +
      "\n" +
      "    kitty pixels, per frame     1.5 - 1.9 MB      37 - 44 MiB/s at 24 fps\n" +
      "    quadrant cells, per frame        52 KiB            1.26 MiB/s at 24 fps\n" +
      "\n" +
      "So motion is drawn in cells on every terminal, and the expensive path is\n" +
      "saved for the one case it wins: a paused frame.",
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
      "CPU is not the limit — the wire is. What decides the ceiling is how much\n" +
      "escape-sequence traffic the terminal will swallow, which is why the pack\n" +
      "default is 12 fps rather than 24.",
    ),
  ];
}
