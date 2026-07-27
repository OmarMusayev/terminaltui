# terminaltui — identity & website brief v2
**This supersedes BRIEF.md.** Every agent working on the logo or the site obeys this document.
Do not invent facts. If a number is not in here, do not put it on the page.

---

## 1. What we are selling

> **A standardized engine for terminal apps. Easy to build, easy to ship — over npm or over SSH.**

That is the whole pitch. Everything on the site serves it.

The audience is **someone about to build their first serious terminal app.** They are
currently deciding between Ink, Bubble Tea, and hand-rolling ANSI escapes. We want them
to conclude, within 30 seconds, that terminaltui is *the easiest and most premium way to
do this* — and then star the repo.

Three pillars, in priority order:

1. **Standardized.** You don't invent an architecture. `pages/about.ts` → `/about`.
   Routing, layout, navigation, state, theming already have one obvious right answer.
   This is the Next.js bargain, applied to the terminal.
2. **Easy to distribute.** `npx your-app` and it runs. Or `terminaltui serve` and people
   `ssh` in. No install, no binary, no Electron, no browser.
3. **Premium by default.** 30+ components, 10 themes, a 12-column grid, ASCII art, and
   real images — all in the box. Your first commit already looks designed.

### Voice
Plain, specific, technical, unhurried. Write like good documentation, not like a landing page.
Short declarative sentences. Concrete nouns. No adjective stacking.
Never: "blazing fast", "seamless", "effortless", "powerful", "beautiful", "revolutionize",
"unleash", "supercharge", "game-changing", "the future of".
Never open a sentence with "Whether you're…". Never use "simply" or "just" to mean "easily".

---

## 2. THE STAT PROBLEM — read this twice

The old site led with **"67.7% fewer bytes"**. That is a bad statistic *as presented*,
because it never said fewer than what. The honest reading is: *v2's renderer writes 67.7%
fewer bytes than v1's renderer did, over the same scripted navigation.* Comparing the
framework to its own previous version is an internal changelog fact. It is not a reason
for a stranger to adopt the framework, and it must never be a headline number again.

**Rules:**
- ❌ Never put a bare percentage in the hero.
- ❌ Never write "67% fewer bytes" without naming the baseline in the same sentence.
- ❌ Never phrase it as "faster". It is a bytes-written measurement, not a latency one.
- ✅ The user-facing truth is the one worth saying: **when nothing on screen changes, the
  renderer writes nothing at all.** That is what you feel on a laggy SSH connection.
  Say *that*, in words, without a number.
- ✅ The full 269,355 → 87,027 methodology belongs in an **engineering blog post**, where
  the baseline and the method can be stated properly. That's its home. Not the hero.

Same discipline for everything else. **37 stars is small — do not dress it up.** Don't
render it as social proof ("loved by developers"). Show the number plainly next to a star
button; honesty is more persuasive than a fake crowd at this stage.

---

## 3. Verified facts (the ONLY numbers allowed on the site)

Checked live on 2026-07-26.

| Fact | Value |
|---|---|
| Version | 2.0.3 |
| GitHub stars | **37** (fetch live, fall back to 37) |
| npm downloads | **731** last month · 588 last week |
| Tests | **3,323 across 52 suites** |
| First published | 2026-03-23 |
| License | MIT · Node >= 18 · ESM-only |
| Runtime deps | **3** — esbuild, jpeg-js, pngjs |
| Components | 30+ · **10** themes · 12-column grid |
| ASCII | 14 fonts · 15 scenes · 30+ icons |
| Demos shipped | 11 |
| Repo | github.com/OmarMusayev/terminaltui ← **the funnel target** |

**Best "hard" numbers for a site that is honest about being young:** 3 runtime
dependencies, 3,323 tests, 11 demos, 30+ components, 10 themes, zero-byte idle frames.
These describe the *product*, not its popularity. Lead with product facts.

---

## 4. What actually makes it different (lead with these)

1. **File-based routing for screens.** Nobody else does this. Ink is a component library;
   Pastel routes CLI *subcommands*; Bubble Tea is an Elm loop. terminaltui routes *pages*.
   `pages/projects/[slug].ts` is a dynamic route. `api/stats.ts` is a `GET` endpoint.
2. **Real images in the terminal.** Actual PNG/JPEG. No `sharp`, no native build. On
   kitty/Ghostty it draws **real pixels** via the kitty graphics protocol; everywhere else
   it paints colored cells using block glyphs, so images survive Apple Terminal, tmux, and
   SSH. Same row count on every tier. `image("./cover.png", { width: 60 })`.
   *(This is newly built — `src/image/`, `docs/images.md`. Video rendering is a roadmap
   item, not a shipped feature. Say so.)*
3. **SSH hosting is first-class.** `terminaltui serve`. One server, many sessions,
   auto-detects the client's TERM for color depth. Your app becomes a URL people `ssh` to.
