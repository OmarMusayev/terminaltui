# terminaltui

![npm](https://img.shields.io/npm/v/terminaltui) ![license](https://img.shields.io/github/license/OmarMusayev/terminaltui) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![typescript](https://img.shields.io/badge/TypeScript-strict-blue) ![dependencies](https://img.shields.io/badge/dependencies-0-success) ![tests](https://img.shields.io/badge/tests-1572-brightgreen)

A framework for building beautiful, interactive terminal websites and apps. Write a config, get a TUI, distribute via `npx`.

![terminaltui demo](assets/recordings/hero.gif)

---

## Get Started

```bash
npm install -g terminaltui     # install
terminaltui init               # create a new project
terminaltui dev                # preview it
terminaltui build && npm publish   # now anyone can: npx your-project-name
```

---

## Build something new

```bash
terminaltui create
# Answer a few questions → get a tailored AI prompt → paste into Claude Code
```

## Already have a website?

```bash
cd ~/my-website
terminaltui convert
# paste the prompt into Claude Code — it reads your site and generates the TUI version
```

---

## Minimal Config

```typescript
import { defineSite, page, markdown, card, link } from "terminaltui";

export default defineSite({
  name: "My Site",
  theme: "dracula",
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("# Hello World\nWelcome to my terminal."),
        card({ title: "My Project", body: "Something cool", tags: ["typescript"] }),
        link("GitHub", "https://github.com/me"),
      ],
    }),
  ],
});
```

---

## See it live

```bash
npx omar-musayev
```

A real portfolio built with terminaltui — AI chat, blog posts with parameterized routes, interactive forms, and a custom orange-on-black theme.

---

## Try the demos

No setup needed — run any demo straight from npm:

```bash
npx terminaltui demo restaurant
npx terminaltui demo dashboard
npx terminaltui demo band
npx terminaltui demo coffee-shop
npx terminaltui demo conference
npx terminaltui demo developer-portfolio
npx terminaltui demo freelancer
npx terminaltui demo startup
```

Run `npx terminaltui demo` to see the full list.

| Demo | Command | Theme |
|------|---------|-------|
| Restaurant | `npx terminaltui demo restaurant` | gruvbox |
| Live Dashboard | `npx terminaltui demo dashboard` | hacker |
| Band Page | `npx terminaltui demo band` | rosePine |
| Coffee Shop | `npx terminaltui demo coffee-shop` | catppuccin |
| Conference | `npx terminaltui demo conference` | nord |
| Developer Portfolio | `npx terminaltui demo developer-portfolio` | cyberpunk |
| Freelancer Studio | `npx terminaltui demo freelancer` | custom |
| Startup Landing | `npx terminaltui demo startup` | tokyoNight |

### Restaurant
![restaurant demo](assets/recordings/restaurant.gif)

### Dashboard (live API data)
![dashboard demo](assets/recordings/dashboard.gif)

### Tetris (yes, really — a fully playable game built on the framework)
![tetris](assets/recordings/tetris.gif)

---

## Features

### 21+ Components

Card, Timeline, Table, Hero, Gallery, Tabs, Accordion, Quote, Badge, ProgressBar, Link, List, Section, Divider, Image, and more.

### Interactive Forms

TextInput, TextArea, Select, Checkbox, Toggle, RadioGroup, NumberInput, SearchInput, Button — with validation, submission, and notifications.

### ASCII Art System

![fonts and art](assets/recordings/fonts-and-art.gif)

14 fonts, 15 scenes, 32 icons, 12 patterns, 9 shapes, 5 data visualizations. Image-to-ASCII conversion with braille mode.

### 10 Built-in Themes

![theme switching](assets/recordings/themes.gif)

cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker. Plus custom themes.

### Reactive State & Live Data

`createState`, `computed`, `dynamic` blocks, `fetcher` with auto-refresh, `request` HTTP client, WebSocket/SSE via `liveData`. Build real applications, not just static sites.

### API Routes (Backend Built In)

Define backend endpoints directly in your config — no separate server needed:

```typescript
api: {
  "GET /stats": async () => {
    const uptime = execSync("uptime -p").toString().trim();
    return { uptime, timestamp: Date.now() };
  },
  "POST /deploy": async (req) => {
    execSync(`docker run -d ${(req.body as any).image}`);
    return { success: true };
  },
}
```

Run shell commands, read files, query databases — anything Node can do. The framework starts a local server automatically. `fetcher({ url: "/stats" })` just works. See [API Routes docs](docs/api-routes.md) for the full reference.

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

When focused on a text input, just start typing — it auto-enters edit mode. Press Escape to return to navigation.

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [API Routes](docs/api-routes.md)
- [Components](docs/components.md)
- [Themes](docs/themes.md)
- [ASCII Art](docs/ascii-art.md)
- [State & Data](docs/state-data.md)
- [Routing & Middleware](docs/routing.md)
- [Testing](docs/testing.md)
- [CLI Reference](docs/cli-reference.md)
- [Create Command](docs/create-command.md)

---

## Tech Stack

- **TypeScript** — fully typed with strict mode
- **Zero dependencies** — pure Node.js 18+
- **1,572 tests** across 10 suites (`npm test`)
- **Apple Terminal compatible** — auto-detects and falls back to 256-color

> terminaltui is a v1 framework — the API is ambitious and some features are foundational implementations that will deepen over time. Contributions welcome.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

[MIT](LICENSE)
