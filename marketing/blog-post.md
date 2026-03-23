# I built a framework that turns any website into a terminal app

What if your portfolio wasn't a website? What if someone could type `npx your-name` and get a fully interactive, keyboard-navigable, beautifully themed terminal experience -- complete with ASCII art banners, animated transitions, and working contact forms?

That's what I've been building for the past few months. It's called **terminaltui**, and it's a TypeScript framework for building terminal apps from a single config file.

[hero.gif]

## The problem

Building terminal UIs is hard. You have to think about ANSI escape codes, terminal dimensions, cursor positioning, keyboard input buffering, Unicode character widths, color support detection, and a hundred other things that web developers never worry about because browsers abstract it all away.

Existing TUI libraries give you low-level primitives -- draw a box here, handle this keypress there. That's fine if you're building a database client, but overkill if you just want to present information in a beautiful terminal interface.

I wanted something closer to the web mental model: define your content declaratively, pick a theme, and let the framework handle everything else.

## The solution

terminaltui takes a single `site.config.ts` file and turns it into a full terminal application. Here's what a minimal site looks like:

```ts
import { defineSite, page, markdown, card, ascii } from "terminaltui";

export default defineSite({
  name: "My Site",
  banner: ascii("My Site", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: "dracula",
  pages: [
    page("home", {
      title: "Home",
      content: [
        markdown("Welcome to my terminal site!"),
        card({ title: "About", body: "This runs entirely in your terminal." }),
      ],
    }),
  ],
});
```

That's it. Run `terminaltui dev` and you have a working terminal app with keyboard navigation, a themed UI, and an ASCII art banner.

[restaurant.gif]

## It's not just static content

The framework includes everything you'd expect from a real application framework:

**20+ display components.** Cards, tables, timelines, galleries, accordions, tabs, heroes, progress bars, badges, and more. Each renders beautifully in the terminal with proper borders, alignment, and color.

**10 input components.** Text inputs, text areas, selects, checkboxes, toggles, radio groups, number inputs, search inputs, buttons, and forms. All with keyboard-driven interaction -- press Enter to edit, Escape to navigate away, Tab to move between fields.

**Reactive state management.** `createState()` gives you a reactive container with get/set/update/batch/subscribe. Pair it with `dynamic()` blocks and your UI updates automatically. Need persistence? `createPersistentState()` writes to disk as JSON.

**Data fetching.** `fetcher()` gives you reactive HTTP with caching, retry, and auto-refresh. `request.get/post/put/delete/patch` for one-shot calls. `liveData()` for WebSocket and SSE connections.

**Routing and middleware.** Static pages with `page()`, parameterized routes with `route()`, programmatic navigation with `navigate()`. Middleware can guard pages, redirect, rate-limit, or cache.

[dashboard.gif]

## 10 themes, zero compromises

One of the things I cared about most was making terminal apps that look genuinely good. The framework ships with 10 carefully tuned color themes:

- **dracula** -- the default, great for everything
- **cyberpunk** -- hot pink neon for tech/gaming
- **nord** -- frost blue for corporate/SaaS
- **gruvbox** -- warm orange for restaurants and cafes
- **hacker** -- green-on-black Matrix aesthetic
- **catppuccin**, **tokyoNight**, **rosePine**, **monokai**, **solarized** -- each with its own personality

Every theme defines accent, text, muted, success, warning, error, and border colors. You can also pass a completely custom theme object.

All colors use 256-color mode for maximum terminal compatibility. No truecolor assumptions.

[themes.gif]

## The ASCII art system

This might be my favorite part. terminaltui includes a full ASCII art system:

- **14 banner fonts** -- from clean modern (`ANSI Shadow`) to retro DOS (`DOS Rebel`) to horror (`Bloody`, `Ghost`)
- **15 pre-made scenes** -- mountains, cityscapes, forests, rockets, robots, retro devices
- **32 icons** -- laptop, terminal, music, heart, and more
- **12 decorative patterns** -- circuit boards, rain, stars, waves
- **9 geometric shapes** -- boxes, circles, hearts, stars, diamonds
- **5 data visualization types** -- bar charts, sparklines, heatmaps, pie charts, line graphs

And a composition layer that lets you overlay, tile, mirror, rotate, colorize, and apply gradients to any ASCII art.

## The AI shortcut

Here's the thing I'm most excited about: **automatic website conversion**.

Run `terminaltui convert` in any existing web project. It drops two reference files into your directory. Open Claude Code (or any AI coding assistant), tell it to read those files and convert your site. The AI understands your HTML/React/Vue/whatever, maps your content to terminaltui components, picks an appropriate theme, and produces a working `site.config.ts`.

I've tested this on dozens of sites -- portfolios, restaurants, landing pages, documentation sites, conference sites -- and it works remarkably well. The AI knows which web patterns map to which terminal components, when to use cards vs. tables vs. accordions, and how to structure content for vertical keyboard navigation.

## Under the hood

A few technical details for the curious:

**Rendering pipeline.** The framework maintains a virtual screen buffer. On each frame, it walks the content tree, measures each block (using proper Unicode-aware string width, not `.length`), lays them out vertically, and diffs against the previous frame. Only changed regions get new ANSI sequences written to stdout.

**Focus system.** Every focusable component registers itself in a flat focus list. Arrow keys move a cursor through this list. The viewport scrolls to keep the focused item visible. Components declare their own focusability -- cards and inputs are focusable, markdown and tables are not.

**256-color fallback.** Rather than assuming truecolor support (which breaks in many terminals including Apple Terminal), all hex colors get mapped to the nearest color in the 256-color ANSI palette. This means the framework works everywhere.

**Input mode switching.** The terminal has two modes: navigation (arrow keys move between items) and edit (typing goes into an input field). Enter switches from navigation to edit, Escape switches back. This is the core UX pattern that makes forms work in a terminal.

**Zero runtime dependencies.** The entire framework ships with no dependencies. The only optional peer dependency is `node-pty` for the testing emulator.

## What I've built with it

To prove the framework works for real use cases, I've built a bunch of showcase sites:

- A developer portfolio with projects, skills, and contact links
- A restaurant with full menu, reservation form, and hours
- A coffee shop with menu categories, loyalty program, and locations
- A conference site with schedule, speakers, and venue info
- A podcast site with episodes, show notes, and subscribe links
- A startup landing page with features, pricing table, and waitlist form
- A documentation site with search, code examples, and API reference
- A dashboard with live data, charts, and WebSocket updates

Each one runs with `npx` and looks great in any terminal.

## What's next

I'm working on a few things:

- **Plugin system** for community-contributed components and themes
- **Animation improvements** -- more transition types, per-component animations
- **Accessibility audit** -- screen reader compatibility for terminal apps
- **More templates** for `terminaltui init`

## Try it

```bash
npm install terminaltui
npx terminaltui init portfolio
npx terminaltui dev
```

Or convert an existing site:

```bash
cd your-website
npx terminaltui convert
```

The framework is open source and MIT licensed. I'd love to hear what you build with it.
