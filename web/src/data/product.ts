/**
 * Single source of truth for every fact on the site.
 *
 * Every number here was verified against the repo, the GitHub API or the npm
 * registry on 2026-07-26. If a fact is not in this file it does not belong on
 * the page. Do not add a number here without a source.
 */

/**
 * NOTE ON VERSIONS: this describes the repository source. Publishing status is
 * a separate launch check; do not silently substitute the npm registry version
 * here or the site will describe two different codebases on one page.
 */
export const product = {
  name: "terminaltui",
  version: "2.1.0",
  tagline: "A standardized engine for terminal apps.",
  /** The one-sentence pitch. Build ease + distribution, in that order. */
  pitch:
    "Write a pages directory of TypeScript. Get a navigable terminal app you can ship with npx or host over SSH.",
  repo: "https://github.com/OmarMusayev/terminaltui",
  npm: "https://www.npmjs.com/package/terminaltui",
  docs: "https://terminaltui.dev/docs",
  site: "https://terminaltui.dev",
  author: { name: "Omar Musayev", handle: "OmarMusayev", url: "https://github.com/OmarMusayev" },
  license: "MIT",
  node: ">=18",
  firstPublished: "2026-03-23",
} as const;

/** Live-fetched at runtime; this is the honest fallback, not a target. */
export const STAR_FALLBACK = 37;

/**
 * The public authoring API, read straight from the `export {...}` block in
 * src/index.ts. The docs undercount it — several builders (skillBar, ascii,
 * gradient, sparkline, menu, chat) ship but are not in docs/components.md.
 */
export const componentGroups = [
  {
    group: "Content",
    items: ["section", "card", "timeline", "table", "list", "quote", "hero", "gallery",
      "tabs", "accordion", "link", "skillBar", "progressBar", "badge", "image", "text",
      "ascii", "markdown", "gradient", "sparkline", "divider", "spacer"],
  },
  {
    group: "Input",
    items: ["textInput", "textArea", "select", "checkbox", "toggle", "radioGroup",
      "numberInput", "searchInput", "button", "form", "asyncContent"],
  },
  { group: "Layout", items: ["columns", "rows", "grid", "panel", "col", "row", "container"] },
  { group: "Navigation", items: ["menu", "chat"] },
] as const;

/** Derived, so the number on the page can never drift from the list. */
export const COMPONENT_COUNT = componentGroups.reduce((n, g) => n + g.items.length, 0);

export const stats = {
  /** Live GitHub/npm figures checked 2026-08-25 (npm windows end 2026-08-24). */
  stars: 39,
  downloadsMonth: 166,
  downloadsWeek: 20,
  /**
   * Measured on 2026-08-25 by running the full sweep: 4,223 passing across 68
   * suites. Keep this paired with the version above when the suite changes.
   */
  tests: 4223,
  testSuites: 68,
  components: COMPONENT_COUNT,
  themes: 12,
  demos: 12,
  runtimeDeps: 3,
  asciiFonts: 14,
  asciiScenes: 15,
} as const;

/** The three pillars, in priority order. Everything on the home page serves one. */
export const pillars = [
  {
    key: "standard",
    title: "One obvious way to build",
    body: "Routing, layout, navigation, state and theming already have an answer. You write pages; the framework decides the rest. If you have used Next.js, you already know the shape.",
    proof: "pages/projects/[slug].ts",
  },
  {
    key: "ship",
    title: "Two ways to ship, both trivial",
    body: "Publish to npm and anyone runs it with npx — no install, no binary. Or run terminaltui serve and people reach it over SSH, with color depth negotiated per client.",
    proof: "npx your-app",
  },
  {
    key: "batteries",
    title: "Designed before you start",
    body: "42 components, 12 themes, a 12-column grid, ASCII art and real image rendering ship in the box. The first commit already looks considered.",
    proof: "image('./cover.png')",
  },
] as const;

