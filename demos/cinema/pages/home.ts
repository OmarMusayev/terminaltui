import { video } from "../../../src/index.js";

export const metadata = { label: "Now playing · pixels or colour cells", order: 1 };

/**
 * The video page.
 *
 * `fitPage` rather than a hand-picked width, for the reason the odyssey poster
 * learned the hard way: a constant chosen for one window is wrong in every
 * other one. This page deliberately contains only the player, so the picture
 * gets the whole content viewport even in a short terminal. The page title and
 * demo tagline explain the pixel/cell capability split without guessing which
 * renderer this particular process negotiated; the visible attribution lives
 * on the adjacent How it works page (and remains in the player's alt text).
 *
 * `controls: true` buys the transport row AND a focus slot — press Space to
 * play, left/right to scrub. Paused on frame 12 to start so the initial screen
 * shows a useful frame before the viewer starts playback.
 */
export default function Home() {
  return [
    video("./assets/sintel.tvf", {
      fitPage: true,
      controls: true,
      alt: "Sintel trailer — Blender Foundation, CC-BY 3.0",
      poster: 12,
      loop: true,
    }),
  ];
}
