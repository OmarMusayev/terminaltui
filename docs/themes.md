# Themes

terminaltui ships with 12 built-in themes. Set a theme by name or by reference:

```ts
// config.ts
import { defineConfig, themes } from "terminaltui";

export default defineConfig({
  name: "My Site",
  theme: "dracula",         // by name
  // or
  theme: themes.dracula,    // by reference
});
```

## Built-in Themes

| Theme | Accent | Best For |
|-------|--------|----------|
| `cyberpunk` | `#ff2a6d` (hot pink) | Tech startups, gaming, futuristic |
| `dracula` | `#ff79c6` (pink) | General purpose, developer tools (default) |
| `nord` | `#88c0d0` (frost blue) | Corporate, professional, SaaS |
| `monokai` | `#f92672` (magenta) | Developer portfolios, coding tools |
| `solarized` | `#268bd2` (blue) | Academic, documentation, research |
| `gruvbox` | `#fe8019` (orange) | Restaurants, cafes, warm brands |
| `catppuccin` | `#f5c2e7` (pink) | Creative agencies, design portfolios |
| `tokyoNight` | `#7aa2f7` (blue) | Modern SaaS, product pages |
| `rosePine` | `#ebbcba` (rose) | Music, art, personal blogs |
| `hacker` | `#00ff41` (green) | Security, infosec, Matrix-style |

If no theme is specified, `dracula` is used by default.

## Custom Themes

Pass a `Theme` object to use your own colors:

```ts
export default defineConfig({
  name: "My Site",
  theme: {
    accent: "#e06c75",
    accentDim: "#be5046",
    text: "#abb2bf",
    muted: "#5c6370",
    subtle: "#3e4452",
    success: "#98c379",
    warning: "#e5c07b",
    error: "#e06c75",
    border: "#5c6370",
    bg: "#282c34",
  },
});
```

## Theme Interface

```ts
interface Theme {
  accent: string;       // Primary accent color (hex)
  accentDim: string;    // Dimmed accent for secondary highlights
  text: string;         // Primary text color
  muted: string;        // Muted/secondary text
  subtle: string;       // Subtle elements (backgrounds, inactive borders)
  success: string;      // Success state color
  warning: string;      // Warning state color
  error: string;        // Error state color
  border: string;       // Border color
  bg?: string;          // Background color (optional)
}
```

All colors are hex strings (e.g., `"#ff79c6"`). You always write the exact color you mean; the framework maps it down to whatever the viewer's terminal can actually display.

## Color depth

Detected once at startup, in this order:

1. **`NO_COLOR`** (any value) — no color at all. The [published standard](https://no-color.org/), and it outranks everything below.
2. **`TERMINALTUI_COLOR`** — an explicit override: `truecolor`/`24bit`, `256`, `16`, or `none`. Unrecognized values are ignored rather than obeyed.
3. **Apple Terminal** — sniffed from its build number, because Terminal.app is the one major terminal that gained 24-bit color without ever setting `COLORTERM`. Build **470+** (macOS 26 Tahoe) gets truecolor; earlier builds get 256, since they parse a `38;2` triple but snap it to their own palette — strictly worse than quantizing here, where we control the rounding.
4. **`COLORTERM=truecolor`/`24bit`**, then a list of known-truecolor terminals, then `TERM`.

The override is worth knowing about for two reasons: it is the escape hatch if that version sniff is ever wrong for your machine, and it is the only way to *preview* a lower depth on a terminal that reports a higher one.

```bash
TERMINALTUI_COLOR=256 terminaltui dev    # see what a 256-color viewer sees
TERMINALTUI_COLOR=16 terminaltui dev     # and a 16-color one
```

Themes are designed against truecolor and degrade automatically; see [docs/images.md](images.md#256-color-output) for what the 256-color palette can and cannot express, which matters far more for photographs than for UI chrome.

## Border Styles

Borders are separate from themes and apply to cards, tables, and other bordered elements:

```ts
export default defineConfig({
  name: "My Site",
  borders: "rounded",   // default
});
```

Available styles: `"single"`, `"double"`, `"rounded"`, `"heavy"`, `"dashed"`, `"ascii"`, `"none"`.

Individual cards and tables can override the global border style:

```ts
card({ title: "Special Card", border: "double" })
```
