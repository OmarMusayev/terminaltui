# Changelog

## 1.1.0

### Added
- **API Routes**: define backend endpoints directly in site.config.ts
  - Local HTTP server starts automatically when routes are defined
  - Relative URLs in fetcher/request auto-resolve to local API
  - Support for GET, POST, PUT, DELETE, PATCH methods
  - URL params (`:id`), query strings, JSON body parsing
  - Localhost only (127.0.0.1), random port, clean shutdown
  - Zero dependencies — uses Node's built-in `http` module
  - Fetcher instance registry prevents duplicate timers across re-renders
- **`terminaltui create`**: interactive prompt builder for new projects
  - 10-question questionnaire (name, description, pages, content, theme, style, art, features, animations, extras)
  - Assembles a tailored AI prompt from answers (no LLM in the loop)
  - Outputs TERMINALTUI_SKILL.md + TERMINALTUI_CREATE_PROMPT.md
  - Paste into Claude Code to build the site

## 1.0.0 — Initial Release

### Core Framework
- Declarative site definition via `defineSite()` and `page()`
- 21+ content block components (Card, Timeline, Table, Hero, Gallery, Tabs, Accordion, Quote, Badge, ProgressBar, Link, List, Section, Divider, Spacer, Image, Custom)
- Focus-based keyboard navigation with viewport following
- Content width capped at 100 chars for readability, centered in terminal

### Input Components
- TextInput, TextArea, Select, Checkbox, Toggle, RadioGroup, NumberInput, SearchInput, Button
- Form system with validation, submission, notifications, and `resetOnSubmit`
- Auto-enter edit mode when typing on a focused text input
- `onChange` callbacks on all input types

### Themes
- 10 built-in themes: cyberpunk, dracula, nord, monokai, solarized, gruvbox, catppuccin, tokyoNight, rosePine, hacker
- Custom theme support via Theme interface
- 7 border styles: single, double, rounded, heavy, dashed, ascii, none

### ASCII Art System
- 14 banner fonts with gradient and shadow support
- 15 pre-built scenes (mountains, cityscape, coffee-cup, rocket, etc.)
- 32 icons, 12 patterns, 9 shapes
- 5 data visualizations (barChart, sparkline, heatmap, pieChart, graph)
- 13 art composition utilities
- Image-to-ASCII conversion (ascii, braille, blocks, shading modes)
- Community art pack system (registerScene, registerFont, etc.)

### State Management
- `createState()` — reactive state with get/set/update/batch/on
- `computed()` — cached derived values
- `dynamic()` — reactive content blocks that re-render on state change
- `createPersistentState()` — JSON file persistence with debounced writes

### Data Fetching
- `fetcher()` — declarative data loading with cache, retry, refresh intervals
- `request()` — imperative HTTP client with shorthand methods
- `liveData()` — WebSocket and Server-Sent Events with auto-reconnect
- `asyncContent()` — async content blocks with loading/error states

### Routing & Middleware
- `route()` — parameterized detail pages with async content
- `navigate()` — programmatic navigation
- Card `action: { navigate, params }` for declarative navigation
- Middleware system (global and per-page)
- Built-in middleware: requireEnv, rateLimit, cache

### Environment & Config
- Auto `.env` file loading (.env, .env.local, .env.production)
- `defineConfig()` — typed config from env vars with validation

### Lifecycle Hooks
- onInit, onExit, onNavigate, onError

### Animation System
- Boot sequence (progressive banner reveal + menu stagger)
- Page transitions (instant, fade, slide, wipe)
- Exit messages
- Spinner animations (6 styles)

### CLI
- `terminaltui init [template]` — scaffold new projects
- `terminaltui dev [path]` — compile and run in dev mode
- `terminaltui build` — bundle for npm publish
- `terminaltui test` — automated testing with emulator
- `terminaltui art` — manage art assets
- `terminaltui convert` — AI-assisted website conversion

### TUI Emulator
- Headless terminal testing (like Puppeteer for TUIs)
- Virtual terminal with full ANSI parser
- Screen reader, assertions, snapshots
- Input simulation (keypress, type, navigation)

### Claude Integration
- SKILL.md — comprehensive framework reference (1,700+ lines)
- prompt.md — step-by-step website conversion guide
- 9 example configs covering different site types
- `terminaltui convert` CLI command

### Apple Terminal
- Auto-detection of Apple Terminal
- 256-color fallback (no truecolor)
- Unicode-aware string width measurement
