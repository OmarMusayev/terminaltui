# ASCII Art

terminaltui includes a complete ASCII art system: banner fonts, pre-made scenes, icons, decorative patterns, geometric shapes, data visualization, and composition utilities.

## Banners

Use `ascii()` in the `banner` field of `defineConfig()` to create a large ASCII text banner:

```ts
// config.ts
import { defineConfig, ascii } from "terminaltui";

export default defineConfig({
  name: "My Site",
  banner: ascii("MY SITE", {
    font: "ANSI Shadow",
    gradient: ["#ff6b6b", "#4ecdc4"],
    shadow: true,
  }),
});
```

### Banner Options

| Option | Type | Description |
|--------|------|-------------|
| `font` | `string` | Font name (see below) |
| `gradient` | `string[]` | Array of hex colors (min 2) |
| `align` | `"left" \| "center" \| "right"` | Text alignment (default: `"left"`) |
| `padding` | `number` | Padding around banner |
| `shadow` | `boolean` | Drop shadow effect |
| `border` | `string \| false` | Border around banner |
| `width` | `number` | Max width |

### Fonts (14 built-in)

| Font | Height | Style |
|------|--------|-------|
| `"ANSI Shadow"` | 6 | Clean block letters with shadow -- modern default |
| `"Block"` | 6 | Solid block characters -- bold and heavy |
| `"Slant"` | 6 | Classic italic/slanted -- elegant |
| `"Calvin S"` | 4 | Clean thin letters -- professional, compact |
| `"Small"` | 4 | Tiny but readable -- space-constrained |
| `"Ogre"` | 5 | Chunky and playful -- fun, casual |
| `"DOS Rebel"` | 10 | DOS-era block art -- retro, nostalgic |
| `"Ghost"` | 10 | Spooky hollow letters -- horror, creative |
| `"Bloody"` | 10 | Dripping horror letters -- intense |
| `"Electronic"` | 10 | Digital/LED style -- tech, futuristic |
| `"Sub-Zero"` | 10 | Icy/frozen appearance -- cool, sharp |
| `"Larry 3D"` | 10 | 3D perspective letters -- eye-catching |
| `"Colossal"` | 10 | Massive block letters -- impactful |
| `"Isometric1"` | 10 | Isometric 3D projection -- unique |

Font names are case-sensitive. Short names (1-2 words) work best. Good defaults: `"ANSI Shadow"` for modern, `"Calvin S"` for compact, `"Ogre"` for fun, `"Slant"` for elegant.

## Scenes

Pre-made decorative ASCII art scenes. Returns `string[]`.

```ts
import { asciiArt } from "terminaltui";

const mountains = asciiArt.scene("mountains", { width: 60 });
const rocket = asciiArt.scene("rocket", { color: "#ff6b6b" });
```

### All 15 Scenes

**Landscapes:** `mountains`, `cityscape`, `forest`, `ocean`, `space`, `clouds`

**Objects:** `coffee-cup`, `rocket`, `cat`, `robot`, `terminal`

**Retro:** `vinyl-record`, `cassette`, `floppy-disk`, `gameboy`

Options: `width` (number), `color` (hex string).

## Icons

Pre-made ASCII art icons in small, medium, and large sizes. Returns `string[] | undefined`.

```ts
import { getIcon, asciiArt } from "terminaltui";

const icon = getIcon("terminal");
// or
const icon = asciiArt.getIcon("terminal", "medium");
```

### All 32 Icons

`laptop`, `briefcase`, `person`, `chain`, `chart`, `pen`, `music`, `star`, `globe`, `mail`, `code`, `terminal`, `folder`, `file`, `git`, `heart`, `check`, `cross`, `warning`, `film`, `camera`, `book`, `phone`, `pin`, `clock`, `users`, `cup`, `food`, `car`, `plane`, `fire`, `lightning`

Sizes: `"small"`, `"medium"`, `"large"`.

## Patterns

Decorative fill patterns. Returns `string[]`.

```ts
const bg = asciiArt.pattern(40, 10, "circuit", { density: 0.5 });
```

### All 12 Patterns

`dots`, `crosshatch`, `diagonal`, `waves`, `bricks`, `circuit`, `rain`, `stars`, `confetti`, `static`, `braille-dots`, `grid`

Options: `density` (number), `seed` (number).

## Shapes

Nine geometric shapes. All return `string[]`.

```ts
asciiArt.box(20, 5, "rounded")    // width, height, style
asciiArt.circle(8, "*")           // radius, fill char
asciiArt.diamond(6)               // size
asciiArt.triangle(5)              // height
asciiArt.heart(5)                 // size
asciiArt.star(5)                  // size
asciiArt.arrow(10, "right")       // length, direction
asciiArt.hexagon(4)               // size
asciiArt.line(20, "dashed")       // length, style
```

## Data Visualization

