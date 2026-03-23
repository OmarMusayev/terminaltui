# Contributing to terminaltui

## Setup

```bash
git clone https://github.com/terminaltui/terminaltui.git
cd terminaltui
npm install
```

## Development

```bash
npm run typecheck    # type-check without emitting
npx tsc              # full build to dist/
```

Run any demo:
```bash
npx tsx src/cli/index.ts dev demos/developer-portfolio/site.config.ts
```

## Tests

```bash
npx tsx test/test-all-components.ts    # 1,267 component tests across 10 themes
npx tsx test/test-emulator.ts          # 73 emulator tests
npx tsx test/test-state.ts             # 23 state system tests
npx tsx test/test-routing-middleware.ts # 20 routing tests
npx tsx test/test-data-config.ts       # 22 data/config tests
npx tsx test/test-form.ts              # 23 form tests
npx tsx test/test-async.ts             # 23 async tests
npx tsx test/test-inputs.ts            # 36 input tests
npx tsx test/test-apple-terminal-colors.ts  # 38 color tests
```

## Project Structure

```
src/
├── animation/      # Animation engine, boot sequence, transitions
├── art-registry/   # Community art asset system
├── ascii/          # Fonts, scenes, icons, patterns, shapes, dataviz
├── cli/            # CLI commands (init, dev, build, test, art, convert)
├── components/     # All 30+ component renderers
├── config/         # Type definitions, parser, env loader, defineConfig
├── core/           # Runtime, input handling, input modes, notifications
├── data/           # Fetcher, request, liveData, cache, async content
├── emulator/       # Headless TUI testing framework
├── helpers/        # Terminal detection, clipboard, URL opening
├── layout/         # Layout engine
├── lifecycle/      # Lifecycle hook types
├── middleware/     # Middleware system
├── navigation/     # Router, focus manager, keybindings
├── routing/        # Parameterized routes, navigate()
├── state/          # Reactive state, computed, dynamic, persistent
└── style/          # Themes, colors, borders, gradients
```

## Guidelines

- Zero external dependencies — use Node.js built-ins only
- All colors go through `fgColor()`/`bgColor()` for Apple Terminal compatibility
- Use `stringWidth()` not `.length` for terminal display width
- Every component receives `RenderContext` and returns `string[]`
- Test at terminal widths 40, 80, and 100

## Pull Requests

1. Fork and create a branch
2. Make changes
3. Run `npx tsc --noEmit` (must pass with 0 errors)
4. Run the component test suite
5. Open a PR with a clear description
