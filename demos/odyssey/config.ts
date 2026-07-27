import { defineConfig } from "../../src/index.js";

/**
 * A joke demo, and a real stress test.
 *
 * The bit is Christopher Nolan's format maximalism — IMAX 70mm, no digital
 * intermediate, "see it on the biggest screen you can" — applied with total
 * sincerity to the lowest-fidelity display medium in existence. It works as
 * comedy only because every technical claim underneath it is TRUE: the frame
 * really is resampled rather than magnified when it grows, the tier really is
 * negotiated from the terminal, and the projection certificate on the home
 * page really is read live from the running engine.
 *
 * `nord` because the still is cold steel-blue and overcast, with gold as its
 * only warm accent. The theme's accent (#88c0d0) is the same washed Aegean
 * blue as the sky behind the ships, so the chrome reads as part of the
 * photograph instead of fighting it. `gruvbox` was the alternative — it picks
 * up the lion-head medallions — but it warms the whole frame and the picture
 * loses its overcast.
 */
export default defineConfig({
  name: "The Odyssey",
  tagline: "Shot on IMAX 70mm. Exhibited at four sub-pixels, as intended.",
  theme: "nord",
  banner: {
    text: "ODYSSEY",
    font: "ANSI Shadow",
  },
  menu: {
    items: [
      { label: "** Odysseus Terminal Movie Session", page: "poster" },
      { label: ">> The presentation", page: "home" },
      { label: "<> Choose your gauge", page: "formats" },
      { label: "## Approved print stocks", page: "tiers" },
    ],
  },
});
