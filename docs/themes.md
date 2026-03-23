# Themes

terminaltui ships with 10 built-in themes. Set a theme by name or by reference:

```ts
import { defineSite, themes } from "terminaltui";

export default defineSite({
  theme: "dracula",         // by name
  // or
  theme: themes.dracula,    // by reference
  // ...
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
export default defineSite({
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
  // ...
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

All colors are hex strings (e.g., `"#ff79c6"`). The terminal's 256-color palette is used for rendering, so colors are mapped to the nearest available value automatically.

## Border Styles

Borders are separate from themes and apply to cards, tables, and other bordered elements:

```ts
export default defineSite({
  borders: "rounded",   // default
  // ...
});
```

Available styles: `"single"`, `"double"`, `"rounded"`, `"heavy"`, `"dashed"`, `"ascii"`, `"none"`.

Individual cards and tables can override the global border style:

```ts
card({ title: "Special Card", border: "double" })
```