/** Honest comparison. Being fair here is what makes it persuasive. */
export const comparison = {
  columns: ["terminaltui", "Ink", "Pastel", "Bubble Tea"],
  rows: [
    { label: "Language", values: ["TypeScript", "TypeScript (React)", "TypeScript (Ink-based)", "Go"] },
    { label: "Shape", values: ["Framework — pages, routing, layouts", "Component library", "CLI command router", "TUI framework (Elm-style)"], emphasize: 0 },
    { label: "File-based routing for screens", values: [true, false, "Routes CLI subcommands", false] },
    { label: "SSH hosting", values: ["terminaltui serve", false, false, "Via charmbracelet/wish"] },
    { label: "npx distribution", values: ["First-class", "First-class", "First-class", "No — Go binary"] },
    { label: "Components included", values: [String(COMPONENT_COUNT), "Bring your own", "Inherits from Ink", "Via bubbles"] },
    { label: "Images in-terminal", values: [true, false, false, false] },
    { label: "AI codegen-native", values: ["Ships claude/SKILL.md", false, false, false] },
  ],
  /** Said plainly on the page. A visibly fair table is more convincing than a rigged one. */
  caveat:
    "Ink and Bubble Tea are excellent and far more mature. The difference is shape: they give you pieces, terminaltui gives you a structure.",
} as const;

export const cli = [
  { cmd: "npx terminaltui try", desc: "A five-page guided tour. Zero install, zero config.", hero: true },
  { cmd: "terminaltui init [template]", desc: "Scaffold a project — minimal, portfolio, landing, restaurant, blog, creative." },
  { cmd: "terminaltui dev", desc: "Run locally with on-the-fly compilation." },
  { cmd: "terminaltui serve", desc: "Host over SSH so anyone can connect." },
  { cmd: "terminaltui demo [name]", desc: "Run one of the 12 built-in demos." },
  { cmd: "terminaltui build", desc: "Bundle for npm publish." },
  { cmd: "terminaltui create", desc: "Interactive prompt builder for AI scaffolding." },
  { cmd: "terminaltui validate", desc: "Lint a routing project for common mistakes." },
] as const;

/**
 * Real swatches, read from the theme source.
 *
 * The flint pair leads because it is what every capture on this site is taken
 * in and, as of this release, the theme a new project starts on. The other ten
 * are the loud ones, and they are a genuine feature — just not the first thing
 * a stranger should be shown.
 */
export const themes = [
  { name: "flintNight", swatch: ["#aec9e7", "#b9e1c3", "#d7b68d", "#ca8f88", "#61666a"] },
  { name: "flintDay", swatch: ["#265173", "#3d694c", "#614112", "#702221", "#8c9195"] },
  { name: "cyberpunk", swatch: ["#ff2cde", "#0fffd4", "#ffe600", "#00b3ff", "#ff7a18"] },
  { name: "dracula", swatch: ["#ff79c6", "#bd93f9", "#50fa7b", "#f1fa8c", "#8be9fd"] },
  { name: "nord", swatch: ["#88c0d0", "#81a1c1", "#a3be8c", "#ebcb8b", "#bf616a"] },
  { name: "monokai", swatch: ["#f92672", "#a6e22e", "#fd971f", "#66d9ef", "#ae81ff"] },
  { name: "solarized", swatch: ["#268bd2", "#859900", "#b58900", "#cb4b16", "#dc322f"] },
  { name: "gruvbox", swatch: ["#fb4934", "#fabd2f", "#b8bb26", "#83a598", "#d3869b"] },
  { name: "catppuccin", swatch: ["#f5c2e7", "#f9e2af", "#a6e3a1", "#94e2d5", "#cba6f7"] },
  { name: "tokyoNight", swatch: ["#7aa2f7", "#bb9af7", "#7dcfff", "#9ece6a", "#f7768e"] },
  { name: "rosePine", swatch: ["#eb6f92", "#f6c177", "#ebbcba", "#9ccfd8", "#c4a7e7"] },
  { name: "hacker", swatch: ["#39ff14", "#9eff8a", "#0aff60", "#1f3d1f", "#0a3a0a"] },
] as const;

