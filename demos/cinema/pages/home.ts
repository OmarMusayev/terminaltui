import { divider, markdown, video } from "../../../src/index.js";

export const metadata = { label: "Now playing", order: 1 };

/**
 * The video page.
 *
 * `fitPage` rather than a hand-picked width, for the reason the odyssey poster
 * learned the hard way: a constant chosen for one window is wrong in every
 * other one. The page composes the prose first and hands the picture whatever
 * rows are left, so the same page is a postage stamp in a 20-row terminal and
 * a cinema in a full-screen one.
 *
 * `controls: true` buys the transport row AND a focus slot — press Space to
 * play, left/right to scrub. Paused on frame 12 to start, because frame 0 of
 * this clip is a fade from black and a poster that is literally a black
 * rectangle looks like a bug.
 */
export default function Home() {
  return [
    markdown(
      "### Sintel, at four sub-pixels per cell\n" +
      "Press **Space** to play. **←/→** to scrub.",
    ),
    video("./assets/sintel.tvf", {
      fitPage: true,
      controls: true,
      border: true,
      alt: "Sintel trailer — Blender Foundation, CC-BY 3.0",
      poster: 12,
      loop: true,
    }),
    divider(),
    markdown("Sintel © Blender Foundation · durian.blender.org · CC-BY 3.0"),
  ];
}
