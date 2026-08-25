# terminaltui

[![CI](https://github.com/OmarMusayev/terminaltui/actions/workflows/ci.yml/badge.svg)](https://github.com/OmarMusayev/terminaltui/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/terminaltui)](https://www.npmjs.com/package/terminaltui) [![license](https://img.shields.io/github/license/OmarMusayev/terminaltui)](LICENSE) ![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![typescript](https://img.shields.io/badge/TypeScript-strict-blue) ![tests](https://img.shields.io/badge/tests-3334-brightgreen) [![website](https://img.shields.io/badge/website-terminaltui.dev-ff7edb)](https://terminaltui.dev)

> **Next.js for the terminal.** Write a `pages/` directory of TypeScript files. Get an interactive TUI with file-based routing, components, and themes. Distribute it with `npx` — or host it and let people `ssh` in.

**🌐 [terminaltui.dev](https://terminaltui.dev)** &nbsp;·&nbsp; **📦 [npm](https://www.npmjs.com/package/terminaltui)** &nbsp;·&nbsp; **🚀 [Try it: `npx terminaltui try`](#quick-start)**

[![terminaltui Cinema demo rendering a real video frame through the Kitty graphics protocol](web/public/media/terminaltui-kitty-video-poster.jpg)](https://terminaltui.dev/video/)

**[Watch the real three-second Kitty recording →](https://terminaltui.dev/video/)** &nbsp;·&nbsp; [Direct MP4](https://terminaltui.dev/media/terminaltui-kitty-video.mp4) &nbsp;·&nbsp; [`npx terminaltui demo cinema`](https://terminaltui.dev/demos/#d-cinema)

This is the bundled Cinema demo running in Kitty on macOS—not a browser mock-up. terminaltui sends real pixels through the Kitty graphics protocol and uses the same-sized coloured-cell block everywhere else.

<details>
<summary>See the original five-page framework tour</summary>

![terminaltui — 5-page tour rendered in a Synthwave-themed terminal: ANSI Shadow banner, navigable menu, components showcase, live theme switching, animated sparklines](assets/recordings/launch-hero-bg.gif)

*Try it yourself: `npx terminaltui try` — this GIF predates the v2 renderer; the frames are provably identical, so it never needed re-recording.*

</details>

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

**Requirements:** Node.js **>= 18** (relies on the built-in `fetch`). The package is **ESM-only** — load it with `import`, not `require()`.

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
| SSH hosting | `terminaltui serve` (`ssh2` peer dep) | No | No | Via `charmbracelet/wish` |
| `npx` distribution | First-class | First-class | First-class | No (Go binary) |
| Components included | 30+ | Bring your own | Inherits from Ink | Via `bubbles` |
| AI codegen-native | `claude/SKILL.md` ships in package | No | No | No |

---

## What's new in 2.1

> v2.1 adds a real image and video pipeline: Kitty and Ghostty get pixel frames, while Apple Terminal, tmux and SSH get a portable coloured-cell fallback with identical geometry. The production renderer introduced in v2 still writes 67.7% fewer bytes (269,355 → 87,027 across a 41-keypress scripted nav at 120x40), and exactly zero when nothing changed. A dual-terminal oracle proves final frames byte-identical, and the complete validation run covers the engine, demos, emulator, image tiers and video transport.

**Migration note (breaking):** component state (accordions, tabs, galleries, button loading) is now keyed by page + tree position instead of display label. Two same-labeled components no longer share state, and state persists across navigation — correct behavior, but observably different if your app relied on the old label sharing. Details in the [CHANGELOG](CHANGELOG.md).

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

### 42 Components

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

### 12 Themes

![theme switching](assets/recordings/themes.gif)

flintNight, flintDay, cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker. Plus custom themes.

```ts
export default defineConfig({ theme: "dracula" });
```

### ASCII Art Engine

![fonts and art](assets/recordings/fonts-and-art.gif)

14 fonts, 15 scenes, 30+ icons, data visualization, image-to-ASCII conversion.

### Images

```ts
image("./cover.png", { width: 60 })
image("./nebula.jpg", { width: 40, resizable: true })   // viewer can grow it
image("./poster.jpg", { fitPage: true, border: true })  // sizes itself to the page
```

Real PNGs and JPEGs -- no `sharp`, no native build, nothing to install. On kitty and Ghostty they are drawn as **real pixels** via the kitty graphics protocol; everywhere else as colored cells, each one a Unicode block glyph with its own foreground and background, so images work on Apple Terminal, over SSH, and inside tmux. The path is negotiated from the viewer's terminal -- pixels, six cell tiers from 2x2 quadrants down to a plain ASCII ramp, and a bordered alt box on any failure, all at exactly the same row count. `resizable: true` lets the viewer resize a frame with `+`/`-`, and because the engine samples per cell, a bigger frame is a fresh resample with genuinely more detail. `fitPage: true` deletes the hand-picked `width` entirely: the image takes whatever rows the page has left, so a page meant to be seen at once fits at any window size and re-fits on resize. [Watch the real renderer](https://terminaltui.dev/video/) or see [docs/images.md](docs/images.md).

### Video

```ts
video("./trailer.mp4", { fitPage: true, controls: true })  // Space plays, arrows scrub
video("./loop.gif", { autoplay: true, width: 40 })         // zero tooling required
```

Moving pictures, through the same cell engine -- and **with no video decoder at runtime**. A source is packed once, ahead of time, into a `.tvf` frame pack of small pre-scaled JPEGs; playback is a 0.6 ms decode into the existing resample-fit-write path, about 5% of a 24fps frame budget. ffmpeg is needed to *pack* an mp4 and never to play one, and a `.gif` needs nothing at all because the GIF decoder is pure TypeScript. On kitty and Ghostty a playing video is transmitted as **real pixels**: the native pack frame is compressed with kitty's zlib transport and the terminal scales it. The bundled 848x352 demo averages 437 KiB on the wire, or 5.12 MiB/s at 12fps; everywhere else it is coloured cells at about 52 KiB a frame. Both paths produce exactly the same row count, so a terminal that gains or loses pixel support never reflows the page, and `mode: "quadrant"` forces cells if the bandwidth bites. `autoplay` defaults to false so a page stays screenshottable, and `TERMINALTUI_VIDEO=off` freezes every video absolutely. [Watch the real Kitty recording](https://terminaltui.dev/video/) or see [docs/video.md](docs/video.md).

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

Component state (accordions, tabs, galleries, button loading) is keyed by page + tree position — it survives navigation and refresh, stays isolated per page, and two same-labeled components never share state.

Rendering is line-diffed: only rows that changed are repainted, and a frame with no changes writes zero bytes.

---

## Demos

No setup needed -- run any demo straight from npm:

```bash
npx terminaltui demo restaurant
npx terminaltui demo dashboard
npx terminaltui demo cinema
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
| Cinema | dracula | Video transport, Kitty/Ghostty pixels, portable colour-cell fallback |
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
terminaltui try                # run a 5-page guided tour — zero install, zero config
terminaltui init [tpl|name]    # scaffold a new project — arg is a template (minimal, portfolio, landing, restaurant, blog, creative) or your site name
terminaltui create             # interactive prompt builder — describe what you want, AI builds it
terminaltui convert            # drop terminaltui docs into your project for AI-assisted conversion
terminaltui validate           # check a file-based routing project for common issues
terminaltui dev [path]         # start development preview (auto-starts API server if routes defined)
terminaltui serve [path]       # host your TUI over SSH
terminaltui demo [name]        # run a built-in demo
terminaltui build              # bundle for npm publish (includes API routes)
terminaltui test               # run automated tests on the site in the current directory
terminaltui art                # manage art assets (list, preview, create, validate)
terminaltui video pack <file>  # build a reusable .tvf video frame pack
terminaltui help               # show help
```

---

## SSH Hosting

Host any TUI app over SSH -- anyone can connect with `ssh` and see it rendered in their terminal, zero install required. Think `ssh chat.shazow.net` but for any terminaltui project.

v2 writes 67.7% fewer bytes per session, and idle frames cost zero bandwidth — over ssh, that's latency you can feel.

The `serve` command needs [`ssh2`](https://www.npmjs.com/package/ssh2), an optional peer dependency — install it in your project first:

```bash
npm install ssh2
terminaltui serve --port 2222
```

If terminaltui is installed globally (or run via zero-install `npx`), it also picks up an `ssh2` installed in the project directory you run `serve` from; alternatively, install it globally too with `npm install -g ssh2`.

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

## Testing

terminaltui ships a headless emulator (`terminaltui/emulator`) — think Playwright, but the browser is a terminal. It spawns your app in a PTY, scripts keypresses, and lets you assert on the rendered grid:

```ts
import { TUIEmulator } from "terminaltui/emulator";

const emu = await TUIEmulator.launch({
  command: "npx terminaltui dev",
  cwd: "./my-site",
  cols: 120,
  rows: 40,
});

await emu.waitForBoot();
emu.assert.textVisible("MY SITE");

await emu.press("down");
await emu.press("enter");
await emu.waitForText("About Me");
emu.assert.currentPage("about");

// New in 2.0: assert your app's render cost in CI
emu.resetBytesReceived();
await emu.press("escape");
await emu.waitForIdle();
console.log(`repaint cost: ${emu.bytesReceived} bytes`);

await emu.close();
```

Beyond the basics: `screen.text()` / `screen.cells()` for raw grid access, `screen.menu()` / `screen.cards()` / `screen.links()` for structural queries, `navigateTo()` for menu-aware navigation, `resize()` for breakpoint tests, and a recorder for replayable scripts. It's the same emulator the framework's own test suite and the v2 render benchmark run through. See [docs/testing.md](docs/testing.md).

---

## Performance

Method: measured with the built-in emulator driving a 41-keypress scripted navigation at 120x40; medians of 3 runs. The metric is **bytes written to the terminal** — not a speed claim.

| Scenario | Change in bytes written (v1 → v2) |
|----------|-----------------------------------|
| demos/startup | −69.0% |
| demos/developer-portfolio | −66.2% |
| **Combined total** | **269,355 → 87,027 (−67.7%)** |

- Frames with no changes write **0 bytes**.
- Equivalence, not vibes: a dual-VirtualTerminal oracle ran old and new renderers side by side and proved the final grids **byte-identical**.
- Measure your own app the same way with [`TUIEmulator.bytesReceived`](#testing) (byte totals are comparable within the same PTY backend on the same machine).

---

## For AI Agents

Start with [`AGENTS.md`](AGENTS.md) for repository landmarks, [`llms.txt`](llms.txt) for canonical public links, and [`claude/SKILL.md`](claude/SKILL.md) for the complete code-generation API. The public [image and video rendering proof](https://terminaltui.dev/video/) includes a crawlable `VideoObject`, direct MP4 and poster assets, and the exact Cinema command. `terminaltui create` and `terminaltui convert` generate tailored prompts for coding agents.

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
| [docs/themes.md](docs/themes.md) | The 12 built-in themes + how to write your own |
| [docs/images.md](docs/images.md) | Rendering PNG/JPEG -- kitty pixels, cell tiers, detection, resizable frames, caching |
| [docs/video.md](docs/video.md) | Playing video -- frame packs, the pack CLI, GIF support, the frame budget, tearing |
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
- **3 required dependencies** (esbuild, pngjs, jpeg-js) -- all pure JavaScript, no native builds; ssh2 is an optional peer dependency for `serve`
- **3,334 tests across 49 suites** in the default run; `npx tsx test/run-all.ts --all` runs stress, manual health checks and the PTY-driven demo sweep too: 4,223 tests across 68 suites
- **Apple Terminal compatible** -- truecolor on Terminal.app 470+ (macOS 26), automatic 256-color fallback below that

## Contributing

Issues and PRs welcome at [github.com/OmarMusayev/terminaltui](https://github.com/OmarMusayev/terminaltui).

## License

[MIT](LICENSE)
