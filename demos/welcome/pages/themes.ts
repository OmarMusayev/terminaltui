import { card, divider, markdown, row, col, spacer, quote, table } from "../../../src/index.js";

export const metadata = { label: "Themes", order: 2 };

const THEMES: Array<{ name: string; vibe: string; demoFor: string }> = [
  { name: "cyberpunk", vibe: "neon green / magenta", demoFor: "this page, dev portfolios" },
  { name: "dracula", vibe: "purple / teal", demoFor: "the default — friendly, dark" },
  { name: "nord", vibe: "icy blues + greys", demoFor: "conference, corporate" },
  { name: "monokai", vibe: "warm reds + oranges", demoFor: "code-heavy pages" },
  { name: "solarized", vibe: "muted, eye-friendly", demoFor: "long sessions, docs" },
  { name: "gruvbox", vibe: "earthy retro", demoFor: "restaurant demo lives here" },
  { name: "catppuccin", vibe: "pastel mauves", demoFor: "modern, soft, popular" },
  { name: "tokyoNight", vibe: "deep blue + neon", demoFor: "startup landing pages" },
  { name: "rosePine", vibe: "warm muted pinks", demoFor: "band demo, lifestyle" },
  { name: "hacker", vibe: "pure green on black", demoFor: "dashboards, system monitors" },
];

export default function Themes() {
  return [
    markdown("**10 built-in themes** + the ability to define your own. The current page is rendered in `cyberpunk`."),
    spacer(),

    divider("=", "Switch themes live"),
    markdown("Press `:` to enter command mode, then type `theme <name>` and press Enter. Try one of these:"),
    spacer(),
    markdown([
      "```",
      ":theme dracula",
      ":theme nord",
      ":theme catppuccin",
      ":theme tokyoNight",
      ":theme hacker",
      "```",
    ].join("\n")),
    spacer(),

    divider("=", "All 10 themes"),
    row(
      THEMES.map((t) =>
        col(
          [card({ title: t.name, subtitle: t.vibe, body: `Demo: ${t.demoFor}` })],
          { span: 4, xs: 12, sm: 6 },
        ),
      ),
      { gap: 1 },
    ),
    spacer(),

    divider("=", "Custom themes"),
    markdown("```ts\n// config.ts\nexport default defineConfig({\n  theme: {\n    name: \"mybrand\",\n    background: \"#0a0b0a\",\n    text: \"#e8e8e8\",\n    accent: \"#8effbe\",\n    border: \"#2a2a2a\",\n    // ...\n  },\n});\n```"),
    spacer(),

    quote("Themes are plain objects. Override one slot, override all of them. No CSS to fight."),
  ];
}
