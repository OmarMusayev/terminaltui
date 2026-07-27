# terminaltui.dev — Authoritative Design Rule Set (v1, FINAL)

**Status:** supersedes all five research reports. Where a researcher's rule contradicts this document, this document wins. Where this document is silent, the researchers' rules are advisory, not binding.

**Read `BRIEF2.md` first.** This document implements it. §7 of the brief (ANTI-AI-DESIGN LAW) outranks everything here — if a rule below would produce something §7 forbids, §7 wins and you report the conflict.

---

## 0. The one constraint everything derives from

> The page is full of **real, full-colour terminal screenshots** (`devnotes/frames.json` — 27 genuine captures, rendered as live DOM). Those frames are cyberpunk pink, gruvbox orange, nord blue. **They are the colour on this site.** Every other decision in this document exists to keep the chrome from competing with them.

Three consequences, and you should be able to trace almost every rule below back to one of them:

1. **The UI is near-monochrome.** Ink, paper, five alpha steps, one accent used ≤3 times per page. If the chrome has colour, the frames stop reading as content and start reading as decoration.
2. **Code blocks are recessed panels in the page's own colour family, NOT dark slabs.** A dark code block is a second saturated rectangle competing with the frames. This is the single most consequential conflict I resolve below (§6.3).
3. **The brand's texture is typographic, not chromatic.** Departure Mono pixel type against clean neutral sans is the identity. That contrast is free; it costs no colour.

---

## 1. Conflicts between researchers — resolved explicitly

Do not average these. Each resolution is a decision with a reason.

### 1.1 Light vs dark default — **LIGHT default, dark fully supported**
Tiger and Tailwind are light-first. T3, Ghostty and Bun are dark-only. Zed is warm-paper light.

**For us: light is the default, dark is a first-class equal.** Reason: the terminal frames are overwhelmingly dark objects. On a white page a dark frame has a hard edge and reads as *a thing on a desk* — a window you are looking into. On a dark page a dark frame's boundary dissolves into the background and the frame stops being an object. The brief's own identity line is "pixelated type on a clean white background in light mode" first, dark second. Ship both; author in light.

Dark mode is not optional and not an afterthought: it must be derived (§4.3), not hand-tuned, so it cannot rot.

### 1.2 Star count in the nav — **SHOW THE 37**
Three of five researchers said never render a small star count. They are wrong for us, and the brief overrules them (§2: *"37 stars is small — do not dress it up… honesty is more persuasive than a fake crowd"*).

**Resolution:** show it, plainly, as a number next to a star button. What is banned is *framing* it as social proof. `★ Star  37` is honest. "Loved by developers" above a 37 is a lie. A shields.io badge is amateur regardless of the number. The number appears in the star button and nowhere else.

### 1.3 What goes in the hero — **the product, rendered as live DOM**
Tiger's hero has no code and no visual. T3 ships a static `.webp`. Ghostty and Zed both refuse a screenshot and rebuild the product's output as real DOM on the page.

**Ghostty and Zed win outright, and it isn't close.** Our product's output *is* a grid of styled monospace characters, which is native HTML, and we already have it in `frames.json`. Tiger's empty hero is the least transferable thing in the entire research set: it works for a hosted database sold on a claim; a TUI framework sold on a claim is unsellable. **The hero carries a real terminal frame, always.** It is crisp at any DPI, selectable, searchable, diffable in git, and no competitor's landing page can fake it.

### 1.4 Boundary language — **full-bleed hairlines primary, bordered rows secondary, cards rare**
Tailwind draws every division as a 1px full-bleed rule (`before/after` at `w-[200vw]`). Tiger uses bordered list rows. T3 uses bordered cards with a white-alpha gradient fill. All three ban shadows.

**Resolution, in priority order:**
1. **Section separation** = a full-bleed 1px hairline that runs past the content column to the viewport edge. This is the house device. It costs nothing, scales to any amount of content, needs zero assets, and reads as engineering paper rather than as a landing page.
2. **Lists of features** = bordered rows (`border-bottom`, `first:pt-0`), never a grid of cards. §7 of the brief bans repeated equal-weight card grids outright.
3. **Cards** = allowed at most twice on the home page, and never three-across-equal-weight twice in a row.
4. **Box-shadow: banned site-wide.** One exception, below.

### 1.5 Radius — **commit to sharp: 0px and 4px only**
References range from 4px (Tiger) to 16px (T3) to 999px pills (Tailwind). §7 says "pick sharp or pick soft, then commit."

**Resolution: sharp.** The brand face is a pixel font on a hard grid; rounded corners fight it. Allowed values: **`0`** for rules, tables, section plates, inputs, and text fields; **`4px`** for buttons, chips, code blocks and images. **`6px` is permitted for the terminal-frame window only**, because it is imitating a real OS window and a hard-cornered one looks broken. **No pill radius anywhere. Nothing above 6px, ever.**

### 1.6 Code-block treatment — **recessed panel, not a dark slab**
Tailwind keeps code blocks `bg-gray-950` in *both* themes. Tiger's docs make them `foreground@4%` with a `foreground@16%` border — a slightly sunken panel in the page's own colour family.

**Tiger wins, for the reason in §0.** A permanently-dark code block on a light page is a second high-contrast rectangle, and on this site it would sit fifteen scroll-inches from a real terminal frame and dilute it. More importantly it destroys the most useful distinction on the page: **source you type vs. output you get.** Full spec in §6.3. The rule to remember: **code blocks are quiet and belong to the page; terminal frames are loud and belong to the product.**

