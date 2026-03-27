# Convert This Website to a Terminal UI

> **Building from scratch instead of converting?** Use `terminaltui create` for an interactive prompt builder that asks about your project and generates a tailored AI prompt.

You are converting an existing website into a fully interactive terminal-style UI using the **terminaltui** framework.

**IMPORTANT: Do NOT modify, delete, or overwrite any files in the original website project.** Create a new `tui/` subdirectory for the TUI version. All generated files go inside `tui/`. The original website must remain completely untouched.

## Step 1: Read the existing website FIRST (before creating anything)

Scan **all files** in the current directory to understand the website:
- HTML, JSX/TSX, MDX, markdown, templates
- CSS/styling for design cues (colors, fonts, mood)
- JavaScript/TypeScript for interactivity, API calls, data
- Config files (package.json, next.config, etc.)
- Image references, asset paths
- CMS data, JSON files, API endpoints
- Forms, contact info, interactive features

Build a complete picture of:
- **Site type:** portfolio, restaurant, SaaS, blog, band, agency, e-commerce, event, etc.
- **All pages:** home, about, menu, projects, contact, pricing, etc.
- **All content per page:** text, lists, images, quotes, pricing tables, timelines, forms, etc.
- **Tone/vibe:** professional, playful, dark, minimal, bold, retro, creative
- **Interactive features:** contact forms, search, filters, login, dynamic data

## Step 2: TUI Layout Philosophy

**Default to vertical scrolling with flat card layouts.** TUI navigation is fundamentally up/down arrow keys. Use `divider("Label")` to visually separate sections rather than nesting them inside `tabs()`. Use individual `card()` blocks for anything users need to browse — each card is separately focusable and scrollable.

**Use split-pane layouts for dashboard-style and complex sites.** When the original site has side-by-side content (pricing tiers, hours + location, food + drinks menus, monitoring metrics), use `columns()`, `split()`, or `grid()` instead of stacking everything vertically. Layouts make better use of terminal width and create a more professional look. Don't force layouts on every page — single-column is still best for timelines, forms, and narrative content. See `demos/server-dashboard/` for a comprehensive layout showcase.

**Layout navigation is spatial.** Arrow keys move focus to the nearest focusable item in that direction based on screen position. On pages with layouts, left/right moves between side-by-side panels, up/down navigates vertically. On single-column pages, up/down moves sequentially and left goes back. Enter activates, Escape goes back. No configuration needed -- spatial navigation is automatic for all layout functions.

### Component Mapping — Prioritize Navigability

