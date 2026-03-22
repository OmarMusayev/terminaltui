# terminaltui — Claude Skill Reference

## Overview

**terminaltui** is a framework that turns any website into a fully interactive terminal (TUI) experience. Users define their site in a single `site.config.ts` file using a declarative API of builder functions. The result is an interactive terminal app — navigable with keyboard — that can be published to npm so anyone can run it with `npx`.

### What it produces

A `site.config.ts` file that default-exports a `Site` object created by `defineSite()`. This config describes the entire site: name, banner, theme, pages, content blocks, animations, and navigation.

### How users run it

```bash
# Scaffold a new project
npx terminaltui init [template]

# Start dev preview (compiles and runs the TUI)
npx terminaltui dev

# Bundle for npm publish
npx terminaltui build

# Users install the published package and run:
npx my-cool-site
```

### File structure of a terminaltui project

```
my-site/
  site.config.ts    # <-- the only file you edit
  package.json      # must have "type": "module"
  tsconfig.json
```

### Minimal valid config

```ts
import { defineSite, page, markdown } from "terminaltui";

export default defineSite({
  name: "My Site",
  pages: [
    page("home", {
      title: "Home",
      content: [
        markdown("Hello world!"),
      ],
    }),
  ],
});
```

---

## Full API Reference

Every function below is imported from `"terminaltui"`.

### `defineSite(config: SiteConfig): Site`

Top-level site definition. Must be the default export of `site.config.ts`.

```ts
import { defineSite, page, markdown, ascii, themes } from "terminaltui";

export default defineSite({
  name: "My Site",
  handle: "@myhandle",
  tagline: "a cool terminal site",
  banner: ascii("My Site", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.dracula,
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "Goodbye!" },
  pages: [ /* ... */ ],
});
```

**Parameters (SiteConfig):**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Site name (shown if no banner) |
| `handle` | `string` | No | Handle/username shown on home page (e.g. `"@username"`) |
| `tagline` | `string` | No | Subtitle shown below the banner |
| `banner` | `BannerConfig` | No | ASCII art banner config (use `ascii()` helper) |
| `theme` | `Theme \| BuiltinThemeName` | No | Theme object or name string. Defaults to `"dracula"` |
| `borders` | `BorderStyle` | No | Border style for cards/tables. Default `"rounded"` |
| `animations` | `AnimationConfig` | No | Boot, transitions, exit animation config |
| `navigation` | `NavigationConfig` | No | Navigation behavior options |
| `pages` | `PageConfig[]` | Yes | Array of pages (use `page()` helper) |
| `easterEggs` | `EasterEggConfig` | No | Konami code and custom commands |
| `footer` | `string \| ContentBlock` | No | Footer content |
| `statusBar` | `boolean \| StatusBarConfig` | No | Status bar configuration |

---

### `page(id: string, config): PageConfig`

Creates a page. Each page appears as a menu item on the home screen.

```ts
page("about", {
  title: "About Me",
  icon: "◆",
  content: [
    markdown("Hello! I'm a developer."),
  ],
})
```

**Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique page identifier (first arg) |
| `title` | `string` | Yes | Display name in the menu |
| `icon` | `string` | No | Single character/emoji shown before the title |
| `content` | `ContentBlock[]` | Yes | Array of content blocks |

**Common icons:** `"◆"` `"◈"` `"▣"` `"▤"` `"◉"` `"▸"` `"✦"` `"★"` `"●"` `"■"` `"▲"` `"♦"`

---

### Content Helpers

#### `section(title: string, content: ContentBlock[]): SectionBlock`

Groups content under a titled section header with a divider line.

```ts
section("Starters", [
  card({ title: "Bruschetta", subtitle: "$12", body: "Toasted bread with tomatoes" }),
  card({ title: "Soup du Jour", subtitle: "$9", body: "Ask your server" }),
])
```

#### `card(config): CardBlock`

A bordered card with title, optional subtitle, body text, tags, and URL.

```ts
card({
  title: "My Project",
  subtitle: "★ 200",
  body: "A brief description of this project.",
  tags: ["TypeScript", "Open Source"],
  url: "https://github.com/user/repo",
  border: "rounded",  // optional: "single" | "double" | "rounded" | "heavy" | "dashed" | "ascii" | "none"
})
```

**Parameters (Omit<CardBlock, "type">):**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Card heading |
| `subtitle` | `string` | No | Secondary text (price, star count, date, etc.) |
| `body` | `string` | No | Body text / description |
| `tags` | `string[]` | No | Tags shown as badges |
| `url` | `string` | No | URL opened when user presses Enter |
| `border` | `BorderStyle` | No | Override border style for this card |

#### `timeline(items: TimelineItem[]): TimelineBlock`

A vertical timeline with connected entries. Great for work history, changelog, education.

```ts
timeline([
  { title: "Senior Engineer", subtitle: "Acme Corp", period: "2023 — present", description: "Leading the platform team" },
  { title: "Software Engineer", subtitle: "Startup Inc", period: "2021 — 2023", description: "Full-stack development" },
  { title: "BS Computer Science", subtitle: "University", period: "2017 — 2021" },
])
```

**TimelineItem fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Entry heading |
| `subtitle` | `string` | No | Organization/company |
| `period` | `string` | No | Time range |
| `description` | `string` | No | Details |