4. **A headless terminal emulator for tests.** "Playwright, but the browser is a terminal."
   `TUIEmulator.launch()`, `press()`, `waitForText()`, `screen.cells()`. Import from
   `terminaltui/emulator`. The website's own screenshots were produced with it — say that,
   it is a genuinely good story.
5. **AI-codegen native.** Ships `claude/SKILL.md`, a 2,608-line API reference written for
   code generation. `terminaltui create` builds a tailored prompt. No competitor ships this.

### Comparison table (keep — high SEO and decision value)

|  | terminaltui | Ink | Pastel | Bubble Tea |
|---|---|---|---|---|
| Language | TypeScript | TypeScript (React) | TypeScript (Ink-based) | Go |
| Shape | **Framework** (pages, routing, layouts) | Component library | CLI command router | TUI framework (Elm-style) |
| File-based routing for screens | Yes | No | No (routes CLI subcommands) | No |
| SSH hosting | `terminaltui serve` | No | No | Via `charmbracelet/wish` |
| `npx` distribution | First-class | First-class | First-class | No (Go binary) |
| Components included | 30+ | Bring your own | Inherits from Ink | Via `bubbles` |
| Images in-terminal | Built in | No | No | No |
| AI codegen-native | `claude/SKILL.md` in package | No | No | No |

Be fair to the competition. Ink is excellent and far more popular; Bubble Tea is superb.
We win on *shape* (framework vs library) and *batteries*, not on maturity. A comparison
table that is visibly fair is more convincing than one that isn't.

---

## 5. Roadmap — say it, but mark it clearly

The owner intends to build these **on** the framework. They are proof the engine is
general-purpose. Present them as a roadmap or "what you can build", never as shipped.

- **Video rendering** — the image pipeline extended to frames.
- **A digital library over SSH** — `ssh library.example` and read books in your terminal,
  no CLI flags to memorize.
- **A comic reader** — the image renderer's hardest test case.
- **A movie/media library.**
- **An agent manager** — run and switch between multiple Claude Code / Codex sessions
  from one TUI.
- **Performance work** — latency and throughput optimization.

Label the section honestly: "Planned", "In progress", "Shipped". Do not fake a changelog.

---

## 6. VISUAL IDENTITY

The owner's direction, which we are executing, not debating:

> Pixelated type on a clean white background in light mode.
> White pixelated type on a dark background in dark mode.

### Typeface system
- **Display / brand: `Departure Mono`** — a monospaced pixel font by Helena Zhang,
  SIL OFL 1.1, self-hosted (`fonts/DepartureMono-Regular.woff2`, 22 KB). Ship the LICENSE
  file alongside it. This is the brand voice. It is lo-fi *and* refined, which is exactly
  the line we're walking.
- **Body: a neutral, high-quality sans** (Inter Variable) or **IBM Plex Sans**. Body copy
  is NOT set in a pixel font. Reading 400 words of pixel type is punishment.
- **Code: JetBrains Mono / Geist Mono / IBM Plex Mono.** Real code needs a real mono.

**The rule:** pixel type is for the wordmark, section markers, numerals, labels, and the
occasional large statement line. Everything you actually *read* is set in the sans.
This contrast — crunchy pixel display against clean neutral text — IS the identity.

### Pixel-type craft rules (these are what separate good from amateur)
- Pixel fonts must be rendered at **integer multiples of their design size** or they
  smear. Departure Mono's grid wants sizes like 12/16/24/32/48/64px. Do not use 17px.
- Set `-webkit-font-smoothing: none` / `font-smooth: never` where the pixel font is used
  large, so the edges stay hard. Test it — on some sizes antialiasing looks better.
- Generous `letter-spacing` on small pixel text; tight on large.
- Never set pixel type in italic or fake-bold. There is one weight. Respect it.
- Uppercase pixel type at small sizes with tracking reads as "label". Use it for eyebrows.

