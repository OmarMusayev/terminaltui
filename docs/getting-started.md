# Getting Started

terminaltui turns any website into a fully interactive terminal app. Define your site as a `config.ts` plus a `pages/` directory, preview it locally, and publish it to npm so anyone can run it with `npx your-site`.

## Prerequisites

- Node.js 18 or later
- A terminal emulator (any will do)

## Install

```bash
npm install terminaltui
```

Or use it directly without installing:

```bash
npx terminaltui init
```

## Three Ways to Start

- **`terminaltui init [template]`** — scaffold from a template with placeholder content
- **`terminaltui create`** — describe what you want, AI builds it ([details](./create-command.md))
- **`terminaltui convert`** — convert an existing website to TUI

## Scaffold a Project

```bash
npx terminaltui init [template]
```

Available templates: `minimal`, `portfolio`, `landing`, `restaurant`, `blog`, `creative`.

This creates a project with file-based routing:

```
my-site/
  config.ts          # theme, banner, global settings
  pages/
    home.ts          # the landing page
    about.ts         # /about
    ...
  api/               # optional — file-based HTTP routes
  package.json       # must have "type": "module"
  tsconfig.json
```

### Minimal example

```ts
// config.ts
import { defineConfig } from "terminaltui";

export default defineConfig({
  name: "My Site",
  theme: "cyberpunk",
});
```

```ts
// pages/home.ts
import { card, markdown } from "terminaltui";

export const metadata = { label: "Home", icon: "◆" };

export default function Home() {
  return [
    markdown("Hello world!"),
    card({ title: "Welcome", body: "This is your first terminal app." }),
  ];
}
```

Each file in `pages/` becomes a route. Filename → URL: `pages/about.ts` → `/about`, `pages/projects/[slug].ts` → `/projects/:slug`. See [Routing](./routing.md) for layouts, dynamic routes, and metadata.

## Dev Preview

```bash
npx terminaltui dev
```

This compiles your project and launches an interactive terminal preview. Navigate with arrow keys, press Enter to select, Escape to go back, and `q` to quit.

You can also point it at a specific config file:

```bash
npx terminaltui dev path/to/config.ts
```

## Build for Publishing

```bash
npx terminaltui build
```

This bundles your site into a standalone package ready for `npm publish`. After publishing, anyone can run your site with:

```bash
npx your-package-name
```

## Host over SSH

```bash
npx terminaltui serve --port 2222
```

Anyone with an SSH client can then connect (`ssh your-host -p 2222`) and use the app interactively, no install required. See [SSH Hosting](./serve.md) for the full guide.

## Project Configuration

Your `package.json` needs two things:

```json
{
  "type": "module",
  "dependencies": {
    "terminaltui": "^1.5.0"
  }
}
```

The `"type": "module"` field is required because terminaltui uses ES modules.

## Convert an Existing Website

If you already have a website and want to turn it into a TUI, the `convert` command sets up everything an AI coding assistant needs to do it for you:

```bash
cd your-existing-site
npx terminaltui convert
```

This drops two reference files into your project directory. Open Claude Code (or any AI assistant), point it at the files, and tell it to convert your site.

## API Routes

Need backend logic? Drop `.ts` files into `api/` — each file's `GET`/`POST`/etc. exports become endpoints. No separate server needed. See [API Routes](./api-routes.md) for the full reference.

## What's Next

- [Routing](./routing.md) — file-based routing, dynamic routes, layouts, middleware
- [Components](./components.md) — every content block and input component
- [Layouts](./layouts.md) — panels, the 12-column grid, spatial navigation
- [State & Data](./state-data.md) — reactive state, data fetching, real-time connections
- [API Routes](./api-routes.md) — backend endpoints in your project
- [SSH Hosting](./serve.md) — host your TUI over SSH
- [Themes](./themes.md) — built-in themes and custom theme creation
- [ASCII Art](./ascii-art.md) — banners, scenes, icons, and data visualization
- [Testing](./testing.md) — automated testing with TUIEmulator
- [CLI Reference](./cli-reference.md) — all commands and flags
- [Architecture](../ARCHITECTURE.md) — internal module map for contributors
