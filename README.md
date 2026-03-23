# terminaltui

![hero](assets/recordings/hero.gif)

**Turn any website into a beautiful terminal experience.**

```bash
npx demo-dev-portfolio   # try it now
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

![convert](assets/recordings/convert-demo.gif)

---

## Showcase

| | |
|---|---|
| ![portfolio](assets/recordings/hero.gif) **Developer Portfolio** (cyberpunk) | ![restaurant](assets/recordings/restaurant.gif) **Restaurant** (gruvbox) |
| ![dashboard](assets/recordings/dashboard.gif) **Dashboard** (hacker) | ![conference](assets/recordings/conference.gif) **Conference** (nord) |
| ![startup](assets/recordings/startup.gif) **Startup** (tokyoNight) | ![band](assets/recordings/band.gif) **Band** (rosePine) |
| ![cafe](assets/recordings/cafe.gif) **Coffee Shop** (catppuccin) | ![freelancer](assets/recordings/freelancer.gif) **Freelancer** (custom) |

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

![themes](assets/recordings/themes.gif)

cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker. Plus custom themes.

### Reactive State & Live Data

![dashboard](assets/recordings/dashboard.gif)

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