### 1.7 Inline code — **literal backticks, no background pill**
Tiger tints inline code `fg@8%`. Tailwind renders literal `` ` `` characters via `code::before/::after` with no background at all.

**Tailwind wins.** It is how code looks in a terminal, it never collides with line-height, it never produces a ragged row of grey lozenges in a paragraph, and it costs one CSS rule. Adopt it verbatim. **Do not do both** — a pill *and* backticks makes inline code heavier than the block code it references.

### 1.8 Blog index layout — **ruled table, no featured post, no cover images**
Tiger uses a featured-split (1 big card + 5 headline rows) that needs ≥6 posts and a commissioned 677×381 illustration per post. Tailwind uses a single-column ruled table with a mono date column. T3 uses a flat title-left/date-right list.

**Tailwind's table wins, with T3's restraint applied.** We will not have six posts on day one and we will not commission art. A table looks correct at 3 posts and at 40. A featured-split at 3 posts looks broken. Full spec in §8.

### 1.9 What mono is for — **we have three faces, so the roles change**
Tiger: mono = all labels. T3: mono = machine-authored strings only. t3.gg: mono = everything (bad).

Every reference has two faces. **We have three** (pixel display, sans body, code mono), so the label role that mono occupies on their sites belongs to **pixel** on ours. Binding assignment:

| Face | Owns |
|---|---|
| **Departure Mono (pixel)** | Wordmark. Section eyebrows. Numerals and stats. Nav labels. Table column headers. Version tag. Star count. Kbd chips. Occasional large statement line. |
| **Inter / IBM Plex Sans** | Every word a human wrote and you are meant to read. All body, ledes, excerpts, prose headings, buttons, captions. |
| **JetBrains Mono** | Every string a machine wrote or you would type. Code blocks, inline code, shell commands, file paths, routes, branch names, terminal frames, docs breadcrumbs. |

**Three hard bans:** no body copy in pixel. No prose in code mono. No mono eyebrows (that slot is pixel's — it is what makes us not look like Tiger).

### 1.10 Accent on primary buttons — **no**
Zed and Tailwind fill the primary CTA with the accent / with black. T3 explicitly keeps the accent off buttons and makes the primary an inverted ink fill.

**T3 wins.** Primary button = **ink fill** (near-black in light, near-white in dark). The accent is worth more as a rationed signal — a caret, a rule, an underline, a focus ring — than as a button background. A saturated button also drags the eye away from the frames, which is the whole problem we are solving.

### 1.11 Section rhythm — **three densities, deliberately uneven**
Tailwind: uniform 160px. T3: uniform 96px. Tiger: 60/80/100/120.

**All uniform rhythms are banned by §7** ("Uniform vertical spacing between all sections… Rhythm is what makes a page feel authored"). Use exactly three densities and alternate them with intent (§3.3).

### 1.12 Backdrop blur on the sticky nav — **banned**
T3 blurs at 18px, Tiger and Tailwind use a solid fill. §7 bans glassmorphism and frosted blurs outright. **Solid background, 1px bottom hairline, always present.** No scroll-triggered border animation either — that is motion for motion's sake.

### 1.13 "Edit this page on GitHub" — **required**
Tiger, Tailwind and Ghostty all omit it. All three researchers independently flagged this as their mistake, not a pattern. It is the cheapest contributor funnel an open-source project has. **Every docs page and every blog post gets one.**

---

## 2. Baseline: what every direction must meet

Non-negotiable across all five directions. A direction that violates any of these is rejected before it is judged on taste.

### 2.1 Type scale — real px values

**PIXEL — Departure Mono.** Integer-grid sizes only. **These six values and no others:**

| px | Role | Tracking | Case |
|---|---|---|---|
| **12** | Eyebrows, table column heads, kbd chips, version tag, meta labels | `+0.12em` | UPPER |
| **16** | Wordmark, nav labels, small stat labels, star count | `+0.04em` | as-set |
| **24** | Sub-display, stat numerals, mobile section headings | `+0.01em` | as-set |
| **32** | Section headings (mobile), large numerals | `0` | as-set |
| **48** | Section headings (desktop), hero h1 (mobile) | `-0.01em` | as-set |
| **64** | Hero h1 (desktop), closing-CTA h2 | `-0.02em` | as-set |

- **`17px`, `20px`, `40px`, `56px` are forbidden in pixel type.** Off-grid sizes smear the bitmap and are the fastest way to look amateur with a pixel face.
- `-webkit-font-smoothing: none; font-smooth: never;` at **≥24px**. At 12–16px, test both — antialiasing frequently looks better small, and hard edges frequently look better large. Pick per size and lock it.
- **Never italic. Never fake-bold. Never `font-weight` other than 400.** There is one weight; `font-synthesis: none` globally.
- Line-height for pixel: **1.0 at 48–64px, 1.15 at 24–32px, 1.35 at 12–16px.**

**Pixel headline length is a hard geometric constraint.** Departure Mono is monospaced; assume advance = `0.6em` until you measure `1ch` at runtime. Max characters per line:

| Size | Column 1120px | Column 620px | Mobile 320px |
|---|---|---|---|
| 64px | 29 | — | — |
| 48px | 38 | 21 | 11 |
| 32px | 58 | 32 | 16 |
| 24px | 77 | 43 | 22 |

**Therefore: hard-break your display lines with explicit markup. Do not let pixel display type wrap.** A hero line is ≤ 22 characters on mobile and ≤ 29 on desktop, 2 lines maximum. If your headline does not fit, the headline is wrong.

**SANS — Inter Variable (or IBM Plex Sans). One family, weights 400/500/600 only. No 700, no 800.**

| px / line-height | Role | Weight | Tracking |
|---|---|---|---|
| **13 / 1.5** | Fine print, footnotes, table cells in dense tables | 400 | `+0.005em` |
| **14 / 1.5** | Meta, dates, bylines, captions, footer links, nav | 400/500 | `0` |
| **16 / 1.6** | Default body, marketing paragraphs, docs body | 400 | `0` |
| **17 / 1.65** | Blog post body **only** | 400 | `0` |
| **19 / 1.55** | Lede paragraph under a section heading | 400 | `0` |
| **21 / 1.4** | Blog prose h3, card titles | 600 | `-0.01em` |
| **28 / 1.3** | Blog prose h2, docs h2 | 600 | `-0.015em` |
| **36 / 1.2** | Docs h1, blog post h1 (mobile) | 600 | `-0.02em` |
| **48 / 1.1** | Blog post h1 (desktop), sans-path hero h1 (mobile) | 600 | `-0.025em` |
| **64 / 1.05** | Sans-path hero h1 (desktop) | 600 | `-0.03em` |

There is no size between any two of these. Negative tracking scales with size and reaches zero at 19px; it is never applied below 19px. **Body text is never below 16px and never below 1.55 line-height on long copy** (§7).

**CODE MONO — JetBrains Mono, 400/500.** Pinned sizes: **14px / 1.6** in code blocks and terminal frames, **13px** inside tables and asides, **0.9em** inline. Pin them with `!important` if your framework fights you — code that shrinks inside an aside or grows inside a heading is a tell.

### 2.2 Spacing scale

One 4-based ramp. **These values and no others:**

```
4  8  12  16  24  32  48  64  96  144
```

Bind them:
- **Micro (inside a component):** 4, 8, 12
- **Component internal stack:** 16, 24, 32
- **Block-to-block within a section:** 32, 48, 64
- **Section vertical padding:** 64 (dense) · 96 (normal) · 144 (breathe) — see §3.3
- Mobile (<768px) drops every section pad one step: 48 / 64 / 96.

`20px`, `40px`, `80px`, `120px` are forbidden as spacing values. The one exception is the page gutter, which is 20px at mobile because 16 is too tight and 24 wastes a phone.

### 2.3 Content widths

| Token | Value | Applies to |
|---|---|---|
| `--shell` | **1200px** | Outer content max-width. Nav content, footer content, all sections. |
| gutter | **20px** <768 · **32px** ≥768 · **48px** ≥1280 | Side padding on `--shell` |
| `--measure` | **620px** | Any paragraph of prose: ledes, blog body, marketing copy |
| `--measure-docs` | **680px** | Docs prose (denser, more code/tables which break the measure) |
| `--frame-max` | **1120px** | Terminal frames, wide figures, the comparison table |
| `--bleed` | `100vw` | Full-bleed hairlines and the one grid-breaking section |

**1200, not Tiger's 1440.** 1440 is sized for a company with six mega-menus. At our content volume a 1440 shell leaves the nav's right cluster stranded a foot from the left cluster and reads as an empty office. Zed ships 1120, create-t3 ships 1280; 1200 is right.

**Measure is never wider than ~72 characters** (§7). At 17px Inter that is ~620px. Do not pair a 768px column with 14–16px text — Tailwind's own blog runs ~105 chars/line and only survives it because line-height 2 and constant code blocks keep breaking the measure. We will have paragraphs.

### 2.4 Colour tokens

**Derive, do not enumerate.** Two base colours plus a five-step alpha ladder produce the entire neutral system in both themes. This is Tiger's docs system and Tailwind's alpha system agreeing, and it is the single best idea in the research.

```css
:root {
  --ink:   #0A0A0A;          /* light-mode foreground */
  --paper: #FFFFFF;          /* light-mode background  (a direction may use #FAFAF7) */

  --color-bg:      var(--paper);
  --color-ink:     var(--ink);
  --color-surface: color-mix(in srgb, var(--ink) 3%,  var(--color-bg));
  --color-sunken:  color-mix(in srgb, var(--ink) 6%,  var(--color-bg));
  --color-line:    color-mix(in srgb, var(--ink) 12%, var(--color-bg));
  --color-line-strong: color-mix(in srgb, var(--ink) 22%, var(--color-bg));
  --color-muted:   color-mix(in srgb, var(--ink) 60%, var(--color-bg));  /* ≈ #666 — 5.7:1 ✓ */
}

