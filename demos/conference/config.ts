import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "TermConf 2026",
  tagline: "The Terminal Renaissance — June 15-16, Portland OR",
  banner: {
    text: "TERMCONF",
    font: "Ogre",
    gradient: ["#88c0d0", "#5e81ac"],
  },
  theme: "nord",
  borders: "single",
  animations: {
    boot: true,
    transitions: "slide",
    exitMessage: "See you at TermConf 2026!",
  },
});