| Original Content | Best TUI Pattern | Avoid |
|---|---|---|
| Hero / headline | `banner` config + `tagline` | |
| About text / prose | `markdown()` | |
| Cards / items / features | Individual `card()` blocks (each focusable) | |
| Work history / experience | Individual `card()` blocks (subtitle=dates) | `timeline()` (not actionable) |
| Education entries | Individual `card()` blocks | `timeline()` |
| Sectioned page content | `divider("Label")` + content below | `tabs()` (forces horizontal switching) |
| Skills / progress bars | `skillBar()` — passive display | |
| Testimonials / reviews | `quote()` — passive display | |
| Pricing / schedules / data | `table()` — passive dense data | Many cards for tabular data |
| Menu items (restaurant) | `divider("Category")` + `card()` items (subtitle=price) | |
| Social links / contact | `link()` per item (each focusable) | |
| Blog posts | `card()` per post (subtitle=date, body=excerpt) | |
| FAQ / expandable content | `accordion()` — each item focusable + expandable | |
| Toggle between views | `tabs()` — ONLY for mutually exclusive views | Organizing sequential sections |
| Dashboard with sidebar | `columns([panel({...}), panel({...})])` | Flat single-column layout |
| Side-by-side cards (2-4 cols) | `row([col([card1], {span: 6}), col([card2], {span: 6})])` | Stacking when side-by-side fits |
| Responsive grid of items | `row([col([item], {span: 4, xs: 12}), ...])` — wraps on narrow terminals | Fixed-width panels |
| Centered narrow content | `container([...], { maxWidth: 85 })` | Full-width prose |
| Monitoring grid | `grid({ cols: 2, items: [...] })` | Single-column cards |
| Split pane (editor/preview) | `split({ direction: "horizontal", first: [...], second: [...] })` | Tabs (can't see both) |
| Contact forms | `form()` with `textInput()`, `textArea()`, `button()` | |
| Search / filter | `searchInput()` with `action: "navigate"` | |
| Stats / metrics | `asciiArt.barChart()`, `asciiArt.sparkline()` | |
| Visual section breaks | `divider("Label")` | Overusing `section()` |
| Dynamic / API data | `fetcher()` + `dynamic()` blocks | |

### Bad → Good Patterns

```ts
// BAD: tabs for resume sections, timeline for entries
tabs([
  { label: "Experience", content: [timeline([...])] },
  { label: "Education", content: [timeline([...])] },
])
// ↑ timeline items aren't actionable, tabs force horizontal switching

// GOOD: flat layout, everything scrolls vertically
divider("Experience"),
card({ title: "Senior Engineer", subtitle: "Acme — 2023–present", body: "..." }),
card({ title: "Junior Dev", subtitle: "Startup — 2021–2023", body: "..." }),
divider("Education"),
card({ title: "BS Computer Science", subtitle: "State University — 2021" }),
// ↑ each card is focusable, user scrolls naturally with ↑↓
```

## Step 3: Choose theme, style, and art

**Theme** — match the site's vibe:
- Developer/tech → `cyberpunk`, `tokyoNight`, `dracula`, `monokai`
- Restaurant/food → `gruvbox`, `catppuccin`
- Music/creative → `rosePine`, `dracula`
- Corporate/professional → `nord`, `solarized`
- Docs/reference → `hacker`, `monokai`
- Minimal/clean → `nord`, `solarized`, `rosePine`

**Borders:** `"rounded"` (friendly), `"heavy"` (bold), `"double"` (classic), `"single"` (clean), `"dashed"` (playful)

**Animations:** `boot: true` for a startup sequence, `transitions: "fade"` for smooth navigation

**Banner font** — match the personality:
- Modern/tech: `ANSI Shadow`, `Electronic`
- Classic/elegant: `Slant`, `Calvin S`, `Small`
- Bold/fun: `Ogre`, `Colossal`, `DOS Rebel`
- Dark/artistic: `Ghost`, `Bloody`, `Sub-Zero`
- 3D: `Larry 3D`, `Isometric1`

**ASCII art scenes** — add one that matches the site:
- Tech: `terminal`, `robot`, `rocket`, `space`
- Food: `coffee-cup`
- Music: `vinyl-record`, `cassette`
- Nature: `mountains`, `forest`, `ocean`, `clouds`
- Fun: `cat`, `gameboy`, `floppy-disk`, `cityscape`

## Step 4: Set up the TUI project

**Do NOT modify any existing files.** Create a `tui/` subdirectory with file-based routing:

```bash
mkdir -p tui/pages
```

Create `tui/package.json`:
```json
{
  "name": "my-tui-site",
  "private": true,
  "type": "module",
  "dependencies": {
    "terminaltui": "latest"
  },
  "scripts": {
    "dev": "npx terminaltui dev"
  }
}
```

Then install:
```bash
cd tui && npm install
```

All imports use the npm package:
```typescript
import { defineConfig } from "terminaltui";
import { card, markdown, row, col } from "terminaltui";
```

## Step 5: Generate tui/config.ts + tui/pages/

**File-based routing** — each page is its own file. The `config.ts` has global settings only (no pages, no content).

### 5a. Create `tui/config.ts`

```typescript
import { defineConfig } from "terminaltui";

export default defineConfig({
  name: "Site Name",
  tagline: "description",
  banner: { text: "SITE", font: "ANSI Shadow", gradient: ["#color1", "#color2"] },
  theme: "dracula",
  borders: "rounded",
  animations: { boot: true, exitMessage: "Goodbye!" },
});
```

### 5b. Create a page file for each page

Every page is a `.ts` file in `tui/pages/`. Each exports a default function returning content blocks, and an optional `metadata` export.

**tui/pages/home.ts** — the landing page:
```typescript
import { hero, menu } from "terminaltui";

export const metadata = { order: 0 };

export default function Home() {
  return [
    hero({ title: "Site Name", subtitle: "Welcome" }),
    menu({ source: "auto" }),  // auto-generated from other pages
  ];
}
```

**tui/pages/about.ts** — example content page:
```typescript
import { card, markdown, divider, link, row, col } from "terminaltui";

export const metadata = { label: "About", icon: "?" };

export default function About() {
  return [
    card({ title: "About Us", body: "Full description here..." }),
    divider("Links"),
    link("GitHub", "https://github.com/example"),
  ];
}
```

**tui/pages/contact.ts** — example form page:
```typescript
import { form, textInput, textArea, button } from "terminaltui";

export const metadata = { label: "Contact", icon: ">" };

export default function Contact() {
  return [
    form({
      id: "contact",
      onSubmit: async (data) => ({ success: "Message sent!" }),
      fields: [
        textInput({ id: "name", label: "Name", placeholder: "Your name" }),
        textInput({ id: "email", label: "Email", placeholder: "you@email.com" }),
        textArea({ id: "message", label: "Message", placeholder: "Your message..." }),
        button({ label: "Send", style: "primary" }),
      ],
    }),
  ];
}
```

### 5c. API routes (if the site has backend features)

Create `tui/api/` for backend endpoints:

```typescript
// tui/api/stats.ts → GET /api/stats
export async function GET() {
  return { visitors: 1234 };
}

// tui/api/contact.ts → POST /api/contact
export async function POST(request: { body: any }) {
  const { name, email, message } = request.body;
  return { success: true };
}
```

### Guidelines

- **Preserve ALL content** from the original site verbatim. Do not skip or summarize.
- **Every page on the original site** becomes a file in `tui/pages/`.
- **Use the right component** for each content type — don't dump everything into `markdown()`.
- **Keep the original voice** and copy. This is a faithful conversion, not a rewrite.
- **Add forms** where the original has them (contact, signup, reservation, etc.).
- **Add searchInput** if the site has lists of items worth searching (menu, blog posts, team).
- **Use ASCII art** for visual polish: banner with gradient, scenes on hero pages, icons for section headers.
- **Choose meaningful page icons** using Unicode: ◆ ◉ ★ ✦ ♫ # + > ~ * etc.
- **Set `metadata.order`** on pages to control menu ordering (lowest first). Pages without `order` sort alphabetically after ordered pages.
- **Set `metadata.hidden = true`** on pages that shouldn't appear in the auto-generated menu (e.g., detail pages, utility pages).

## Step 6: Test it

From inside the `tui/` directory:

```bash
cd tui
npm run dev
```

Navigate every page. Check:
- All pages render without errors
- All content is present and matches the original
- Menu shows all pages in the right order
- Forms work (can type, submit)
- Search filters correctly
- Theme looks good
- No text overflows at 80-column width

## Step 7: Fix issues

If there are errors:
- Check imports match what you're using
- Verify prop names against TERMINALTUI_SKILL.md
- Ensure all form/input field IDs are unique across all page files
- Check that `config.ts` uses `defineConfig()` (not `defineSite()`)
- Check that page files export a default **function** (not an object)
- Fix and re-run

---

## Important Notes

- **NEVER modify, delete, or overwrite files in the original website directory.** All TUI files go in `tui/`.
- Do NOT invent content. Use exactly what exists on the original site.
- **Import from `"terminaltui"`** — the npm package.
- If the site has images, describe them in text or use `asciiImage()` if the image file exists locally.
- If the site has dynamic data (API, database), use `fetcher()` and `dynamic()` to fetch and display it. For backend logic (shell commands, file reads, database queries), create files in `tui/api/` with named HTTP method exports — no separate server needed.
- If the site has user preferences, use `createPersistentState()` to remember them across sessions.
- The goal is a **complete, faithful, beautiful** terminal version — not a summary. Make it something worth screenshotting.