/** demo key -> label + theme + command. Captured demos also match frames.json. */
export const demos = [
  { key: "welcome", label: "Welcome Tour", theme: "flintNight", cmd: "npx terminaltui try" },
  { key: "developer-portfolio", label: "Developer Portfolio", theme: "flintNight", cmd: "npx terminaltui demo developer-portfolio" },
  { key: "restaurant", label: "Restaurant", theme: "flintNight", cmd: "npx terminaltui demo restaurant" },
  { key: "dashboard", label: "Dashboard", theme: "flintNight", cmd: "npx terminaltui demo dashboard" },
  { key: "cinema", label: "Cinema", theme: "dracula", cmd: "npx terminaltui demo cinema" },
  { key: "server-dashboard", label: "Server Dashboard", theme: "flintNight", cmd: "npx terminaltui demo server-dashboard" },
  { key: "mac-monitor", label: "Mac Monitor", theme: "flintNight", cmd: "npx terminaltui demo mac-monitor" },
  { key: "startup", label: "Startup", theme: "tokyoNight", cmd: "npx terminaltui demo startup" },
  { key: "conference", label: "Conference", theme: "flintNight", cmd: "npx terminaltui demo conference" },
  { key: "band", label: "Band", theme: "rosePine", cmd: "npx terminaltui demo band" },
  { key: "coffee-shop", label: "Coffee Shop", theme: "flintNight", cmd: "npx terminaltui demo coffee-shop" },
  { key: "freelancer", label: "Freelancer", theme: "custom", cmd: "npx terminaltui demo freelancer" },
] as const;

/**
 * Roadmap. Status is honest and load-bearing — never render a "planned" item
 * as though it exists.
 */
export const roadmap = [
  { status: "shipped", title: "Images in the terminal", body: "Real PNG and JPEG, drawn as colored cells everywhere and as true pixels on kitty and Ghostty." },
  { status: "shipped", title: "Headless terminal emulator", body: "Drive a real PTY from tests, assert on screen contents. Every screenshot on this site was produced with it." },
  { status: "shipped", title: "Video rendering", body: "Prepacked video with transport controls, Kitty/Ghostty pixels, and a portable coloured-cell fallback." },
  { status: "planned", title: "A library you can ssh into", body: "Read books in your terminal without memorizing a single flag." },
  { status: "planned", title: "Comic reader", body: "The hardest test the image renderer has: dense panels, text that has to stay legible." },
  { status: "planned", title: "Agent manager", body: "Run and switch between multiple coding-agent sessions from one TUI." },
  { status: "planned", title: "Latency and throughput work", body: "Making the engine genuinely fast, measured properly and published." },
] as const;

export const faq = [
  { q: "What is terminaltui?", a: "A TypeScript framework for building interactive terminal applications. You write a pages directory and it handles routing, navigation, layout, state and rendering. No browser, no Electron, no React." },
  { q: "How is it different from Ink?", a: "Ink is a component library — you bring your own architecture. terminaltui is a framework: file-based routing for screens, layouts, themes and 42 components are already decided for you." },
  { q: "How do people run what I build?", a: "Publish to npm and they run npx your-app. Or run terminaltui serve and they connect over SSH. Both work without your users installing anything." },
  { q: "Can it really show images in a terminal?", a: "Yes. On kitty and Ghostty it draws real pixels via the kitty graphics protocol. Everywhere else it paints colored character cells using block glyphs, so images still work over SSH, in tmux and in Apple Terminal." },
  { q: "Does it need native dependencies?", a: "No. Three runtime dependencies — esbuild, jpeg-js and pngjs. No sharp, no node-gyp. SSH hosting and PTY-based testing pull optional peers only if you use them." },
  { q: "How do I test a terminal app?", a: "Import the headless emulator from terminaltui/emulator. Launch your app in a real PTY, send keypresses, and assert on what is on screen." },
  { q: "Is it production ready?", a: "Version 2.1.0 passes 4,223 tests across 68 suites, and the project is young — first published in March 2026. Read the changelog and decide for yourself." },
  { q: "What does it cost?", a: "Nothing. MIT licensed, Node 18 or newer." },
] as const;