#### `table(headers: string[], rows: string[][]): TableBlock`

A bordered data table.

```ts
table(
  ["Plan", "Price", "Features"],
  [
    ["Free", "$0/mo", "Basic features"],
    ["Pro", "$10/mo", "Everything + priority support"],
    ["Enterprise", "Custom", "Unlimited"],
  ]
)
```

#### `list(items: string[], style?): ListBlock`

A styled list of strings.

```ts
list(["First item", "Second item", "Third item"], "check")
```

**Style options:** `"bullet"` (default) | `"number"` | `"dash"` | `"check"` | `"arrow"`

#### `quote(text: string, attribution?: string): QuoteBlock`

A block quote with optional attribution.

```ts
quote("The best way to predict the future is to invent it.", "— Alan Kay")
```

#### `hero(config): HeroBlock`

A large hero section with title, subtitle, and call-to-action button.

```ts
hero({
  title: "Welcome to My Product",
  subtitle: "The fastest way to build terminal apps.",
  cta: { label: "Get Started →", url: "https://example.com/docs" },
  art: "optional-ascii-art-string",
})
```

**Parameters (Omit<HeroBlock, "type">):**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Large heading |
| `subtitle` | `string` | No | Description text |
| `cta` | `{ label: string; url: string }` | No | Call-to-action link |
| `art` | `string` | No | Custom ASCII art string |

#### `gallery(items): GalleryBlock`

A grid/gallery of cards. Items use the same shape as `card()` but without `type`.

```ts
gallery([
  { title: "Photo 1", body: "Description", tags: ["nature"] },
  { title: "Photo 2", body: "Description", tags: ["urban"] },
  { title: "Photo 3", body: "Description", tags: ["portrait"] },
])
```

#### `tabs(items): TabsBlock`

Tabbed content. Each tab has a label and nested content blocks.

```ts
tabs([
  { label: "Frontend", content: [
    list(["React", "Vue", "Svelte"], "check"),
  ]},
  { label: "Backend", content: [
    list(["Node.js", "Python", "Go"], "check"),
  ]},
])
```

#### `accordion(items): AccordionBlock`

Collapsible sections. Same shape as tabs. Great for FAQs.

```ts
accordion([
  { label: "What is terminaltui?", content: [
    markdown("A framework for building terminal websites."),
  ]},
  { label: "How do I deploy?", content: [
    markdown("Run `terminaltui build` then `npm publish`."),
  ]},
])
```

#### `link(label: string, url: string, options?): LinkBlock`

A clickable link. Opens in the user's browser when selected.

```ts
link("GitHub", "https://github.com/user")
link("Email", "mailto:hello@example.com", { icon: "✉" })
```

**Options:**

| Field | Type | Description |
|---|---|---|
| `icon` | `string` | Icon character shown before the label |

#### `skillBar(label: string, value: number): ProgressBarBlock`

A labeled skill/proficiency bar (0-100). Shorthand for `progressBar(label, value, 100)` with `showPercent: true`.

```ts
skillBar("TypeScript", 90)
skillBar("Rust", 75)
skillBar("Python", 85)
```

#### `progressBar(label: string, value: number, max?: number): ProgressBarBlock`

A generic progress bar.

```ts
progressBar("Project Alpha", 7, 10)
progressBar("Completion", 65)  // max defaults to 100
```

#### `badge(text: string, color?: string): BadgeBlock`

An inline badge/tag.

```ts
badge("v2.0")
badge("NEW", "#50fa7b")
```

**Parameters:**

| Field | Type | Description |
|---|---|---|
| `text` | `string` | Badge text |
| `color` | `string` | Optional hex color |

#### `image(path: string, options?): ImageBlock`

Renders an image in the terminal using ASCII/braille/block art.

```ts
image("./logo.png")
image("./photo.jpg", { width: 60, mode: "braille" })
```

**Options:**

| Field | Type | Description |
|---|---|---|
| `width` | `number` | Render width in columns |
| `mode` | `"ascii" \| "braille" \| "blocks"` | Rendering mode |

---

### Visual Helpers

#### `ascii(text: string, options?): BannerConfig`

Creates an ASCII art banner config for the `banner` field of `defineSite()`.

```ts
ascii("MY SITE", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] })
```

**Options (AsciiBannerOptions):**

| Field | Type | Description |
|---|---|---|
| `font` | `string` | Font name. See Font Selection Guide below |
| `gradient` | `string[]` | Array of hex colors for gradient effect |
| `align` | `"left" \| "center" \| "right"` | Text alignment |
| `padding` | `number` | Padding around the banner |

#### `markdown(text: string): TextBlock`

Renders text with basic markdown formatting (bold, italic, inline code).

```ts
markdown("This is **bold** and *italic* with `code`.")
```

#### `gradient(text: string, colors: string[]): TextBlock`

Creates gradient-colored text.

```ts
gradient("Rainbow text!", ["#ff0000", "#00ff00", "#0000ff"])
```

#### `sparkline(data: number[]): ContentBlock`

A mini sparkline chart from numeric data, rendered with Unicode block characters.

```ts
sparkline([1, 5, 3, 8, 2, 7, 4, 9, 6])
```

#### `divider(style?, label?): DividerBlock`

A horizontal divider line.

