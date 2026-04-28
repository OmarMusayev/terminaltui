# Contributing to terminaltui

## Setup

```bash
git clone https://github.com/OmarMusayev/terminaltui.git
cd terminaltui
npm install
```

## Development

```bash
npm run typecheck        # type-check without emitting
npm run build            # full bundle to dist/ (tsup + bundle-demos)
npm run dev              # tsup --watch on src/index.ts
```

Run any demo straight from source:

```bash
npx tsx src/cli/index.ts dev demos/developer-portfolio/site.config.ts
npx tsx src/cli/index.ts dev demos/developer-portfolio/config.ts   # file-based variant
```

## Tests

```bash
npm test                 # full suite via test/run-all.ts
npm run test:components  # component renderers across all themes
npm run test:emulator    # PTY emulator tests
npm run test:colors      # Apple-Terminal color fallback
```

The test tree at a glance:

- `test/run-all.ts` — entry point, invokes the core suites
- `test/test-*.ts` — unit suites (components, state, async, forms, inputs, data, banner)
- `test/demo-*.test.ts` — emulator-driven smoke tests for every bundled demo
- `test/router/*.test.ts` — file-based routing suites (scanner, route-table, page-loader, layouts, api, resolver)
- `test/stress-*.ts` — stress harnesses for content/sizes/templates/visuals

Total ~1,500 assertions. New tests should land in the existing files where possible; new modules get a new file.

## Working on SSH (`serve`)

`terminaltui serve` lives in `src/core/ssh-server.ts` and uses the `TerminalIO` abstraction (`src/core/terminal-io.ts`) so the runtime can be driven by either `process.stdin/stdout` (`ProcessTerminalIO`) or an SSH channel. `ssh2` is an optional peer dependency — `terminaltui dev` works without it.

When changing anything in `runtime.ts`, `screen.ts`, or `input-manager.ts`, double-check that both code paths still work: `npm run dev` for local stdio, and `npx terminaltui serve --port 2222` + `ssh localhost -p 2222` for SSH.

## Project Structure

```
src/
├── animation/      # Animation engine, boot sequence, transitions
├── api/            # File-based API server (api/*.ts handlers)
├── art-registry/   # Community art asset system
├── ascii/          # Fonts, scenes, icons, patterns, shapes, dataviz
├── cli/            # CLI commands (init, create, convert, dev, serve, build, demo, migrate, validate, test, art)
├── components/     # All 30+ component renderers
├── config/         # Type definitions, parser (DSL helpers), env loader, defineConfig
├── core/           # Runtime, input, render, terminal-io, ssh-server, notifications
├── data/           # fetcher, request, liveData, async content
├── emulator/       # Headless TUI testing framework
├── helpers/        # Terminal detection, clipboard, URL opening
├── layout/         # Box model, panel layout, grid system, flex engine, responsive
├── lifecycle/      # Lifecycle hook types
├── middleware/     # Middleware chain (redirect, requireEnv, rateLimit)
├── navigation/     # Spatial navigation, focus, keybindings, page stack
├── router/         # File-based router (scanner, route-table, page-loader, layout-chain, api-loader, resolver)
├── routing/        # Legacy parameterized routes (route(), navigate())
├── state/          # createState, computed, dynamic, persistent
└── style/          # Themes, colors, borders, gradients
```

`router/` and `routing/` are not duplicates — `router/` is the file-based system (Next.js-style `pages/` discovery), `routing/` is the imperative parameterized-route helpers used inside a single-file `site.config.ts`.

## Guidelines

- **One required dep** — `esbuild` only. Don't add new top-level dependencies; `ssh2` is the one optional peer dep (only needed for `serve`).
- All colors go through `fgColor()`/`bgColor()` for Apple Terminal compatibility.
- Use `stringWidth()` not `.length` for terminal display width.
- Every component receives `RenderContext` and returns `string[]`.
- Test at terminal widths 40, 80, and 100 — narrow widths shake out border-clipping bugs.

## Pull Requests

1. Fork and create a branch
2. Make changes
3. `npm run typecheck` (must pass with 0 errors)
4. `npm test` (or at least the suite covering your area)
5. Open a PR with a clear description and a screenshot if it's UI-affecting
