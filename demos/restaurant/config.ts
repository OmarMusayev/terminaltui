import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "The Rusty Fork",
  tagline: "farm-to-table dining since 2018",
  banner: {
    text: "RUSTY FORK",
    font: "Ogre",
    gradient: ["#fe8019", "#fabd2f"],
  },
  theme: "gruvbox",
  borders: "rounded",
  animations: {
    boot: true,
    transitions: "fade",
  },
});