### Color
- **Light:** near-white background (`#FFFFFF` to `#FAFAF7`), ink `#0A0A0A`. Hairlines, not boxes.
- **Dark:** `#0B0B0C`–`#101011` background, `#FAFAFA` text. Not pure black, not navy.
- **One accent.** Used sparingly — links, the caret, the star button, one rule per page.
  Candidates to explore (pick per direction, we're choosing an identity here):
  phosphor mint `#3DDC97` · terminal amber `#FFB000` · signal red `#FF4D2E` ·
  the existing magenta `#FF2A6D`. Avoid Tailwind's default indigo/violet at all costs.
- The **real terminal frames are already full-color** (cyberpunk pink, gruvbox, nord…).
  They are the color on the page. That's why the chrome must stay near-monochrome —
  otherwise the screenshots and the UI fight. This is the single most important
  color decision on the site.

---

## 7. ANTI-AI-DESIGN LAW (violations are rejected outright)

The previous site "looked extremely AI". Here is precisely what that means and what
is now forbidden.

**Layout**
- ❌ Three-column card grids of equal-weight cards, repeated section after section.
- ❌ Every section being `<h2>` + one-line centered intro + a grid. Vary the rhythm:
  a table, a wide figure, a two-column split, a single sentence at 48px, a code block.
- ❌ Everything centered. Center the hero if you like, then stop.
- ❌ Uniform vertical spacing between all sections. Some sections should feel dense and
  some should breathe. Rhythm is what makes a page feel authored.
- ✅ Asymmetry, deliberate hierarchy, at least one section that breaks the grid.

**Color & surface**
- ❌ Purple→pink or blue→cyan gradients. On text especially.
- ❌ Glassmorphism, frosted blurs, floating translucent cards.
- ❌ Glow/neon shadows behind cards. Colored drop shadows.
- ❌ Rounded-2xl on everything with a soft shadow. Pick sharp or pick soft, then commit.
- ❌ Tailwind default palette straight out of the box (`bg-indigo-600`, `text-slate-500`).
  Define real tokens with real hexes.
- ✅ Hairline borders (1px, low contrast), flat surfaces, one accent, real contrast.

**Content**
- ❌ Emoji as feature icons. 🚀⚡✨ are an instant tell.
- ❌ Feature cards that restate the heading in one bland sentence.
- ❌ Fake testimonials, fake logos, "trusted by" rows, invented metrics.
- ❌ Em-dash-heavy marketing prose. (Yes, this document uses them; the *site* shouldn't.)
- ❌ Sentences that could describe any product. If it would be true of Ink, cut it.
- ✅ Specifics: real commands, real file paths, real output, real numbers from §3.

**Motion**
- ❌ Everything fading up on scroll, staggered, 600ms. This is the #1 AI tell in 2026.
- ❌ Looping typewriter hero text.
- ✅ Almost no motion. Maybe one thing moves, and it earns it. Honor
  `prefers-reduced-motion` completely.

**Typography**
- ❌ More than 2 type families (pixel display + sans body, plus mono for code = the limit).
- ❌ Body text under 16px, or line-height under 1.55 on long copy.
- ❌ Measure wider than ~72 characters.
- ❌ Headings that are the same size as each other across levels.
- ✅ A real modular scale. Optical alignment. Tabular numerals in tables.

---

## 8. The asset nobody else has: `devnotes/frames.json`

27 genuine screen captures from 11 demos, produced by booting each demo inside the
project's own headless PTY emulator and dumping the colored cell grid to HTML.
Shape: `{ demo: [{ label, cols, rows, html }] }` where `html` is newline-separated rows of
run-length-encoded `<span>`s with inline `color:` / `background:` / `font-weight`.

Drop a row into a `<pre>` with a monospace font and you get a pixel-faithful reproduction
of real terminal output. **Use these everywhere.** They are the strongest visual asset on
the site and no generic landing page can fake them.

Index — `welcome`: home, showcase, themes · `developer-portfolio`: home, projects,
experience · `mac-monitor`: home, cpu · `dashboard`: home, posts · `server-dashboard`:
home · `restaurant`: home, menu · `startup`: home, pricing, features · `conference`: home,
schedule, speakers · `band`: home, tour, discography · `coffee-shop`: home, menu ·
`freelancer`: home, work, services.

---

## 9. Non-negotiables for the build

1. **Real project, not a single HTML file.** Astro + Tailwind v4, component files,
   content collections, typed data. Static output, deployable to GitHub Pages.
2. **A blog that is genuinely excellent.** Content collections + MDX, index with tags,
   post pages with reading time, RSS, per-post OG. Long-form typography is the point:
   ~68ch measure, 1.65 line-height, real `<figure>`/`<figcaption>`, styled code blocks,
   footnotes. This section is where the engineering stories live (the renderer post, the
   image-rendering post) — real content, never lorem ipsum.
3. **SEO.** One `<h1>`, real heading hierarchy, semantic landmarks, canonical, OG/Twitter,
   JSON-LD (SoftwareApplication, WebSite, BreadcrumbList, FAQPage, BlogPosting per post),
   sitemap, crawlable text — never text that only exists in JS.
4. **Responsive 360 → 2560px.** No horizontal overflow, ever. Nothing hover-only.
   Touch targets >= 44px.
5. **Accessible.** Keyboard reachable, visible focus rings, `prefers-reduced-motion`,
   contrast >= 4.5:1 for body text. Both themes.
6. **Funnel to GitHub.** Live star count with a graceful fallback to 37. Star CTAs placed
   where conviction peaks — after the comparison table, after the demos — not just in the
   nav. No dark patterns, no fake urgency.
