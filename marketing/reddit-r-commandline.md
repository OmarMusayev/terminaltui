# terminaltui: turn any website into a themed terminal app with ASCII art

I built a framework for creating interactive terminal apps that actually look good. Define your site in a single TypeScript config file, pick one of 10 built-in themes, and get a keyboard-navigable app with proper borders, colors, and ASCII art.

**The aesthetic side:**

10 color themes: dracula, cyberpunk (neon pink), nord (frost blue), gruvbox (warm orange), hacker (green-on-black), catppuccin, tokyoNight, rosePine, monokai, solarized. Each one is carefully tuned with accent, text, muted, border, success/warning/error colors. Or bring your own custom palette.

The ASCII art system has 14 banner fonts (from clean modern to retro DOS to horror), 15 pre-made scenes (mountains, cityscapes, rockets, robots, retro devices), 32 icons, 12 decorative patterns (circuit boards, rain, waves), and data visualization (bar charts, sparklines, heatmaps, pie charts). There's a composition layer for overlaying, tiling, mirroring, and applying gradients to any art.

Everything uses 256-color ANSI -- no truecolor assumptions, so it works in every terminal. Border styles include single, double, rounded, heavy, dashed, and ASCII.

Boot animations, page transitions (fade, slide, wipe), and a customizable exit message round it out.

The result is something you'd actually want to look at in your terminal. I've built showcases for portfolios, restaurants, coffee shops, podcasts, and more -- all runnable via `npx`.

```
npm install terminaltui
npx terminaltui init
npx terminaltui dev
```
