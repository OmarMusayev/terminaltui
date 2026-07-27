import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Pillars of Creation",
  tagline: "One 1280x1335 Hubble JPEG, drawn with whatever this terminal can actually do",
  // "midnight" is not a built-in name — it silently resolved to the default
  // (dracula) and painted a pink/purple chrome around an astronomy photograph.
  // tokyoNight is a real theme whose accent (#7aa2f7) is the same blue as the
  // nebula, so the frame reads as part of the picture instead of against it.
  theme: "tokyoNight",
  banner: {
    text: "PILLARS",
    font: "ANSI Shadow",
  },
  menu: {
    items: [
      { label: ">> The image", page: "home" },
      { label: "<> Resize the frame", page: "resize" },
      { label: "## Every tier, side by side", page: "tiers" },
    ],
  },
});
