import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Server Dashboard",
  tagline: "real-time infrastructure monitoring",
  banner: {
    text: "SERVMON",
    font: "ANSI Shadow",
    gradient: ["#50fa7b", "#8be9fd"],
  },
  theme: "hacker",
  borders: "single",
  animations: {
    boot: true,
    exitMessage: "Session terminated.",
  },
});
