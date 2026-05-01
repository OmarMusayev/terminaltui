# Architecture

This document explains the internal architecture of **terminaltui** — how the framework turns a `config.ts` + `pages/` project into an interactive terminal UI, locally or over SSH.

## Data Flow

```
config + pages → FileRouter → block tree → Layout → Render Pass → ANSI Lines → TerminalIO
```

1. User writes a file-based project: `config.ts` (env-var schema and runtime options) plus a `pages/` directory of TS modules. Each page module exports a default function returning content blocks.
2. `FileRouter` scans `pages/` and `api/`, builds a route table, and lazy-loads modules through `compileFile` (esbuild on first import; cached on disk under `.terminaltui/`).
3. `TUIRuntime` walks the resolved blocks for the active page, producing a flat list per render pass.
4. The renderer dispatches each block to a component renderer that returns ANSI-styled `string[]`.
5. Lines are written through a `TerminalIO`: stdout for `dev`, an SSH channel for `serve`.

(Single-file `site.config.ts` mode was removed in 1.6.0; `defineSite()`, `page()`, and the legacy `routing/` module are gone.)

## Module Map

### `config/`
DSL helpers (`card()`, `timeline()`, `section()`, …) that produce content block objects, plus `defineConfig()` for env-var schemas and runtime options. `env-loader.ts` parses `.env` files.

### `core/`
Runtime orchestrator. `TUIRuntime` coordinates input, rendering, navigation, forms, and SSH. Split across:
- `runtime.ts` — class shell, `start()`/`stop()`, terminal setup, `runFileBasedSite()` entry
- `runtime-context.ts` — `AsyncLocalStorage` that propagates the active runtime to user code that imports `state`/`navigate`/`resolveUrl`. Without this, concurrent SSH sessions clobber each other's render/navigate handlers
- `runtime-input.ts` — key dispatch: navigation, command mode, edit mode routing
- `runtime-edit-handlers.ts` — type-specific input handlers (text, select, number, …)
- `runtime-render.ts` — page rendering, focus tracking, scroll
- `runtime-block-render.ts` — the `renderBlock()` switch: maps block types to component renderers; defines `FOCUSABLE_TYPES`
- `runtime-terminal.ts` — writes ANSI through the active `TerminalIO`
- `runtime-pages.ts` — page navigation, focus collection, middleware wiring, `:command` dispatch
- `runtime-forms.ts` — form submission, validation, button/card actions
- `terminal-io.ts` — `TerminalIO` interface + `ProcessTerminalIO`
- `ssh-server.ts` — `SSHServer` for `terminaltui serve`. Each accepted SSH session gets its own `TUIRuntime` and `SSHTerminalIO`. Auth is opt-in via `auth.passwords`; the default is allow-all so casual local serving works without ceremony

### `components/`
One file per visual component. Each exports a `render*()` returning `string[]`. Display, interactive, input, and layout components plus `Chat` and `Menu`. `base.ts` provides shared utilities: `stringWidth()` (Unicode-aware), `wrapText()`, `pad()`, `truncate()`, `stripAnsi()`, and `RenderContext`.

### `layout/`
- `box-model.ts` — `computeBoxDimensions()` and `COMPONENT_DEFAULTS`. Most components defer their geometry to it; the focus-rect estimator (`flex-engine.estimateBlockHeight`) and a few panel layouts still compute their own offsets — keep them in sync if you change defaults
- `panel-layout.ts` — layout algorithms for `columns`, `rows`, `grid` (assigns x, y, width, height)
- `flex-engine.ts` — computes `FocusRect` positions for spatial navigation
- `grid-system.ts` — 12-column responsive grid (`row`/`col`/`container`) with breakpoints xs/sm/md/lg
- `responsive.ts` — collapse logic when terminal is too narrow

### `style/`
- `theme.ts` — 10 built-in themes
- `colors.ts` — ANSI escape generation with automatic 256-color fallback for Apple Terminal. `fgColor()` (hex) and `fgColorRgb()` (rgb) both honor color mode
- `gradient.ts` — multi-color gradient text
- `borders.ts` — border character sets (rounded, sharp, double, heavy, …)

### `navigation/`
- `router.ts` — page stack with back/forward
- `focus.ts` — home menu focus cursor
- `spatial.ts` — spatial navigation (`findNextFocus`, `spatialScore`) for 2D arrow-key movement
- `keybindings.ts` — keystroke → semantic action mapping

### `router/`
File-based router (Next.js-style):
- `scanner.ts` — `scanDirectory()`/`detectProject()` walks the project, identifying pages, layouts, dynamic routes (`[slug].ts`), API handlers
- `route-table.ts` — resolves routes from scanned files, including layout chains and dynamic-route matching
- `page-loader.ts` — `compileFile()`/`loadPageModule()`. Cache key is sha1 of the absolute path
- `layout-chain.ts` — composes nested `layout.ts` files outside-in
- `api-loader.ts` — loads `api/*.ts` modules
- `resolver.ts` — `FileRouter` class wires it together
- `navigate.ts` — `navigate()` for programmatic navigation; consults `runtime-context` to find the current session's runtime
- `validate.ts` — `terminaltui validate` warnings

### `state/`
- `reactive.ts` — `createState()` with auto-tracking and batched updates; render notifications go through `runtime-context` so multi-session SSH stays isolated
- `computed.ts` — derived values
- `dynamic.ts` — `dynamic()` blocks that re-render on state changes. The block carries no deps — re-render is global
- `persistent.ts` — disk-backed state with debounced writes; uses a single shared process-exit listener regardless of how many persistent containers are created

