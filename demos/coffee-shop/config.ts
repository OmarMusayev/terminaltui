import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Ember & Brew",
  tagline: "specialty coffee roasters — est. 2019",
  banner: {
    text: "EMBER",
    font: "Bloody",
    gradient: ["#f5c2e7", "#cba6f7"],
  },
  theme: "catppuccin",
  borders: "rounded",
  animations: {
    boot: true,
  },
});
