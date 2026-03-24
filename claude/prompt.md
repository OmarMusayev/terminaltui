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

**Do NOT modify any existing files.** Create a `tui/` subdirectory:

```bash
mkdir -p tui
```

Create `tui/package.json`:
```json
{
  "name": "my-tui-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "npx tsx __TERMINALTUI_PATH__/src/cli/index.ts dev"
  }
}
```

**Imports:** Install from npm (`npm install terminaltui`) and import normally:
```typescript
import { defineSite, page, card, markdown /* ... */ } from "terminaltui";
```

If using a local development copy instead, import from the source path:
```typescript
import { defineSite, page, card, markdown /* ... */ } from "__TERMINALTUI_PATH__/src/index.js";
```

## Step 5: Generate tui/site.config.ts

Create `tui/site.config.ts`:

```typescript
import {
  defineSite, page, card, markdown, /* ... */
} from "terminaltui";

export default defineSite({
  name: "Site Name",
  tagline: "description",
  banner: { text: "SITE", font: "ANSI Shadow", gradient: ["#color1", "#color2"] },
  theme: "dracula",
  borders: "rounded",
  animations: { boot: true, exitMessage: "Goodbye!" },
  pages: [
    page("home", { title: "Home", icon: "◆", content: [ /* ... */ ] }),
    // ... more pages
  ],
});
```

**Guidelines:**
- **Preserve ALL content** from the original site verbatim. Do not skip or summarize.
- **Every page** becomes a `page()`. First page is the home/landing.
- **Use the right component** for each content type — don't dump everything into `markdown()`.
- **Keep the original voice** and copy. This is a faithful conversion, not a rewrite.
- **Add forms** where the original has them (contact, signup, reservation, etc.).
- **Add searchInput** if the site has lists of items worth searching (menu, blog posts, team).
- **Use ASCII art** for visual polish: banner with gradient, scenes on hero pages, icons for section headers.
- **Choose meaningful page icons** using Unicode: ◆ ◉ ★ ✦ ♫ # + > ~ * etc.

## Step 6: Test it

From inside the `tui/` directory:

```bash
cd tui
npm run dev
```

Navigate every page. Check:
- All pages render without errors
- All content is present and matches the original
- Forms work (can type, submit)
- Search filters correctly
- Theme looks good
- No text overflows at 80-column width

## Step 7: Fix issues

If there are errors:
- Check imports match what you're using
- Verify prop names against TERMINALTUI_SKILL.md
- Ensure all page IDs are unique
- Ensure form field IDs are unique
- Fix and re-run

---

## Important Notes

- **NEVER modify, delete, or overwrite files in the original website directory.** All TUI files go in `tui/`.
- Do NOT invent content. Use exactly what exists on the original site.
- **Import from `"terminaltui"`** (npm) or from the local source path if developing locally.
- If the site has images, describe them in text or use `asciiImage()` if the image file exists locally.
- If the site has dynamic data (API, database), use `fetcher()` and `dynamic()` to fetch and display it. If the site needs backend logic (shell commands, file reads, database queries), use the `api` field in `defineSite()` to create API routes — no separate server needed.
- If the site has user preferences, use `createPersistentState()` to remember them across sessions.
- If the site would benefit from backend logic (forms that send emails, data from the filesystem, system commands), add API routes in the `api` field of `defineSite()`. See the SKILL.md API Routes section for examples.
- The goal is a **complete, faithful, beautiful** terminal version — not a summary. Make it something worth screenshotting.