[data-theme="dark"] {
  --ink:   #FAFAFA;
  --paper: #0B0B0C;          /* not pure black, not navy. #101011 also permitted. */
  /* every token above re-resolves. Nothing else is redeclared. */
}
```

**The alpha ladder is 3 / 6 / 12 / 22 / 60.** Those five numbers are the entire neutral system. Do not invent a 4% or an 18%. Do not hardcode a grey hex anywhere in a component — if you write `#71717A` in a component file, you have broken dark mode.

**Accent — one hue, chosen per direction from the brief's four candidates:**
`#3DDC97` phosphor mint · `#FFB000` terminal amber · `#FF4D2E` signal red · `#FF2A6D` magenta.

I computed the contrast on all four. **Not one of them reaches 4.5:1 as text on white** (mint 1.77:1, amber 1.85:1, red 3.32:1, magenta 3.61:1). Therefore:

> **LAW: the accent is never a text colour in light mode.** In light mode the accent may only be: an underline, a 1px rule, a fill *behind* ink-coloured text, the terminal caret, a focus ring, a small non-informational mark, or a chart/diagram stroke. In dark mode all four clear 9:1 against `#0B0B0C` and may additionally be used as text — but do not, because then the two themes stop matching. **Links look the same in both themes: ink text + accent underline.**

**Accent budget: three appearances per page maximum**, and one of them should be the focus ring, which is free.

Additionally: `--color-on-accent: #0A0A0A` always. Every candidate is light enough that black text on it passes; white text on any of them fails.

**Banned:** Tailwind default palette classes (`bg-indigo-600`, `text-slate-500`). Any second accent. Purple→pink or blue→cyan gradients, on text especially. Any gradient at all except one permitted radial `--color-line`-strength wash behind the closing CTA, at ≤6% opacity.