Five chart types for rendering data as ASCII art. All return `string[]`.

```ts
// Bar chart
asciiArt.barChart(
  [{ label: "TypeScript", value: 85 }, { label: "Rust", value: 70 }],
  { width: 50, horizontal: true, showValues: true }
)

// Sparkline (compact trend line)
asciiArt.sparkline([1, 5, 3, 8, 2, 7], 30)

// Heatmap
asciiArt.heatmap([[1,2,3],[4,5,6],[7,8,9]], { showScale: true })

// Pie chart
asciiArt.pieChart([{ label: "A", value: 60 }, { label: "B", value: 40 }], 6)

// Line graph
asciiArt.graph([10, 20, 15, 30, 25], 40, 10)
```

## Images to terminal art

`asciiImage()` converts a PNG or JPEG into rows of terminal art. Returns `Promise<string[]>` -- one string per output row, each exactly the negotiated column width.

```ts
import { asciiImage } from "terminaltui";

const rows = await asciiImage("./logo.png", { width: 40 });
console.log(rows.join("\n"));
```

PNG and JPEG decode with the bundled decoders. **No `sharp` and no other install is required** -- the old peer-dependency requirement is gone. GIF, WebP and BMP are recognized but have no synchronous decoder, and a missing or corrupt file behaves the same way: the call resolves to a single `["[Error: ...]"]` row rather than throwing.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `60` | Output width in cells. Capped at 99. |
| `height` | `number` | derived from aspect | Given, the image is stretched to exactly `width` x `height` |
| `mode` | `"ascii" \| "shading" \| "blocks" \| "braille"` | `"ascii"` | Rendering technique |
| `charset` | `string` | `" .:-=+*#%@"` / `" ·:░▒▓█"` | Ramp for `"ascii"` and `"shading"`, darkest first |
| `invert` | `boolean` | `false` | Invert the sampled pixels |
| `color` | `boolean` | `false` | Emit per-cell color. `false` guarantees plain text out |
| `dithering` | `"none" \| "ordered" \| "floyd-steinberg"` | `"none"` | A no-op in truecolor and whenever `color` is `false` |
| `threshold` | `number` | Otsu, chosen per image | Explicit 1-bit cut. Applies to `"braille"` only |

### Modes

| Mode | Sub-cells per row | With `color: false` | With `color: true` |
|------|-------------------|---------------------|--------------------|
| `"ascii"` | 1 | The `" .:-=+*#%@"` ramp | Same glyphs, one color per cell |
| `"shading"` | 1 | The `" ·:░▒▓█"` ramp | Same glyphs, one color per cell |
| `"blocks"` | 2 (upper/lower half) | Falls back to the shading ramp | `▀` with an independent foreground **and background** -- the highest-fidelity mode |
| `"braille"` | 8 (2x4 dots) | 1-bit dot art | Dot art with one color per cell |

```ts
await asciiImage("./photo.jpg", { width: 60, mode: "blocks", color: true });
await asciiImage("./plot.png", { width: 60, mode: "braille" });
await asciiImage(buffer, { width: 30, charset: " .oO@" });
```

`color: false` emits **zero** escape bytes, including the trailing reset -- safe to write straight to a file or pipe. `mode: "blocks"` with `color: false` uses the shading ramp instead of half blocks, because a half block with both pens suppressed only encodes "the two halves differ", which is not an image.

Aspect is correct in every mode: a 1600x1000 source at `width: 60` is 19 rows whether you ask for `"ascii"`, `"blocks"` or `"braille"`. (Before 2.1.0 every sub-cell mode was vertically squashed by 2x -- and in practice `asciiImage()` had never produced an image at all, because the `sharp` guard returned first.)

Relative paths resolve against the current working directory, and transparent pixels are composited against black -- this is a standalone utility with no theme or project root in scope.

### `asciiImage()` vs `image()`

Both go through the same rendering engine. Use `asciiImage()` when you want the rows as strings; use the [`image()`](images.md) content block inside a page, where you also get automatic tier negotiation from the viewer's terminal, theme-aware alpha compositing, caching, framing, alignment, and an alt-text box that reserves the same space the image would have.

## Composing your own art

The framework no longer ships a dedicated `artCompose` API — most use cases were one-liners with `padEnd`/`map`/`join`. To place two pieces of art side by side:

```ts
function sideBySide(left: string[], right: string[], gap = 2): string[] {
  const h = Math.max(left.length, right.length);
  const lw = Math.max(...left.map(l => l.length));
  const out: string[] = [];
  for (let i = 0; i < h; i++) {
    const l = (left[i] ?? "").padEnd(lw);
    const r = right[i] ?? "";
    out.push(l + " ".repeat(gap) + r);
  }
  return out;
}
```

For color/gradient effects on art, apply `gradientLines()` from `style/gradient` (already used internally by `ascii({ gradient })`).