```ts
divider()                    // default solid
divider("dashed")            // dashed line
divider("dotted")            // dotted line
divider("double")            // double line
divider("My Section")        // labeled divider (shorthand: if first arg is not a known style, it becomes a label)
divider("label", "Section")  // explicit label style
```

**Style options:** `"solid"` | `"dashed"` | `"dotted"` | `"double"` | `"label"`

#### `spacer(lines?: number): SpacerBlock`

Vertical whitespace. Defaults to 1 line.

```ts
spacer()     // 1 blank line
spacer(3)    // 3 blank lines
```

---

### `themes` Object

A record of all 10 built-in themes. Use as `themes.themeName`.

```ts
import { themes } from "terminaltui";

// Use by reference:
theme: themes.dracula

// Or use as a string name:
theme: "dracula"
```

**Available themes:** `cyberpunk`, `dracula`, `nord`, `monokai`, `solarized`, `gruvbox`, `catppuccin`, `tokyoNight`, `rosePine`, `hacker`

You can also provide a custom theme object conforming to the `Theme` interface (see Type Reference).

---

## Type Reference

### `SiteConfig`

```ts
interface SiteConfig {
  name: string;
  handle?: string;
  tagline?: string;
  banner?: BannerConfig;
  theme?: Theme | BuiltinThemeName;
  borders?: BorderStyle;
  animations?: AnimationConfig;
  navigation?: NavigationConfig;
  pages: PageConfig[];
  easterEggs?: EasterEggConfig;
  footer?: string | ContentBlock;
  statusBar?: boolean | StatusBarConfig;
}
```

### `PageConfig`

```ts
interface PageConfig {
  id: string;
  title: string;
  icon?: string;
  content: ContentBlock[];
}
```

### `ContentBlock`

Union type of all block types:

```ts
type ContentBlock =
  | TextBlock | CardBlock | TimelineBlock | TableBlock
  | ListBlock | QuoteBlock | HeroBlock | GalleryBlock
  | TabsBlock | AccordionBlock | LinkBlock | ProgressBarBlock
  | BadgeBlock | ImageBlock | DividerBlock | SpacerBlock
  | SectionBlock | CustomBlock;
```

### `CardBlock`

```ts
interface CardBlock {
  type: "card";
  title: string;
  subtitle?: string;
  body?: string;
  tags?: string[];
  url?: string;
  border?: BorderStyle;
}
```

### `TimelineItem`

```ts
interface TimelineItem {
  title: string;
  subtitle?: string;
  period?: string;
  description?: string;
}
```

### `HeroBlock`

```ts
interface HeroBlock {
  type: "hero";
  title: string;
  subtitle?: string;
  cta?: { label: string; url: string };
  art?: string;
}
```

### `Theme`

```ts
interface Theme {
  accent: string;       // Primary accent color (hex)
  accentDim: string;    // Dimmed accent
  text: string;         // Primary text color
  muted: string;        // Muted/secondary text
  subtle: string;       // Subtle elements, backgrounds
  success: string;      // Success color (green)
  warning: string;      // Warning color (yellow)
  error: string;        // Error color (red)
  border: string;       // Border color
  bg?: string;          // Background color
}
```

### `BannerConfig`

```ts
interface BannerConfig {
  text: string;
  font?: string;
  gradient?: string[];
  align?: "left" | "center" | "right";
  padding?: number;
}
```

### `AnimationConfig`

```ts
interface AnimationConfig {
  boot?: boolean;                              // Enable boot animation
  transitions?: "instant" | "fade" | "slide" | "wipe";  // Page transition style
  exitMessage?: string;                        // Message shown on quit
  speed?: "slow" | "normal" | "fast";          // Animation speed
}
```

### `BorderStyle`

```ts
type BorderStyle = "single" | "double" | "rounded" | "heavy" | "dashed" | "ascii" | "none";
```

### `NavigationConfig`

```ts
interface NavigationConfig {
  numberJump?: boolean;    // Press 1-9 to jump to page
  vim?: boolean;           // vim-style j/k navigation
  commandMode?: boolean;   // : to enter command mode
}
```

### `EasterEggConfig`

```ts
interface EasterEggConfig {
  konami?: boolean | string;                        // Enable Konami code easter egg
  commands?: Record<string, string | (() => void)>; // Custom : commands
}
```

### `StatusBarConfig`

```ts
interface StatusBarConfig {
  show?: boolean;
  showPageName?: boolean;
  showHints?: boolean;
}
```

---

## Content Mapping Guide

Use this to decide which terminaltui components to use for different types of web content.

| Web Content | terminaltui Component |
|---|---|
| Navigation / menu | Becomes `pages` array automatically |
| Hero / banner section | `hero()` |
| Cards / grid of items | `card()` individually or `gallery()` for a grid |
| Pricing tables | `table()` |
| Testimonials / reviews | `quote()` per testimonial |
| Work history / changelog | `timeline()` |
| FAQ / collapsible sections | `accordion()` |
| Tabbed content | `tabs()` |
| Blog post list | `card()` per post (subtitle = date, body = excerpt) |
| Contact / social links | `link()` per item |
| Stats / metrics / skills | `skillBar()` or `progressBar()` |
| Features list | `card()` per feature, or `list()` for simple lists |
| Menu items (restaurant) | `section()` with `card()` items (subtitle = price) |
| Album / discography | `card()` per album (subtitle = year, tags = genres) |
| Tour dates / events | `card()` per event (subtitle = date, body = venue) |
| Documentation / prose | `markdown()` |
| Code snippets | `markdown()` with backtick blocks |
| Image / logo | `image()` |
| Data / comparison | `table()` |
| Step-by-step instructions | `list()` with `"number"` style |
| Tags / status labels | `badge()` |
| Visual separation | `divider()` |
| Vertical spacing | `spacer()` |
| Grouped content | `section()` |
| Metrics over time | `sparkline()` |
| Custom rendering | `CustomBlock` with `render` function |

