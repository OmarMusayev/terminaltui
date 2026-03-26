# Architecture

This document explains the internal architecture of **terminaltui** — how the framework turns a `site.config.ts` file into an interactive terminal UI.

## Data Flow

```
site.config.ts → parseConfig → Component Tree → Layout → Render Pass → ANSI Lines → Terminal
```

1. User writes a `site.config.ts` using `defineSite()`, `page()`, `card()`, etc.
2. The config parser creates a `SiteConfig` object with pages and content blocks.
3. The runtime builds a component tree from content blocks.
4. The renderer converts each block to an array of ANSI-styled strings.
5. Lines are truncated to terminal width and written to stdout.

## Module Map

### `config/`
Parses user config into a normalized `SiteConfig`. Houses the DSL helper functions (`card()`, `timeline()`, `section()`, etc.) that create content block objects. Also handles `.env` file loading and `defineConfig()`.

### `core/`
The runtime orchestrator. `TUIRuntime` coordinates all other modules: starts the terminal, listens for input, dispatches to handlers, triggers re-renders. Split across multiple files:
- `runtime.ts` — Class shell: constructor, start/stop, terminal setup
- `runtime-input.ts` — Key dispatch: navigation, command mode, edit mode routing
- `runtime-edit-handlers.ts` — Type-specific input handlers (text, select, number, etc.)
- `runtime-render.ts` — Page rendering: home page, content page, scroll management
- `runtime-block-render.ts` — The `renderBlock()` switch: maps block types to component renderers
- `runtime-terminal.ts` — Terminal output: writes ANSI to stdout
- `runtime-pages.ts` — Page navigation, focus collection, middleware
- `runtime-forms.ts` — Form submission, validation, button/card actions

### `components/`
One file per visual component. Each exports a `render*()` function that takes a content block and `RenderContext`, returning `string[]` (lines of ANSI text). Includes display components (Card, Timeline, Table), interactive components (Link, Accordion, Tabs), input components (TextInput, Select, Button), and layout components (Columns, Rows, Split, Grid, Panel).

`base.ts` provides shared utilities: `stringWidth()` (Unicode-aware), `wrapText()`, `pad()`, `truncate()`, `stripAnsi()`.

`layout/` subdirectory contains the panel layout components: `Columns.ts` (side-by-side panels), `Rows.ts` (stacked panels), `Split.ts` (two-panel split), `Grid.ts` (N×M grid), and `Panel.ts` (bordered content area with title and clipping).

### `layout/` (src/layout/)
Layout engine:
- `panel-layout.ts` — Layout algorithms for columns, rows, split, grid (assigns x, y, width, height)
- `flex-engine.ts` — Computes FocusRect positions for spatial navigation by walking the content tree
- `grid-system.ts` — 12-column grid system (row/col layout math, responsive breakpoints)
- `responsive.ts` — Responsive collapse logic (columns stack when terminal is too narrow)
- `types.ts` — Layout types including FocusRect for spatial navigation

### `style/`
Theme and color system:
- `theme.ts` — 10 built-in themes (hacker, ocean, sunset, etc.) with named color slots
- `colors.ts` — ANSI escape generation with automatic 256-color fallback for Apple Terminal
- `gradient.ts` — Multi-color gradient text rendering
- `borders.ts` — Border character sets (rounded, sharp, double, heavy, etc.)

### `navigation/`
- `router.ts` — Page stack with back/forward, parameterized routes
- `focus.ts` — Home menu focus cursor
- `spatial.ts` — Spatial navigation algorithm (findNextFocus, spatialScore) for 2D arrow key movement
- `keybindings.ts` — Maps keystrokes to semantic actions (up/down/left/right/select/quit)

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
Built-in HTTP API server for sites that define API routes. Handles GET/POST routing, request parsing, and response formatting.

### `ascii/`
ASCII art system:
- `banner.ts` — Figlet-style text banners
- `fonts/` — 14 font definitions (lazy-loaded)
- `shapes.ts` — Geometric shapes (box, circle, diamond, triangle, etc.)
- `scenes.ts` — Composite ASCII scenes (city, forest, ocean, etc.)
- `patterns.ts` — Repeating pattern generators
- `dataviz.ts` — Terminal charts (bar, sparkline, heatmap, pie, graph)
- `compose.ts` — Art manipulation (overlay, stack, mirror, colorize, shadow)
- `image.ts` — Image-to-ASCII conversion
- `braille.ts` — Braille dot patterns

### `art-registry/`
Community art asset system. Registers and loads art packs containing fonts, scenes, icons, and patterns from directories.

### `animation/`
Animation framework:
- `engine.ts` — Frame-based animation scheduler
- `typing.ts`, `stagger.ts`, `fade.ts` — Text animation effects
- `transition.ts` — Page transition effects
- `spinner.ts` — Loading spinner variants

### `middleware/`
Request-style middleware chain that runs before page navigation. Supports `redirect()`, `requireEnv()`, `rateLimit()`.

### `forms/`
Form validation and submission. Form fields are content blocks (textInput, select, etc.) grouped by a `form()` wrapper that handles collection and submission.

### `emulator/`
TUI test emulator. Spawns the TUI in a PTY, captures output, and provides assertion helpers for automated testing.

### `cli/`
CLI commands: `terminaltui dev`, `build`, `init`, `create`, `test`, `art`, `convert`.

### `lifecycle/`
Types for `onInit`, `onExit`, `onNavigate` lifecycle hooks.

## Dependency Graph

Dependencies flow downward — no circular imports.

```
cli/
 └─► core/ ──► config/
      │
      ├─► navigation/
      ├─► components/ ──► style/
      ├─► state/
      ├─► data/
      ├─► animation/
      ├─► ascii/
      ├─► middleware/
      ├─► api/
      └─► helpers/
```

## Key Abstractions

### Content Block
The fundamental unit. Every piece of UI (card, timeline, text, input, layout) is a content block — a plain object with a `type` field and type-specific properties. Created by helper functions like `card()`, `timeline()`, `columns()`, `panel()`.

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

### TUIRuntime
The god object that holds all state and coordinates modules. Split across multiple files but accessed as a single class instance.

### FocusItem
A focusable element on a content page. Can be a block, an accordion item, or a timeline item. The runtime maintains an array of focus items per page and a focus index.

## How To: Add a New Component

1. Create `src/components/MyComponent.ts`
2. Export a `renderMyComponent(block, ctx): string[]` function
3. Add the block type to `config/types.ts`
4. Add a helper function to `config/parser.ts` (e.g., `export function myComponent(config) { ... }`)
5. Add the render case to `core/runtime-block-render.ts` in the `renderBlock()` switch
6. If focusable, add the type to `isBlockFocusable()` and `collectFocusItems()`
7. Re-export from `src/index.ts`

## How To: Add a New Theme

1. Open `src/style/theme.ts`
2. Add a new theme object with all required color slots:
   ```typescript
   const myTheme: Theme = {
     name: "my-theme",
     accent: "#...", text: "#...", muted: "#...",
     border: "#...", subtle: "#...",
     success: "#...", error: "#...", warning: "#...",
   };
   ```
3. Add it to the `themes` record
4. Add the name to the `BuiltinThemeName` union type

## How To: Add a New CLI Command

1. Create `src/cli/mycommand.ts`
2. Export an async handler function
3. Add the command to `src/cli/index.ts` in the command router

## Testing

- **Unit tests** (`test/`): Test individual components, state, routing, forms
- **Emulator tests**: Spawn the TUI in a PTY, send keystrokes, assert screen content
- **Run all**: `npm test` (1572 tests across 10 suites)
- **Typecheck**: `npx tsc --noEmit`
