import { defineConfig } from "../../src/index.js";
import type { Theme } from "../../src/index.js";

const studioTheme: Theme = {
  accent: "#c4a882",
  accentDim: "#a68b6b",
  text: "#e8dcc8",
  muted: "#a89984",
  subtle: "#665c54",
  success: "#a9b665",
  warning: "#d8a657",
  error: "#ea6962",
  border: "#665c54",
  bg: "#1d2021",
};

export default defineConfig({
  name: "Studio Kira",
  tagline: "design that moves people",
  banner: {
    text: "STUDIO KIRA",
    font: "Calvin S",
  },
  theme: studioTheme,
  borders: "dashed",
});