---

## Theme Selection Guide

Choose a theme based on the personality and industry of the site.

| Theme | Best For | Personality |
|---|---|---|
| `cyberpunk` | Tech startups, gaming, futuristic products | Neon, electric, high-energy |
| `dracula` | Developer tools, general purpose | Classic dark theme, versatile (default) |
| `nord` | Corporate, professional, SaaS | Clean, minimal, trustworthy |
| `monokai` | Coding tools, developer portfolios | Familiar to developers, code-editor feel |
| `solarized` | Academic, documentation, research | Scholarly, readable, precise |
| `gruvbox` | Restaurants, cafes, crafts, warm brands | Earthy, warm, retro, approachable |
| `catppuccin` | Creative agencies, design portfolios, soft brands | Soft, pastel, modern, friendly |
| `tokyoNight` | Modern SaaS, product pages, startups | Sleek, contemporary, polished |
| `rosePine` | Music, art, creative portfolios, personal blogs | Artistic, dreamy, elegant |
| `hacker` | Security, CTF, terminal-native tools, infosec | Green-on-black, raw, Matrix-style |

### Custom themes

You can pass a custom `Theme` object instead of using a built-in name:

```ts
theme: {
  accent: "#e06c75",
  accentDim: "#be5046",
  text: "#abb2bf",
  muted: "#5c6370",
  subtle: "#3e4452",
  success: "#98c379",
  warning: "#e5c07b",
  error: "#e06c75",
  border: "#5c6370",
  bg: "#282c34",
}
```

---

## Font Selection Guide

The `font` option in `ascii()` controls the ASCII banner font. Five built-in fonts are available.

| Font | Height | Best For | Look |
|---|---|---|---|
| `"ANSI Shadow"` | 6 lines | Default, modern sites | Clean block letters with shadow effect |
| `"Slant"` | 6 lines | Elegant, creative sites | Classic italic/slanted style |
| `"Calvin S"` | 4 lines | Professional, compact | Clean thin letters, saves space |
| `"Small"` | 4 lines | Space-constrained, blogs | Tiny but readable |
| `"Ogre"` | 5 lines | Fun, casual, restaurants | Chunky, playful, bold |

### Font examples

```ts
// Modern tech site
banner: ascii("ACME", { font: "ANSI Shadow" })

// Elegant portfolio
banner: ascii("Jane Doe", { font: "Slant", gradient: ["#ebbcba", "#c4a7e7"] })

// Professional / corporate
banner: ascii("CorpName", { font: "Calvin S" })

// Blog with limited space
banner: ascii("My Blog", { font: "Small" })

// Fun restaurant
banner: ascii("Bistro", { font: "Ogre", gradient: ["#d4a373", "#e63946"] })
```

**Important:** Font names are case-sensitive. Use exactly: `"ANSI Shadow"`, `"Slant"`, `"Calvin S"`, `"Small"`, `"Ogre"`.

---

## Animation Guide

### Boot animation

When `boot: true`, the banner reveals progressively and menu items stagger in.

```ts
animations: {
  boot: true,
}
```

### Transitions

Controls the animation when switching between pages.

```ts
animations: {
  transitions: "fade",   // "instant" | "fade" | "slide" | "wipe"
}
```

| Transition | Effect |
|---|---|
| `"instant"` | No animation, immediate switch |
| `"fade"` | Fade in/out |
| `"slide"` | Slide from side |
| `"wipe"` | Wipe across screen |

### Exit message

A centered message shown briefly when the user quits.

```ts
animations: {
  exitMessage: "Thanks for visiting!",
}
```

### Speed

Controls overall animation speed.

```ts
animations: {
  speed: "fast",  // "slow" | "normal" | "fast"
}
```

### Full animation config example

```ts
animations: {
  boot: true,
  transitions: "fade",
  exitMessage: "[ end of transmission ]",
  speed: "normal",
}
```

---

## Common Patterns by Site Type

### Portfolio

```ts
pages: [
  page("about",      { title: "About",      icon: "◆", content: [ markdown("...") ] }),
  page("projects",   { title: "Projects",   icon: "◈", content: [ card({...}), card({...}) ] }),
  page("experience", { title: "Experience", icon: "▣", content: [ timeline([...]) ] }),
  page("skills",     { title: "Skills",     icon: "▤", content: [ skillBar("...", 90), ... ] }),
  page("links",      { title: "Links",      icon: "◉", content: [ link("...", "..."), ... ] }),
]
```

Theme: `dracula`, `monokai`, `tokyoNight`, or `catppuccin`
Font: `"ANSI Shadow"` or `"Slant"`

### Restaurant

