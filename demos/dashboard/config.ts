import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "Dashboard",
  tagline: "API-powered dashboard with live data",
  banner: {
    text: "DASHBOARD",
    font: "Sub-Zero",
  },
  theme: "hacker",
  borders: "single",
  animations: {
    boot: true,
    exitMessage: "Connection terminated.",
  },
});
