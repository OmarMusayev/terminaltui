# Changelog

## [1.7.0] - 2026-05-01

Project-wide review pass. Two production-impacting bugs, multi-session SSH correctness, and a sweep of dead code from the 1.6.0 cleanup that didn't get fully removed.

### Fixed (production bugs)

- **`:theme` command crashed on use** — `runtime-pages.ts` used `require()` inside an ESM-only package; the first `:theme dracula` raised `ReferenceError: require is not defined`. Switched to a static import.
- **`requireEnv` and `rateLimit` middleware were silently bypassed** — `runMiddleware().catch()` fell through to `doNavigate`, so a thrown middleware (which is how both built-ins signal failure) rendered the page anyway. Throws now surface a `Blocked: <message>` feedback line and the navigation aborts.
- **Concurrent SSH sessions clobbered each other** — `_renderCallback`, `_navigateFn`, and `apiBaseUrl` were module-level globals; the most recent `runtime.start()` won, so older sessions' `state.set()` and `navigate()` calls hit the wrong runtime. Added `core/runtime-context.ts` with `AsyncLocalStorage`; helpers consult the active context first and fall back to the legacy global for tests / cross-package fetcher imports.
- **`createPersistentState()` leaked process listeners** — each call added three (`exit`/`SIGINT`/`SIGTERM`) handlers; SSH sessions or hot-reloads triggered `MaxListenersExceededWarning`. Now a single shared exit-flush handler is registered once.
- **`asyncContent` render storm** — the loading branch scheduled `setTimeout(rt.render, 100)` on every render, compounding to N²-style render bursts. One guarded spinner timer per runtime now.
- **`stringWidth` adopted unevenly** — `Timeline.ts`, `Divider.ts`, the inline accordion in `runtime-render.ts`, and `TextInput.ts` masking used `.length` (UTF-16 code units) where they needed display width or codepoint count. CJK and emoji rendered miscounted.
- **`ascii/image.ts` emitted raw 24-bit ANSI** — bypassed the 256-color fallback path, so colored ASCII images rendered as garbage in Apple Terminal. Added `fgColorRgb()` to `style/colors.ts`; image renderers route through it.

### Removed (breaking)

These were either internal-only by design or removed in 1.6.0 but the export survived:

- `componentRegistry`, `Component` (interface), `ComponentRegistry` class — the registry was decorative; `runtime-block-render.ts`'s switch was authoritative. Replaced internally with a `FOCUSABLE_TYPES` set.
- `ApiServer`, `setApiBaseUrl`, `FileRouter` — internal classes that should never have been part of the public surface.
- `dynamic(deps, render)` overload — `deps` was stored but never read. Single-arg API only.

### Changed

