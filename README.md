# terminaltui

![npm](https://img.shields.io/npm/v/terminaltui) ![license](https://img.shields.io/github/license/OmarMusayev/terminaltui) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![typescript](https://img.shields.io/badge/TypeScript-strict-blue) ![tests](https://img.shields.io/badge/tests-2142-brightgreen)

> **Next.js for the terminal.** Write a `pages/` directory of TypeScript files. Get an interactive TUI with file-based routing, components, themes, and SSH hosting. Distribute it with `npx`.

![terminaltui — 5-page tour rendered in a Synthwave-themed terminal: ANSI Shadow banner, navigable menu, components showcase, live theme switching, animated sparklines](assets/recordings/launch-hero-bg.gif)

*Try it yourself: `npx terminaltui try`*

## Quick Start

```bash
npx terminaltui init my-site
cd my-site
npx terminaltui dev
```

Or try a built-in demo instantly — zero install, zero scaffold:

```bash
npx terminaltui demo restaurant
```

---

## What is this?

terminaltui is a **framework** for building interactive terminal apps in TypeScript. You write pages, it handles routing, navigation, layout, state, and rendering. Users run your app with a single `npx` command, or you host it over SSH and they connect with `ssh`. No browser, no Electron, no React.

If you've used Next.js, you already know the shape: `pages/about.ts` becomes `/about`, `pages/projects/[slug].ts` is a dynamic route, `api/stats.ts` is a `GET /api/stats` endpoint.

**How it compares:**

|  | terminaltui | [Ink](https://github.com/vadimdemedes/ink) | [Pastel](https://github.com/vadimdemedes/pastel) | [Bubble Tea](https://github.com/charmbracelet/bubbletea) |
|---|---|---|---|---|
| Lang | TypeScript | TypeScript (React) | TypeScript (Ink-based) | Go |
| Shape | **Framework** (pages, routing, layouts) | Component library | CLI command router | TUI framework (Elm-style) |
| File-based routing for **screens** | Yes | No | No (routes CLI subcommands) | No |
| SSH hosting built in | `terminaltui serve` | No | No | Via `charmbracelet/wish` |
| `npx` distribution | First-class | First-class | First-class | No (Go binary) |
| Components included | 30+ | Bring your own | Inherits from Ink | Via `bubbles` |
| AI codegen-native | `claude/SKILL.md` ships in package | No | No | No |

---

## Project Structure

Each page is its own file. A top-level `config.ts` handles theme and settings.

```
my-site/
├── config.ts          # theme, banner, global settings
├── pages/
│   ├── home.ts        # landing page
│   ├── about.ts       # /about
│   ├── projects/
│   │   ├── index.ts   # /projects
│   │   └── [slug].ts  # /projects/:slug (dynamic route)
│   └── contact.ts     # /contact
├── api/
│   └── stats.ts       # GET /api/stats
└── components/        # reusable blocks
```

**config.ts**

```ts
import { defineConfig } from "terminaltui";

export default defineConfig({
  name: "My Site",
  theme: "cyberpunk",
  banner: { text: "MY SITE", font: "ANSI Shadow" },
});
```

**pages/about.ts**

```ts
import { card, timeline } from "terminaltui";

export const metadata = { label: "About", icon: "?" };

export default function About() {
  return [
    card({ title: "About Me", body: "Full-stack developer based in Portland." }),
    timeline([
      { date: "2024", title: "Started terminaltui" },
      { date: "2023", title: "Joined Acme Corp" },
    ]),
  ];
}
```

---

## Features

### 30+ Components

Cards, tables, timelines, forms, progress bars, galleries, tabs, accordions, and more.

```ts
row([
  col([card({ title: "Revenue", body: "$1.2M" })], { span: 4 }),
  col([card({ title: "Users", body: "45,231" })], { span: 4 }),
  col([card({ title: "Uptime", body: "99.97%" })], { span: 4 }),
])
```

### 12-Column Grid System

Bootstrap-style responsive grid with automatic spatial navigation.

```ts
row([
  col([statsCard], { span: 3, xs: 12 }),
  col([chartCard], { span: 9, xs: 12 }),
], { gap: 1 })
```

Breakpoints: xs (<60 cols), sm (60-89), md (90-119), lg (>=120). Rows auto-wrap.

### Spatial Navigation

Arrow keys move to the nearest item on screen -- like a TV remote. No configuration needed. Works automatically with all layouts.

| Key | Action |
|-----|--------|
| Up/Down or j/k | Move to nearest item above/below |
| Left/Right or h/l | Move to nearest item left/right |
| Enter | Activate |
| Escape | Go back |
| Tab | Sequential fallback |
| 1-9 | Jump to page |

### 10 Themes

![theme switching](assets/recordings/themes.gif)

cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker. Plus custom themes.

```ts
export default defineConfig({ theme: "dracula" });
```

### ASCII Art Engine

![fonts and art](assets/recordings/fonts-and-art.gif)

14 fonts, 15 scenes, 30+ icons, data visualization, image-to-ASCII conversion.

### Forms & Inputs

TextInput, TextArea, Select, Checkbox, Toggle, RadioGroup, NumberInput, SearchInput, Button. Validation, submission, notifications.

### File-Based API Routes

```ts
// api/stats.ts
export async function GET() {
  return { users: 45231, uptime: 99.97 };
}
```

File path maps to endpoint: `api/stats.ts` -> `GET /api/stats`. Framework starts a local server automatically.

### Reactive State

```ts
const count = createState({ visitors: 0 });

dynamic(() => [text(`Visitors: ${count.get("visitors")}`)]);
```

`createState`, `computed`, `dynamic`, `createPersistentState`, `fetcher`, `request`, `liveData`.

---

## Demos

No setup needed -- run any demo straight from npm:

```bash
npx terminaltui demo restaurant
npx terminaltui demo dashboard
npx terminaltui demo band
npx terminaltui demo coffee-shop
npx terminaltui demo conference
npx terminaltui demo developer-portfolio
npx terminaltui demo freelancer
npx terminaltui demo startup
npx terminaltui demo server-dashboard
npx terminaltui demo mac-monitor   # macOS only — live system stats
```

| Demo | Theme | Highlights |
|------|-------|------------|
| Restaurant | gruvbox | Tabbed menu, reservation form, split layout |
| Dashboard | hacker | Live API data, persistent state, parameterized routes |
| Band | rosePine | Album cards, tour dates, mailing list |
| Coffee Shop | catppuccin | Tabbed menu, catering form |
| Conference | nord | Schedule tabs, speaker grid, sponsor tiers |
| Developer Portfolio | cyberpunk | Skill bars, sparklines, project grid |
| Freelancer | custom | Testimonial quotes, contact form |
| Startup | tokyoNight | Pricing tiers, feature accordion |
| Server Dashboard | hacker | System metrics, container table, log stream |
| Mac Monitor | hacker | Live macOS system stats (CPU/mem/GPU/disk/net/battery/processes), dynamic routes for per-process detail — darwin only |

### Restaurant
![restaurant demo](assets/recordings/restaurant.gif)

### Dashboard (live API data)
![dashboard demo](assets/recordings/dashboard.gif)

---

## CLI

```bash
terminaltui init [template]    # scaffold a new project
terminaltui dev [path]         # compile and run (auto-detects project type)
terminaltui serve [path]       # host your TUI over SSH
terminaltui build              # bundle for npm publish
terminaltui demo [name]        # run a built-in demo
terminaltui create             # interactive prompt builder
terminaltui convert            # AI-assisted website conversion
terminaltui test               # headless emulator tests
terminaltui art                # manage ASCII art assets
```

---

## SSH Hosting

Host any TUI app over SSH -- anyone can connect with `ssh` and see it rendered in their terminal, zero install required. Think `ssh chat.shazow.net` but for any terminaltui project.

```bash
terminaltui serve --port 2222
```

Then from any machine:

```bash
ssh localhost -p 2222
```

Each connection gets an independent session. Arrow keys, forms, navigation -- everything works.

| Flag | Default | Description |
|------|---------|-------------|
| `--port <N>` | 2222 | SSH port |
| `--host-key <path>` | `.terminaltui/host_key` | Host key path (auto-generated) |
| `--max-connections <N>` | 100 | Max simultaneous connections |

---

## See It Live

```bash
npx omar-musayev
```

A real portfolio built with terminaltui.

---

## For AI Agents

terminaltui ships with `claude/SKILL.md` -- a 2,500+ line API reference designed for AI code generation. The `terminaltui create` and `terminaltui convert` commands generate tailored prompts for Claude Code.

The TUI emulator (`terminaltui/emulator`) provides headless testing: spawn the app in a PTY, read the screen, send keystrokes, assert content.

---

## Documentation

| Doc | What's in it |
|-----|-------------|
| [docs/getting-started.md](docs/getting-started.md) | Install, scaffold, run your first project |
| [docs/cli-reference.md](docs/cli-reference.md) | Every CLI command with flags and examples |
| [docs/components.md](docs/components.md) | Component catalog with examples |
| [docs/layouts.md](docs/layouts.md) | Grid system, spatial navigation, layout patterns |
| [docs/routing.md](docs/routing.md) | File-based routing, dynamic routes, middleware |
| [docs/api-routes.md](docs/api-routes.md) | File-based HTTP API server (api/*.ts) |
| [docs/state-data.md](docs/state-data.md) | createState, computed, dynamic, fetcher, liveData |
| [docs/themes.md](docs/themes.md) | The 10 built-in themes + how to write your own |
| [docs/ascii-art.md](docs/ascii-art.md) | Banners, scenes, icons, dataviz, image-to-ASCII |
| [docs/serve.md](docs/serve.md) | SSH hosting (`terminaltui serve`) |
| [docs/testing.md](docs/testing.md) | Headless TUI emulator |
| [docs/create-command.md](docs/create-command.md) | The interactive prompt builder |
| [claude/SKILL.md](claude/SKILL.md) | Full API reference for AI code generation |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Codebase structure and design decisions |

---

## Tech Stack

- **TypeScript** -- strict mode, zero `any` in public API
- **1 required dependency** (esbuild) -- ssh2 is optional for `serve`
- **2,100+ assertions** across unit, integration, emulator, and demo suites
- **Apple Terminal compatible** -- auto-detects and uses 256-color fallback

## Contributing

Issues and PRs welcome at [github.com/OmarMusayev/terminaltui](https://github.com/OmarMusayev/terminaltui).

## License

[MIT](LICENSE)
