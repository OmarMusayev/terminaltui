import { defineConfig } from "../../src/index.js";

export default defineConfig({
  name: "terminaltui",
  tagline: "Next.js for the terminal",
  theme: "cyberpunk",
  banner: {
    text: "TERMINALTUI",
    font: "ANSI Shadow",
  },
  animations: {
    boot: true,
    exitMessage: "Build your own: npx terminaltui init my-site",
  },
  menu: {
    items: [
      { label: "// Home", page: "home" },
      { label: ">> Showcase", page: "showcase" },
      { label: "## Themes", page: "themes" },
      { label: "~~ Live Data", page: "live-data" },
      { label: "++ Get Started", page: "get-started" },
    ],
  },
});
