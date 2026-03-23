# ASCII Art

terminaltui includes a complete ASCII art system: banner fonts, pre-made scenes, icons, decorative patterns, geometric shapes, data visualization, and composition utilities.

## Banners

Use `ascii()` in the `banner` field of `defineSite()` to create a large ASCII text banner:

```ts
import { defineSite, ascii } from "terminaltui";

export default defineSite({
  banner: ascii("MY SITE", {
    font: "ANSI Shadow",
    gradient: ["#ff6b6b", "#4ecdc4"],
    shadow: true,
  }),
  // ...
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

## Composition Utilities

The `artCompose` module manipulates `string[]` art. All functions take and return `string[]`.

```ts
import { artCompose, asciiArt } from "terminaltui";

// Place two scenes side by side with a 4-character gap
const combined = artCompose.sideBySide(
  asciiArt.scene("mountains"),
  asciiArt.scene("forest"),
  4
);

// Apply a gradient to a shape
const colored = artCompose.gradient(
  asciiArt.box(20, 5),
  ["#ff0000", "#0000ff"]
);
```

### All 13 Utilities

| Function | Description |
|----------|-------------|
| `overlay(base, over, x, y)` | Layer `over` on top of `base` at position |
| `sideBySide(left, right, gap?)` | Place art horizontally (gap default: 2) |
| `stack(top, bottom, gap?)` | Stack art vertically (gap default: 1) |
| `center(art, width)` | Center art within a given width |
| `pad(art, padding)` | Add padding (number or `{ top, right, bottom, left }`) |
| `crop(art, x, y, width, height)` | Crop a region |
| `repeat(art, times, direction)` | Repeat horizontally or vertically |
| `mirror(art, axis)` | Mirror horizontally or vertically |
| `rotate(art, degrees)` | Rotate 90, 180, or 270 degrees |
| `colorize(art, color)` | Apply a single hex color to non-space characters |
| `gradient(art, colors, direction?)` | Apply a gradient (horizontal, vertical, or diagonal) |
| `rainbow(art)` | Apply a rainbow gradient |
| `shadow(art, direction?, char?)` | Add a drop shadow |
