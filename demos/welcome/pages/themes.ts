import {
  button, divider, markdown, row, col, spacer, quote, setTheme,
} from "../../../src/index.js";
import type { BuiltinThemeName } from "../../../src/index.js";

export const metadata = { label: "Themes", order: 2 };

const THEMES: Array<{ name: BuiltinThemeName; vibe: string; demoFor: string }> = [
  { name: "cyberpunk",  vibe: "neon green / magenta",  demoFor: "this page, dev portfolios" },
  { name: "dracula",    vibe: "purple / teal",         demoFor: "the default — friendly, dark" },
  { name: "nord",       vibe: "icy blues + greys",     demoFor: "conference, corporate" },
  { name: "monokai",    vibe: "warm reds + oranges",   demoFor: "code-heavy pages" },
  { name: "solarized",  vibe: "muted, eye-friendly",   demoFor: "long sessions, docs" },
  { name: "gruvbox",    vibe: "earthy retro",          demoFor: "restaurant demo lives here" },
  { name: "catppuccin", vibe: "pastel mauves",         demoFor: "modern, soft, popular" },
  { name: "tokyoNight", vibe: "deep blue + neon",      demoFor: "startup landing pages" },
  { name: "rosePine",   vibe: "warm muted pinks",      demoFor: "band demo, lifestyle" },
  { name: "hacker",     vibe: "pure green on black",   demoFor: "dashboards, system monitors" },
];

export default function Themes() {
  return [
    markdown("**10 built-in themes** + custom themes are plain objects. Pick one below — the whole UI swaps in place."),
    spacer(),

    divider("=", "Click a theme to switch"),
    spacer(),
    row(
      THEMES.map((t) =>
        col(
          [
            button({
              label: `${t.name} — ${t.vibe}`,
              onPress: () => {
                if (setTheme(t.name)) {
                  return { success: `Theme: ${t.name} (${t.demoFor})` };
                }
                return { error: `Unknown theme: ${t.name}` };
              },
            }),
          ],
          { span: 6, xs: 12 },
        ),
      ),
      { gap: 1 },
    ),
    spacer(),

    divider("=", "Or use the command shortcut"),
    markdown("Press `:` to enter command mode, type `theme <name>` and press Enter:"),
    spacer(),
    markdown([
      "```",
      ":theme dracula",
      ":theme nord",
      ":theme tokyoNight",
      "```",
    ].join("\n")),
    spacer(),

    divider("=", "Custom themes"),
    markdown([
      "```ts",
      "// config.ts",
      "export default defineConfig({",
      "  theme: {",
      "    name: \"mybrand\",",
      "    background: \"#0a0b0a\",",
      "    text: \"#e8e8e8\",",
      "    accent: \"#8effbe\",",
      "    border: \"#2a2a2a\",",
      "    // ...",
      "  },",
      "});",
      "```",
    ].join("\n")),
    spacer(),

    quote("Themes are plain objects. Override one slot, override all of them. No CSS to fight."),
  ];
}
