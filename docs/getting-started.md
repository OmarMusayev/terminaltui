# Getting Started

terminaltui turns any website into a fully interactive terminal app. Define your site in a single `site.config.ts` file, preview it locally, and publish it to npm so anyone can run it with `npx your-site`.

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

## Scaffold a Project

```bash
npx terminaltui init [template]
```

Available templates: `minimal`, `portfolio`, `landing`, `restaurant`, `blog`, `creative`.

This creates a project with three files:

```
my-site/
  site.config.ts    # your entire site lives here
  package.json      # must have "type": "module"
  tsconfig.json
```

### Minimal Example

```ts
import { defineSite, page, markdown } from "terminaltui";

export default defineSite({
  name: "My Site",
  pages: [
    page("home", {
      title: "Home",
      content: [markdown("Hello world!")],
    }),
  ],
});
```

The `defineSite()` function is always the default export of `site.config.ts`. Pages are defined with the `page()` builder. Content is an array of content blocks like `markdown()`, `card()`, `table()`, and so on.

## Dev Preview

```bash
npx terminaltui dev
```

This compiles your config and launches an interactive terminal preview. Navigate with arrow keys, press Enter to select, Escape to go back, and `q` to quit.

You can also point it at a specific config file:

```bash
npx terminaltui dev path/to/site.config.ts
```

## Build for Publishing

```bash
npx terminaltui build
```

This bundles your site into a standalone package ready for `npm publish`. After publishing, anyone can run your site with:

```bash
npx your-package-name
```

## Project Configuration

Your `package.json` needs two things:

```json
{
  "type": "module",
  "dependencies": {
    "terminaltui": "^1.0.0"
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

This drops two reference files into your project directory. Open Claude Code (or any AI assistant), point it at the files, and tell it to convert your site. The AI reads your existing HTML/React/Vue/etc. and produces a `site.config.ts`.

## What's Next

- [Components](./components.md) -- every content block and input component
- [Themes](./themes.md) -- built-in themes and custom theme creation
- [ASCII Art](./ascii-art.md) -- banners, scenes, icons, and data visualization
- [State & Data](./state-data.md) -- reactive state, data fetching, and real-time connections
- [Routing](./routing.md) -- parameterized routes and middleware
- [Testing](./testing.md) -- automated testing with TUIEmulator
- [CLI Reference](./cli-reference.md) -- all commands and flags