```ts
pages: [
  page("menu",    { title: "Menu",             icon: "◆", content: [
    section("Appetizers", [ card({title: "...", subtitle: "$12", body: "..."}) ]),
    divider(),
    section("Entrees",    [ card({title: "...", subtitle: "$28", body: "..."}) ]),
  ]}),
  page("about",   { title: "Our Story",        icon: "◈", content: [ markdown("..."), quote("...", "— Critic") ] }),
  page("hours",   { title: "Hours & Location", icon: "▣", content: [ table(["Day", "Hours"], [...]) ] }),
  page("contact", { title: "Contact",          icon: "◉", content: [ link("...", "...") ] }),
]
```

Theme: `gruvbox`
Font: `"Ogre"`

### Landing Page / SaaS

```ts
pages: [
  page("home",     { title: "Home",       icon: "◆", content: [ hero({title: "...", subtitle: "...", cta: {...}}) ] }),
  page("features", { title: "Features",   icon: "◈", content: [ card({...}), card({...}), card({...}) ] }),
  page("pricing",  { title: "Pricing",    icon: "▣", content: [ table(["Plan", "Price", "Features"], [...]) ] }),
  page("docs",     { title: "Quick Start",icon: "▸", content: [ list([...], "number"), link("Docs", "...") ] }),
]
```

Theme: `tokyoNight`, `cyberpunk`, or `nord`
Font: `"ANSI Shadow"`

### Band / Musician

```ts
pages: [
  page("music",   { title: "Music",       icon: "♦", content: [
    card({title: "Album Name", subtitle: "2025", body: "Description", tags: ["Rock", "Indie"]}),
  ]}),
  page("tour",    { title: "Tour Dates",  icon: "◆", content: [
    card({title: "City, Venue", subtitle: "Mar 15, 2026", body: "Doors 7pm, Show 8pm"}),
  ]}),
  page("about",   { title: "About",       icon: "◈", content: [ markdown("...") ] }),
  page("links",   { title: "Listen",      icon: "◉", content: [
    link("Spotify", "..."), link("Apple Music", "..."), link("Bandcamp", "..."),
  ]}),
]
```

Theme: `rosePine` or `cyberpunk`
Font: `"Slant"`

### Blog

```ts
pages: [
  page("posts", { title: "Posts",  icon: "◆", content: [
    card({title: "Post Title", subtitle: "Mar 2026", body: "Excerpt..."}),
    card({title: "Another Post", subtitle: "Feb 2026", body: "Excerpt..."}),
  ]}),
  page("about", { title: "About",  icon: "◈", content: [ markdown("...") ] }),
  page("links", { title: "Links",  icon: "◉", content: [ link("RSS", "..."), link("Twitter", "...") ] }),
]
```

Theme: `rosePine`, `catppuccin`, or `solarized`
Font: `"Small"` or `"Calvin S"`

### Corporate / Agency

```ts
pages: [
  page("services", { title: "Services", icon: "◆", content: [ card({...}), card({...}) ] }),
  page("team",     { title: "Team",     icon: "◈", content: [ gallery([{title: "Name", subtitle: "Role"}, ...]) ] }),
  page("clients",  { title: "Clients",  icon: "▣", content: [ quote("...", "— Client"), quote("...", "— Client") ] }),
  page("contact",  { title: "Contact",  icon: "◉", content: [ link("...", "..."), ... ] }),
]
```

Theme: `nord` or `tokyoNight`
Font: `"Calvin S"` or `"ANSI Shadow"`

### Event Page

```ts
pages: [
  page("info",     { title: "Info",     icon: "◆", content: [ hero({title: "Event Name", subtitle: "Date & Location"}) ] }),
  page("schedule", { title: "Schedule", icon: "◈", content: [
    timeline([
      {title: "Registration", period: "9:00 AM"},
      {title: "Keynote", period: "10:00 AM", description: "Speaker Name"},
      {title: "Workshops", period: "1:00 PM"},
    ]),
  ]}),
  page("speakers", { title: "Speakers", icon: "▣", content: [ card({...}), card({...}) ] }),
  page("register", { title: "Register", icon: "◉", content: [ link("Get Tickets", "https://...") ] }),
]
```

Theme: `cyberpunk` or `tokyoNight`
Font: `"ANSI Shadow"`

---

## Complete Example Configs

### Example 1: Developer Portfolio

