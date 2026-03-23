# terminaltui

![terminaltui demo](assets/recordings/hero.gif)

**Turn any website into a beautiful terminal experience.**

```bash
npx omar-musayev   # try it now
```

---

## What is this?

terminaltui is a framework for building interactive terminal (TUI) websites and applications. Write a config file, get a polished terminal app with keyboard navigation, ASCII art, themes, forms, live data, and animations. Distribute via `npx` — anyone can run it, nothing to install.

### The AI Shortcut

Already have a website? One command:

```bash
cd ~/my-website
terminaltui convert
# paste the prompt into Claude Code — done
```

---

## Demos

Run any of these to see the framework in action:

```bash
# From the repo:
npx tsx src/cli/index.ts dev demos/developer-portfolio/site.config.ts   # cyberpunk portfolio
npx tsx src/cli/index.ts dev demos/restaurant/site.config.ts            # gruvbox restaurant
npx tsx src/cli/index.ts dev demos/dashboard/site.config.ts             # hacker dashboard (live API)
npx tsx src/cli/index.ts dev demos/startup/site.config.ts               # tokyoNight SaaS landing
npx tsx src/cli/index.ts dev demos/conference/site.config.ts            # nord conference
npx tsx src/cli/index.ts dev demos/band/site.config.ts                  # rosePine band page
npx tsx src/cli/index.ts dev demos/coffee-shop/site.config.ts           # catppuccin cafe
npx tsx src/cli/index.ts dev demos/freelancer/site.config.ts            # custom earth-tone studio
npx tsx demos/tetris/index.ts                                           # playable Tetris game
```

### Restaurant Demo (gruvbox theme)
![restaurant demo](assets/recordings/restaurant.gif)

### Dashboard Demo (hacker theme — live API data)
![dashboard demo](assets/recordings/dashboard.gif)

| Demo | Theme | Highlights |
|------|-------|------------|
| **Developer Portfolio** | cyberpunk | Gradient banner, 6 project cards, skill bars, sparkline, search |
| **Restaurant** | gruvbox | 20+ menu items, wine list, reservation form, press quotes |
| **Dashboard** | hacker | Live API data, reactive state, parameterized routes, bookmarks |
| **Startup** | tokyoNight | Hero with CTA, pricing table, signup form, accordion quick start |
| **Conference** | nord | 12 speaker cards, schedule tabs, speaker search, sponsor tiers |
| **Band** | rosePine | Album search, tour dates, press quotes, mailing list signup |
| **Coffee Shop** | catppuccin | 19-item menu search, bean origins, catering form |
| **Freelancer** | custom | Service cards with pricing, portfolio, testimonials, contact form |
| **Tetris** | cyberpunk | Fully playable Tetris with scoring, levels, hold piece, ghost |

---

## Quick Start

```bash
npm install -g terminaltui
terminaltui init         # pick a template
terminaltui dev          # preview in terminal
terminaltui build        # bundle for npm
npm publish              # now anyone can npx your-site
```

### Minimal Config

```typescript
import { defineSite, page, markdown, card, link } from "terminaltui";

export default defineSite({
  name: "My Site",
  tagline: "welcome to my terminal",
  theme: "dracula",
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("# Hello World"),
        card({ title: "My Project", body: "Something cool", tags: ["typescript"] }),
        link("GitHub", "https://github.com/me"),
      ],
    }),
  ],
});
```

---

## Features

### 21+ Components

Card, Timeline, Table, Hero, Gallery, Tabs, Accordion, Quote, Badge, ProgressBar, Link, List, Section, Divider, Image, and more.

### Interactive Forms

TextInput, TextArea, Select, Checkbox, Toggle, RadioGroup, NumberInput, SearchInput, Button — with validation, submission, and notifications.

### ASCII Art System

14 fonts, 15 scenes, 32 icons, 12 patterns, 9 shapes, 5 data visualizations. Image-to-ASCII conversion with braille mode. Art composition utilities.

### 10 Built-in Themes

![theme switching](assets/recordings/themes.gif)

cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker. Plus custom themes.

### Reactive State & Live Data

`createState`, `computed`, `dynamic` blocks, `fetcher` with auto-refresh, `request` HTTP client, WebSocket/SSE via `liveData`. Build real applications, not just static sites.

### Parameterized Routes

```typescript
route("project", {
  title: (params) => `Project: ${params.id}`,
  content: async (params) => {
    const data = await fetch(`/api/projects/${params.id}`).then(r => r.json());
    return [card({ title: data.name, body: data.description })];
  },
});
```

### Persistent State

```typescript
const store = createPersistentState({
  path: ".terminaltui/state.json",
  defaults: { theme: "cyberpunk", favorites: [] },
});
// Survives app restarts
```

### Built-in Testing

```bash
terminaltui test --sizes --verbose
```

Headless TUI emulator — like Puppeteer for terminals. Test every page programmatically.

### AI-Powered Conversion

```bash
terminaltui convert
# Drops API docs into your project
# Paste the prompt into Claude Code
# Claude reads your site and generates the TUI version
```

---

## Navigation

| Key | Action |
|-----|--------|
| ↑↓ / jk | Navigate between items |
| Enter / → | Select / activate |
| ← / Esc | Back |
| q | Quit |
| : | Command mode |
| 1-9 | Jump to page |
| Tab | Next item |

When focused on a text input, just start typing — it auto-enters edit mode. Press Escape to return to navigation.

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Components](docs/components.md)
- [Themes](docs/themes.md)
- [ASCII Art](docs/ascii-art.md)
- [State & Data](docs/state-data.md)
- [Routing & Middleware](docs/routing.md)
- [Testing](docs/testing.md)
- [CLI Reference](docs/cli-reference.md)

---

## Tech Stack

- **TypeScript** — fully typed, zero `any` in the public API
- **Zero dependencies** — pure Node.js 18+
- **83 exports** — comprehensive but focused
- **1,500+ tests** — components, state, routing, rendering
- **Apple Terminal compatible** — auto-detects and falls back to 256-color

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

[MIT](LICENSE)