### 2.5 Nav pattern — fixed for all five directions

```
height        56px (one value; marketing and docs both — we are not big enough to
              justify Tiger's 70/56 split, and a single number can never drift)
position      sticky, top 0, z 30
background    solid var(--color-bg). NO blur, NO transparency.
border-bottom 1px var(--color-line), always present
inner         max-width var(--shell), gutter padding, flex, align center
scroll-padding-top: 72px   (56 + 16) on :root, so anchor jumps clear the bar
```

**Left cluster:** `PixelMark` (24px) + wordmark in pixel 16px + a version tag `v2.0.3` in pixel 12px inside a 1px `--color-line` box, 0 radius, `4px 6px` padding, `--color-muted`.

**Right cluster, in this order, and this is the only correct order:**
`Docs` → `Blog` → theme toggle (28px icon button, visible, not buried in a menu) → **`StarButton`** (the only bordered/filled element in the header).

**Four items. That is the whole nav.** Do not build a dropdown. Do not build a mega-menu. Tiger's six-item nav with 25 dropdown links is sized for a five-product company; at our size an empty dropdown reads as an abandoned project. Nav links are sans 14px/500, `gap: 24px`, `--color-muted`, → `--color-ink` on hover, with the active page at `--color-ink` weight 500 and **a 1px accent underline** (the only accent in the chrome).

Below 768px: link cluster collapses behind a 44px icon button opening a full-height sheet (not a dropdown). The star button stays visible at all widths — it is the funnel.

**Search:** not in v1. When it ships, it is a `⌘K` chip (`1px --color-line`, 0 radius, pixel 12px showing the literal shortcut), backed by **Pagefind**, not Algolia — DocSearch requires an approved application we cannot get yet, and blocking on it is a self-inflicted wound.

### 2.6 Buttons — one geometry, three ranks

| | Fill | Border | Text | Height | Padding | Radius |
|---|---|---|---|---|---|---|
| **Primary** | `--color-ink` | none | `--color-bg` | 44px | `12px 20px` | 4px |
| **Secondary** | none | `1px --color-line-strong` | `--color-ink` | 44px | `12px 20px` | 4px |
| **Tertiary** | none | none | `--color-ink` | 44px | `12px 4px` | 0 |

- Label: **sans 14px / 500**. (Not pixel — buttons are read, not scanned.)
- **44px minimum height on everything clickable, everywhere** (hard requirement).
- Hover: primary lightens/darkens fill by one alpha step; secondary darkens its border `--color-line` → `--color-line-strong` → `--color-ink`. **Nothing lifts. Nothing glows. Nothing scales.**
- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px;` globally on `:focus-visible`. This is one of your three accent appearances and it is free.
- **Never two primaries side by side.** Hero has exactly one primary; its partner is a secondary or a `CopyCommand`.
- Optional signature, worth stealing from Zed: a **kbd chip** on buttons — pixel 12px inside a `1px --color-line` box at `--color-muted`. `Read the source  S`. It costs nothing and it says keyboard-first, which is literally our product.

### 2.7 Code-block treatment (the full spec)

```
BLOCK
  background   var(--color-surface)        /* ink@3% — recessed, same family as page */
  border       1px solid var(--color-line)
  radius       4px
  padding      16px 20px
  font         JetBrains Mono 14px / 1.6, weight 400
  tab-size     2
  overflow-x   auto
  max-height   560px, with scrollbar-color: var(--color-line) transparent
  margin       24px 0 32px

CAPTION BAR (when the block has a filename — use it whenever the file matters)
  height 32px, padding 0 20px, border-bottom 1px var(--color-line)
  JetBrains Mono 12px, var(--color-muted), left-aligned, the literal path: pages/about.ts
  Block radius stays 4px; the caption bar takes the top two corners.

COPY BUTTON
  32px square, top-right, icon only, no "Copy" word.
  opacity .45 AT REST, 1 on hover/focus.  ← NOT hover-revealed.
  Hover-revealed copy buttons fail our "nothing hover-only" requirement on touch.
  Confirmation: swap icon to a check for 1.2s. No toast, no colour change.

INLINE CODE
  font-family JetBrains Mono; font-weight 500; font-size .9em; color inherit
  code::before, code::after { content: "`" ; }
  NO background. NO border. NO padding. NO pill.

SYNTAX HIGHLIGHTING
  Shiki, dual-theme, emitted inline as CSS custom properties per token
  (--shiki-light / --shiki-dark), switched by ONE rule under [data-theme="dark"].
  Zero JS, zero flash, no re-render, no theme drift.
  Maximum SIX token colours, all desaturated (target chroma ≤ 0.10 in oklch).
  If a token colour is more saturated than anything in the site chrome, it is too loud —
  it will compete with the terminal frames three inches below it.