```ts
import {
  defineSite, page, card, timeline, link, skillBar,
  ascii, markdown, themes, divider, spacer, badge,
} from "terminaltui";

export default defineSite({
  name: "Alex Chen",
  handle: "@alexchen",
  tagline: "full-stack engineer & open source contributor",
  banner: ascii("Alex Chen", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.dracula,
  animations: { boot: true, transitions: "fade", exitMessage: "See you in the terminal!" },

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown("Hey! I'm Alex, a full-stack engineer based in San Francisco. I build developer tools and contribute to open source. Currently working on distributed systems at **Acme Corp**."),
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
          body: "A suite of terminal utilities for modern developers. Built with Rust for blazing performance.",
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
        timeline([
          {
            title: "Senior Platform Engineer",
            subtitle: "Acme Corp",
            period: "2023 — present",
            description: "Leading the developer platform team. Building internal tooling and CI/CD infrastructure.",
          },
          {
            title: "Software Engineer",
            subtitle: "Startup Labs",
            period: "2021 — 2023",
            description: "Full-stack development on the core product. Grew the user base from 1k to 50k.",
          },
          {
            title: "Junior Developer",
            subtitle: "WebAgency",
            period: "2019 — 2021",
            description: "Frontend development, client projects, and learning the ropes.",
          },
          {
            title: "BS Computer Science",
            subtitle: "UC Berkeley",
            period: "2015 — 2019",
          },
        ]),
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
        skillBar("PostgreSQL", 75),
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

### Example 2: Restaurant

```ts
import {
  defineSite, page, section, card, table, quote,
  link, markdown, ascii, themes, divider, spacer,
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
          card({ title: "Heirloom Tomato Bruschetta", subtitle: "$14", body: "San Marzano tomatoes, fresh basil, aged balsamic, sourdough crostini" }),
          card({ title: "Burrata & Figs", subtitle: "$16", body: "Creamy burrata, mission figs, honey, toasted pistachios, arugula" }),
          card({ title: "Charred Octopus", subtitle: "$18", body: "Spanish octopus, romesco, fingerling potatoes, smoked paprika oil" }),
        ]),
        divider(),
        section("Mains", [
          card({ title: "Pan-Seared Salmon", subtitle: "$32", body: "Wild-caught king salmon, lemon beurre blanc, asparagus, dill" }),
          card({ title: "Dry-Aged Ribeye", subtitle: "$45", body: "28-day aged, 14oz, bone marrow butter, roasted root vegetables" }),
          card({ title: "Wild Mushroom Risotto", subtitle: "$26", body: "Arborio rice, porcini, chanterelle, truffle oil, Parmigiano-Reggiano" }),
          card({ title: "Roasted Half Chicken", subtitle: "$28", body: "Free-range, herbs de Provence, garlic confit, seasonal greens" }),
        ]),
        divider(),
        section("Desserts", [
          card({ title: "Crème Brûlée", subtitle: "$12", body: "Classic vanilla bean, caramelized sugar" }),
          card({ title: "Chocolate Fondant", subtitle: "$14", body: "Valrhona dark chocolate, salted caramel, vanilla gelato" }),
        ]),
      ],
    }),

    page("drinks", {
      title: "Wine & Drinks",
      icon: "◈",
      content: [
        section("Red Wine", [
          card({ title: "Château Margaux 2015", subtitle: "$28/glass" }),
          card({ title: "Barolo, Piedmont 2018", subtitle: "$22/glass" }),
        ]),
        divider(),
        section("White Wine", [
          card({ title: "Chablis Premier Cru 2020", subtitle: "$18/glass" }),
          card({ title: "Sancerre, Loire Valley 2021", subtitle: "$16/glass" }),
        ]),
        divider(),
        section("Cocktails", [
          card({ title: "The Golden Negroni", subtitle: "$16", body: "Gin, Aperol, white vermouth, gold leaf" }),
          card({ title: "Smoked Old Fashioned", subtitle: "$18", body: "Bourbon, demerara, Angostura, applewood smoke" }),
        ]),
      ],
    }),

    page("about", {
      title: "Our Story",
      icon: "▣",
      content: [
        markdown("Founded in 2018 by Chef Maria Santos, The Golden Fork is dedicated to bringing the freshest seasonal ingredients from local farms to your plate. Every dish tells the story of the land it came from."),
        spacer(),
        markdown("We partner with over 20 local farms and producers within a 50-mile radius. Our menu changes with the seasons, reflecting what the earth gives us."),
        divider(),
        quote("One of the most exciting farm-to-table experiences in the city. Every bite is intentional.", "— City Food Magazine"),
        quote("Chef Santos has created something truly special. A must-visit.", "— The Dining Gazette"),
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
        link("Email", "mailto:hello@thegoldenfork.com"),
      ],
    }),
  ],
});
```

### Example 3: SaaS Landing Page

```ts
import {
  defineSite, page, hero, card, table, link,
  list, badge, ascii, themes, markdown, divider,
  tabs, accordion, spacer, sparkline, progressBar,
} from "terminaltui";