- **Test runner**: `test/run-all.ts` now globs `test-*.ts` and `**/*.test.ts` instead of an allowlist of 10 files. Default suite went from 1,469 to 2,127 passing assertions across 25 suites. `--stress`, `--demos`, and `--all` flags opt into the slower suites.
- **`terminaltui serve` single-file path removed** — `startSingleFileSession` deleted; running `serve` on a non-file-based project prints a clear error pointing at `terminaltui init`.
- **`compileFile` skips esbuild bundling under tsx/ts-node** — projects whose pages import the framework via relative paths no longer trip on native binaries (`ssh2`'s `.node` files). Bundle path also externalizes relative `src/index.js` imports for the rare projects that compile production builds.
- **`compileFile` cache key is sha1 of absolute path** instead of last-80-char tail. Eliminates the (theoretical) collision when two deeply nested projects share a path tail.
- **`box-model` is closer to the single source of truth it claimed to be** — `flex-engine.estimateBlockHeight` (card branch) now derives chrome from `COMPONENT_DEFAULTS`; `components/layout/Panel.ts` uses `computeBoxDimensions` instead of inline arithmetic with mislabeled variable names.

### Security hardening

- `exec` / `execSync` → `spawn` / `spawnSync` with array args in `helpers/open-url.ts`, `helpers/clipboard.ts`, and `core/ssh-server.ts` (host-key generation). No shell interpolation.
- `terminaltui art create <type> <name>` validates `name` against `/^[a-z0-9][a-z0-9_-]*$/i` (path-traversal guard).
- `api/server.ts` caps request bodies at 1 MB.

### Notes

- SSH `serve` keeps its allow-all default; password auth remains opt-in via `auth.passwords`.
- `ARCHITECTURE.md` rewritten to match the post-1.6.0 reality (removed `routing/` section, dropped `runSite` references, fixed the dependency graph, documented `runtime-context`).

### Removed dead files (no behavior change)

`src/core/renderer.ts` (Cell-diff renderer, 0 importers), `src/layout/engine.ts`, `src/layout/constraints.ts`, `src/ascii/fonts-extra.ts`, `src/cli/init-templates.ts`, `src/components/registry.ts`. Plus the matching test cleanup (5 stress harnesses + 9 directory-based tests + 3 manual harnesses, all of which targeted the single-file API removed in 1.6.0).

---

## [1.6.1] - 2026-04-28

### Fixed

- **`terminaltui init` now scaffolds the file-based shape** — every template was still emitting the pre-1.6.0 layout (`site.config.ts` with a `pages: [...]` array) using removed exports `defineSite`/`page`, plus `banner: ascii(...)` (a content block, not a banner spec). Running `npm run dev` on a fresh project failed immediately with `No config.ts found alongside a pages/ directory`. All six templates (minimal, portfolio, landing, restaurant, blog, creative) now emit `config.ts` with `defineConfig({...})` + `pages/<name>.ts` files exporting `metadata` and a default render function, matching the demo layout.
- **Typo'd template/theme names no longer fall back silently** — `init` now prints `'X' is not a known template — using 'minimal'` instead of accepting any string and quietly defaulting.

---

## [1.6.0] - 2026-04-28

### Removed (breaking)

- **Single-file `site.config.ts` mode** — `defineSite()`, `page()`, `route()`, `runSite()`, and the `terminaltui migrate` command are gone. The framework is now file-based only (`config.ts` + `pages/` + optional `api/`).
- **Layout `split()` and `box()`** — `split()` was redundant with `columns([panel, panel])`; `box()` was redundant with `panel({border, padding, content})`. Use the explicit forms.
- **Animation transitions** — `transition.ts`, `typing.ts`, `stagger.ts`, `fade.ts`, `effects.ts` (matrix rain / glitch / sparkle) deleted. The `transitions` field on `AnimationConfig` is gone. `boot` and `exitMessage` survive; spinner/engine survive.
- **ASCII community-pack public API** — `registerArtPack`, `useArtPack`, `listArt`, `getArtInfo`, `createArtPack`, `registerFont/Scene/Icon/Pattern` no longer exported. The internal art registry stays as plumbing for built-in assets.
- **`artCompose`** (overlay/mirror/rotate/colorize/shadow on string[] art) — niche, not used by demos. Gone.
- **`brailleSparkline`, `dotMatrix`, `braillePattern`** — exotic, deleted. Use `asciiArt.sparkline()` for sparklines.
- **Tetris demo** — broken since 1.0.5; removed (folder + gif + README reference).
- **`PanelFocusManager`** dead code (deprecated since 1.0.5).
- **`runPreview` CLI stub** — never implemented; deleted.
- **`src/routing/`** folder — `navigate()` moved into `src/router/`; route/middleware types moved to `router/types.ts` and `middleware/types.ts`.

### Changed

- Demo bundling dropped — demo sources ship in the npm package under `demos/<name>/` (config.ts + pages/) and are compiled on the fly by `npx terminaltui demo <name>`. No more `dist/demos/*.js` artifacts.
- Renamed `src/components/Box.ts` is unchanged (it's the rendering utility used by Card/Form/etc., not the deleted layout `box()`).
- `terminaltui dev` now requires `config.ts + pages/`; running it on a `site.config.ts` errors clearly instead of going through the deprecated path.

### Migration from 1.5.x

If you were using `defineSite`/`page`/`route`/`split`/`box`:
- Convert your project layout to `config.ts` + `pages/` (one file per page).
- Replace `split({direction: "horizontal", ratio: 30, first, second})` with `columns([panel({width: "30%", content: first}), panel({width: "70%", content: second})])`. Vertical splits become `rows(...)` with `height` instead of `width`.
- Replace `box({content, border, padding})` with `panel({content, border, padding})` (no title/scroll) or `container({content, padding})` (centered).

---

## [1.5.1] - 2026-04-10

### Fixed

- **SSH color mode detects client TERM** — reads `term` from the SSH pty request (e.g. `xterm-kitty` → truecolor, `xterm-256color` → 256, `vt100` → 16) instead of hardcoding 256 for all SSH sessions
- **openUrl() is a no-op in serve mode** — displays the URL as a notification instead of executing shell commands (`open`/`xdg-open`) on the server. Configurable via `serve.openUrls: true` in site config
- **Color mode is per-runtime** — each SSH session maintains its own color mode. Multi-user sessions no longer clobber each other's colors via the global singleton
- **Reset before erase-line prevents color bleed** — prepends `\x1b[0m` before each `\x1b[2K` so a missed reset on one line can't flood subsequent lines with background color
- **Easter egg functions disabled in serve mode** — function-valued easter egg commands are skipped over SSH to prevent unintended server-side execution
- **Primary button focus style is subtler** — focused primary buttons use bold border + bold accent text instead of a solid background fill that dominated the page

### Added

- **`serve` config in SiteConfig** — configure SSH hosting from `defineSite()` or `defineConfig()`: `port`, `hostKeyPath`, `maxConnections`, `colorMode`, `openUrls`, `auth`
- **`termType` on TerminalIO interface** — exposes the client's TERM string for color capability detection
- **`isServeMode` getter on TUIRuntime** — indicates whether the runtime is serving over SSH

---

## [1.5.0] - 2026-04-10

### Added

- **SSH Hosting (`terminaltui serve`)** — host any TUI app over SSH so users connect with `ssh host -p PORT`, zero install required. Each connection gets an independent session with full interactivity (navigation, forms, resize).
  - `--port <N>` flag (default: 2222)
  - `--host-key <path>` flag (auto-generates Ed25519 key on first run)
  - `--max-connections <N>` flag (default: 100)
  - Per-session `TerminalIO` abstraction — SSH channel used as I/O target
  - Session logging (connect/disconnect with client IP and active count)
- **`TerminalIO` interface** — abstracts terminal I/O away from `process.stdin`/`process.stdout`, enabling pluggable I/O targets (SSH channels, PTYs, custom streams)
- **`ProcessTerminalIO`** — default implementation wrapping `process.stdin`/`process.stdout` for local `dev` usage
- **`SSHServer` and `ServeOptions` exports** — programmatic API for embedding SSH hosting in custom setups

### Changed

- **`TUIRuntime` accepts optional `TerminalIO`** — constructor now takes an optional second argument for custom I/O. Defaults to `ProcessTerminalIO` for full backward compatibility.
- **`InputManager` and `Screen` use `TerminalIO`** — no longer hardcoded to `process.stdin`/`process.stdout`. Both accept a `TerminalIO` via `attachIO()`.
- **`writeToTerminal` uses `\r\n`** — fixes rendering over SSH where raw `\n` doesn't return cursor to column 1
- **SSH sessions use 256-color mode** — since the server can't detect the remote client's terminal capabilities, SSH sessions default to 256-color (safe for all terminals)
- **Process signals scoped to local sessions** — `SIGINT`/`SIGTERM` handlers and `process.exit()` only attach for `ProcessTerminalIO`, preventing a single SSH disconnect from killing the server
- **`ssh2` added as optional dependency** — only required for `terminaltui serve`. The `dev` command works without it.

---

## [1.4.0] - 2026-04-09

### Fixed

- **Single-file build produces functional bundles** — `terminaltui build` on `site.config.ts` now wraps the entry with `runSite()` so the published npm package actually starts the TUI (#1)
- **File-based routing build uses relative paths** — `_entry.ts` no longer hardcodes absolute filesystem paths; all imports are relative and resolved at bundle time (#2)
- **`compileFile()` throws clear errors** — when esbuild is unavailable outside dev mode, a descriptive error is thrown instead of silently returning a raw `.ts` path that Node.js can't import (#3)
- **`_entry.ts` cleaned up after build** — intermediate build artifacts are deleted from `dist/` after successful bundling, preventing them from being published to npm (#5)

### Added

- **`text()` content helper** — `import { text } from "terminaltui"` creates a plain text content block. Previously referenced in docs but not exported (#4)
- **Build validation** — after bundling, the build checks that the output contains a `runSite()` call and warns about any hardcoded absolute paths (#7)
- **Page Visibility documentation** — clear docs on how to hide pages from menus in both single-file and file-based routing modes (#8)
- **Banner config clarification** — docs now show both `ascii()` helper and plain object forms for the `banner` field (#9)

### Changed

- **Version jump from 1.0.9 to 1.4.0** — versions 1.1.0 through 1.3.0 were experimental publishes from a separate codebase and have been deprecated on npm. This release continues from the stable 1.0.x line (#6)

### Deprecated

- **npm versions 1.1.0–1.3.0** — these were experimental/incompatible releases. Use 1.4.0+ instead.

---

## [1.0.5] - 2026-03-26

### Added

- **Spatial Navigation Engine** — arrow keys now move to the nearest focusable item by screen position (like a TV remote / Android TV D-pad), replacing the old panel-based Tab cycling
  - `findNextFocus()` algorithm scores candidates by distance + alignment (2x weight on axis alignment)
  - Direction-filtered: only items in the arrow direction are candidates
  - ← from leftmost position goes back; automatic for all layout functions
  - New `computeFocusPositions()` in flex-engine walks the entire content tree and assigns FocusRect screen coordinates to every focusable item

- **12-Column Responsive Grid System** — Bootstrap-style layout primitives
  - `container(content, { maxWidth, padding, center })` — centered content wrapper
  - `row(cols, { gap })` — 12-column grid row with responsive column wrapping
  - `col(content, { span, offset, xs, sm, md, lg })` — grid column with breakpoint-aware spans
  - Responsive breakpoints: xs (<60 cols), sm (60-89), md (90-119), lg (≥120)
  - Rows auto-wrap when effective spans exceed 12 at the current breakpoint
  - Nesting support — rows inside cols inside rows

- **Unified Box Model** — single source of truth for component width calculation
  - `computeBoxDimensions(allocatedWidth, { border, padding, margin })` — every component calls this
  - `COMPONENT_DEFAULTS` — centralized padding/border/margin defaults for all 28+ components
  - Zero manual `width - N` math remaining in any component file

- **File-Based Routing** — Next.js App Router-style directory-based page routing
  - `config.ts` + `pages/` directory structure replaces single `site.config.ts` for larger projects
  - Page files: `export default function About() { return [...] }` with optional `export const metadata`
  - Layout files: `pages/layout.ts` wraps siblings/descendants, receives `{ children }`
  - Nested layouts compose from outside in (root → section → page)
  - Dynamic routes: `pages/projects/[slug].ts` receives `{ params: { slug } }`
  - Async pages: `export default async function Dashboard() { ... }`
  - File-based API routes: `api/stats.ts` exports `GET()`, `POST()`, etc.
  - Auto-generated menu from filesystem (ordering via `metadata.order`, labels via `metadata.label`)
  - Manual menu override in `defineConfig({ menu: { items: [...] } })`
  - New `menu({ source: "auto" })` component for inline auto-menu rendering
  - `MenuBlock` content type added to the block union
  - `FileRouter` class: scanner → route table → menu builder → page loader → layout chain
  - 9 router module files: types, scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, index

- **`terminaltui migrate`** CLI command — converts existing `site.config.ts` to file-based routing structure (config.ts + pages/ + api/)

- **`defineConfig()` overload** — now accepts file-based routing config (`{ name, theme, menu, ... }`) in addition to the existing env-var schema

- **9 demos migrated to file-based routing** — each demo now has both `site.config.ts` (backward compat) and `config.ts` + `pages/` (new structure)

- **169 new router unit tests** across 8 test files (scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, migrate) plus 1 integration test

- **204 demo navigation tests** — emulator-based tests for all 9 demos

- **103 box model tests** and **41 grid system tests**

### Changed

- **All 9 demos rebuilt with spatial layouts** — split, grid, row/col, container patterns throughout
  - developer-portfolio: row/col grid for skills, container for centered content
  - restaurant: tabs for menu, split for contact form, row/col for menu items
  - startup: row/col for features and pricing, accordion for quickstart
  - band: row/col for discography and press quotes, container for about
  - coffee-shop: tabs for menu, row/col for beans and hours
  - conference: tabs for schedule, row/col for speakers and sponsors
  - freelancer: row/col for services, work portfolio, and testimonials
  - dashboard: row/col for stat cards, split for posts
  - server-dashboard: row/col for resource cards, split for system info

- **Navigation model** — spatial navigation replaces Tab-based panel cycling on all layout pages; Tab still works as sequential fallback
  - ↑↓/jk move to nearest item above/below by screen position
  - ←→/hl move to nearest item left/right; ← from leftmost goes back

- **CLI `dev` command** auto-detects project type: file-based (`config.ts` + `pages/`) vs single-file (`site.config.ts`)

- **CLI `findConfig()`** now checks for `config.ts` + `pages/` before falling back to `site.config.ts`

### Fixed

- Card height equalization causing excessive whitespace in side-by-side layouts
- Border clipping at very narrow terminal widths (<10 cols)
- Search input dropdown filling entire viewport
- Focus prefix overflow causing content to exceed terminal width
- Percentage column overflow in layoutColumns
- Button ignoring ctx.width (labels now truncate to fit)
- Section/accordion/timeline content overflow beyond allocated width
- Responsive row wrapping not honoring breakpoints
- Emulator resize not triggering app re-render (SIGWINCH forwarding)
- Table cells missing right-padding in truncation

### Removed

- `PanelFocusManager` — no longer imported or used (file still exists as dead code); superseded by spatial navigation

### Breaking Changes

- **Navigation behavior change**: Arrow keys on layout pages now use spatial navigation instead of panel-based Tab cycling. The `panelArrows` config option still exists but has no effect. Users who relied on Tab to switch panels can still use Tab (sequential fallback), but arrow keys now move spatially.

## [1.0.4] - 2026-03-24

### Changed
- Modularized codebase: split runtime into runtime-input, runtime-pages, runtime-render, runtime-block-render, runtime-forms
- Lazy-load fonts (reduced startup time)
- Updated docs: component registry, fixed npm import paths, added ARCHITECTURE.md references

## [1.0.3] - 2026-03-24

### Added
- `terminaltui demo` command — run 8 built-in demos from npm
- Server dashboard demo with nested layouts

### Changed
- Rebuilt all 8 demos with split-pane layouts (columns, rows, split, grid)

## [1.0.2] - 2026-03-24

### Added
- Split-pane layouts: `columns()`, `rows()`, `split()`, `grid()`, `panel()`
- Panel focus management (Tab/Shift+Tab between panels)
- Active panel border indicator
- Responsive collapse for narrow terminals

## [1.0.1] - 2026-03-23

### Fixed
- 8 bugs found during full framework verification (P0-P3)
- Menu navigation now enforces middleware
- Lifecycle hooks fire on menu navigation
- Route function titles resolve correctly
- `computed()` auto-invalidates
- `section()` gives clear error on wrong args
- Viewport scrolls past last focusable item
- Emulator `goHome()` and `navigateTo()` fixes

## [1.0.0] - 2026-03-22

### Added
- Initial release: 21+ content blocks, 10 themes, ASCII art system, state management, data fetching, routing, middleware, API routes, forms, CLI, emulator, Claude integration