```

**TERMINAL FRAMES ARE NOT CODE BLOCKS.** They are the other thing, and the visual difference must be unmistakable at a glance:

```
FRAME
  A window: 1px var(--color-line-strong) border, 6px radius, background = the frame's own
  captured background colour (dark, whatever the demo's theme was).
  Title bar 32px: three 10px dots, ALL ONE NEUTRAL COLOUR (do NOT use red/amber/green
  traffic lights — that is a macOS costume, and one of our accent candidates is amber),
  centred title in JetBrains Mono 12px at 60% of the frame's foreground.
  Body: the frames.json rows in a <pre>, JetBrains Mono, line-height 1.0 (it is a cell grid),
  auto-fit to container width, never allowed to overflow horizontally.
  Below the frame: a <figcaption> in sans 14px var(--color-muted), stating what it is and
  which demo produced it.
  NO drop shadow. NO 3D perspective tilt. NO hover-to-flatten. T3 and Zed both tilt theirs;
  §7 bans it and it makes the pixel grid non-integer, which visibly smears our type.
```

Rule of thumb: **caption bar + quiet surface = "type this". Window chrome + dark field = "this appears".** Never let a reader be unsure which they're looking at.

### 2.8 How the GitHub funnel works

Target: `github.com/OmarMusayev/terminaltui`. Live star count, graceful fallback to **37**.

**The `StarButton` component** — one component, three sizes, used everywhere:

```
[ ★  Star   37 ]
  ^   ^      ^
  |   |      pixel 16px (or 24px at lg), .tnum, --color-ink
  |   sans 14px/500
  16px star glyph (stroked, not filled), --color-muted

sm  → 44px tall, 1px --color-line border, 4px radius, no fill      (nav)
md  → 44px tall, secondary button styling                          (inline in sections)
lg  → 52px tall, PRIMARY styling (ink fill)                         (closing CTA only)
```

Fetch on the client from the GitHub API with a hardcoded `37` rendered server-side as the fallback, so the number is in the static HTML and never flashes or shows a skeleton. If the fetch fails, nothing changes. **`.tnum` on the numeral so it does not jump when the count changes.**

**Placement — exactly four, at conviction peaks, not sprayed:**

| # | Where | Size | Why there |
|---|---|---|---|
| 1 | Nav, right end | sm | Always reachable; the only bordered element in the header |
| 2 | Immediately after the comparison table | md | Peak conviction #1 — they have just decided we are different |
| 3 | After the demos / what's-in-the-box gallery | md | Peak conviction #2 — they have just seen it work |
| 4 | Closing CTA | lg | The one filled star button on the page |

**Secondary GitHub routes, all of which work at 37 stars:**
- Hero secondary action: **"Read the source"** (Zed's "Clone source" reframed). Not "View on GitHub", which is dead copy. Not "Star us", which begs.
- **"Edit this page on GitHub"** at the foot of every docs page and every blog post — sans 14px, `--color-muted`, with the file path in mono. This is the highest-intent visitor on the site and Tiger, Tailwind and Ghostty all waste them.
- Footer: `GitHub` in a Community column, plain text link, no count.

**Banned:** shields.io badges anywhere. A contributor wall or avatar grid. A "trusted by" row. A star count outside the StarButton. Any language implying scale we don't have. Fake urgency of any kind.

---

## 3. Home page — section order

Ten required blocks (per `BUILD_SPEC.md`). This is the order, with the argument for each position. A direction may re-weight and re-treat freely; it may not reorder without writing down why.

| # | Section | Density | Why it sits here |
|---|---|---|---|
| **1** | **Hero** — wordmark, positioning line, `npx terminaltui try`, star, **and a real terminal frame** | breathe (144) | A stranger must know what this is in five seconds, and the only thing that does that is showing the output. Everything else is a claim. |
| **2** | **File-based routing** — `pages/about.ts` file tree beside the screen it produces | normal (96) | The one thing literally nobody else does. Put the differentiator second, before attention decays, not buried at #7 with the other features. |
| **3** | **Distribution — npm and SSH** | dense (64) | Completes the pitch sentence started in the hero: *easy to build* (§2) *, easy to ship* (§3). Two halves of one idea should be adjacent. |
| **4** | **What's in the box** — 30+ components, 10 themes, 12-col grid, ASCII, shown as a demo gallery | breathe (144) | "Premium by default" is the third pillar and it is a *visual* claim, so it needs the most room and the most frames. This is the page's second wide moment. |
| **5** | **Images in the terminal** | normal (96), **grid-breaking** | The most surprising capability and the newest. It is the section that earns the mandatory §7 asymmetry — make it the one that breaks the column. Mark video as roadmap, in the same breath. |
| **6** | **Comparison table** (with `comparison.caveat` visible) | dense (64) | Decision content. It only lands *after* they believe the capabilities are real; before that it reads as posturing. **Star CTA immediately below it.** |
| **7** | **Testing — the headless PTY emulator** | dense (64) | The credibility close: *every terminal image on this page was captured with it.* Placed after the comparison so it answers "but is it actually engineered?" |
| **8** | **Roadmap**, with `status` rendered honestly | dense (64) | The young-project disclosure. It belongs late — after conviction, where honesty reads as confidence, not as an excuse. |
| **9** | **Latest writing** — 2–3 posts | dense (64) | Proves the project is alive and hands the reader to the blog, which is where the engineering stories actually convert. |
| **10** | **Closing CTA** — star, with the real number | breathe (144) | One pixel line at the same size as the h1, one primary star button, nothing else. No paragraph, no form, no card. |

**Rhythm check (this is what §7 is really asking for):** `144 · 96 · 64 · 144 · 96 · 64 · 64 · 64 · 64 · 144`. Two loud breathing moments near the ends, one in the middle, and a dense run through 6–9. If your densities read `96 96 96 96 96`, you have failed.

**Treatment variety is mandatory.** Across these ten sections you must use at least five different shapes: a wide figure, a two-column split, a table, a bordered row list, a code+output pair, a single large statement line. **Three consecutive `<h2>` + centred one-liner + 3-up card grid is an automatic rejection.**

**Copy budget: under 900 words of body copy on the entire page.** Every feature description is **one sentence under 90 characters.** If a feature needs two sentences, the feature is wrong, not the copy. Cut adjectives, never facts.

---

## 4. Blog — index

```
SHELL         --shell (1200), standard gutters
HEADER BLOCK  h1 in pixel 48px (desktop) / 32px (mobile) — same treatment as the home
              hero so the blog reads as the same site, not a bolt-on.
              One sans 19px line beneath it, --color-muted, max-width 620px.
              margin-bottom 64px.
              RSS link, visible, sans 14px, right-aligned on the h1 baseline.

LIST          A ruled table, not cards. NO featured post. NO cover images. NO avatars.

  grid, lg:  [144px  32px  minmax(0,1fr)]     ← date col, gutter, content
  below lg:  single column, date moves inline above the title

  Each row:
    full-bleed 1px --color-line hairline top and bottom (rows share edges)
    padding 24px 0
    DATE      pixel 12px UPPER, +0.12em, --color-muted, .tnum
              <time datetime="2026-07-14">14 JUL 2026</time>   ← ISO 8601 in the attribute,
              ALWAYS. t3.gg emits a raw JS Date string; it is invalid and useless to feeds.
    TITLE     sans 21px / 600 / --color-ink / -0.01em.  No underline at rest.
    EXCERPT   sans 16px / 1.6 / --color-muted / line-clamp: 2 / max-width 620px / mt 8px
    TAGS      pixel 12px UPPER +0.12em in a 1px --color-line box, 0 radius, 3px 6px padding,
              --color-muted.  MONOCHROME.  Border darkens on hover.
              NEVER colour-code tags — coloured category pills are the single fastest way
              to make a small blog look like a template.
    READ TIME sans 14px --color-muted, separated from the tag row by a 4×4px SOLID SQUARE
              (Tiger's detail — not a bullet, not a slash, not a middot).

  Whole row clickable via <a class="absolute inset-0"> containing the title text
  (stays in the accessibility tree). Hover = a 1px accent bar animating width 0→100%
  over 200ms at the row's bottom edge, guarded by prefers-reduced-motion.
  THIS IS THE ONLY MOTION ON THE BLOG.

  144px date column, NOT Tailwind's 384px. 384px is 28% of the width holding one line
  of text — a rhythm flex that needs forty rows to pay off and reads as a void at four.
```

**Tag filter row:** only once there are ≥8 posts and ≥3 tags. Below that it is chrome advertising an empty archive. **Pagination:** a `Load more` button (explicit click, never infinite scroll) only above 20 posts.

**Feeds:** declare `/rss.xml` (RSS 2.0) in `<head>`, and link it visibly. Per-post OG images generated at build time — **a terminal frame or a typographic pixel card, never stock photography.**

---

## 5. Blog — post

```
LAYOUT     Single column, centred. NO left author rail (we have one maintainer; Tailwind's
           352px rail holding one 48px avatar is 24% of the width doing nothing).
           NO cover image.

HEADER     max-width 620px, centred
  eyebrow   pixel 12px UPPER +0.12em --color-muted:  the date, then a 4×4px square, then
            read time.  <time datetime> in ISO 8601.
  h1        sans 48px/1.1/600/-0.025em desktop; 36px/1.2 mobile.  max-width 620px.
            SANS, not pixel — a post title is a sentence you read, and titles are long.
  standfirst sans 19px/1.55 --color-muted, one or two sentences, mt 24px
  byline    sans 14px --color-muted, inline, mt 24px. No avatar.
  rule      full-bleed 1px --color-line, mt 48px, mb 48px

BODY       max-width 620px · sans 17px / 1.65 · --color-ink
           ≈ 68 characters per line. This is the brief's number and it is correct.

TOC        Right rail, 200px, sticky top 72px, ONLY above 1280px (max-xl:hidden below).
           Label in pixel 12px UPPER. Entries sans 14px/1.9, active state = 1px left
           border in --color-ink plus weight 500. No pill, no accent, no background.
           Mandatory on any post over ~2000 words. A 12,000px post with no TOC is a real
           usability failure — Tailwind ships one and it is a genuine defect, not a style.
```

**Prose system — define it once as custom properties and never touch it again:**

```css
.prose {
  --prose-body:        var(--color-ink);
  --prose-heading:     var(--color-ink);
  --prose-strong:      var(--color-ink);
  --prose-muted:       var(--color-muted);
  --prose-link:        var(--color-ink);
  --prose-link-underline: var(--color-accent);
  --prose-marker:      var(--color-line-strong);
  --prose-rule:        var(--color-line);
  --prose-quote-border: var(--color-line-strong);
}
/* dark mode redeclares NOTHING — every value already resolves through the theme tokens. */
```

Vertical rhythm is **one adjacent-sibling rule**, not per-element margins:

```
.prose  * + *              margin-top: 24px
        h2                 margin-top: 64px   (sans 28px/1.3/600)
        h3                 margin-top: 48px   (sans 21px/1.4/600)
        h2 + h3            margin-top: 24px
        h2,h3,h4           scroll-margin-top: 72px
        hr                 margin-block: 64px, border-color var(--prose-rule)
        pre                margin-top 16px, margin-bottom 32px
        figure             margin-block: 40px
        figcaption         sans 14px, --color-muted, mt 12px, LEFT-aligned (not centred)
        ul                 padding-left 24px; list-style: square
        li                 padding-left 8px
        li + li            margin-top: 12px
        blockquote         border-inline-start 2px var(--prose-quote-border);
                           padding-inline-start 20px; NOT italic; --color-muted
        table              sans 14px/1.4, thead 1px bottom border, per-row bottom borders,
                           last row's removed, first/last cell outer padding stripped so
                           the table sits flush with the text column. .tnum on numeric cols.
                           Wrapped in a div{overflow-x:auto} ALWAYS.
```

**Links in prose:** `color: var(--prose-link); font-weight: 500; text-decoration: underline; text-decoration-color: var(--prose-link-underline); text-decoration-thickness: 1px; text-underline-offset: 3px;` and on hover `text-decoration-thickness: 2px`. **Bold near-black text with a coloured underline reads as emphasis; accent-coloured link text reads as a rainbow** — and per §2.4 it also fails contrast in light mode.

**One steal from Tailwind worth taking verbatim:** `.prose h2:has(+ h3) { font: 12px pixel; text-transform: uppercase; letter-spacing: .12em; color: var(--color-muted); }` — an h2 that merely labels a group of h3s automatically demotes itself to an eyebrow. It costs one rule and it makes long reference posts look edited.

**Post pages carry:** a `Edit this page on GitHub` link with the source path, prev/next post links, and the RSS link. **Not:** share buttons, comments, related-posts grids, reading-progress bars, or an author bio card.

---

## 6. Docs shell (baseline, for whichever direction builds it)

One Astro project, one token file, **two visual modes** — not two codebases. Tiger runs a whole second Astro app with leftover Mintlify compatibility classes shipping in production markup; that is company-scale maintenance and visible debt.

```
grid, lg:   [240px  1fr  200px]   gap 40px, inside --shell
below lg:   single column; sidebar → 44px hamburger sheet; TOC → a <details> disclosure
            (NOT a JS framework island — create.t3.gg ships headlessui purely to render a
            dropdown on a static page)

NAV         56px, identical to marketing. One nav, one height, sitewide.

SIDEBAR     sticky top 56px, own scroll container, max-height calc(100dvh - 56px), pad 24px
            Groups: pixel 12px UPPER +0.12em --color-muted, gap 32px between groups
            Links:  sans 14px/1.7 desktop, 16px/2 MOBILE (bigger touch targets), gap 8px
            Active: 1px left border in --color-ink + weight 500. Nothing else.
                    No pill, no fill, no accent, no icon. Works identically in dark mode.
            ~20 pages → FLAT, 3–4 groups, never collapsed, no accordion.

CONTENT     max-width 680px · sans 16px/1.7
            docs h1  sans 36px/1.2/600
            docs h2  sans 28px/1.3/600
            docs h3  sans 21px/1.4/600
            eyebrow above h1: pixel 12px UPPER = the section name
            Reserve a fixed 32px slot above the h1 for breadcrumbs so the heading never
            shifts between pages that have them and pages that don't.

FOOT        prev/next links (REQUIRED — our docs are read front-to-back, unlike a
            200-entry utility reference) + "Edit this page on GitHub" with the file path.
```

**Do not build:** a version dropdown, multi-version routing, Algolia, or a deep collapsible tree. All four signal maintenance commitments we have not made.

---

## 7. The ten rules that most separate professional from amateur here

In order of how much damage breaking them does.

1. **Keep the chrome monochrome so the frames can be the colour.** One accent, three appearances per page, never as text on white, never on a filled button. The instant the UI has a second hue, twenty-seven real terminal captures stop being the point of the page and become wallpaper.

2. **Render pixel type only at 12/16/24/32/48/64, with `font-synthesis: none` and smoothing off above 24px.** A pixel font at 17px is smeared and every designer who has ever used one can see it from across the room. Off-grid pixel type is the loudest amateur signal available to us, and it is free to avoid.

3. **Every boundary is a 1px hairline. Zero `box-shadow`, site-wide, no exceptions.** Prefer full-bleed rules that run past the content column to the viewport edge. Shadows "for depth" and rounded-2xl-with-soft-shadow are the exact tells §7 is describing, and each individual exception feels harmless while collectively destroying the system.

4. **Commit to sharp: 0 and 4px, plus 6px on the terminal window only.** Mixed radii — 4 here, 12 there, a pill in the nav — is what a page assembled from tutorials looks like. One radius vocabulary, applied without exception, reads as authored.

5. **Vary the rhythm and vary the treatment.** Three section densities (64/96/144), at least five different section shapes across ten sections, exactly one section that breaks the grid. A page where every section is heading + centred line + 3-up cards at identical spacing is the #1 AI tell in 2026, and it is a rhythm problem, not a colour problem.

6. **One sentence per feature, under 900 words on the home page, and every number traceable to `product.ts`.** The moment a feature gets a second sentence, the grid goes ragged, the 16px body starts competing with the heading, and the page reads as a wiki. And never a bare percentage — never "67% fewer bytes." The true, sayable version is: *when nothing on screen changes, the renderer writes nothing at all.*

7. **Derive light and dark from two base colours and a 3/6/12/22/60 alpha ladder.** Two hand-maintained palettes always diverge; within a month one theme has a grey the other doesn't. If a component file contains a grey hex, dark mode is already broken.

8. **Code blocks are quiet recessed panels; terminal frames are loud windows. Never confuse the two.** The reader must always know instantly whether they are looking at something they type or something they get. This distinction is our entire product story rendered in CSS, and no reference site had to solve it.

9. **Near-zero motion, and nothing hover-only.** One thing may move and it must earn it (the 1px hover underline is the house allowance). No scroll-triggered fade-up, no staggered reveals, no looping typewriter, no 3D tilt. Copy buttons and metadata are visible at rest, because a phone has no hover. Honour `prefers-reduced-motion` completely.

10. **Be exactly as big as we are.** 37 stars shown plainly beats a badge. No "trusted by," no logo wall, no testimonial marquee, no contributor grid, no sponsor row. A section-shaped hole where social proof would go is worse than no section — and honesty is the only credibility signal available to a young project, so spend it deliberately: three runtime dependencies, 3,323 tests, 11 demos, zero-byte idle frames. Product facts, not popularity facts.

---

## 8. What NOT to copy from these sites

**From tigerdata.com**
- The empty hero. Zero `<pre>`, zero `<code>`, no product visual. That works when the product is a claim; for us it is malpractice. Copy their density and their 5:1 type ratio, never their emptiness.
- Four sections of social proof (Trusted-by marquee, the 3-trillion-metrics stat band, the four-customer slab, the partner grid) — roughly a third of the page exists to display other companies' names. Redesign around what we can show, do not trim theirs down.
- A 1440px shell with a six-item mega-menu nav. At our size the dropdown reads as an abandoned project.
- The featured-split blog index. It needs six posts and a commissioned 677×381 illustration each.
- The 80px h1 at -0.03em without checking the headline length. Theirs is 36 characters.
- Two separate design systems and two build pipelines for marketing and docs.
- **And do copy the thing they got wrong by omitting: "Edit this page on GitHub."**

**From tailwindcss.com**
- The mono annotation strips labelling each element with its own utility classes. That is an in-joke that lands only because Tailwind's product *is* class names. Lifting the device without the joke is decoration and reads as noise.
- 96px type at weight 400. It survives on Inter's display cut; it will not survive on a pixel font, where 96px is off our integer grid anyway.
- 768px measure paired with 14px body (~105 chars/line). Their posts are mostly bullets and code that keep breaking the measure. Ours will be paragraphs.
- 160px uniform section gaps and 96px hero padding on a page with fewer than twelve sections.
- Permanently-dark code blocks in light mode (§1.6).
- Hover-revealed copy buttons — they fail on touch.
- A flat, never-collapsed 200-item sidebar; a version dropdown; Algolia.
- The 384px blog date column, and the omission of prev/next and of a TOC on very long posts.

**From t3.codes / t3.gg / create.t3.gg**
- The endorsements marquee: 19 named tweets, "100,000 devs," a 14k-star nav pill. None of it scales down; a marquee of three tweets reads as desperate.
- The zero-link nav. It works only because that site has no docs and no blog. We must have both from day one.
- `backdrop-filter: blur(18px)` on the nav — banned by §7.
- Hiding the product image below 820px. For a desktop app, defensible. For a framework whose output *is* the image, fatal.
- A static screenshot where the product is live output.
- Long-form prose set in monospace. It survives short opinion posts; it will fight a post explaining a layout algorithm with tables and diagrams.
- A raw JavaScript `Date` string in `<time datetime>` — invalid HTML and worthless to feed readers. Emit ISO 8601.
- Per-row inline `animation-delay` staggering with no reduced-motion guard.
- Render-blocking Google Fonts. Self-host all three faces as woff2, `preload` the pixel font and the sans, `font-display: swap`.
- create.t3.gg's code blocks: 4px radius, translucent purple border, asymmetric padding, `shadow-xl`, no visible syntax theme, no filename bar, no copy button. Invert every one of those choices.
- Dotted underlines on body links. They read as spelling errors at body size.
- Its features grid built from borrowed logos (Next.js/Prisma/tRPC) — we have no partner brands and must argue from our own capabilities.
- **And invert their headline stance entirely:** "Your agents deserve better than a terminal" is a direct attack on our medium. Our closing line reclaims the terminal; it never apologises for it.
- Also invert: "we are not accepting contributions." At 37 stars we need the exact opposite — a visible good-first-issue path and a CONTRIBUTING link in the footer.

**From ghostty.org / zed.dev / bun.com**
- Ghostty's chrome-less, no-nav, single-viewport home. It works because Ghostty is one binary with one action. A framework has an API to explain, and ~30 words of indexable copy is an SEO decision we cannot afford.
- Ghostty's mascot-driven hero art. We have no mascot; our equivalent is a real running app, which is better.
- Zed's commissioned typefaces and brand system, its "trusted by world-class developers" band, and its team-photo section.
- Zed's client-rendered blog index — in a headless fetch the post list is an empty 400px void. **Ours is static HTML** (§9.3 of the brief: never text that exists only in JS).
- Zed's and T3's 3D-tilted product frames. A perspective transform puts our pixel grid on non-integer coordinates and visibly smears the type.
- Bun's eleven identical 150px-padded sections, its 16,364px page height, its 14-logo "USED BY" wall, and its case-study sections.
- Bun's benchmark widget — it requires a maintained benchmark suite and honest competitor numbers, and any benchmark we ship without both is exactly the "67% fewer bytes" mistake in a new costume.
- Bun's weight-800 headings and macOS traffic-light colours in window chrome.

**Do steal, from all of them:** Ghostty's product-as-live-text hero. Zed's DOM-not-screenshot principle and its keyboard-shortcut chips. Tailwind's full-bleed hairlines, prose custom-property system, single adjacent-sibling margin rule, backtick inline code, and `h2:has(+h3)` auto-demotion. Tiger's opacity-ladder token system, bordered-row feature lists, 4×4px square metadata separator, monochrome tag chips, and 1px-underline hover. T3's derive-surfaces-from-alpha discipline, accent-off-buttons rule, and the practice of stating maturity in plain words. Bun's labelled install block. Nobody's social proof.

---

## 9. What the five directions MAY vary

Everything above is fixed. These are the levers that make five sites distinct rather than five skins:

- **Accent hue** — one of the four candidates, per direction.
- **Default theme** — light or dark (both must be correct either way).
- **Paper** — `#FFFFFF` or `#FAFAF7`; dark `#0B0B0C` or `#101011`.
- **Hero headline path** — **(A)** pixel h1 at 48/64px, hard-broken, ≤22ch per line, with a sans 16px subhead one size-step down; or **(B)** sans h1 at 48/64px/600/-0.03em with a pixel 12px eyebrow above it. Path A is more branded; path B carries a longer headline. Both are correct; commit to one.
- **The signature device** — each direction picks exactly ONE and uses it consistently: full-bleed hairlines · a hatched/ruled engineering gutter · pixel-grid crosshairs at rule intersections · a dot-matrix section marker · numbered mono section indices. **One. Not two.**
- **Section shape vocabulary** — which five of the permitted shapes you use, and which section breaks the grid.
- **Frame presentation** — inline in the column, full-bleed, offset into a gutter, or paired code+output.
- **Which of the ten home sections gets the "breathe" density** beyond the fixed hero and closing CTA.

If two directions come back looking the same, the failure is in this list, not in the baseline.