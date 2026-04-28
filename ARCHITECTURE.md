# Architecture

This document explains the internal architecture of **terminaltui** — how the framework turns a `site.config.ts` (or `config.ts` + `pages/`) into an interactive terminal UI, locally or over SSH.

## Data Flow

```
config + pages → Parser / Router → Component Tree → Layout → Render Pass → ANSI Lines → TerminalIO
```

1. User writes either a single-file `site.config.ts` (using `defineSite()`, `page()`, `card()`, …) or a file-based project (`config.ts` + `pages/*.ts`).
2. **Single-file:** `parseConfig()` normalizes into `SiteConfig`. **File-based:** `FileRouter` scans `pages/`, builds a route table, lazy-loads page modules.
3. The runtime builds a component tree from content blocks.
4. The renderer converts each block to an array of ANSI-styled strings.
5. Lines are written through a `TerminalIO` (stdout for `dev`, an SSH channel for `serve`).

## Module Map

### `config/`
Parses user config into a normalized `SiteConfig`. Houses the DSL helper functions (`card()`, `timeline()`, `section()`, …) that create content block objects. Also handles `.env` file loading and `defineConfig()` (which now accepts both the env-var schema *and* file-based routing config).

### `core/`
The runtime orchestrator. `TUIRuntime` coordinates all other modules: starts the terminal, listens for input, dispatches to handlers, triggers re-renders. Split across multiple files:
- `runtime.ts` — Class shell: constructor, start/stop, terminal setup, `runSite()` / `runFileBasedSite()` entry points
- `runtime-input.ts` — Key dispatch: navigation, command mode, edit mode routing
- `runtime-edit-handlers.ts` — Type-specific input handlers (text, select, number, …)
- `runtime-render.ts` — Page rendering: home page, content page, scroll management
- `runtime-block-render.ts` — The `renderBlock()` switch: maps block types to component renderers
- `runtime-terminal.ts` — Terminal output: writes ANSI through the active `TerminalIO`
- `runtime-pages.ts` — Page navigation, focus collection, middleware
- `runtime-forms.ts` — Form submission, validation, button/card actions
- `terminal-io.ts` — `TerminalIO` interface + `ProcessTerminalIO` (default, wraps `process.stdin/stdout`). Lets the runtime drive any I/O target.
- `ssh-server.ts` — `SSHServer` for `terminaltui serve`. Each accepted SSH session gets its own `TUIRuntime` instance with an `SSHTerminalIO`.

### `components/`
One file per visual component. Each exports a `render*()` function that takes a content block and `RenderContext`, returning `string[]` (lines of ANSI text). Includes display components (Card, Timeline, Table), interactive components (Link, Accordion, Tabs), input components (TextInput, Select, Button), layout components (Columns, Rows, Grid, Panel), and the newer `Chat` and `Menu` blocks.

`base.ts` provides shared utilities: `stringWidth()` (Unicode-aware), `wrapText()`, `pad()`, `truncate()`, `stripAnsi()`, the `componentRegistry` for custom components.

### `layout/`
Layout engine:
- `box-model.ts` — `computeBoxDimensions()` — single source of truth for component width/height. `COMPONENT_DEFAULTS` centralizes padding/border/margin per component type.
- `panel-layout.ts` — Layout algorithms for `columns`, `rows`, `grid` (assigns x, y, width, height)
- `flex-engine.ts` — Computes `FocusRect` positions for spatial navigation by walking the content tree
- `grid-system.ts` — 12-column responsive grid (`row`/`col`/`container`) with breakpoints xs/sm/md/lg
- `responsive.ts` — Responsive collapse logic (panels stack when terminal is too narrow)

