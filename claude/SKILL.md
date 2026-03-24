---
name: terminaltui
description: Framework for building TUI websites and applications. Use when a user wants to create a terminal-based website, build a TUI application, or convert an existing website to TUI. Trigger on: "TUI", "terminal website", "terminal UI", "terminal app", "npx site", "terminaltui", converting websites to terminal, building CLI/terminal interfaces.
---

# terminaltui — TUI Website & Application Framework

## What It Is

terminaltui is a TypeScript framework that turns any website into a fully interactive terminal (TUI) experience. Users define their site in a single `site.config.ts` file using a declarative API of builder functions — pages, content blocks, input components, themes, ASCII art, animations, state management, and data fetching. The result is an interactive terminal app navigable by keyboard that can be published to npm so anyone can run it with `npx my-site`.

## Quick Start

```bash
# Scaffold a new project
npx terminaltui init [template]

# Start dev preview
npx terminaltui dev

# Bundle for npm publish
npx terminaltui build
```

Minimal config (`site.config.ts`):

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

Project structure:

```
my-site/
  site.config.ts    # the only file you edit
  package.json      # must have "type": "module"
  tsconfig.json
```

---

## Focus & Scroll Model — CRITICAL FOR GOOD UX

TUI navigation is fundamentally **up/down arrow keys** moving a focus cursor between items. The viewport scrolls to follow the focused item. Understanding which components are focusable is essential for building good TUI experiences.

**Default layout philosophy:** Use vertical scrolling with flat card layouts. Use `divider("Label")` to visually separate sections rather than nesting them inside containers like `tabs()`.

### Focusability per Component

| Component | Focusable? | Behavior |
|-----------|-----------|----------|
| `card()` | **Yes** — individually | Each card is a separate focus target. Best for browsable lists. |
| `link()` | **Yes** — individually | Opens URL on Enter. |
| `hero()` | **Yes** — individually | Opens CTA URL on Enter (if `cta` set). |
| `accordion()` | **Yes** — per item | Each accordion item is separately focusable. Enter toggles open/close. |
| `tabs()` | **Yes** — as one block | Enter cycles through tabs. Not ideal for many sections. |
| `textInput()` | **Yes** — individually | Enter starts editing, Escape exits. |
| `textArea()` | **Yes** — individually | Same as textInput but multi-line. |
| `select()` | **Yes** — individually | Enter opens dropdown, arrow keys pick option. |
| `checkbox()` | **Yes** — individually | Enter/Space toggles. |
| `toggle()` | **Yes** — individually | Enter/Space toggles. |
| `radioGroup()` | **Yes** — individually | Enter starts selection, arrows move between options. |
| `numberInput()` | **Yes** — individually | Left/Right changes value. |
| `searchInput()` | **Yes** — individually | Type to filter, arrows to pick result, Enter to select. |
| `button()` | **Yes** — individually | Enter triggers action. |
| `timeline()` | **Yes** — per item | Each timeline item is focusable but display-only (no action on Enter). |
| `markdown()` | No | Passive text. Not focusable. |
| `table()` | No | Passive data display. Not focusable. |
| `list()` | No | Passive list. Items not individually focusable. |
| `quote()` | No | Passive text. Not focusable. |
| `progressBar()` / `skillBar()` | No | Passive display. |
| `badge()` | No | Inline label. Not focusable. |
| `divider()` | No | Visual separator. Not focusable. |
| `spacer()` | No | Vertical spacing. Not focusable. |
| `image()` | No | Passive display. |
| `section()` | No — wrapper | Children inherit their own focusability. |
| `form()` | No — wrapper | Children (inputs, buttons) are individually focusable. |
| `dynamic()` | No — wrapper | Children inherit their own focusability. |

### TUI UX Patterns — What to Use When