export default defineSite({
  name: "Launchpad",
  tagline: "deploy anywhere in seconds",
  banner: ascii("Launchpad", { font: "ANSI Shadow", gradient: ["#7c3aed", "#06b6d4"] }),
  theme: themes.tokyoNight,
  animations: { boot: true, transitions: "slide", exitMessage: "Happy deploying!" },

  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        hero({
          title: "Ship Faster Than Ever",
          subtitle: "One command to deploy your app to any cloud. No config files, no YAML, no pain.",
          cta: { label: "Get Started Free →", url: "https://launchpad.dev/signup" },
        }),
        spacer(),
        sparkline([2, 5, 8, 12, 18, 25, 34, 45, 60, 78, 95, 120]),
        markdown("*Monthly deployments (thousands) — growing fast*"),
      ],
    }),

    page("features", {
      title: "Features",
      icon: "◈",
      content: [
        card({
          title: "Zero-Config Deploys",
          body: "Just run `launch deploy`. We detect your framework, build, and ship. Works with Next.js, Remix, Astro, SvelteKit, and more.",
          tags: ["Core"],
        }),
        card({
          title: "Edge Functions",
          body: "Run serverless functions at the edge in 40+ regions. Sub-10ms cold starts.",
          tags: ["Performance"],
        }),
        card({
          title: "Preview Environments",
          body: "Every pull request gets its own URL. Share with your team, get feedback, merge with confidence.",
          tags: ["Collaboration"],
        }),
        card({
          title: "Built-in Analytics",
          body: "Real-time performance metrics, error tracking, and usage analytics. No third-party scripts needed.",
          tags: ["Observability"],
        }),
        card({
          title: "Team Management",
          body: "Role-based access, audit logs, SSO. Everything your team needs to ship together.",
          tags: ["Enterprise"],
        }),
      ],
    }),

    page("pricing", {
      title: "Pricing",
      icon: "▣",
      content: [
        table(
          ["", "Hobby", "Pro", "Enterprise"],
          [
            ["Price", "Free", "$20/mo", "Custom"],
            ["Deployments", "100/mo", "Unlimited", "Unlimited"],
            ["Bandwidth", "10 GB", "1 TB", "Unlimited"],
            ["Team members", "1", "10", "Unlimited"],
            ["Edge functions", "10", "Unlimited", "Unlimited"],
            ["Support", "Community", "Email", "Dedicated"],
            ["SLA", "—", "99.9%", "99.99%"],
          ]
        ),
        spacer(),
        link("Start Free →", "https://launchpad.dev/signup"),
      ],
    }),

    page("docs", {
      title: "Quick Start",
      icon: "▸",
      content: [
        list([
          "Install the CLI: npm install -g @launchpad/cli",
          "Navigate to your project directory",
          "Run: launch deploy",
          "Your app is live! Visit the generated URL.",
        ], "number"),
        divider(),
        tabs([
          { label: "Next.js", content: [
            markdown("```\nnpx create-next-app my-app\ncd my-app\nlaunch deploy\n```"),
          ]},
          { label: "Remix", content: [
            markdown("```\nnpx create-remix my-app\ncd my-app\nlaunch deploy\n```"),
          ]},
          { label: "Astro", content: [
            markdown("```\nnpm create astro@latest\ncd my-app\nlaunch deploy\n```"),
          ]},
        ]),
        spacer(),
        link("Full Documentation →", "https://docs.launchpad.dev"),
        link("API Reference →", "https://docs.launchpad.dev/api"),
      ],
    }),

    page("faq", {
      title: "FAQ",
      icon: "★",
      content: [
        accordion([
          { label: "Is there a free tier?", content: [
            markdown("Yes! The Hobby plan is free forever with generous limits."),
          ]},
          { label: "Can I bring my own domain?", content: [
            markdown("Absolutely. Custom domains with automatic SSL are included on all plans."),
          ]},
          { label: "Do you support monorepos?", content: [
            markdown("Yes. We detect and build individual packages within monorepos automatically."),
          ]},
          { label: "What about databases?", content: [
            markdown("We offer managed Postgres, Redis, and S3-compatible storage. Connect with one command."),
          ]},
        ]),
      ],
    }),
  ],
});
```

### Example 4: Band / Musician Page

```ts
import {
  defineSite, page, card, link, markdown,
  ascii, themes, divider, spacer, quote, gallery,
} from "terminaltui";

export default defineSite({
  name: "Neon Dusk",
  tagline: "synthwave / electronic / dream pop",
  banner: ascii("Neon Dusk", { font: "Slant", gradient: ["#ff2a6d", "#05d9e8", "#ff2a6d"] }),
  theme: themes.rosePine,
  animations: { boot: true, transitions: "wipe", exitMessage: "🎵 keep listening" },

  pages: [
    page("music", {
      title: "Discography",
      icon: "♦",
      content: [
        card({
          title: "Chromatic Dreams",
          subtitle: "2026 — LP",
          body: "Our latest album. 12 tracks exploring the space between memory and imagination. Produced with analog synths and modern production.",
          tags: ["Synthwave", "Dream Pop", "New"],
          url: "https://open.spotify.com/album/chromatic-dreams",
        }),
        card({
          title: "Midnight Signal",
          subtitle: "2024 — LP",
          body: "The sophomore record. Darker, more atmospheric. Features collaborations with Dreamcatcher and LMNO.",
          tags: ["Electronic", "Ambient"],
          url: "https://open.spotify.com/album/midnight-signal",
        }),
        card({
          title: "First Light",
          subtitle: "2022 — EP",
          body: "Where it all started. 5 tracks of raw synthwave energy.",
          tags: ["Synthwave"],
          url: "https://open.spotify.com/album/first-light",
        }),
      ],
    }),

    page("tour", {
      title: "Tour Dates",
      icon: "◆",
      content: [
        card({ title: "Los Angeles, CA", subtitle: "Apr 5, 2026", body: "The Fonda Theatre — Doors 7pm, Show 8pm", tags: ["On Sale"] }),
        card({ title: "San Francisco, CA", subtitle: "Apr 7, 2026", body: "The Independent — Doors 7pm, Show 8:30pm", tags: ["On Sale"] }),
        card({ title: "Portland, OR", subtitle: "Apr 9, 2026", body: "Wonder Ballroom — Doors 7pm, Show 8pm", tags: ["On Sale"] }),
        card({ title: "Seattle, WA", subtitle: "Apr 11, 2026", body: "Neumos — Doors 7pm, Show 8pm", tags: ["Sold Out"] }),
        card({ title: "Vancouver, BC", subtitle: "Apr 13, 2026", body: "Commodore Ballroom — Doors 7pm, Show 8pm", tags: ["On Sale"] }),
        divider(),
        link("Buy Tickets", "https://neondusk.com/tickets"),
      ],
    }),

    page("about", {
      title: "About",
      icon: "◈",
      content: [
        markdown("**Neon Dusk** is a three-piece electronic act from Los Angeles. Formed in 2021, we blend synthwave, dream pop, and ambient textures into something we call \"terminal music\" — music for the space between waking and dreaming."),
        spacer(),
        markdown("**Members:**"),
        markdown("- **Kai** — synths, production\n- **Luna** — vocals, keys\n- **Zero** — drums, electronics"),
        divider(),
        quote("Neon Dusk creates soundscapes that feel like driving through a neon-lit city at 3am.", "— Synth Magazine"),
        quote("One of the most exciting new acts in electronic music.", "— Pitchfork"),
      ],
    }),

    page("listen", {
      title: "Listen",
      icon: "◉",
      content: [
        link("Spotify", "https://open.spotify.com/artist/neondusk"),
        link("Apple Music", "https://music.apple.com/artist/neondusk"),
        link("Bandcamp", "https://neondusk.bandcamp.com"),
        link("YouTube", "https://youtube.com/@neondusk"),
        link("SoundCloud", "https://soundcloud.com/neondusk"),
        divider(),
        link("Instagram", "https://instagram.com/neondusk"),
        link("Twitter", "https://twitter.com/neondusk"),
        link("TikTok", "https://tiktok.com/@neondusk"),
        divider(),
        link("Press Kit", "https://neondusk.com/press"),
        link("Booking", "mailto:booking@neondusk.com"),
      ],
    }),
  ],
});
```

---

## Troubleshooting

### Common Mistakes

**1. Missing `type: "module"` in package.json**

The project's `package.json` MUST include `"type": "module"`. Without it, ESM imports will fail.

```json
{
  "type": "module"
}
```

**2. Content not wrapped in an array**

The `content` field of a page expects `ContentBlock[]` (an array). Every content helper returns a single block, so you must wrap them in `[]`.

```ts
// WRONG
page("about", {
  title: "About",
  content: markdown("Hello"),  // not an array!
})

