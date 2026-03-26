import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Warpspeed",
  tagline: "deploy at the speed of thought",
  banner: {
    text: "WARPSPEED",
    font: "Electronic",
    gradient: ["#7aa2f7", "#bb9af7"],
  },
  theme: "tokyoNight",
  borders: "heavy",
  animations: {
    boot: true,
    exitMessage: "$ warpspeed --stop",
  },
});
