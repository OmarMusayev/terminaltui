# Changelog

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

## [1.0.4] - 2025-05-24

### Changed
- Modularized codebase: split runtime into runtime-input, runtime-pages, runtime-render, runtime-block-render, runtime-forms
- Lazy-load fonts (reduced startup time)
- Updated docs: component registry, fixed npm import paths, added ARCHITECTURE.md references

## [1.0.3] - 2025-05-23

### Added
- `terminaltui demo` command — run 8 built-in demos from npm
- Server dashboard demo with nested layouts

### Changed
- Rebuilt all 8 demos with split-pane layouts (columns, rows, split, grid)

## [1.0.2] - 2025-05-22

### Added
- Split-pane layouts: `columns()`, `rows()`, `split()`, `grid()`, `panel()`
- Panel focus management (Tab/Shift+Tab between panels)
- Active panel border indicator
- Responsive collapse for narrow terminals

## [1.0.1] - 2025-05-21

### Fixed
- 8 bugs found during full framework verification (P0-P3)
- Menu navigation now enforces middleware
- Lifecycle hooks fire on menu navigation
- Route function titles resolve correctly
- `computed()` auto-invalidates
- `section()` gives clear error on wrong args
- Viewport scrolls past last focusable item
- Emulator `goHome()` and `navigateTo()` fixes

## [1.0.0] - 2025-05-20

### Added
- Initial release: 21+ content blocks, 10 themes, ASCII art system, state management, data fetching, routing, middleware, API routes, forms, CLI, emulator, Claude integration
