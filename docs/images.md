# Images

`image()` renders a real PNG or JPEG in the terminal. On most terminals it is drawn as colored character cells — ordinary styled text, no native dependency, no `sharp` install — and on terminals that speak the kitty graphics protocol (kitty, Ghostty) it is drawn as **real pixels**. Both paths are chosen automatically, produce the same number of rows, and survive layout, scrolling, clipping and the frame diff identically.

```ts
import { image } from "terminaltui";

content: [
  image("./assets/cover.png", { width: 60, alt: "Album cover" }),
]
```

## How it works

**The cell path** (Apple Terminal, iTerm2, WezTerm, Alacritty, VS Code, tmux, most SSH clients) paints each terminal cell with one block-element glyph plus a foreground and a background color, so a single cell can carry up to four independently colored sub-pixels:

```
█ = one cell        ▘▝  = quadrant glyph, 2×2 sub-cells
                    ▖▗    fg color paints the "ink" sub-cells
                          bg color paints the rest
```

The image is decoded synchronously, box-filtered down to a sub-cell grid, and then each cell picks the glyph-plus-two-colors combination with the lowest error, with both pens snapped onto the palette the terminal can actually display. That is the whole pipeline, and it runs inside the normal render pass — `renderBlock()` never awaits.

**The pixel path** (kitty, Ghostty) transmits the decoded image to the terminal once and then draws a grid of *Unicode placeholder cells* that tell the terminal where to paint it. The rows are still rows: they measure the right number of columns, clip, scroll and diff like any other text. See [Real pixels: the kitty tier](#real-pixels-the-kitty-tier).

Because both outputs are just cells, images survive everything else the framework does to a line: width measurement, truncation, panel clipping, column layout, the per-row frame diff, and the SSH write path.

## Quick start

```ts
// pages/gallery.ts
import { image, section } from "terminaltui";

export default function Gallery() {
  return [
    section("Cover", [
      // Fills the available content width; height derived from the file's
      // real aspect ratio.
      image("./covers/nocturne.png"),

      // Sized, capped, framed and captioned.
      image("./covers/nocturne.png", {
        width: 48,
        maxHeight: 14,
        border: true,
        alt: "Nocturne — 2026",
      }),

      // Focusable. The viewer grows it with `+` and shrinks it with `-`,
      // and the picture gains real detail as the frame grows.
      image("./covers/nocturne.png", { width: 40, resizable: true }),
    ]),
  ];
}
```

Images are **not focusable** — arrow-key navigation skips them — unless you pass `resizable: true`. See [Resizable frames](#resizable-frames).

## Options

`image(path, options?)`. Every option is optional.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | fills the available content width | Width in terminal **cells**. Capped at 99 (the content column, minus the focus gutter). |
| `height` | `number` | derived from the source aspect | Height in **rows**. Exact under `fit: "fill"` and `"cover"`; a ceiling under `"contain"`. |
| `maxHeight` | `number` | the enclosing panel's height, else 200 | Hard cap on derived rows. |
| `fit` | `"contain" \| "cover" \| "fill"` | `"contain"` | See [Fit](#fit-and-geometry). |
| `align` | `"left" \| "center" \| "right"` | `"center"` | Horizontal placement inside the block's allocation. |
| `mode` | `ImageMode` | `"auto"` | Force a rendering tier. See [The tier ladder](#the-tier-ladder). Pinning any mode also **disables the pixel path** for that block. |
| `dither` | `"auto" \| "ordered" \| "floyd-steinberg" \| "none"` | `"auto"` | See [Dithering](#dithering). Ignored on the pixel path. |
| `alt` | `string` | the file's basename | Shown in the fallback box on any failure. |
| `background` | `string` | the theme's background | Hex color composited under transparent pixels. Applies on both paths. |
| `invert` | `boolean` | `false` | Negate the image's ink. Transparent regions still composite to `background`, so a logo with a transparent surround does not grow a bright box. Applies on both paths. |
| `charset` | `string` | `" .:-=+*#%@"` / `" ·:░▒▓█"` | Ramp for the `ascii` and `shading` tiers, darkest first. Rejected (and the default used instead) if any character is not one display column wide. |
| `border` | `boolean \| BorderStyle` | `false` | Draw a themed border. `true` uses the site's style, a style name overrides it. Adds 2 columns and 2 rows **around** the image area. |
| `resizable` | `boolean` | `false` | Let the viewer resize the frame at runtime. **Makes the block focusable** and adds one hint row. See [Resizable frames](#resizable-frames). |
| `fitPage` | `boolean` | `false` | Size the image to the rows the page has left, instead of to a width you picked by hand. See [Fitting the page](#fitting-the-page). |

`width`, `height` and `maxHeight` size the **image**; the border is added outside them. `{ width: 40, border: true }` occupies 42 columns and image-rows + 2.

Zero, negative and `NaN` dimensions all mean "unspecified" rather than zero, so a bad expression falls back to the default instead of rendering a one-cell sliver.

## Fit and geometry

Terminal cells are about twice as tall as they are wide, so the row count is `round(cols × srcHeight / srcWidth × 0.5)`. A 1600×1000 PNG at 60 columns is 19 rows.

| `fit` | Behavior |
|-------|-----------|
| `"contain"` (default) | Largest aspect-correct box that satisfies every constraint. **Never letterboxes** — the block just gets smaller. |
| `"cover"` | Fills the requested box exactly, cropping the source from the center. |
| `"fill"` | Fills the requested box exactly, stretching the source. |

`"contain"` not letterboxing is the one behavior that surprises people. Asking a 1600×1000 source for `{ width: 24, height: 4, fit: "contain" }` yields a **14×4** block, not 24×4 — you cannot both honor an exact box and preserve aspect. Pass `fit: "fill"` (or `"cover"`) when the box matters more than the aspect.

Geometry is computed from the file **header**, which is read without decoding pixels (~0.01 ms). The consequence that matters: the layout engine and the renderer call the same function, so a block reserves its final row count on the very first frame — before any pixel is decoded, identically whether the decode later succeeds or fails, and identically on the cell and pixel paths. Nothing below an image ever shifts.

Hard ceilings: **99 columns**, **200 rows**, **20,000 cells** total, **16 MB** source file, **8192×8192** source pixels.

## The tier ladder

`mode: "auto"` (the default) negotiates a tier from the viewer's terminal. Everything except the pixel row is a pure function of color depth and glyph coverage — no probe bytes are written for a cell tier, ever.

| Tier | Sub-cells | Colors | Glyphs | Selected when |
|------|-----------|---------|--------|---------------|
| `kitty` | **real pixels** | 24-bit | `U+10EEEE` placeholders | the terminal is confirmed to support the kitty protocol *with Unicode placeholders* — see [Detection](#automatic-detection) |
| `quadrant` | 2×2 | fg + bg | `▘▝▀▖▌▞▗` + space | truecolor or 256 color, Unicode, no multiplexer — **the default cell tier** |
| `half` | 1×2 | fg + bg | `▀` + space | truecolor or 256 color with a multiplexer detected (`TMUX`/`STY`, or a `TERM` starting `screen`/`tmux`), or an unrecognized remote `TERM` over SSH |
| `solid` | 1×1 | bg only | space | Unicode is unavailable — no UTF-8 in `LANG`/`LC_CTYPE`/`LC_ALL`, on a non-macOS host with no known-Unicode terminal marker. The only tier needing zero glyph coverage |
| `shading` | 1×1 | fg only | ` ·:░▒▓█` | **never automatic** — `mode: "shading"` only |
| `ascii` | 1×1 | none | ` .:-=+*#%@` | color is off entirely — `NO_COLOR` is set, or output is not a TTY (piped, redirected, CI) |
| `braille` | 2×4 | one fg | `U+2800`–`U+28FF` | **never automatic** — `mode: "braille"` only |
| `alt` | — | — | a bordered box | every failure path |

Order matters twice over:

- **The pixel tier is checked first**, because a terminal that can draw pixels is not limited by any of the constraints below it. But it is checked *after* the override and explicit-`mode` returns, so `TERMINALTUI_IMAGE=off` and `mode: "half"` both still mean what they say.
- **The cell guards are evaluated most-restrictive-first**, so a capability set that trips several rows always resolves to a tier that can actually be drawn. A 16-color multiplexer gets `half`; a 16-color terminal without one gets `quadrant`.

A 16-color terminal used to divert to `shading`, on the theory that half blocks with a 16-entry palette band worse than a luminance ramp reads. Rendered side by side that is not true: the ramp carries **one** sample per cell where quadrant carries four, and the quadrant image is a legible posterized photograph where the ramp is a coarse smear. The knob that actually mattered at 16 colors was the dither, not the tier — see [Dithering](#dithering).

Setting `mode` explicitly is honored **verbatim**, with no capability demotion and **no pixel path** — that is what makes a demo or a snapshot test byte-stable across machines. `mode: "blocks"` is the original published spelling of `"half"` and still works. There is no `mode: "kitty"`: pixels are negotiated, never authored, because a pinned pixel tier on a terminal that cannot draw it is a screen full of tofu.

Braille is opt-in because it is right for line art (plots, waveforms, logos) and wrong for photographs: 2×4 sub-cells at one color per cell is high spatial resolution and no tonal range.

```ts
image("./charts/streams.png", { mode: "braille", width: 60 })
image("./art/logo.png",       { mode: "half", width: 40 })  // pinned for a snapshot
```

## Real pixels: the kitty tier

On kitty and Ghostty an image is transmitted to the terminal as actual pixels and placed with **Unicode placeholders** — the kitty protocol's `U=1` variant. Each cell of the image is one `U+10EEEE` character carrying two zero-width diacritics that encode its row and column, and the image id is carried in the row's foreground color.

### Why placeholders and not ordinary placements

The kitty protocol also has a classic mode where the image is placed at the cursor and thereafter floats over the screen, owned by the terminal. This framework cannot use that mode, and the reason is architectural rather than aesthetic:

- **Placeholders occupy real cells.** A placement row is a string that `stringWidth()` measures as exactly `cols` columns. Every existing primitive therefore keeps working with no special case: `cutToWidth` clips it (and a clipped row is still a valid partial image, because each cell names its own coordinates), `Panel` scrolls it, `Columns` lays it out, and the per-row frame diff writes zero bytes when it has not changed.
- **The framework never clears the screen.** `writeToTerminal` emits no `\x1b[2J`, and navigation issues no clear — the frame diff is the whole redraw strategy. A cursor-anchored placement would therefore outlive the page that drew it and float over the next one.
- **Deletion becomes tractable.** Because the placement is anchored to cells the framework already tracks, "this image is no longer on screen" is just "its id stopped being placed this frame", which is a set difference rather than damage tracking.

The cost of the variant is that it is not universal: WezTerm, Konsole, Contour, Rio and Warp implement the graphics protocol without placeholders, so they get cells. See [Automatic detection](#automatic-detection).

### Lifecycle

| Event | What goes on the wire |
|-------|------------------------|
| An image appears | One transmission (chunked APC escapes, `a=T,U=1,t=d,q=2`), then `rows` placement rows in the frame |
| Every later frame | The placement rows only — and if nothing changed, the row diff writes **nothing at all** |
| The image leaves the screen (navigation, a block that stops rendering) | `a=d` delete for its id |
| The frame is invalidated out of band (terminal resize, full repaint) | delete, then re-transmit — the cells that anchored the image were erased, and re-transmitting onto a live id is unspecified behavior across terminals |
| The frame is resized (`resizable`) | The new size is a new cache key, so: delete the old id, transmit a new one at the new resolution |
| The app exits | Delete for every image this terminal still holds, before leaving the alt screen |

Transmissions carry `q=2`, so the terminal sends no acknowledgement and nothing can land in stdin as phantom keystrokes. Payloads go out **after** the frame, through the unfiltered output pipe — never through the row composer, which would shred base64 at the first `m`.

### Resolution and cost

The transmitted buffer is sampled at **10×20 pixels per terminal cell**, capped at 1.2 M pixels total (reached by roughly a 99×60-cell image; beyond it the sampling factor scales down uniformly rather than the image being refused). A bigger block therefore transmits a bigger buffer — which is what makes [resizable frames](#resizable-frames) gain real detail as they grow.

Transmission is the one genuinely expensive part of this protocol, and it is paid once per image, per size, per terminal:

| Block | Source buffer | Transmission | Placement rows, per frame |
|-------|---------------|--------------|---------------------------|
| 40×12 cells | 400×240 px | 376 KiB | 4.0 KiB (8.6 B/cell) |
| 60×19 cells | 600×380 px | 894 KiB | 9.3 KiB (8.4 B/cell) |
| 80×25 cells | 800×500 px | 1.5 MiB | 16.2 KiB (8.3 B/cell) |
| 99×30 cells | 990×600 px | 2.3 MiB | 23.9 KiB (8.2 B/cell) |

Opaque sources go out as `f=24` (RGB), which is 25% fewer bytes than RGBA. The placement column is the *worst case* — a static image re-renders to the identical rows, so the diff sends zero bytes per frame after the first.

Over SSH those numbers are the whole story of the tier: a kitty client connecting to `terminaltui serve` does get pixels, and does pay ~1 MB for a 60-column photograph on the frame it first appears.

### What is unchanged on the pixel path

Row counts, geometry, `fit`, `align`, `border`, `background`, `invert`, alt-text fallback, path resolution and the layout estimate are all identical to the cell path. `dither` and `charset` are cell-only and are ignored.

Every way the pixel path can fail — no runtime to carry the transmission, a footprint the 297-entry diacritic table cannot address, a source that will not decode — **demotes to the cell ladder**. It never throws, never emits a short block, and never paints placeholder cells the terminal has no image for.

## Automatic detection

Which path a terminal gets is decided once per session, in this order. The design rule is that **the default answer is "no pixels"**: detection is a positive allowlist, and every step that could be wrong fails toward cells.

1. **Overrides.** `TERMINALTUI_GRAPHICS=off` wins over everything. Any non-neutral `TERMINALTUI_IMAGE` value pins the cell path and therefore also denies pixels. `TERMINALTUI_GRAPHICS=kitty` forces pixels on, deliberately outranking every check below.
2. **Hard denylist — zero bytes written.** Apple Terminal (`TERM_PROGRAM=Apple_Terminal`); any multiplexer (`TERM` starting `screen`/`tmux`, or `TMUX`/`STY` set); `TERM` unset or `dumb`; CI; stdin and stdout not both TTYs. The CI, TTY and env-marker rules apply to *local* sessions only — in a `serve` session the server's own stdio says nothing about the client.
3. **Positive env allowlist.** `TERM` containing `kitty` (or `KITTY_WINDOW_ID` set) → pixels. `TERM` containing `ghostty`, or `TERM_PROGRAM=ghostty` → pixels. WezTerm → **cells, decisively**. Konsole → protocol yes, placeholders no, so cells.
4. **Everything else** → cells, and *only* this state permits a probe.

### The probe

A local, interactive TTY whose environment names no terminal we recognize is asked directly, once, during startup — after terminal setup and before input starts. The probe is a single write of a kitty graphics query, `XTVERSION`, and a primary-DA query as a sentinel, with a hard **300 ms** deadline (usually settled in single-digit milliseconds by the sentinel).

The important property is that the probe is *gated by the denylist rather than recovered from afterwards*: Apple Terminal, tmux, screen, CI, non-TTY stdio and every SSH session are provably sent **zero bytes**, because Apple Terminal prints the body of an unknown escape onto the screen and no timeout can undo that.

`XTVERSION` is part of the probe because a positive graphics answer alone does not tell you whether placeholders work — the split runs straight through the terminals that answer it. A terminal that names itself kitty ≥ 0.28 or Ghostty gets pixels; any other name, or none, gets transmit-only, which this framework treats as cells.

### Over SSH

For a `serve` session the client's pty-req `TERM` is the only evidence, and it is the only thing consulted: every local marker (`TERM_PROGRAM`, `KITTY_WINDOW_ID`, `TMUX`, `KONSOLE_VERSION`, the server's own TTY state) describes the *server* and is ignored. No probe is ever sent over SSH.

That means a kitty or Ghostty client that forwards `TERM=xterm-kitty` gets pixels, and a client forwarding `xterm-256color` gets cells — under-detection is the intended direction. The **cell** tier is negotiated from the client's `TERM` too, so a daemon running inside tmux no longer downgrades its clients. A `TERM` the ladder does not recognize makes that negotiation conservative: `half` blocks.

### Which terminal gets which path

| Terminal or context | Path |
|---------------------|------|
| kitty, Ghostty | **pixels** (`kitty` tier) |
| Apple Terminal | cells, `quadrant`; truecolor on Terminal.app 470+ (macOS 26 Tahoe), 256 colors below that. Never probed for pixels |
| WezTerm | cells, `quadrant`, truecolor — its kitty support is partial and has no placeholders, and a correct cell image beats a buggy pixel one |
| Konsole | cells — kitty transmit-direct only, no placeholders |
| iTerm2, Alacritty, foot, Rio, Contour, GNOME Terminal / VTE, Windows Terminal, VS Code | cells, `quadrant` |
| An unknown local terminal | cells, unless the startup probe answers for kitty or Ghostty |
| Inside tmux or screen | cells, `half` — a multiplexer cannot be interrogated from inside, and passthrough is off by default |
| Over SSH (`terminaltui serve`) | pixels if the client's `TERM` says kitty/ghostty, else cells negotiated from that same `TERM` — an unrecognized one is treated conservatively |
| Linux VT console, `TERM=vt100`, a bare `screen` | cells, `half` or `solid` — 16 colors no longer diverts to a ramp |
| Piped or redirected output, CI, the test emulator without a PTY | cells, `ascii` — non-TTY output gets no color. The emulator additionally denies graphics for every app it launches, PTY or not |
| `NO_COLOR=1` | cells, `ascii` — **on a cell terminal**. See the note below. |

> `NO_COLOR` suppresses SGR, not graphics: on kitty or Ghostty an image still renders as pixels, because the pixel tier sits above the color guards in the ladder. Use `TERMINALTUI_GRAPHICS=off` if you want a genuinely paint-free run.

## Fitting the page

A `width` is a number you picked by looking at *one* window. Change the terminal's
font size and it is wrong again — usually by scrolling a page that was meant to be
seen at once.

`fitPage: true` deletes the number:

```ts
image("./assets/poster.jpg", { fitPage: true, border: true })
```

The page composes every other block first, then hands this image whatever rows are
left in the content viewport; geometry back-solves the column count from the
source's own aspect. It is re-derived every frame, so a resize re-fits the page
rather than breaking it.

- `width` still applies as a **ceiling**, and `maxHeight` as a tighter cap — so
  `{ fitPage: true }` alone is the usual form.
- A fitted image is composed against the **whole terminal**, not the 100-column
  centred content column every other block lives in. That column is a measure
  chosen for prose, and since `contain` derives rows from columns, applying it to
  a picture capped the picture's height too: a 1080x709 source stopped at 34 rows
  however many it was granted, leaving a quarter of a tall window black. So on a
  window wider than the content column a fitted picture bleeds past it, which is
  what a one-sheet wants and the only place on a page it happens.
- The surplus is **kept around the picture**. `contain` means a wide source often
  cannot spend every row it is offered; those rows become symmetric margin inside
  the image's own slot rather than a black band under the last block, so whatever
  follows the picture still sits where the composition puts it.
- Several fitted images on one page **split the leftover evenly**, and each fills
  its own share the same way.
- A bordered image cannot go below **3 rows** (the border is dropped only when the
  block is too narrow, never when it is too short). If the rest of the page already
  fills the screen, the page scrolls — the option makes the picture elastic, it
  cannot make the other blocks smaller.

Inert in three places, so it can never change a layout that did not ask for it:

| Where | Why |
|-------|-----|
| On a `resizable` image | The viewer's chosen size wins. The two never combine. |
| Inside a `panel` / `columns` / `rows` / `grid` cell | The pane's own inner height already governs the image. |
| On the home page | It composes its own fixed layout. |

An image *without* the flag is unchanged in every respect: it may still run off the
bottom of the page and be scrolled to, exactly as before.

> **Cost.** The rendered size now depends on the terminal's row count, and every
> distinct size is its own cache entry — so a height change is a fresh resample
> and, on kitty/Ghostty, a new image id and a new transmission. Repeated frames at
> the same height are free, and width-only churn is free.

### Sizing type to the page too

A `custom` block receives the same row budget as a third argument, so display type
can pick its font from the room it has rather than from a constant:

```ts
import type { CustomRenderContext } from "terminaltui";

const block = {
  type: "custom" as const,
  render: (width: number, _theme, ctx?: CustomRenderContext) => {
    const font = ctx && ctx.availRows < 40 ? "Small" : "ANSI Shadow";
    return renderBanner("ODYSSEUS", { font }, width);
  },
};
```

`ctx.availRows` is the enclosing sequence's **total** budget — the page viewport, or
the pane's inner height — never the rows left after the block's siblings. That is
deliberate: a block sized to the leftover could not be measured until its siblings
were, and a `fitPage` image sized from that measurement would close the loop.
Nothing clamps to `availRows`; a block that returns more rows simply scrolls, as it
does today. `ctx` also carries the terminal's `columns` and `rows`.

The parameter is optional, so every existing `(width, theme) => string[]` keeps
working untouched.

The layout pass **measures** a `custom` block by calling its `render`, rather than
assuming a height for it, so a block that steps between a 1-row and a 7-row face
still leaves every focusable block below it exactly where its focus rectangle says
it is. Keep `render` pure and cheap: it is called once more per layout pass (on
navigation and on resize, not per frame), and a `render` that throws is charged a
fallback height instead of taking the frame down.

## Resizable frames

`resizable: true` makes an image block focusable and lets the viewer change its size at runtime:

```ts
image("./assets/nebula.jpg", { width: 40, resizable: true, border: true })
```

| Key | Effect |
|-----|--------|
| `+` / `=` | Grow the frame by 4 cells |
| `-` / `_` | Shrink it by 4 cells |
| `0` | Back to the declared size |

The block renders one extra row, always, carrying the live size — `↔ 40x12  resizable` at rest, `↔ 40x12   +/- resize   0 reset` when focused. The row is charged whether or not the block is focused on purpose: layout cannot see which block has focus, so a hint that appeared only on focus would shift every rect below the image as focus moved through the page.

**A bigger frame is genuinely higher resolution, not a magnification.** The engine samples the source *per cell*, so a wider frame is a fresh resample into a larger sub-cell grid — every frame size is its own cache entry, rebuilt from the decoded source rather than stretched. Measured through the real renderer, three presses of `+` on a photograph took a block from 20×5 to 32×8 cells and from 52 to 79 distinct colors on screen. On the pixel path the same thing happens one level up: a larger frame transmits a proportionally larger pixel buffer under a new image id.

Limits, all enforced at render time against the block's real allocation:

- **Floor: 8 cells.** Below that a quadrant image is four colored smudges.
- **Ceiling: the content column (99 cells) minus any border**, and never wider than the space the block actually has.
- **Height is capped to what is visible** — the enclosing panel's inner height, else the page viewport, minus the hint row and border. This is the one rule that applies *only* to resizable images (an ordinary image may run off the bottom and be scrolled to): you cannot judge a frame you are resizing if growing it pushes its own bottom edge off screen. `{ width: 99, resizable: true }` on a tall source therefore renders smaller than the same block without the flag, and only ever smaller — nothing overflows.
- A press that cannot move the frame says so in the status row (`Frame at maximum size` / `Frame at minimum size`).

The chosen size is per-viewer runtime state, keyed like accordion and tab state: it survives navigating away and back, it survives a terminal resize (it is re-clamped, and springs back when the window grows again), and two concurrent SSH sessions cannot see each other's frames. It is not persisted across restarts.

Opting in matters. Focusability is otherwise decided by block *type*, so making every image focusable would insert a focus slot into every page that shows one and shift every focus index below it.

`FRAME_MIN_COLS` (8) and `FRAME_STEP_COLS` (4) are exported if a help screen needs to state them.

## Dithering

Indexed palettes band on gradients, and dithering trades that banding for dispersion. Whether the trade is worth it depends entirely on how coarse the palette is. This is a cell-path option — the pixel path sends real pixels and ignores it.

| Value | truecolor | 256 color | 16 color |
|-------|-----------|-----------|----------|
| `"auto"` (default) | none | **none** | **none** |
| `"none"` | none | none | none |
| `"ordered"` | none | ordered Bayer | ordered Bayer |
| `"floyd-steinberg"` | none | Floyd–Steinberg | Floyd–Steinberg |

**Nothing is dithered automatically.** One dithered sample is one whole terminal cell — far larger than a print dot — so the dispersion never fuses into a blended color. It reads as confetti, and it wrecks the legibility of text inside an image.

At **256 colors** the 240-entry xterm palette is dense enough that nearest-color is already smooth. The cost is a real loss of saturation in dark and mid-tone regions; see [256-color output](#256-color-output) for exactly what that rule is and why it is drawn where it is.

At **16 colors** the default was Floyd–Steinberg until it was rendered and looked at. Two things were wrong with the argument that "an undithered dark image comes out nearly empty": the emptiness was a separate bug in the `shading` tier (it painted `coverage × color`, i.e. luminance squared, so every picture came out at a third of its true brightness), and with 16 entries the dispersion is enormous — reproducing a mid grey means alternating between black and a saturated primary, so a photograph became scattered colored dots on black with no identifiable content. Undithered, the same image is a legible posterized photograph. Measured on the pillars fixture at 54 cells: RMSE 32.5 undithered against 52.0 dithered, and the rendered comparison is not close.

`"ordered"` (Bayer) is never chosen automatically. It applies one threshold to all three channels at once, so it can displace a pixel along the grey axis but can never manufacture chroma; measured against og-image.png at 256 colors it retained 13% of source chroma, *worse than not dithering at all* (18%). It remains available for callers who specifically want a position-deterministic pattern.

> These defaults were chosen from screenshots of the real renderer, not from a metric. Blurred RMSE — the usual proxy for dithered output — ranked Floyd–Steinberg 2.25× better at 256 colors than no dithering, because blurring models an eye integrating adjacent samples. That assumption holds for print dots and fails for terminal cells.

A flat-colored image does not necessarily render as flat cells. If the color is not exactly a palette entry, ordered dithering mixes the two nearest entries so the local average is right. That is working correctly.

## 256-color output

Any `xterm-256color` session without `COLORTERM` — and Apple Terminal below build 470 — draws from the 240 usable xterm entries: a 6×6×6 color cube whose levels are 0/95/135/175/215/255, plus a 24-step grey ramp spaced 10 apart. Those two families are wildly different resolutions, and which one a pixel lands on used to be decided by plain RGB distance. That produced visible **blotching** on photographs:

```
before, two adjacent sub-pixels of the same photograph:

  (68,18,22)  chroma 39  ->  cube (95,0,0)     a saturated red
  (70,21,24)  chroma 39  ->  ramp (38,38,38)   a flat neutral

now: both -> ramp (38,38,38)
```

Those two colors are 4 units apart in the source and 78 apart on screen. Nothing about the pixels differs — what differs is where each channel happens to sit inside its cube bracket. The ramp's error is smooth in the input while the cube's sawtooths with a 40–95 wide period, so the crossing point between them wanders at pixel frequency and neighbouring pixels of near-identical color land on opposite sides of it. On a photograph that reads as hard islands of saturated blue, red and teal scattered through a grey field.

**The rule now: below a chroma of 40, a color is painted from the grey ramp outright.** Above it, the exact nearest neighbour over all 240 entries still decides. (Chroma here is the distance from the neutral axis, `sqrt(sum((c - mean)²))`.) The floor is anchored in the palette itself: the smallest non-zero chroma the cube can express is `sqrt(2/3) × 40 = 32.7`, so below that band *every* colored cube entry over-states the pixel's chroma, and neutral is the only stable answer. 40 is the largest floor in that range that leaves saturated UI art bit-identical — the welcome demo's teal accent bar keeps 100% of its chroma at 40 and starts eroding at 42.

Measured on the pillars photograph, the fix removes **58% of the grey/cube flips** and **52% of the isolated specks**, at a cost of 3.3% RMSE and a drop in retained chroma from 36% to 26%. That trade is deliberate and was made by comparing rendered screenshots, not scores: a uniformly slightly-desaturated image reads far better than one that is half grey and half neon.

What this means in practice:

- **Dark and desaturated regions on a 256-color terminal are neutral, on purpose.** They are not losing color to a bug; the palette simply cannot express chroma between 0 and 32.7, so there is always a hard edge somewhere. It is now a smooth function of the source's chroma instead of a function of the cube's bracket phase.
- **Saturated content is untouched.** Logos and accent art above the floor quantize exactly as before.
- **The floor does not apply to UI chrome.** `fgColor`/`bgColor` keep the exact nearest neighbour over all 240 entries. The floor exists to stop *neighbouring pixels* flip-flopping across a decision boundary, which is a property a sampled grid has and a lone theme color does not; when the two shared one search, 34 of the 100 built-in theme slots that were colored started rendering neutral grey and `catppuccin`/`rosePine` went effectively monochrome. The image path still emits through the same emitter — `render.ts` snaps every pen onto the palette first, and every one of the 240 entries is a fixed point of both searches — so image cells and text can never disagree about what a given color *is*.
- Dithering does not change this and is off by default — Bayer moves a pixel along the luminance axis only, so it cannot push one across the floor, and error diffusion restores the chroma at the cost of visible confetti.
- **This is a palette limit, not a tuning knob.** On the pillars photograph at 54 cells, 55.8% of sub-pixels have all three channels inside one cube bracket and therefore quantize to a *neutral* cube entry under any rule whatsoever, and 61% carry less chroma than the smallest non-zero value the cube can express. A bracket-scaled floor, a chroma-weighted 240-entry search, a chroma-overshoot allowance and a luminance-weighted anisotropic metric were each rendered and compared at life size: every one either kept the color and raised the blotch rate, or removed the blotching by removing all the color.
- **And the ceiling has been measured, so there is no point looking for a better algorithm.** Solving each sub-pixel *optimally* — an exhaustive search over all 240 entries, which is the best any 256-color renderer can possibly do — retains **31%** of the source chroma at a weighted error of 1737. What ships retains **32%** at 1848. The reason is structural: **75% of this photograph's sub-pixels are darker than luma 95**, which is inside the cube's first 0→95 gap, where the only entries in existence are black and the grey ramp. Palette-aware joint (glyph, fg, bg) fitting was prototyped and bought 5.9%; adding ANSI 0–15 as candidates changed nothing at all, because all sixteen are bright (205/255) and never nearest to a dark pixel. If a 256-color image looks washed out, the fix is a terminal with more colors, not more code.

## Terminal support

| Terminal or context | Result |
|---------------------|--------|
| kitty, Ghostty | Real pixels |
| Apple Terminal 470+ (macOS 26) | `quadrant` cells, truecolor |
| Apple Terminal below 470 | `quadrant` cells, 256 colors |
| WezTerm, Alacritty, foot, iTerm2, Rio, Contour | `quadrant` cells, truecolor |
| GNOME Terminal / VTE, Konsole, Windows Terminal, VS Code | `quadrant` cells |
| Inside tmux, or `screen` with a 256-color `TERM` | `half` cells |
| Over SSH (`terminaltui serve`) | Negotiated per session from the client's `TERM` — pixels for a kitty/ghostty `TERM`, else cells; an unrecognized `TERM` negotiates conservatively (`half`) |
| Linux VT console, `TERM=vt100`, a bare `screen` | `half` cells |
| Piped or redirected output, CI, the test emulator without a PTY | `ascii` — non-TTY output gets no color at all |
| `NO_COLOR=1` | `ascii` on a cell terminal; pixels are unaffected |

### Why not iTerm2 or sixel

kitty's protocol is implemented because its Unicode-placeholder variant fits the framework's write path exactly (see [above](#why-placeholders-and-not-ordinary-placements)). The other two protocols do not, and are not planned:

- **Apple Terminal supports none of them.** A scan of the shipped binary finds zero references to sixel, DECSIXEL, OSC 1337 or the kitty protocol. It is the framework's primary target, and cells remain the only technique that reaches every terminal.
- **Neither has a cell-anchored variant.** iTerm2's OSC 1337 and sixel both draw at the cursor and are thereafter owned by the terminal, so they need an out-of-band emission plane *plus* damage tracking to survive a framework that never clears the screen. Placeholders need neither.
- **Probing has to stay cheap and safe.** The graphics probe already exists, is denied on every terminal that could be damaged by it, and costs at most 300 ms once. Adding sixel would not need a new probe — the primary-DA reply is already parsed and retained — but it would need the whole placement-lifecycle machinery that placeholders make unnecessary.

Background, the escape sequences, the full support matrix and the measurements behind all of this are in `devnotes/terminal-image-rendering-exploration.md`.

## Supported formats

| Format | Status |
|--------|--------|
| **PNG** | Decoded. Palette, greyscale, 16-bit and alpha all normalized. |
| **JPEG** | Decoded, including progressive. |
| GIF, WebP, BMP | Recognized but **not decoded** — no synchronous decoder is bundled. The header still parses, so the block reserves the right number of rows, and the alt box is shown in it. |
| anything else | Alt box. |

Decoding uses `pngjs` and `jpeg-js`, both regular dependencies of the package. There is no native build step, no `sharp`, and no optional peer to install — on either path. Format detection is by magic bytes; the file extension is never consulted.

Transparent pixels are composited against `background` (default: the theme's background) before sampling, so a logo with an alpha channel blends into the page instead of showing undefined color.

## Path resolution

| Source | Resolved as |
|--------|-------------|
| `"./covers/a.png"` | Relative to the **project root** — the directory containing `pages/` — not the current working directory. |
| `"/Users/me/a.png"` | Absolute path, used as-is. |
| `"~/pics/a.png"` | Expanded against the home directory. |
| `"file:///Users/me/a.png"` | `file:` URL, converted to a path. |
| `"data:image/png;base64,…"` | Decoded inline and content-addressed, so two identical payloads share one decode. |
| `"https://example.com/a.png"` | **Alt box.** Remote sources cannot be fetched synchronously. |
| `"art:logo"` | Alt box — no reader for that scheme. |

Relative paths resolve against the project root because `terminaltui dev demos/x/config.ts` runs from one directory while the page lives in another. A relative path that escapes the project root — by `../` or through a symlink whose target lands outside it — is refused. Absolute paths are trusted: a page is the author's own executable TypeScript.

## Failure behavior

Every failure renders a bordered box, at exactly the same size the successful image would have occupied, carrying `alt` (or the file's basename) centered and truncated to fit:

```
╭────────────────────────╮
│                        │
│      Album cover       │
│                        │
╰────────────────────────╯
```

A box too small to draw a border in (under 3 rows or 4 columns) degrades to the label alone, still at exactly the requested geometry.

Nothing throws. A missing file, a corrupt file, an oversized file, a remote URL, an undecodable format and a path outside the project all take this path, and none of them shifts the layout below.

## Performance and caching

Three module-level caches sit in front of the pipeline:

- **L1 — pixels.** The resampled sub-cell grid, keyed on `(path, mtime, size, cols, rows, sub-grid, tier, crop, background, invert)` — the crop is what `fit: "cover"` changes, and omitting it let a `cover` block and a `fill` block of the same file at the same cell size collide. Deliberately **not** keyed on color mode, so two SSH sessions at different color depths share one decode.
- **L2 — rows.** The finished ANSI strings, keyed on the L1 key plus color mode, dither and charset.
- **The kitty registry.** Per (source, size, crop, background, invert): the image id, the placement rows, and a *thunk* that can rebuild the transmission. The megabyte of base64 is never resident — an entry costs single-digit kilobytes — and the runtime, not the cache, tracks which terminal has already received which id.

An L2 hit returns the *same array instance* as the previous frame, so the frame diff writes zero bytes for an unchanged image. The kitty registry does the same for placement rows.

Measured on an M4 Max, a 1600×1000 PNG rendered at 80 columns (25 rows):

| Path | Cost |
|------|------|
| Header read — all layout needs | 0.015 ms |
| Cold frame: decode + resample + dither + emit | 32 ms, of which 26 ms is the PNG decode |
| Warm frame: the whole block render on an L2 hit | 0.0024 ms |
| Color-mode change (L1 hit, L2 miss) | ~0.25 ms — no re-decode |

All three caches share a byte budget, 32 MB by default, split 60% pixels / 34% rows / 6% kitty. Override it with `TERMINALTUI_IMAGE_CACHE_BYTES` (bytes; `0` disables caching). The kitty share keeps a **512 KB floor even at a budget of 0**, deliberately: an evicted kitty entry takes its image id with it, and a new id means a fresh multi-megabyte transmission on the very next frame. "Uncached" is slow for cells and pathological for pixels.

A file is re-read when its mtime or size changes — `stat` calls are throttled to one per path per second.

Escape-string size is the other thing worth knowing about on the cell path. Foreground and background pens are tracked independently and only the half that changed is re-emitted, and the run key is the *palette index* rather than the RGB — two cells that quantize to the same 256-color entry cost nothing between them. A 60×19 quadrant render of a photograph emits about 8 KB in 256-color mode (≈7 bytes per cell) and 25 KB in truecolor.

## Environment variables

### `TERMINALTUI_IMAGE` — the cell knob

Read on every render. It outranks a block's `mode`, so it is an unconditional override.

| Value | Effect |
|-------|--------|
| `off`, `none`, `0`, `false` | Never draw an image — every block renders its alt box. Row counts are unchanged. |
| `cells` | Force the cell path (re-negotiating the cell tier), **never pixels**. |
| `auto`, `on`, `1`, `true` | Force re-negotiation, ignoring any explicit `mode`. Neutral with respect to the pixel path. |
| `quadrant`, `half`, `solid`, `shading`, `ascii`, `braille`, `alt` | Force that tier — and therefore cells. |
| anything else | Ignored — a typo degrades to normal negotiation rather than silently disabling images. |

Values are case-insensitive and trimmed. Note that **any value that pins a cell tier also denies pixels**, `off` and `cells` included; that is one predicate shared by the tier ladder and the graphics detector, so the two cannot disagree. `kitty` is not a value here — this variable names cell tiers.

```bash
TERMINALTUI_IMAGE=off terminaltui dev        # text-only run
TERMINALTUI_IMAGE=cells terminaltui dev      # cells on a kitty terminal
TERMINALTUI_IMAGE=half terminaltui dev       # check the tmux/SSH look locally
TERMINALTUI_IMAGE=ascii terminaltui dev      # what CI sees
```

### `TERMINALTUI_GRAPHICS` — the pixel knob

| Value | Effect |
|-------|--------|
| `off`, `none`, `0`, `false` | **Absolute.** No pixels, and no probe byte is ever written. Checked before everything else. |
| `kitty`, `on`, `1`, `true` | Force the pixel path on, overriding detection *and the denylist* — the escape hatch for a terminal we mis-detect. |
| `auto`, unset, anything else | Normal detection. |

`off` is the recommended switch for test harnesses, screenshot scripts and any environment where a stray protocol payload would be noise. The bundled PTY emulator sets it for every app it launches, so a suite's cell assertions do not depend on which terminal the contributor happens to be running.

### `TERMINALTUI_COLOR` — the color-depth knob

Not image-specific, but it changes images more than anything else does: `TERMINALTUI_COLOR=256` (or `16`, `none`, `truecolor`) overrides detection framework-wide, which is how you preview the lower-depth render on a terminal that reports truecolor. Full ladder in [docs/themes.md](themes.md#color-depth).

### `TERMINALTUI_IMAGE_CACHE_BYTES`

Total byte budget for the image caches. Default 32 MB. `0` disables the pixel and row caches; the kitty registry keeps a 512 KB floor for the reason described [above](#performance-and-caching).

## Limitations

Stated plainly, because most of these are structural rather than to-do items:

- **No animation.** Animated GIF is not decoded at all; nothing re-renders on a timer.
- **No remote images.** `http(s)` sources render as alt text. Decoding is synchronous by design, and fetching is not.
- **No GIF, WebP or BMP pixels.** Their headers parse (so layout is right), but no synchronous decoder is bundled for them.
- **16-color output is heavily posterized.** Sixteen entries is sixteen entries; the picture reads, but large regions collapse to one color. Dithering makes it worse, not better — see [Dithering](#dithering).
- **256-color output is deliberately desaturated below a chroma of 40.** See [256-color output](#256-color-output).
- **Pixels only on kitty and Ghostty.** WezTerm, Konsole, Contour, Rio and Warp implement the protocol without the Unicode-placeholder variant this framework needs; iTerm2's OSC 1337 and sixel have no cell-anchored variant at all.
- **A pixel image cannot exceed 297 cells in either dimension** — that is the size of kitty's row/column diacritic table. The framework's own 99-column / 200-row ceilings are stricter, so this can only bite if those change.
- **A resize re-sends pixels only when the image geometry changed.** The placeholder cells are erased by an out-of-band repaint but the pixels live in the terminal's own image store, so a redraw that re-emits the same cells is enough. A drag-resize that does change the frame's size does pay for a re-transmission per distinct size.
- **Size ceilings.** 99 columns, 200 rows, 20,000 cells, 16 MB source, 8192×8192 pixels. A larger request is clamped; a larger *file* falls back to the alt box.
- **Images are not focusable** and carry no action, unless `resizable: true`.
- **A source with no readable header reserves a square box.** A square source is a 2:1 cell box, so a typo'd path at the full 99-column width reserves 50 rows for its alt box, and an extreme-aspect source outside a panel is bounded only by the 200-row ceiling. Layout stays consistent — the estimator and the renderer agree — but the page below it is pushed a long way down. Give unreliable or very tall sources an explicit `maxHeight`.
- **Terminals configured to render East Asian ambiguous characters double-width** will shear the quadrant and half tiers, because `▀` and `▌` are ambiguous-width. The same is already true of every border in the framework; force `mode: "solid"` if you must support that configuration.

## `asciiImage()` — standalone conversion

`image()` is a content block. If you want the rows as strings — to write to a file, print outside a page, or drop into a custom block — use `asciiImage()` instead. See [docs/ascii-art.md](ascii-art.md#images-to-terminal-art).

```ts
import { asciiImage } from "terminaltui";

const rows = await asciiImage("./logo.png", { width: 40, mode: "blocks", color: true });
console.log(rows.join("\n"));
```

Both go through the same cell engine, so a fix in one reaches the other. `asciiImage()` has no pixel path — it returns strings, and a kitty transmission is not a string a caller could print.