### `style/`
Theme and color system:
- `theme.ts` — 10 built-in themes: `cyberpunk`, `dracula`, `nord`, `monokai`, `solarized`, `gruvbox`, `catppuccin`, `tokyoNight`, `rosePine`, `hacker`
- `colors.ts` — ANSI escape generation with automatic 256-color fallback for Apple Terminal. Color mode is per-runtime (so SSH sessions don't clobber each other).
- `gradient.ts` — Multi-color gradient text rendering
- `borders.ts` — Border character sets (rounded, sharp, double, heavy, …)

### `navigation/`
- `router.ts` — Page stack with back/forward, parameterized routes
- `focus.ts` — Home menu focus cursor
- `spatial.ts` — Spatial navigation algorithm (`findNextFocus`, `spatialScore`) for 2D arrow-key movement
- `keybindings.ts` — Maps keystrokes to semantic actions (up/down/left/right/select/quit)

### `router/` (file-based routing — distinct from `routing/`)
The Next.js-style file-based router introduced in 1.0.5. Scans `pages/` and `api/`, builds a route table, lazy-loads modules.
- `scanner.ts` — `scanDirectory()` / `detectProject()` walks the project, identifies pages, layouts, dynamic routes (`[slug].ts`), API handlers.
- `route-table.ts` — `buildRouteTable()` resolves routes from scanned files, including layout chains and dynamic-route matching.
- `page-loader.ts` — `compileFile()` / `loadPageModule()` — esbuild-based on-the-fly compilation with module caching.
- `layout-chain.ts` — Composes nested `layout.ts` files outside-in (root → section → page).
- `api-loader.ts` — Loads `api/*.ts` modules and extracts their `GET`/`POST`/… exports.
- `resolver.ts` — `FileRouter` class wires it all together.
- `validate.ts` — `terminaltui validate` warnings for misconfigured projects.

### `routing/` (legacy parameterized routes — distinct from `router/`)
Used inside a single-file `site.config.ts`. Tiny module:
- `route()` — declare a parameterized route with `:param` placeholders
- `navigate()` — programmatic navigation from anywhere
- `types.ts` — `RouteConfig`, `RouteParams`, `HistoryEntry`, `MiddlewareFn`

### `state/`
Reactive state system:
- `reactive.ts` — `createState()` with auto-tracking and batched updates
- `computed.ts` — Derived values that recompute on dependency change
- `dynamic.ts` — `dynamic()` blocks that re-render when state changes
- `persistent.ts` — State backed by disk with debounced writes

### `data/`
Data fetching:
- `fetcher.ts` — Declarative GET with caching, refresh intervals, retry
- `request.ts` — Imperative HTTP client
- `live-data.ts` — WebSocket/SSE live connections
- `async-content.ts` — `asyncContent()` loader with loading/error states

### `api/`
Built-in HTTP API server for sites that define API routes (either in `site.config.ts` `api: {…}` or as `api/*.ts` files when using file-based routing). Handles GET/POST/PUT/DELETE routing, request parsing, and response formatting.

### `ascii/`
ASCII art system:
- `banner.ts` — Figlet-style text banners
- `fonts/` — 14 font definitions (lazy-loaded)
- `shapes.ts` — Geometric shapes (box, circle, diamond, triangle, …)
- `scenes.ts` — Composite ASCII scenes (city, forest, ocean, …)
- `patterns.ts` — Repeating pattern generators
- `dataviz.ts` — Terminal charts (bar, sparkline, heatmap, pie, graph)
- `image.ts` — Image-to-ASCII conversion

### `art-registry/`
Internal asset registry — the lookup layer that `banner.ts`, `art.ts`, `scenes.ts`, `patterns.ts` go through to resolve a name like `"ANSI Shadow"` or `"forest"` to its data. Built-in assets are registered at module-load time. The `terminaltui art` CLI uses the same registry to load art packs from disk.

### `animation/`
Animation framework:
- `engine.ts` — Frame-based animation scheduler (used by spinners and the boot sequence)
- `spinner.ts` — Loading spinner variants

### `middleware/`
Request-style middleware chain that runs before page navigation. Supports `redirect()`, `requireEnv()`, `rateLimit()`.

### `helpers/`
Terminal-environment utilities used by the runtime and CLI: terminal capability detection, clipboard, `openUrl()` (no-op in serve mode), and other host-process helpers.

### `emulator/`
TUI test emulator. Spawns the TUI in a PTY, captures output, and provides assertion helpers for automated testing.

### `cli/`
CLI commands: `dev`, `serve`, `build`, `init`, `create`, `convert`, `migrate`, `validate`, `demo`, `test`, `art`.

### `lifecycle/`
Types for `onInit`, `onExit`, `onNavigate` lifecycle hooks.

## Dependency Graph

Dependencies flow downward — no circular imports.

```
cli/
 └─► core/ ──► config/
      │
      ├─► navigation/        (page stack, spatial nav)
      ├─► router/            (file-based routing)
      ├─► routing/           (parameterized routes)
      ├─► components/ ──► style/  ──► layout/
      ├─► state/
      ├─► data/
      ├─► animation/
      ├─► ascii/  ──► art-registry/
      ├─► middleware/
      ├─► api/
      ├─► helpers/
      └─► emulator/  (test-only)
```

## Key Abstractions

### Content Block
The fundamental unit. Every piece of UI (card, timeline, text, input, layout) is a content block — a plain object with a `type` field and type-specific properties. Created by helper functions like `card()`, `timeline()`, `columns()`, `panel()`, `row()`/`col()`, `chat()`, `menu()`.

### RenderContext
Passed to every component renderer:

```typescript
interface RenderContext {
  width: number;        // available width in columns
  theme: Theme;         // current theme colors
  focused?: boolean;    // is this block focused?
  editing?: boolean;    // is this block in edit mode?
  borderStyle?: string; // border character set
}
```

### TerminalIO (1.5.0)
Abstracts terminal I/O so the runtime is not coupled to `process.stdin`/`process.stdout`. Two implementations ship:
- `ProcessTerminalIO` — wraps `process.stdin`/`process.stdout` for `dev`
- `SSHTerminalIO` — wraps an SSH channel for `serve`

`InputManager`, `Screen`, and the runtime all `attachIO(io)` and call into the same interface.

### TUIRuntime
The root coordinator. Holds all per-session state. For `serve`, one instance per SSH connection; for `dev`, a single instance bound to the local terminal.

### FocusItem
A focusable element on a content page. Can be a block, an accordion item, or a timeline item. The runtime maintains an array of focus items per page and a focus index. Spatial navigation walks this array using on-screen coordinates from `FocusRect`.

## How To: Add a New Component

1. Create `src/components/MyComponent.ts`
2. Export a `renderMyComponent(block, ctx): string[]` function
3. Add the block type to `config/types.ts`
4. Add a helper function to `config/parser.ts` (e.g., `export function myComponent(config) { … }`)
5. Add the render case to `core/runtime-block-render.ts` in the `renderBlock()` switch
6. If focusable, add the type to `isBlockFocusable()` and `collectFocusItems()`
7. Re-export the helper and any new types from `src/index.ts`
8. Add a renderer test in `test/test-all-components.ts` and a SKILL.md entry

## How To: Add a New Theme

1. Open `src/style/theme.ts`
2. Add a new theme object with all required color slots:

   ```typescript
   const myTheme: Theme = {
     name: "my-theme",
     accent: "#…", text: "#…", muted: "#…",
     border: "#…", subtle: "#…",
     success: "#…", error: "#…", warning: "#…",
   };
   ```
3. Add it to the `themes` record
4. Add the name to the `BuiltinThemeName` union type

## How To: Add a New CLI Command

1. Create `src/cli/mycommand.ts`
2. Export an async handler function
3. Add the command to `src/cli/index.ts` in the `switch (command)` and the `printHelp()` text
4. Add an entry to `docs/cli-reference.md`

## Testing

- **Unit tests** (`test/test-*.ts`): components, state, async, forms, inputs, data, banner, colors
- **Demo tests** (`test/demo-*.test.ts`): emulator-driven smoke tests for every bundled demo
- **Router tests** (`test/router/*.test.ts`): scanner, route-table, page-loader, layout-chain, api-loader, resolver
- **Stress harnesses** (`test/stress-*.ts`): content extremes, sizes, templates, validation, visuals
- **Run all**: `npm test` (~1,500 assertions across the suites above)
- **Typecheck**: `npm run typecheck`