| UX Need | Use | Avoid |
|---------|-----|-------|
| Scrollable list of items | Flat `card()` blocks | `timeline()`, `list()` |
| Sectioned long page | `divider("Label")` + cards below | `tabs()` (forces horizontal switching) |
| Toggle between views of same data | `tabs()` | n/a |
| Dense reference data | `table()` | Many cards for tabular data |
| Expandable FAQ / details | `accordion()` | Long `markdown()` blocks |
| Work history / education | Individual `card()` blocks with period as subtitle | `timeline()` (items aren't actionable) |
| Skills / tech stack | `skillBar()` or `list()` (passive reference) | Cards (overkill for simple data) |

### Bad → Good Patterns

```ts
// BAD: tabs for resume sections + timeline for entries
// timeline is one block, tabs force left/right switching
tabs([
  { label: "Experience", content: [timeline([
    { title: "Engineer", subtitle: "Acme", period: "2023–now" }
  ])] },
  { label: "Education", content: [timeline([...])] },
])

// GOOD: flat cards with divider sections — everything scrolls vertically
divider("Experience"),
card({ title: "Senior Engineer", subtitle: "Acme Corp — 2023–present", body: "Leading platform team..." }),
card({ title: "Junior Dev", subtitle: "Startup — 2021–2023", body: "Built core features..." }),
divider("Education"),
card({ title: "BS Computer Science", subtitle: "State University — 2021" }),
// Each card is focusable, everything scrolls naturally with ↑↓
```

**When to use `timeline()`:** Only when you want a visual connected-dot timeline aesthetic AND the items are passive (no action needed on Enter). For anything users need to browse, navigate, or interact with, use `card()` blocks instead.

**When to use `tabs()`:** Only for mutually exclusive views of the same data (e.g., "Grid view" vs "List view", "Day 1" vs "Day 2" of a conference). NOT for organizing sequential sections of a page — use `divider("Label")` for that.

---

## Full API Reference

Every function below is imported from `"terminaltui"`.

### defineSite(config: SiteConfig): Site

Top-level site definition. Must be the default export of `site.config.ts`.

```ts
interface SiteConfig {
  name: string;                                   // Required. Site name
  handle?: string;                                // Handle shown on home (e.g. "@user")
  tagline?: string;                               // Subtitle below the banner
  banner?: BannerConfig;                          // ASCII art banner (use ascii() helper)
  theme?: Theme | BuiltinThemeName;               // Theme object or name. Default: "dracula"
  borders?: BorderStyle;                          // Border style for cards/tables. Default: "rounded"
  animations?: AnimationConfig;                   // Boot, transitions, exit config
  navigation?: NavigationConfig;                  // Navigation behavior options
  pages: (PageConfig | RouteConfig)[];            // Array of pages and routes
  middleware?: MiddlewareFn[];                     // Global middleware chain
  easterEggs?: EasterEggConfig;                   // Konami code and custom commands
  footer?: string | ContentBlock;                 // Footer content
  statusBar?: boolean | StatusBarConfig;          // Status bar configuration
  artDir?: string | false;                        // Custom art directory path

  // Lifecycle hooks
  onInit?: (app: AppContext) => Promise<void> | void;
  onExit?: (app: AppContext) => Promise<void> | void;
  onNavigate?: (from: string, to: string, params?: RouteParams) => void;
  onError?: (error: Error, context: ErrorContext) => ContentBlock[] | void;
}
```

```ts
export default defineSite({
  name: "My Site",
  handle: "@me",
  tagline: "a cool terminal site",
  banner: ascii("My Site", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: "dracula",
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "Goodbye!", speed: "normal" },
  middleware: [requireEnv(["API_KEY"])],
  onInit: async (app) => { /* setup */ },
  onError: (err, ctx) => [markdown(`Error: ${err.message}`)],
  pages: [ /* ... */ ],
});
```

### page(id: string, config): PageConfig

Creates a page. Each page appears as a menu item.

```ts
interface PageConfig {
  id: string;                                        // Unique page identifier (first arg)
  title: string;                                     // Display name in the menu
  icon?: string;                                     // Single character before the title
  content: ContentBlock[] | (() => Promise<ContentBlock[]>); // Static or async content
  loading?: string;                                  // Loading message for async content
  refreshInterval?: number;                          // Auto-refresh interval in ms
  onError?: (err: Error) => ContentBlock[];          // Error handler
  middleware?: MiddlewareFn[];                        // Page-level middleware chain
}
```

```ts
page("about", {
  title: "About Me",
  icon: "◆",
  content: [markdown("Hello!")],
  middleware: [requireEnv(["ABOUT_DATA"])],
})
```

Common icons: `"◆"` `"◈"` `"▣"` `"▤"` `"◉"` `"▸"` `"✦"` `"★"` `"●"` `"■"` `"▲"` `"♦"`

### route(id: string, config): RouteConfig

Defines a parameterized route. Unlike `page()`, routes receive params and content is always a function.

```ts
interface RouteConfig {
  id: string;                                                          // Route ID
  title: string | ((params: RouteParams) => string);                   // Static or dynamic title
  icon?: string;
  content: ((params: RouteParams) => ContentBlock[]) | ((params: RouteParams) => Promise<ContentBlock[]>);
  loading?: string | ((params: RouteParams) => string);
  onError?: (err: Error, params: RouteParams) => ContentBlock[];
  middleware?: MiddlewareFn[];
}

type RouteParams = Record<string, string>;
```

```ts
route("project", {
  title: (params) => `Project: ${params.name}`,
  content: async (params) => {
    const data = await fetchProject(params.name);
    return [card({ title: data.name, body: data.description })];
  },
  loading: "Loading project...",
})
```

### navigate(pageId: string, params?: RouteParams): void

Programmatic navigation from anywhere (event handlers, middleware, etc.).

```ts
navigate("project", { name: "my-app" });
navigate("home");
```

---

### Content Blocks

#### markdown(text: string): TextBlock

Renders text with markdown formatting (bold, italic, inline code, code blocks).

```ts
markdown("This is **bold** and *italic* with `code`.")
```

#### card(config): CardBlock

A bordered card with title, optional subtitle, body, tags, URL, and action.

```ts
interface CardBlock {
  title: string;          // Card heading
  subtitle?: string;      // Secondary text (price, date, star count)
  body?: string;          // Body text
  tags?: string[];        // Tags shown as badges
  url?: string;           // URL opened on Enter
  border?: BorderStyle;   // Override border style
  action?: CardAction;    // Action on select (navigate, onPress, etc.)
}

interface CardAction {
  label?: string;
  style?: "primary" | "secondary" | "danger";
  confirm?: string;                         // Confirmation prompt text
  onPress?: () => void | Promise<void>;
  navigate?: string;                        // Navigate to a page/route
  params?: RouteParams;                     // Route parameters
}
```

```ts
card({
  title: "My Project",
  subtitle: "★ 200",
  body: "A brief description.",
  tags: ["TypeScript", "Open Source"],
  url: "https://github.com/user/repo",
  action: { navigate: "project", params: { name: "my-project" } },
})
```

#### timeline(items: TimelineItem[]): TimelineBlock

Vertical timeline with connected entries. Great for work history, changelog, education.

```ts
interface TimelineItem {
  title: string;       // Entry heading
  subtitle?: string;   // Organization/company
  period?: string;     // Time range
  description?: string; // Details
}
```

```ts
timeline([
  { title: "Senior Engineer", subtitle: "Acme Corp", period: "2023 — present", description: "Leading platform team" },
  { title: "BS Computer Science", subtitle: "University", period: "2017 — 2021" },
])
```

#### table(headers: string[], rows: string[][]): TableBlock

A bordered data table.

```ts
table(
  ["Plan", "Price", "Features"],
  [
    ["Free", "$0/mo", "Basic features"],
    ["Pro", "$10/mo", "Everything + priority support"],
  ]
)
```

#### list(items: string[], style?): ListBlock

A styled list. Style: `"bullet"` (default) | `"number"` | `"dash"` | `"check"` | `"arrow"`.

```ts
list(["First item", "Second item", "Third item"], "check")
```

#### quote(text: string, attribution?: string): QuoteBlock

Block quote with optional attribution.

```ts
quote("The best way to predict the future is to invent it.", "— Alan Kay")
```

#### hero(config): HeroBlock

Large hero section with title, subtitle, CTA, and optional ASCII art.

```ts
interface HeroBlock {
  title: string;                              // Large heading
  subtitle?: string;                          // Description
  cta?: { label: string; url: string };       // Call-to-action link
  art?: string;                               // Custom ASCII art string
}
```

```ts
hero({ title: "Welcome", subtitle: "Build terminal apps.", cta: { label: "Get Started →", url: "https://..." } })
```

#### gallery(items): GalleryBlock

Grid of cards. Items use the same shape as `card()` (without `type`).

```ts
gallery([
  { title: "Photo 1", body: "Description", tags: ["nature"] },
  { title: "Photo 2", body: "Description", tags: ["urban"] },
])
```

#### tabs(items): TabsBlock

Tabbed content. Each tab has a label and nested content blocks.

```ts
tabs([
  { label: "Frontend", content: [list(["React", "Vue", "Svelte"], "check")] },
  { label: "Backend", content: [list(["Node.js", "Python", "Go"], "check")] },
])
```

#### accordion(items): AccordionBlock

Collapsible sections. Same shape as tabs. Great for FAQs.

```ts
accordion([
  { label: "What is terminaltui?", content: [markdown("A framework for building terminal websites.")] },
  { label: "How do I deploy?", content: [markdown("Run `terminaltui build` then `npm publish`.")] },
])
```

#### link(label: string, url: string, options?: LinkOptions): LinkBlock

A clickable link. Opens in the user's browser when selected.

```ts
interface LinkOptions {
  icon?: string;   // Icon character before the label
}
```

```ts
link("GitHub", "https://github.com/user")
link("Email", "mailto:hello@example.com", { icon: "✉" })
```

#### progressBar(label: string, value: number, max?: number): ProgressBarBlock

Generic progress bar. Max defaults to 100. Always shows percent.

```ts
progressBar("Project Alpha", 7, 10)
progressBar("Completion", 65)
```

#### skillBar(label: string, value: number): ProgressBarBlock

Shorthand for `progressBar(label, value, 100)` with `showPercent: true`.

```ts
skillBar("TypeScript", 90)
skillBar("Rust", 75)
```

#### badge(text: string, color?: string): BadgeBlock

An inline badge/tag. Color is a hex string.

```ts
badge("v2.0")
badge("NEW", "#50fa7b")
```

#### image(path: string, options?): ImageBlock

Renders an image in the terminal.

```ts
image("./logo.png")
image("./photo.jpg", { width: 60, mode: "braille" })
```

Options: `width?: number`, `mode?: "ascii" | "braille" | "blocks"`.

#### section(title: string, content: ContentBlock[]): SectionBlock

Groups content under a titled section header with a divider line.

```ts
section("Appetizers", [
  card({ title: "Bruschetta", subtitle: "$12", body: "Toasted bread with tomatoes" }),
])
```

#### divider(style?, label?): DividerBlock

Horizontal divider line. Styles: `"solid"` | `"dashed"` | `"dotted"` | `"double"` | `"label"`. If the first arg is not a known style, it becomes a label automatically.

```ts
divider()                    // solid line
divider("dashed")            // dashed line
divider("My Section")        // labeled divider (auto-detected)
divider("label", "Section")  // explicit label style
```

#### spacer(lines?: number): SpacerBlock

Vertical whitespace. Defaults to 1 line.

```ts
spacer()     // 1 blank line
spacer(3)    // 3 blank lines
```

#### dynamic(renderFn) / dynamic(deps, renderFn): DynamicBlock

Reactive content block that re-renders when state changes. Currently all dynamic blocks re-render on any state change. The deps array is accepted for forward compatibility.

```ts
// Re-renders on any state change
dynamic(() => markdown(`Count: ${state.get("count")}`))

// Deps accepted for forward compatibility (currently re-renders on any change)
dynamic(["count"], () => markdown(`Count: ${state.get("count")}`))
```

#### asyncContent(config): AsyncContentBlock

Lazily-loaded async content.

```ts
asyncContent({
  load: async () => {
    const data = await fetchData();
    return [card({ title: data.name, body: data.description })];
  },
  loading: "Loading data...",
  fallback: [markdown("Failed to load.")],
})
```

---

### Input Components

All input components create interactive form elements. In navigation mode, press Enter on an input to enter edit mode; press Escape to return to navigation.

#### textInput(config): TextInputBlock

```ts
interface TextInputBlock {
  id: string;                                    // Unique input ID
  label: string;                                 // Label text
  placeholder?: string;                          // Placeholder text
  defaultValue?: string;                         // Initial value
  maxLength?: number;                            // Max character count
  validate?: (value: string) => string | null;   // Return error message or null
  mask?: boolean;                                // Mask input (for passwords)
  transform?: (value: string) => string;         // Transform input on change
}
```

```ts
textInput({ id: "name", label: "Your Name", placeholder: "Enter name...", maxLength: 50 })
textInput({ id: "password", label: "Password", mask: true })
```

#### textArea(config): TextAreaBlock

```ts
interface TextAreaBlock {
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;                                 // Visible rows (default varies)
  maxLength?: number;
  validate?: (value: string) => string | null;
}
```

```ts
textArea({ id: "bio", label: "Bio", placeholder: "Tell us about yourself...", rows: 4, maxLength: 500 })
```

#### select(config): SelectBlock

```ts
interface SelectBlock {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}
```

```ts
select({
  id: "color",
  label: "Favorite Color",
  options: [{ label: "Red", value: "red" }, { label: "Blue", value: "blue" }],
  onChange: (val) => console.log("Selected:", val),
})
```

#### checkbox(config): CheckboxBlock

```ts
interface CheckboxBlock {
  id: string;
  label: string;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
}
```

```ts
checkbox({ id: "agree", label: "I agree to the terms", onChange: (val) => console.log(val) })
```

#### toggle(config): ToggleBlock

```ts
interface ToggleBlock {
  id: string;
  label: string;
  defaultValue?: boolean;
  onLabel?: string;                              // Text for "on" state
  offLabel?: string;                             // Text for "off" state
  onChange?: (value: boolean) => void;
}
```

```ts
toggle({ id: "dark", label: "Dark Mode", onLabel: "ON", offLabel: "OFF", defaultValue: true })
```

#### radioGroup(config): RadioGroupBlock

```ts
interface RadioGroupBlock {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
}
```

```ts
radioGroup({
  id: "plan",
  label: "Select Plan",
  options: [{ label: "Free", value: "free" }, { label: "Pro", value: "pro" }],
  defaultValue: "free",
  onChange: (val) => console.log("Plan:", val),
})
```

#### numberInput(config): NumberInputBlock

```ts
interface NumberInputBlock {
  id: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}
```

```ts
numberInput({ id: "qty", label: "Quantity", defaultValue: 1, min: 1, max: 99, step: 1 })
```

#### searchInput(config): SearchInputBlock

```ts
interface SearchInputBlock {
  id: string;
  label?: string;
  placeholder?: string;
  items: { label: string; value: string; keywords?: string[] }[];
  maxResults?: number;
  action?: "navigate" | "callback";              // Default: "callback" if onSelect provided
  onSelect?: (value: string) => void;
}
```

```ts
searchInput({
  id: "search",
  placeholder: "Search pages...",
  items: [
    { label: "About", value: "about", keywords: ["bio", "info"] },
    { label: "Projects", value: "projects", keywords: ["work", "code"] },
  ],
  action: "navigate",
})
```

#### button(config): ButtonBlock

```ts
interface ButtonBlock {
  label: string;
  style?: "primary" | "secondary" | "danger";
  onPress?: () => void | Promise<void>;
  loading?: boolean;
}
```

```ts
button({ label: "Submit", style: "primary", onPress: async () => { /* ... */ } })
```

#### form(config): FormBlock

Groups input fields and a submit button. On submit, collects all field values by ID.

```ts
interface FormBlock {
  id: string;
  onSubmit: (data: Record<string, any>) => Promise<ActionResult> | ActionResult;
  fields: ContentBlock[];
}

type ActionResult = { success: string } | { error: string } | { info: string };
```

```ts
form({
  id: "contact",
  onSubmit: async (data) => {
    await sendEmail(data.name, data.email, data.message);
    return { success: "Message sent!" };
  },
  fields: [
    textInput({ id: "name", label: "Name" }),
    textInput({ id: "email", label: "Email" }),
    textArea({ id: "message", label: "Message", rows: 4 }),
    button({ label: "Send", style: "primary" }),
  ],
})
```

---

### State Management

#### createState(initial): StateContainer

Reactive state container. Changes trigger UI re-renders.

```ts
interface StateContainer<T> {
  get(): T;                                      // Get entire state
  get<K extends keyof T>(key: K): T[K];          // Get single key
  set<K extends keyof T>(key: K, value: T[K]): void;
  update<K extends keyof T>(key: K, fn: (prev: T[K]) => T[K]): void;
  batch(fn: () => void): void;                   // Batch multiple updates
  on<K extends keyof T>(key: K, handler: (newVal, oldVal) => void): Unsubscribe;
  on(key: "*", handler: (key, newVal) => void): Unsubscribe;
}
```

```ts
const state = createState({ count: 0, name: "world" });
state.set("count", 1);
state.update("count", (prev) => prev + 1);
state.on("count", (newVal, oldVal) => console.log(`Changed: ${oldVal} -> ${newVal}`));
state.batch(() => {
  state.set("count", 10);
  state.set("name", "hello");
});
```

#### computed(fn): ComputedValue

Cached derived values. Call `.invalidate()` to force recalculation.

```ts
interface ComputedValue<T> {
  get(): T;
  invalidate(): void;
}
```

```ts
const total = computed(() => state.get("price") * state.get("quantity"));
console.log(total.get());
```

#### createPersistentState(options): StateContainer

State that persists to disk as JSON. Same API as `createState`.

```ts
interface PersistentStateOptions<T> {
  path: string;           // File path for JSON persistence
  defaults: T;            // Default values
}
```

```ts
const prefs = createPersistentState({
  path: "./data/prefs.json",
  defaults: { theme: "dracula", fontSize: 14 },
});
```

---

### Data Fetching

#### fetcher(options): FetcherResult

Reactive data fetcher with caching, retry, and auto-refresh.

```ts
interface FetcherOptions<T> {
  url?: string;                                  // URL to fetch
  fetch?: () => Promise<T>;                      // Custom fetch function
  method?: string;                               // HTTP method
  headers?: Record<string, string>;
  body?: any;
  refreshInterval?: number;                      // Auto-refresh in ms
  cache?: boolean;                               // Enable caching (default: true)
  cacheTTL?: number;                             // Cache TTL in ms (default: 60000)
  retry?: number;                                // Retry count (default: 0)
  retryDelay?: number;                           // Retry delay in ms (default: 1000)
  transform?: (data: any) => T;                  // Transform response
  onError?: (err: Error) => void;
}

interface FetcherResult<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: Error | null;
  refresh(): Promise<void>;
  mutate(data: T): void;
  clear(): void;
  destroy(): void;
}
```

```ts
const api = fetcher({ url: "https://api.example.com/data", refreshInterval: 30000, retry: 3 });
```

#### request(options) / request.get/post/put/delete/patch

Simple HTTP request helper.

```ts
interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

interface RequestResult<T> {
  data: T | null;
  error: Error | null;
  status: number;
  ok: boolean;
}
```

```ts
const res = await request({ url: "https://api.example.com/data", method: "POST", body: { name: "test" } });
// Shorthand methods:
const res = await request.get("https://api.example.com/data");
const res = await request.post("https://api.example.com/data", { name: "test" });
const res = await request.put("https://api.example.com/data/1", { name: "updated" });
const res = await request.delete("https://api.example.com/data/1");
const res = await request.patch("https://api.example.com/data/1", { name: "patched" });
// Third arg is a flat headers object (not { headers: {...} }):
const res = await request.post("https://api.example.com/data", { name: "test" }, { Authorization: "Bearer sk-..." });
```

#### liveData(options): LiveDataConnection

Real-time data via WebSocket or Server-Sent Events.

```ts
// WebSocket
const ws = liveData({
  type: "websocket",
  url: "wss://api.example.com/ws",
  onMessage: (data) => { /* handle message */ },
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
  onError: (err) => console.error(err),
  reconnect: true,                               // Auto-reconnect (default: false)
  reconnectInterval: 5000,
  protocols: [],
});

// SSE
const sse = liveData({
  type: "sse",
  url: "https://api.example.com/events",
  onMessage: (event) => { /* event.data, event.type, event.lastEventId */ },
  headers: { Authorization: "Bearer ..." },
});

// LiveDataConnection API:
ws.send("hello");
ws.close();
ws.connected; // boolean
```

---

### API Routes

Define backend endpoints directly in your site config. No Express, no external server — just Node's built-in `http` module on localhost.

```ts
import { defineSite, page, dynamic, fetcher, request, markdown } from "terminaltui";

export default defineSite({
  name: "My Dashboard",
  theme: "hacker",

  api: {
    // Simple GET
    "GET /stats": async () => {
      return { uptime: process.uptime(), timestamp: Date.now() };
    },

    // GET with URL params
    "GET /items/:id": async (req) => {
      return { id: req.params.id, name: `Item ${req.params.id}` };
    },

    // POST with request body
    "POST /deploy": async (req) => {
      const { image, name } = req.body as any;
      return { success: true, message: `Deployed ${name}` };
    },

    // Query strings: GET /search?q=hello&page=2
    "GET /search": async (req) => {
      return { query: req.query.q, page: req.query.page };
    },
  },

  pages: [
    page("dashboard", {
      title: "Dashboard",
      content: [
        dynamic(["stats"], () => {
          const stats = fetcher({ url: "/stats", refreshInterval: 5000 });
          if (stats.loading) return markdown("Loading...");
          return markdown(`Uptime: ${stats.data?.uptime}s`);
        }),
      ],
    }),
  ],
});
```

#### How It Works

- When `terminaltui dev` or the built `npx` package runs, a localhost HTTP server starts on a random port
- `fetcher()`, `request.*()`, and `liveData()` calls with relative URLs (starting with `/`) auto-route to this server
- The server **only** binds to `127.0.0.1` — never exposed to the network
- Sites without `api` in their config work exactly as before

#### ApiRequest Object

```ts
interface ApiRequest {
  method: string;                        // "GET", "POST", etc.
  path: string;                          // "/items/42"
  params: Record<string, string>;        // { id: "42" } from :id
  query: Record<string, string>;         // { q: "hello" } from ?q=hello
  body: unknown;                         // Parsed JSON body (POST/PUT/PATCH)
  headers: Record<string, string>;
}
```

#### Supported Methods

`GET`, `POST`, `PUT`, `DELETE`, `PATCH` — defined as `"METHOD /path"` keys in the `api` object.

#### Common API Route Patterns

**Shell commands:**
```ts
import { execSync } from "child_process";

"GET /uptime": async () => {
  return { uptime: execSync("uptime -p").toString().trim() };
},
```

**File system:**
```ts
import { readFileSync, readdirSync } from "fs";

"GET /files": async () => {
  const files = readdirSync(".").filter(f => !f.startsWith("."));
  return { files };
},
"GET /config": async () => {
  return { content: readFileSync("./config.yml", "utf-8") };
},
```

**Stateful in-memory data:**
```ts
let counter = 0;
// ...inside api:
"GET /counter": async () => ({ count: ++counter }),
"POST /counter/reset": async () => { counter = 0; return { count: 0 }; },
```

**CRUD with POST body:**
```ts
const items: any[] = [];
// ...inside api:
"GET /items": async () => ({ items }),
"POST /items": async (req) => {
  const item = { id: Date.now(), ...(req.body as any) };
  items.push(item);
  return { success: true, item };
},
"DELETE /items/:id": async (req) => {
  const idx = items.findIndex(i => i.id === Number(req.params.id));
  if (idx === -1) return { error: "not found" };
  items.splice(idx, 1);
  return { success: true };
},
```

**Error handling (throw → 500):**
```ts
"GET /risky": async () => {
  const result = execSync("some-command").toString();
  if (!result) throw new Error("Command produced no output");
  return { result };
},
// If the handler throws, the framework returns:
// HTTP 500 { "error": "Command produced no output" }
```

#### Using API Routes with fetcher/request

Relative URLs in `fetcher()`, `request.*()`, and `liveData()` auto-resolve to the local API server:

```ts
// In a dynamic block — fetcher with auto-refresh
dynamic(["stats"], () => {
  const data = fetcher({ url: "/stats", refreshInterval: 5000 });
  if (data.loading) return markdown("Loading...");
  if (data.error) return markdown(`Error: ${data.error.message}`);
  return markdown(`Uptime: ${data.data.uptime}`);
}),

// In a form onSubmit — imperative POST
form({
  id: "deploy",
  onSubmit: async (data) => {
    const res = await request.post("/deploy", { image: data.image });
    if (res.ok) return { success: "Deployed!" };
    return { error: (res.data as any)?.error || "Deploy failed" };
  },
  fields: [
    textInput({ id: "image", label: "Docker Image" }),
    button({ label: "Deploy", style: "primary" }),
  ],
}),
```

#### When to Use API Routes

| Scenario | Solution |
|---|---|
| Site needs system info (uptime, disk, CPU) | API route with `execSync` / `os` module |
| Dashboard with start/stop/restart actions | POST API routes |
| Contact form that sends email | API route calling email service |
| Live metrics that update on screen | API route + `fetcher({ refreshInterval })` |
| Read/write local files | API routes with `fs` module |
| Docker container management | API routes wrapping `docker` CLI |
| Database queries | API routes with your DB driver |

#### Security

API routes have full Node.js capabilities (file system, shell commands, etc). They run on the user's machine and are only accessible from localhost. **Never expose the API port to the network.**

---

### `terminaltui create` — Interactive Prompt Builder

Build a new TUI project from scratch using an interactive questionnaire:

```bash
terminaltui create
```

Asks 10 questions:
1. **Project name** — becomes the `npx` command name
2. **Description** — what the site/app is about (detailed)
3. **Pages** — list of pages (one per line)
4. **Content** — real content to include, or "skip" to let AI generate it
5. **Theme** — pick from 10 themes or "auto"
6. **Visual style** — bold, minimal, retro, playful, professional
7. **ASCII art** — scenes to include, or "auto"/"none"
8. **Interactive features** — contact form, search, reservation, signup, newsletter, custom
9. **Animations** — full, subtle, or none
10. **Extra instructions** — anything else

Creates a project directory with:
- `TERMINALTUI_SKILL.md` — full framework reference
- `TERMINALTUI_CREATE_PROMPT.md` — tailored AI prompt from your answers

Then open Claude Code in that directory and paste the instructions.

#### When to use create vs init vs convert

| Command | Use when | What it does |
|---|---|---|
| `terminaltui init` | You want a template with placeholder content | Scaffolds a project from a template |
| `terminaltui create` | You want to describe something new and have AI build it | Generates a tailored AI prompt |
| `terminaltui convert` | You already have a website to convert | Drops conversion docs into your project |

---

### Themes

10 built-in themes. Use as string name or reference `themes.themeName`.

```ts
import { themes } from "terminaltui";
theme: themes.dracula    // or theme: "dracula"
```

| Theme | Accent | Best For |
|---|---|---|
| `cyberpunk` | `#ff2a6d` (hot pink) | Tech startups, gaming, futuristic |
| `dracula` | `#ff79c6` (pink) | General purpose, developer tools (default) |
| `nord` | `#88c0d0` (frost blue) | Corporate, professional, SaaS |
| `monokai` | `#f92672` (magenta) | Developer portfolios, coding tools |
| `solarized` | `#268bd2` (blue) | Academic, documentation, research |
| `gruvbox` | `#fe8019` (orange) | Restaurants, cafes, warm brands |
| `catppuccin` | `#f5c2e7` (pink) | Creative agencies, design portfolios |
| `tokyoNight` | `#7aa2f7` (blue) | Modern SaaS, product pages |
| `rosePine` | `#ebbcba` (rose) | Music, art, personal blogs |
| `hacker` | `#00ff41` (green) | Security, infosec, Matrix-style |

Custom theme:

```ts
interface Theme {
  accent: string;       // Primary accent color (hex)
  accentDim: string;    // Dimmed accent
  text: string;         // Primary text color
  muted: string;        // Muted/secondary text
  subtle: string;       // Subtle elements
  success: string;      // Success color
  warning: string;      // Warning color
  error: string;        // Error color
  border: string;       // Border color
  bg?: string;          // Background color
}
```

```ts
theme: {
  accent: "#e06c75", accentDim: "#be5046", text: "#abb2bf", muted: "#5c6370",
  subtle: "#3e4452", success: "#98c379", warning: "#e5c07b", error: "#e06c75",
  border: "#5c6370", bg: "#282c34",
}
```

---

### Border Styles

```ts
type BorderStyle = "single" | "double" | "rounded" | "heavy" | "dashed" | "ascii" | "none";
```

Used in: `defineSite({ borders })`, `card({ border })`, `table({ border })`.

---

### ASCII Art System

#### ascii(text, options?): BannerConfig

Creates an ASCII art banner for the `banner` field of `defineSite()`.

```ts
interface BannerConfig {
  text: string;
  font?: string;                                 // Font name (see list below)
  gradient?: string[];                           // Array of hex colors
  align?: "left" | "center" | "right";           // Default: "left"
  padding?: number;                              // Padding around banner
  shadow?: boolean;                              // Drop shadow effect
  border?: string | false;                       // Border around banner
  width?: number;                                // Max width
}
```

```ts
banner: ascii("MY SITE", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"], shadow: true })
```

#### Fonts (14 built-in)

| Font | Height | Style |
|---|---|---|
| `"ANSI Shadow"` | 6 | Clean block letters with shadow — modern default |
| `"Block"` | 6 | Solid block characters — bold and heavy |
| `"Slant"` | 6 | Classic italic/slanted — elegant |
| `"Calvin S"` | 4 | Clean thin letters — professional, compact |
| `"Small"` | 4 | Tiny but readable — space-constrained |
| `"Ogre"` | 5 | Chunky and playful — fun, casual |
| `"DOS Rebel"` | 10 | DOS-era block art — retro, nostalgic |
| `"Ghost"` | 10 | Spooky hollow letters — horror, creative |
| `"Bloody"` | 10 | Dripping horror letters — intense |
| `"Electronic"` | 10 | Digital/LED style — tech, futuristic |
| `"Sub-Zero"` | 10 | Icy/frozen appearance — cool, sharp |
| `"Larry 3D"` | 10 | 3D perspective letters — eye-catching |
| `"Colossal"` | 10 | Massive block letters — impactful |
| `"Isometric1"` | 10 | Isometric 3D projection — unique |

Font names are case-sensitive. Use exactly as listed.

#### asciiArt.scene(type, options?): string[]

Pre-made decorative scenes. Returns string array.

```ts
type SceneType = "mountains" | "cityscape" | "forest" | "ocean" | "space"
  | "clouds" | "coffee-cup" | "rocket" | "cat" | "robot" | "terminal"
  | "vinyl-record" | "cassette" | "floppy-disk" | "gameboy";

interface SceneOptions { width?: number; color?: string; }
```

15 scenes:
- **Landscapes:** `mountains`, `cityscape`, `forest`, `ocean`, `space`, `clouds`
- **Objects:** `coffee-cup`, `rocket`, `cat`, `robot`, `terminal`
- **Retro:** `vinyl-record`, `cassette`, `floppy-disk`, `gameboy`

```ts
const art = asciiArt.scene("mountains", { width: 60 });
```

#### getIcon(name, size?): string[] | undefined

Pre-made ASCII art icons. Size: `"small"` | `"medium"` | `"large"`.

32 icons: `laptop`, `briefcase`, `person`, `chain`, `chart`, `pen`, `music`, `star`, `globe`, `mail`, `code`, `terminal`, `folder`, `file`, `git`, `heart`, `check`, `cross`, `warning`, `film`, `camera`, `book`, `phone`, `pin`, `clock`, `users`, `cup`, `food`, `car`, `plane`, `fire`, `lightning`

```ts
const icon = getIcon("terminal");
// or via asciiArt:
const icon = asciiArt.getIcon("terminal");
```

#### asciiArt.pattern(width, height, type, options?): string[]

Decorative fill patterns.

```ts
type PatternType = "dots" | "crosshatch" | "diagonal" | "waves" | "bricks"
  | "circuit" | "rain" | "stars" | "confetti" | "static" | "braille-dots" | "grid";

interface PatternOptions { density?: number; seed?: number; }
```

12 patterns: `dots`, `crosshatch`, `diagonal`, `waves`, `bricks`, `circuit`, `rain`, `stars`, `confetti`, `static`, `braille-dots`, `grid`

```ts
const bg = asciiArt.pattern(40, 10, "circuit", { density: 0.5 });
```

#### Shapes (9)

All shapes return `string[]`.

```ts
asciiArt.box(width: number, height: number, style?: "single"|"double"|"rounded"|"heavy"|"ascii"): string[]
asciiArt.circle(radius: number, fill?: string): string[]
asciiArt.diamond(size: number): string[]
asciiArt.triangle(height: number): string[]
asciiArt.heart(size: number): string[]
asciiArt.star(size: number): string[]
asciiArt.arrow(length: number, direction?: "right"|"left"|"up"|"down"): string[]
asciiArt.hexagon(size: number): string[]
asciiArt.line(length: number, style?: string): string[]
```

```ts
const box = asciiArt.box(20, 5, "rounded");
const heart = asciiArt.heart(5);
```

#### Data Visualization (5)

```ts
asciiArt.barChart(
  data: { label: string; value: number }[],
  options?: { width?: number; horizontal?: boolean; showValues?: boolean; maxBarWidth?: number }
): string[]

asciiArt.sparkline(data: number[], width?: number): string[]

asciiArt.heatmap(
  data: number[][],
  options?: { chars?: string; showScale?: boolean }
): string[]

asciiArt.pieChart(
  data: { label: string; value: number }[],
  radius?: number
): string[]

asciiArt.graph(data: number[], width?: number, height?: number): string[]
```

```ts
const chart = asciiArt.barChart([
  { label: "TypeScript", value: 85 },
  { label: "Rust", value: 70 },
], { width: 50 });
const spark = asciiArt.sparkline([1, 5, 3, 8, 2, 7], 30);
const heat = asciiArt.heatmap([[1,2,3],[4,5,6],[7,8,9]], { showScale: true });
const pie = asciiArt.pieChart([{ label: "A", value: 60 }, { label: "B", value: 40 }], 6);
const g = asciiArt.graph([10, 20, 15, 30, 25], 40, 10);
```

#### Art Compose Utilities (13)

All operate on `string[]` (lines of ASCII art).

```ts
artCompose.overlay(base: string[], over: string[], x: number, y: number): string[]
artCompose.sideBySide(left: string[], right: string[], gap?: number): string[]   // gap default: 2
artCompose.stack(top: string[], bottom: string[], gap?: number): string[]        // gap default: 1
artCompose.center(art: string[], width: number): string[]
artCompose.pad(art: string[], padding: number | { top?, right?, bottom?, left? }): string[]
artCompose.crop(art: string[], x: number, y: number, width: number, height: number): string[]
artCompose.repeat(art: string[], times: number, direction: "horizontal" | "vertical"): string[]
artCompose.mirror(art: string[], axis: "horizontal" | "vertical"): string[]
artCompose.rotate(art: string[], degrees: 90 | 180 | 270): string[]
artCompose.colorize(art: string[], color: string): string[]           // hex color on non-space chars
artCompose.gradient(art: string[], colors: string[], direction?: "horizontal"|"vertical"|"diagonal"): string[]
artCompose.rainbow(art: string[]): string[]                           // rainbow gradient
artCompose.shadow(art: string[], direction?: "bottom-right"|"bottom-left", char?: string): string[]
```

```ts
const combined = artCompose.sideBySide(
  asciiArt.scene("mountains"),
  asciiArt.scene("forest"),
  4
);
const colored = artCompose.gradient(asciiArt.box(20, 5), ["#ff0000", "#0000ff"]);
```

#### asciiImage(source, options?): Promise<string[]>

Convert images to ASCII art. Requires `sharp` peer dependency.

```ts
interface AsciiImageOptions {
  width?: number;                                // Default: 60
  height?: number;
  mode?: "ascii" | "braille" | "blocks" | "shading";
  charset?: string;                              // Custom char ramp
  invert?: boolean;
  color?: boolean;
  dithering?: "none" | "floyd-steinberg" | "ordered";
  threshold?: number;
}
```

```ts
const art = await asciiImage("./logo.png", { width: 40, mode: "braille", color: true });
```

---

### Animations

```ts
interface AnimationConfig {
  boot?: boolean;                                // Boot animation (banner reveal + stagger)
  transitions?: "instant" | "fade" | "slide" | "wipe";
  exitMessage?: string;                          // Centered message on quit
  speed?: "slow" | "normal" | "fast";
}
```

```ts
animations: {
  boot: true,
  transitions: "fade",
  exitMessage: "[ end of transmission ]",
  speed: "normal",
}
```

---

### Middleware

```ts
// Create middleware
middleware(fn: MiddlewareFn): MiddlewareFn

// Return a redirect from middleware
redirect(pageId: string, params?: RouteParams): { redirect: string; params?: RouteParams }

type MiddlewareFn = (context: MiddlewareContext) => Promise<MiddlewareResult> | MiddlewareResult;

interface MiddlewareContext {
  page: string;
  params: RouteParams;
  state: any;
}

type MiddlewareResult = void | undefined | { redirect: string; params?: RouteParams };
```

Built-in middleware:

```ts
requireEnv(vars: string[]): MiddlewareFn          // Throws if env vars missing
rateLimit({ maxRequests, windowMs }): MiddlewareFn // Throws when limit exceeded
```

```ts
// Global middleware
defineSite({
  middleware: [requireEnv(["API_KEY"]), rateLimit({ maxRequests: 100, windowMs: 60000 })],
  pages: [
    page("admin", {
      middleware: [middleware(async (ctx) => {
        if (!isAdmin(ctx.state)) return redirect("home");
      })],
      // ...
    }),
  ],
});
```

---

### Environment & Config

`.env` files are auto-loaded on startup.

```ts
// Typed config from environment variables
const config = defineConfig({
  apiUrl: { env: "API_URL", default: "https://api.example.com" },
  apiKey: { env: "API_KEY", required: true },
  debug: { env: "DEBUG", default: false, transform: (v) => v === "true" },
});
config.get("apiUrl"); // string
config.get("debug");  // boolean
```

```ts
interface ConfigField<T> {
  env: string;                                   // Env var name
  default?: T;                                   // Default if missing
  required?: boolean;                            // Throw if missing and no default
  transform?: (value: string) => T;              // Transform string value
}
```

---

### Lifecycle Hooks

Set on `SiteConfig`. All receive an `AppContext`.

```ts
interface AppContext {
  state: any;
  navigate: (pageId: string, params?: RouteParams) => void;
}

interface ErrorContext {
  page?: string;
  params?: RouteParams;
  phase: "render" | "middleware" | "action" | "fetch";
}
```

```ts
defineSite({
  onInit: async (app) => { /* runs once at startup */ },
  onExit: async (app) => { /* runs on quit */ },
  onNavigate: (from, to, params) => { /* runs on every navigation */ },
  onError: (error, context) => {
    // Return ContentBlock[] to show custom error page, or void to use default
    return [markdown(`Error on ${context.page}: ${error.message}`)];
  },
  // ...
});
```

---

### CLI Commands

```bash
terminaltui init [template]              # Scaffold project (templates: portfolio, restaurant, saas, blog, band)
terminaltui dev [path]                   # Dev preview with hot reload
terminaltui build                        # Bundle for npm publish
terminaltui test [--cols=N] [--sizes] [--verbose]  # Run tests
terminaltui art list|preview|create|validate       # Manage ASCII art assets
```

---

### Navigation & Keybindings

**Navigation mode (default):**

| Key | Action |
|---|---|
| `Up` / `k` | Move selection up |
| `Down` / `j` | Move selection down |
| `Enter` | Select item / enter page / enter edit mode on input |
| `Escape` / `Backspace` | Go back / exit page |
| `1`-`9` | Jump to page by number (if `numberJump: true`) |
| `q` / `Ctrl+C` | Quit |
| `Tab` | Next focusable element |
| `Shift+Tab` | Previous focusable element |
| `Home` | First item |
| `End` | Last item |

**Edit mode (when editing an input):**

| Key | Action |
|---|---|
| `Escape` | Exit edit mode, return to navigation |
| `Enter` | Submit (in forms) / confirm selection |
| `Tab` | Next field |
| `Up`/`Down` | Navigate options (select, radio) |
| `Space` | Toggle (checkbox, toggle) |
| Standard typing | Text input |

---

### TUI Emulator (Testing)

Headless terminal emulator for automated testing. Think Puppeteer for terminal apps.

```ts
import { TUIEmulator } from "terminaltui";

const emu = await TUIEmulator.launch({
  command: "terminaltui dev",
  cwd: "./my-site",
  cols: 80,                                      // Terminal width (default: 80)
  rows: 24,                                      // Terminal height (default: 24)
  timeout: 30000,                                // Kill after timeout
});

await emu.waitForBoot();                         // Wait for boot animation
await emu.waitForText("About");                  // Wait for text to appear
await emu.waitForTextGone("Loading...");         // Wait for text to disappear
await emu.waitForIdle(500);                      // Wait for screen to stabilize
await emu.waitFor(() => emu.screen.contains("Ready")); // Custom condition

await emu.press("down");                         // Single key press
await emu.press("down", { times: 3 });           // Multiple presses
await emu.pressSequence(["down", "down", "enter"]); // Key sequence
await emu.type("hello world");                   // Type text
await emu.navigateTo("About");                   // Navigate to page by name

emu.screen.text();                               // Full screen as text
emu.screen.ansi();                               // Full screen as ANSI string
emu.screen.contains("text");                     // Check if text is visible
emu.screen.find("text");                         // Find text position
emu.screen.currentPage();                        // Current page name
emu.screen.menu();                               // Menu items and selected index
emu.screen.cards();                              // All visible cards
emu.screen.links();                              // All visible links

emu.assert.textVisible("About");                 // Assert text is on screen
emu.screenshot();                                // ANSI screenshot string
emu.snapshot();                                  // { text, ansi, timestamp }

await emu.close();                               // Shut down
```

---

## Content Extraction Guide

### Component Mapping

**IMPORTANT:** The "Best TUI Pattern" column takes priority. TUI navigation is up/down arrows — optimize for vertical scrolling and per-item focusability, not semantic content matching.

| Web Content | Semantic Match | Best TUI Pattern |
|---|---|---|
| Navigation / menu | Becomes `pages` array | `pages` array (automatic) |
| Hero / banner section | `hero()` | `hero()` — focusable if CTA set |
| Cards / grid of items | `card()` | Individual `card()` blocks (each focusable) |
| Pricing tables | `table()` | `table()` — passive, fine for dense data |
| Testimonials / reviews | `quote()` | `quote()` — passive, or `card()` if users need to browse |
| Work history / experience | `timeline()` | **Individual `card()` blocks** (each focusable, scrollable) |
| Education entries | `timeline()` | **Individual `card()` blocks** (subtitle=dates) |
| FAQ / collapsible sections | `accordion()` | `accordion()` — each item is focusable + expandable |
| Sectioned page content | `tabs()` | **`divider("Label")` + content below** (vertical scroll) |
| Toggle between views | `tabs()` | `tabs()` — only for mutually exclusive views |
| Blog post list | `card()` | Individual `card()` blocks (subtitle=date, body=excerpt) |
| Contact / social links | `link()` | `link()` per item (each focusable) |
| Stats / metrics / skills | `skillBar()` | `skillBar()` or `progressBar()` — passive display |
| Features list | `card()` | Individual `card()` blocks with tags |
| Menu items (restaurant) | `section()` + `card()` | `divider("Category")` + `card()` items (subtitle=price) |
| Documentation / prose | `markdown()` | `markdown()` — passive text |
| Data / comparison | `table()` | `table()` — passive dense data |
| Step-by-step instructions | `list()` | `list("number")` — passive, or `accordion()` for expandable |
| Search functionality | `searchInput()` | `searchInput()` with `action: "navigate"` |
| Contact forms | `form()` | `form()` with inputs + button |
| Interactive charts | `asciiArt.barChart()` | Custom block with dataviz functions |
| Real-time data | `liveData()` + `dynamic()` | `dynamic()` blocks with fetcher/state |

### Theme Selection Guide

| Theme | Best For |
|---|---|
| `cyberpunk` | Tech startups, gaming, futuristic — neon, electric |
| `dracula` | Developer tools, general purpose — classic dark (default) |
| `nord` | Corporate, professional, SaaS — clean, minimal |
| `monokai` | Coding tools, dev portfolios — code-editor feel |
| `solarized` | Academic, documentation, research — scholarly |
| `gruvbox` | Restaurants, cafes, crafts — earthy, warm, retro |
| `catppuccin` | Creative agencies, design — soft, pastel, friendly |
| `tokyoNight` | Modern SaaS, product pages — sleek, contemporary |
| `rosePine` | Music, art, creative portfolios — dreamy, elegant |
| `hacker` | Security, CTF, infosec — green-on-black, Matrix |

### ASCII Art Selection Guide

- **Banners:** Use `ascii()` with a font. Short names (1-2 words) work best. `"ANSI Shadow"` for modern, `"Calvin S"` for compact, `"Ogre"` for fun, `"Slant"` for elegant.
- **Hero art:** Use `asciiArt.scene()` — `mountains` for outdoors, `cityscape` for urban, `rocket` for startups, `terminal` for dev tools, `coffee-cup` for cafes.
- **Decorative icons:** Use `getIcon()` — `laptop` for tech, `music` for bands, `cup` for restaurants, `heart` for personal, `code` for dev.
- **Backgrounds/borders:** Use `asciiArt.pattern()` — `circuit` for tech, `stars` for night themes, `waves` for ocean.
- **Data display:** Use `asciiArt.barChart()` for comparisons, `asciiArt.sparkline()` for trends, `asciiArt.pieChart()` for proportions, `asciiArt.graph()` for time series.
- **Composition:** Use `artCompose.sideBySide()` to place art next to each other, `artCompose.overlay()` for layering, `artCompose.gradient()` for color.

---

## Complete Example: Developer Portfolio

```ts
import {
  defineSite, page, card, timeline, link, skillBar,
  ascii, markdown, themes, divider, spacer, badge,
  searchInput, asciiArt, artCompose,
} from "terminaltui";

const terminalIcon = asciiArt.scene("terminal");

export default defineSite({
  name: "Alex Chen",
  handle: "@alexchen",
  tagline: "full-stack engineer & open source contributor",
  banner: ascii("Alex Chen", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.dracula,
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "See you in the terminal!" },

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown("Hey! I'm Alex, a full-stack engineer in San Francisco. I build developer tools and contribute to open source. Currently at **Acme Corp** working on distributed systems."),
        spacer(),
        markdown("When I'm not coding, you'll find me climbing rocks or brewing coffee."),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: "◈",
      content: [
        card({
          title: "terminaltools",
          subtitle: "★ 2.4k",
          body: "A suite of terminal utilities for modern developers. Built with Rust.",
          tags: ["Rust", "CLI", "Open Source"],
          url: "https://github.com/alexchen/terminaltools",
        }),
        card({
          title: "cloudkit",
          subtitle: "★ 890",
          body: "Simplified cloud deployment framework. One command to deploy anywhere.",
          tags: ["TypeScript", "DevOps"],
          url: "https://github.com/alexchen/cloudkit",
        }),
        card({
          title: "pixelart.dev",
          subtitle: "★ 340",
          body: "Browser-based pixel art editor with real-time collaboration.",
          tags: ["React", "WebSocket"],
          url: "https://pixelart.dev",
        }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "▣",
      content: [
        divider("Experience"),
        card({ title: "Senior Platform Engineer", subtitle: "Acme Corp — 2023–present", body: "Leading the developer platform team." }),
        card({ title: "Software Engineer", subtitle: "Startup Labs — 2021–2023", body: "Full-stack development. Grew users from 1k to 50k." }),
        card({ title: "Junior Developer", subtitle: "WebAgency — 2019–2021", body: "Frontend development and client projects." }),
        divider("Education"),
        card({ title: "BS Computer Science", subtitle: "UC Berkeley — 2015–2019" }),
      ],
    }),

    page("skills", {
      title: "Skills",
      icon: "▤",
      content: [
        skillBar("TypeScript", 95),
        skillBar("Rust", 80),
        skillBar("Python", 85),
        skillBar("Go", 70),
        skillBar("React", 90),
        divider("Tools"),
        skillBar("Docker/K8s", 85),
        skillBar("AWS", 80),
        skillBar("Git", 95),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com/alexchen"),
        link("LinkedIn", "https://linkedin.com/in/alexchen"),
        link("Blog", "https://alexchen.dev/blog"),
        link("Email", "mailto:alex@alexchen.dev"),
      ],
    }),
  ],
});
```

## Complete Example: Restaurant

```ts
import {
  defineSite, page, section, card, table, quote,
  link, markdown, ascii, themes, divider, spacer,
  form, textInput, textArea, select, button, toggle,
} from "terminaltui";

export default defineSite({
  name: "The Golden Fork",
  tagline: "farm to table since 2018",
  banner: ascii("Golden Fork", { font: "Ogre", gradient: ["#d4a373", "#e63946"] }),
  theme: themes.gruvbox,
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "Thanks for visiting! See you at the table." },

  pages: [
    page("menu", {
      title: "Menu",
      icon: "◆",
      content: [
        section("Small Plates", [
          card({ title: "Heirloom Tomato Bruschetta", subtitle: "$14", body: "San Marzano tomatoes, fresh basil, aged balsamic" }),
          card({ title: "Burrata & Figs", subtitle: "$16", body: "Creamy burrata, mission figs, honey, toasted pistachios" }),
          card({ title: "Charred Octopus", subtitle: "$18", body: "Spanish octopus, romesco, fingerling potatoes" }),
        ]),
        divider(),
        section("Mains", [
          card({ title: "Pan-Seared Salmon", subtitle: "$32", body: "Wild-caught king salmon, lemon beurre blanc, asparagus" }),
          card({ title: "Dry-Aged Ribeye", subtitle: "$45", body: "28-day aged, 14oz, bone marrow butter, root vegetables" }),
          card({ title: "Wild Mushroom Risotto", subtitle: "$26", body: "Arborio rice, porcini, chanterelle, truffle oil" }),
        ]),
        divider(),
        section("Desserts", [
          card({ title: "Creme Brulee", subtitle: "$12", body: "Classic vanilla bean, caramelized sugar" }),
          card({ title: "Chocolate Fondant", subtitle: "$14", body: "Valrhona dark chocolate, salted caramel, vanilla gelato" }),
        ]),
      ],
    }),

    page("reservations", {
      title: "Reservations",
      icon: "◈",
      content: [
        markdown("**Book your table online.** We'll confirm by email within an hour."),
        spacer(),
        form({
          id: "reservation",
          onSubmit: async (data) => {
            return { success: `Table for ${data.guests} booked on ${data.date}! Confirmation sent to ${data.email}.` };
          },
          fields: [
            textInput({ id: "name", label: "Name", placeholder: "Your name..." }),
            textInput({ id: "email", label: "Email", placeholder: "your@email.com" }),
            textInput({ id: "date", label: "Date", placeholder: "e.g. March 25, 2026" }),
            select({
              id: "guests",
              label: "Party Size",
              options: [
                { label: "2 guests", value: "2" },
                { label: "4 guests", value: "4" },
                { label: "6 guests", value: "6" },
                { label: "8+ guests", value: "8+" },
              ],
            }),
            textArea({ id: "notes", label: "Special Requests", placeholder: "Dietary restrictions, celebrations...", rows: 3 }),
            button({ label: "Reserve Table", style: "primary" }),
          ],
        }),
      ],
    }),

    page("about", {
      title: "Our Story",
      icon: "▣",
      content: [
        markdown("Founded in 2018 by Chef Maria Santos, The Golden Fork brings the freshest seasonal ingredients from local farms to your plate."),
        divider(),
        quote("One of the most exciting farm-to-table experiences in the city.", "— City Food Magazine"),
        quote("Chef Santos has created something truly special.", "— The Dining Gazette"),
      ],
    }),

    page("visit", {
      title: "Hours & Location",
      icon: "▸",
      content: [
        table(["Day", "Lunch", "Dinner"], [
          ["Monday", "Closed", "Closed"],
          ["Tue — Thu", "11:30 AM — 2:30 PM", "5:30 PM — 10:00 PM"],
          ["Fri — Sat", "11:30 AM — 3:00 PM", "5:30 PM — 11:00 PM"],
          ["Sunday", "10:00 AM — 3:00 PM", "5:00 PM — 9:00 PM"],
        ]),
        spacer(),
        markdown("**Address:** 742 Evergreen Terrace, San Francisco, CA 94102"),
        markdown("**Phone:** (415) 555-0187"),
        spacer(),
        link("Make a Reservation", "https://opentable.com/golden-fork"),
        link("Google Maps", "https://maps.google.com"),
        link("Instagram", "https://instagram.com/thegoldenfork"),
      ],
    }),
  ],
});
```

---

## Common Mistakes to Avoid

1. **Missing `page()` wrapper.** Always use `page("id", { ... })`, not raw objects. The first argument is the page ID.

2. **Wrong font name casing.** Font names are case-sensitive: `"ANSI Shadow"` not `"ansi shadow"`, `"Calvin S"` not `"Calvin s"`.

3. **Using `content: markdown("text")` instead of `content: [markdown("text")]`.** Content is always an array of blocks.

4. **Forgetting `type: "module"` in package.json.** terminaltui uses ES modules. Your package.json must include `"type": "module"`.

5. **Not returning ActionResult from form onSubmit.** Must return `{ success: "..." }`, `{ error: "..." }`, or `{ info: "..." }`.

6. **Putting inputs outside a form and expecting submission.** Standalone inputs work for onChange reactivity, but for submit behavior wrap them in `form()`.

7. **Using `.length` instead of `stringWidth()` for terminal display width.** Unicode characters (CJK, emoji, box-drawing) have different display widths. Import `stringWidth` from terminaltui.

8. **Gradient arrays with one color.** Gradients need at least 2 colors: `gradient: ["#ff0000", "#0000ff"]`.

9. **Async content without loading state.** When using `() => Promise<ContentBlock[]>` for page content or `asyncContent()`, always provide a `loading` message.

10. **Not handling errors in async pages.** Provide `onError` on pages with async content to show a fallback instead of crashing.

11. **Calling `navigate()` before runtime init.** Only call `navigate()` from event handlers, middleware, or lifecycle hooks — not at the top level of the file.

12. **Missing `id` on input components.** Every input (textInput, select, checkbox, etc.) must have a unique `id` for form data collection.

13. **Forgetting `onChange` on interactive inputs.** If you want real-time reactivity from a select, checkbox, toggle, or radioGroup, you must pass an `onChange` handler.

14. **Using truecolor hex in Apple Terminal.** Apple Terminal does not support truecolor ANSI. terminaltui auto-detects and falls back to 256-color mode, but custom render functions using raw ANSI codes should use `fgColor()`/`bgColor()` from terminaltui which handle this automatically.

15. **Using `timeline()` for browsable content.** `timeline()` renders as individual focusable items but they're display-only — Enter does nothing. If users need to interact with entries (open URLs, see details), use individual `card()` blocks instead.

16. **Using `tabs()` to organize page sections.** `tabs()` forces horizontal left/right switching which is awkward in a TUI. Use `divider("Section Name")` to visually separate sections — everything stays in one vertical scroll flow.

17. **Putting everything inside `section()`.** `section()` adds a header + divider but doesn't change focusability. If you just need a visual label, `divider("Label")` is lighter and doesn't add nesting.

18. **Forgetting the TUI is vertical-first.** Always ask: "can the user reach this content by pressing ↓ repeatedly?" If the answer is no (e.g., content hidden behind a tab or inside a non-focusable block), restructure to be vertically scrollable.
