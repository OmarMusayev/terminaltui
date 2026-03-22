# Convert Any Website to a Terminal UI

You are converting an existing website into a terminal-style UI using the **terminaltui** framework.

## Step 1: Read the Existing Website

Scan **all files** in the current directory to understand the website:
- HTML files, templates, markdown content
- CSS/styling for design cues (colors, fonts, mood)
- JavaScript/TypeScript for interactivity or data
- Config files (package.json, next.config, gatsby-config, etc.)
- Image references, asset structure
- Any CMS data, JSON files, or API endpoints

Build a complete mental model of:
- **What kind of site is this?** (portfolio, restaurant, SaaS landing page, blog, band/musician, agency, e-commerce, nonprofit, event, personal, etc.)
- **What pages exist?** (home, about, menu, projects, contact, etc.)
- **What content is on each page?** (text, lists, images described as text, quotes, pricing tables, timelines, etc.)
- **What is the tone/vibe?** (professional, playful, dark, minimal, bold, retro, etc.)

## Step 2: Install terminaltui

```bash
npm init -y && npm install terminaltui
```

## Step 3: Read the Framework API

```
Read the file: node_modules/terminaltui/claude/SKILL.md
```

Read this file completely. It contains the full API reference for all components, themes, and configuration options. Do not proceed until you have read and understood it.

## Step 4: Plan the Terminal Site

Map every piece of content from the original site to terminaltui components:

| Original Content | terminaltui Component |
|---|---|
| Hero text / headline | `banner` (ascii art) + `tagline` |
| About section | `page()` with `markdown()` |
| Project cards / portfolio items | `card()` with title, subtitle, body, tags, url |
| Work experience / timeline | `timeline()` |
| Skills / tech stack | `skillBar()` |
| Testimonials / reviews | `quote()` |
| Pricing tables / schedules | `table()` |
| Menu items (restaurant) | `section()` with `card()` components |
| Social links / contact | `link()` |
| Blog posts | `card()` with title, subtitle, body |
| Grouped content | `section()` to wrap related items |
| Visual breaks | `divider()` and `spacer()` |
| Labels / categories | `badge()` |

Choose a **theme** that matches the original site's vibe:
- Professional/clean → `themes.tokyoNight` or `themes.catppuccin`
- Dark/moody → `themes.dracula` or `themes.cyberpunk`
- Warm/earthy → `themes.gruvbox` or `themes.solarized`
- Soft/elegant → `themes.rosePine` or `themes.nord`
- Minimal → `themes.dracula` with simple config
- Retro/hacker → `themes.matrix` or `themes.cyberpunk`

Choose **borders** that match the feel:
- `"rounded"` — friendly, modern
- `"heavy"` — bold, dramatic
- `"double"` — classic, structured
- Default single — clean, minimal

Choose **animations** that fit:
- `boot: true` — adds a startup sequence (great for creative/techy sites)
- `transitions: "fade"` — smooth, professional
- `transitions: "wipe"` — dramatic, creative
- `transitions: "typewriter"` — retro, storytelling

## Step 5: Generate site.config.ts

Create a `site.config.ts` file in the project root. Import only the components you actually use.

Structure:
```typescript
import { defineSite, page, /* ...only what you need */ themes } from "terminaltui";

export default defineSite({
  name: "Site Name",
  tagline: "site tagline or description",
  // banner: ascii("NAME", { font: "...", gradient: [...] }),  // optional
  theme: themes.themeName,
  // borders: "rounded",  // optional
  // animations: { boot: true, transitions: "fade" },  // optional

  pages: [
    page("slug", {
      title: "Display Title",
      icon: "◆",
      content: [
        // components here
      ],
    }),
    // more pages...
  ],
});
```

Guidelines:
- **Preserve ALL content** from the original site. Do not skip or summarize.
- **Every page** from the original site should become a `page()` in the config.
- **Use the right components** — don't just dump everything into `markdown()`. Use `card()` for items, `timeline()` for history, `table()` for structured data, etc.
- **Keep the original voice** — use the same copy, tone, and personality.
- **Choose meaningful icons** for each page tab. Use Unicode symbols: ◆ ◈ ▣ ▤ ◉ ★ ✦ ♫ etc.
- **First page** is the default/home page shown on load.

## Step 6: Test

```bash
npx terminaltui dev
```

Open the URL shown in the terminal. Check:
- All pages render correctly
- Navigation between pages works
- Content is complete and matches the original site
- Theme looks good
- No TypeScript errors

## Step 7: Fix Issues

If there are errors:
- Read the error message carefully
- Check your imports match what you're using
- Verify component prop names against SKILL.md
- Make sure all strings are properly quoted
- Fix and re-run `npx terminaltui dev`

## Step 8: Prepare for Deployment

Update `package.json` for publishing:

```json
{
  "name": "my-terminal-site",
  "version": "1.0.0",
  "scripts": {
    "dev": "terminaltui dev",
    "build": "terminaltui build",
    "start": "terminaltui start"
  }
}
```

Run `npx terminaltui build` to generate the production build, then verify with `npx terminaltui start`.

---

## Important Notes

- Do NOT invent content. Use exactly what exists on the original site.
- If the site has images, describe them in text or skip them — terminaltui is text-based.
- If the site has forms, convert them to `link()` components pointing to email or external services.
- If the site has dynamic data (e.g., a blog with many posts), include the most recent/prominent items.
- The goal is a **complete, faithful** terminal version of the original site, not a summary.
