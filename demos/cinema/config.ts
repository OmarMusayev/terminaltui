import { defineConfig } from "../../src/index.js";

/**
 * The video demo — a moving picture in a terminal, with the numbers on screen
 * next to it.
 *
 * Sintel rather than a synthetic test pattern because a test pattern proves
 * nothing: a quadrant-tier renderer can make crisp colour bars look perfect
 * and still turn a face into mush. The trailer has skin tones, motion blur,
 * firelight and a lot of dark detail, which is where a cell renderer either
 * holds up or does not.
 *
 * `dracula` for its near-black background — anything lighter puts a bright
 * page around a letterboxed picture, and the eye reads the surround as part of
 * the image. A dark theme lets the frame end where the picture ends.
 *
 * Sintel (c) copyright Blender Foundation | durian.blender.org, CC-BY 3.0.
 */
export default defineConfig({
  name: "Cinema",
  tagline: "Video in real pixels where supported, colour cells everywhere else.",
  theme: "dracula",
  banner: {
    text: "CINEMA",
    font: "Block",
  },
  menu: {
    items: [
      { label: "> Now playing · pixels or colour cells", page: "home" },
      { label: "# How it works", page: "how" },
    ],
  },
});