### `data/`
- `fetcher.ts` — declarative GET with caching, refresh intervals, retry; renders via `runtime-context` (with a `globalThis` fallback for dev/source vs npm dual-package situations)
- `request.ts` — imperative HTTP client
- `live-data.ts` — WebSocket/SSE
- `async-content.ts` — `AsyncContentManager`; `asyncContent()` block with loading/error states

### `api/`
Built-in HTTP API server for projects with `api/*.ts` handlers. Bound to `127.0.0.1` on a random port. POST/PUT bodies are capped at 1 MB. The base URL is propagated to user code via `runtime-context`.

### `ascii/`
- `banner.ts` — figlet-style banners
- `fonts.ts` + `fonts/` — 14 fonts
- `shapes.ts` / `shapes-extra.ts` — geometric shapes
- `scenes.ts` / `scenes-nature.ts` / `scenes-objects.ts` — composite scenes
- `patterns.ts` — pattern generators
- `dataviz.ts` / `dataviz-charts.ts` — terminal charts
- `image.ts` — image-to-ASCII (lazy-loads `sharp`); routes color through `fgColorRgb`
- `box-drawing.ts`, `art.ts` — utilities

### `art-registry/`
Internal asset registry — the lookup layer that `banner.ts`, `scenes.ts`, and the `terminaltui art` CLI go through to resolve names like `"ANSI Shadow"` or `"forest"`.

### `animation/`
- `engine.ts` — frame-based scheduler used by spinners and the boot sequence
- `spinner.ts` — spinner variants

### `middleware/`
Pre-navigation middleware chain. Supports `redirect()`, `requireEnv()`, `rateLimit()`. Throws are surfaced via the runtime feedback line (a thrown middleware blocks the navigation; it does not silently fall through).

### `helpers/`
Terminal capability detection, clipboard (`spawn pbcopy`/`xclip`/`clip`), `openUrl` (`spawn open`/`xdg-open`/`cmd /c start`, no-op in serve mode), and other host-process helpers. All shell commands use array args.

### `emulator/`
TUI test emulator. Spawns the TUI in a PTY, captures output, exposes assertions.

### `cli/`
CLI commands: `dev`, `serve`, `build`, `init`, `create`, `validate`, `demo`, `test`, `art`. (`migrate` and `convert` were removed alongside single-file mode in 1.6.0.)

### `lifecycle/`
Types for `onInit`, `onExit`, `onNavigate`, `onError` hooks.

## Dependency Graph

```
cli/
 └─► core/ ──► config/
      │
      ├─► navigation/        (page stack, spatial nav)
      ├─► router/            (file-based routing + navigate)
      ├─► state/
      ├─► data/
      ├─► animation/
      ├─► ascii/  ──► art-registry/
      ├─► middleware/
      ├─► api/
      ├─► helpers/
      └─► components/    (independently consumes style/ and layout/)
```

`style/` and `layout/` are siblings consumed by `components/` and parts of `core/`. There are no circular imports.

## Key Abstractions

### Content Block
The fundamental unit. Every piece of UI (card, timeline, text, input, layout) is a content block — a plain object with a `type` field and type-specific properties. Created by helpers like `card()`, `timeline()`, `columns()`, `panel()`, `row()`/`col()`, `chat()`, `menu()`.

### RenderContext
Passed to every component renderer:

```typescript
interface RenderContext {
  width: number;          // available width in columns
  theme: Theme;           // current theme colors
  focused?: boolean;      // is this block focused?
  selected?: boolean;
  borderStyle?: string;   // border character set
  editing?: boolean;      // is this block in edit mode?
  panelHeight?: number;   // available height in a panel cell
}
```

### TerminalIO
Decouples the runtime from `process.stdin/stdout`. Two implementations ship:
- `ProcessTerminalIO` — wraps `process.stdin`/`process.stdout` for `dev`
- `SSHTerminalIO` — wraps an SSH channel for `serve`

`InputManager`, `Screen`, and the runtime all `attachIO(io)` and call into the same interface.

### TUIRuntime
Root coordinator. Holds all per-session state. One instance per SSH connection in serve mode; one for `dev`. `start()` runs inside an `AsyncLocalStorage` scope so user code that calls `state.set()` / `navigate()` / `resolveUrl()` resolves to the right runtime even with concurrent sessions.

### FocusItem
A focusable element on a content page (block, accordion item, or timeline item). The runtime maintains an array of focus items per page; spatial navigation walks them using `FocusRect` coordinates.

## How To: Add a New Component

1. Create `src/components/MyComponent.ts` exporting `renderMyComponent(block, ctx): string[]`
2. Add the block type to `src/config/types.ts`
3. Add a helper to `src/config/parser.ts`
4. Add the render case to `src/core/runtime-block-render.ts`
5. If focusable, add the type to `FOCUSABLE_TYPES` in `runtime-block-render.ts` and to `collectFocusItems()` in `runtime-pages.ts`
6. Re-export the helper from `src/index.ts`
7. Add a test to `test/test-all-components.ts`

## How To: Add a New Theme

1. Open `src/style/theme.ts`
2. Add a theme object with all required color slots
3. Add it to the `themes` record
4. Add the name to the `BuiltinThemeName` union

## How To: Add a New CLI Command

1. Create `src/cli/mycommand.ts`
2. Export an async handler
3. Wire it into `src/cli/index.ts` (`switch` and `printHelp()`)
4. Document it in `docs/cli-reference.md`

## Testing

- **Default `npm test`** runs `test/run-all.ts`, which globs `test/test-*.ts` and `test/**/*.test.ts`. ~2,100 assertions across ~25 suites.
- **`npm test -- --demos`** also runs the PTY-driven demo emulator suites.
- **Typecheck**: `npm run typecheck`