// CORRECT
page("about", {
  title: "About",
  content: [
    markdown("Hello"),
  ],
})
```

**3. Forgetting to import functions**

Every helper must be imported from `"terminaltui"`. If you use `card()`, `timeline()`, `link()`, etc., they must appear in the import statement.

```ts
// WRONG — card is not imported
import { defineSite, page, markdown } from "terminaltui";
// ... card({...}) // ReferenceError!

// CORRECT
import { defineSite, page, markdown, card } from "terminaltui";
```

**4. Wrong theme name casing**

Theme names are camelCase. `"tokyoNight"` and `"rosePine"` have specific casing.

```ts
// WRONG
theme: themes.TokyoNight
theme: themes.tokyo_night
theme: "Tokyo Night"

// CORRECT
theme: themes.tokyoNight
theme: "tokyoNight"
```

**5. Using `themes.dracula` vs `"dracula"` string**

Both forms work. You can pass either the theme object or its name as a string.

```ts
// Both are valid:
theme: themes.dracula    // object reference
theme: "dracula"         // string name
```

**6. Banner text vs site name**

The `banner` field controls the ASCII art. The `name` field is the fallback if no banner is set. Always set both.

```ts
// Banner shows ASCII art of "ACME" but the site is named "Acme Corp"
name: "Acme Corp",
banner: ascii("ACME", { font: "ANSI Shadow" }),
```

**7. Font name must be exact**

Font names are strings and must match exactly: `"ANSI Shadow"`, `"Slant"`, `"Calvin S"`, `"Small"`, `"Ogre"`.

```ts
// WRONG
ascii("Hello", { font: "ansi shadow" })
ascii("Hello", { font: "ANSI_Shadow" })

// CORRECT
ascii("Hello", { font: "ANSI Shadow" })
```

**8. Card takes an object, not positional args**

```ts
// WRONG
card("Title", "Subtitle", "Body")

// CORRECT
card({ title: "Title", subtitle: "Subtitle", body: "Body" })
```

**9. Timeline takes an array of items**

```ts
// WRONG
timeline({ title: "Job", period: "2023" })

// CORRECT
timeline([
  { title: "Job", period: "2023" },
])
```

**10. Gallery items do NOT include `type`**

The `gallery()` helper adds `type: "card"` automatically. Pass items without it.

```ts
// WRONG
gallery([{ type: "card", title: "Item" }])

// CORRECT
gallery([{ title: "Item", body: "Description" }])
```

**11. Section content must also be an array**

```ts
// WRONG
section("Title", card({ title: "Item" }))

// CORRECT
section("Title", [
  card({ title: "Item" }),
])
```

**12. Tabs and accordion items need `content` arrays**

```ts
// WRONG
tabs([{ label: "Tab 1", content: markdown("text") }])

// CORRECT
tabs([{ label: "Tab 1", content: [markdown("text")] }])
```

**13. The config must be the default export**

```ts
// WRONG
export const site = defineSite({...});

// CORRECT
export default defineSite({...});
```

**14. Missing `esbuild` dependency**

The `terminaltui dev` and `terminaltui build` commands need `esbuild` to compile TypeScript. Install it as a dev dependency:

```bash
npm install --save-dev esbuild
```
