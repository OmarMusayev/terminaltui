# Spatial Layout & Navigation Reference

> **This document supersedes all previous panel navigation documentation.**
> PanelFocusManager, panelArrows, activePanelIndex, gridCols, groupStart, groupSize -- all deleted. Do NOT use them.

---

## How Navigation Works

Every focusable item on screen has a computed **screen rectangle** `{ x, y, width, height }`. Arrow keys move focus to the **nearest focusable item in that direction**, scored by distance + alignment. Same algorithm as Android TV, Roku, CSS spatial-navigation spec, game console D-pads.

### Key Mappings

| Key | Home Page | Content Page |
|-----|-----------|--------------|
| `Up` / `k` | Previous menu item | Nearest focusable above |
| `Down` / `j` | Next menu item | Nearest focusable below |
| `Left` / `h` | (nothing) | Nearest focusable left; if none, go back |
| `Right` / `l` | Select page | Nearest focusable right; if none, do nothing |
| `Enter` | Select page | Activate (open link, submit, toggle, navigate) |
| `Escape` | Quit | Go back |
| `Backspace` | (nothing) | Go back |
| `Tab` | Next (sequential) | Next focusable (sequential, accessibility) |
| `Shift+Tab` | Previous | Previous focusable |
| `q` | Quit | Quit |
| `g` / `G` | First / Last | First / Last item |
| `1-9` | Jump to page N | (nothing) |
| `:` or `/` | Command mode | Command mode |

### Behavior by Layout Type

- **Single-column** (no layouts): Up/Down moves sequentially. Left goes back. Right does nothing. Identical to old behavior.
- **columns / split** (side-by-side): Right jumps to nearest item in the other panel. Left jumps back. Up/Down stays within same column.
- **grid**: All four arrows work spatially across the grid.
- **Nested layouts**: Algorithm sees flat screen positions. Nesting doesn't affect navigation.

### Edge Behavior

- Rightmost: Right does nothing (no wrap)
- Bottommost: Down scrolls if possible
- Leftmost: Left goes back (like Escape)
- Topmost: Up scrolls if possible

**No configuration needed.** Spatial navigation is automatic for all layout functions.

---

## Layout Functions (Actual API)

### `columns(panels: PanelConfig[]): ColumnsBlock`

Side-by-side panels. Responsive: collapses to vertical stacking when terminal is too narrow.

```ts
import { columns } from "terminaltui";

columns([
  { width: "30%", content: [card({ title: "Sidebar" })] },
  { width: "70%", content: [card({ title: "Main" })] },
])

// PanelConfig options:
{
  content: ContentBlock[];        // required
  width?: string | number;        // "50%", "auto", 30 (for columns)
  height?: string | number;       // "50%", "auto", 10 (for rows)
  title?: string;                 // shown as dim label above content
  border?: boolean | BorderStyle; // default: no border
  padding?: number;               // default: 0
}
```

### `rows(panels: PanelConfig[]): RowsBlock`

Vertically stacked panels with fixed/flex heights.

```ts
rows([
  { height: 5, content: [card({ title: "Top" })] },
  { content: [card({ title: "Bottom (fills remaining)" })] },
])
```

### `split(config: SplitConfig): SplitBlock`

Two panels with a divider. Direction controls orientation.

```ts
split({
  direction: "horizontal",  // "horizontal" = left|right, "vertical" = top|bottom
  ratio: 40,                // first panel gets 40%, second gets 60%. Default: 50
  border: true,             // show divider. Default: true
  first: [card({ title: "Left" })],
  second: [card({ title: "Right" })],
})
```

### `grid(config: GridConfig): GridBlock`

N-column grid. Responsive: reduces columns on narrow terminals.

```ts
grid({
  cols: 2,                  // number of columns
  gap: 1,                   // space between cells. Default: 1
  rows: undefined,          // optional: fixed row count
  items: [                  // PanelConfig[] -- each item is a grid cell
    { content: [card({ title: "A" })] },
    { content: [card({ title: "B" })] },
    { content: [card({ title: "C" })] },
    { content: [card({ title: "D" })] },
  ],
})
```

### `box(config: BoxConfig): BoxBlock` -- NEW

Low-level flexbox primitive. `columns()`, `rows()`, etc. are convenience wrappers.

```ts
import { box } from "terminaltui";

box({
  direction: "row",             // "column" (default) or "row"
  width: "60%",                 // optional: size constraint
  height: 20,                   // optional
  gap: 1,                       // space between children. Default: 0
  padding: 1,                   // inner padding. Default: 0
  align: "start",               // "start" | "center" | "end" | "stretch"
  justify: "start",             // "start" | "center" | "end" | "space-between" | "space-around"
  wrap: false,                  // wrap children to next line. Default: false
  children: [                   // ContentBlock[] -- any blocks including nested box()
    card({ title: "A" }),
    card({ title: "B" }),
  ],
})
```

**When to use which layout:**
- `columns()` for simple side-by-side panels
- `split()` for two-panel layouts with a ratio
- `grid()` for N*M grids of equal-size cards
- `rows()` for stacked sections with height control
- `box()` for flexbox-style layouts with mixed sizing
- `row()` + `col()` for precise 12-column grid layouts with responsive breakpoints
- `container()` for centering content with max width

### `row(cols, config?)` + `col(content, config?)` -- 12-Column Grid

```ts
row([
  col([card(...)], { span: 3 }),           // 25%
  col([card(...)], { span: 6 }),           // 50%
  col([card(...)], { span: 3 }),           // 25%
], { gap: 1 })

// Responsive
col([card(...)], { span: 4, sm: 6, xs: 12 })

// Breakpoints: xs (<60), sm (60-89), md (90-119), lg (>=120)
```

### `container(content, config?)`

```ts
container([
  row([...]),
], { maxWidth: 100, padding: 2, center: true })
```

---

## Design Patterns

### Sidebar + Content
```ts
columns([
  { width: "25%", title: "Navigation", content: [
    link("Home", "/"), link("Settings", "/settings"),
  ]},
  { width: "75%", content: [
    card({ title: "Main Content", body: "..." }),
  ]},
])
```

### Dashboard Stats Grid
```ts
grid({
  cols: 2, gap: 1,
  items: [
    { content: [card({ title: "CPU", subtitle: "45%" })] },
    { content: [card({ title: "Memory", subtitle: "2.1 GB" })] },
    { content: [card({ title: "Disk", subtitle: "120 GB" })] },
    { content: [card({ title: "Network", subtitle: "1.2 Gbps" })] },
  ],
})
```

### Info + Actions Split
```ts
split({
  direction: "horizontal", ratio: 60,
  first: [
    markdown("## Details\nDescription here..."),
    table(["Field", "Value"], [["Status", "Active"]]),
  ],
  second: [
    card({ title: "Quick Actions" }),
    button({ label: "Restart" }),
    button({ label: "Stop", style: "danger" }),
  ],
})
```

### Portfolio / Projects Grid
```ts
grid({
  cols: 2, gap: 1,
  items: projects.map(p => ({
    content: [card({ title: p.name, subtitle: p.tech, body: p.desc, url: p.url })],
  })),
})
```

### Stats Row + Detail Table Below
```ts
columns([
  { width: "33%", content: [card({ title: "Users", subtitle: "1,234" })] },
  { width: "34%", content: [card({ title: "Revenue", subtitle: "$56K" })] },
  { width: "33%", content: [card({ title: "Orders", subtitle: "892" })] },
]),
table(["Date", "Amount"], [["2024-01-01", "$100"]]),
```

### Nested Box Layout
```ts
box({
  direction: "row", gap: 1,
  children: [
    box({ width: "20%", direction: "column", children: [
      card({ title: "Nav 1" }), card({ title: "Nav 2" }),
    ]}),
    box({ width: "80%", direction: "column", gap: 1, children: [
      box({ direction: "row", gap: 1, children: [
        card({ title: "Stat 1" }), card({ title: "Stat 2" }),
      ]}),
      card({ title: "Main Content" }),
    ]}),
  ],
})
```

---

## Deleted APIs (DO NOT USE)

| Deleted | Replacement |
|---------|-------------|
| `PanelFocusManager` | Automatic spatial navigation |
| `panelArrows` config | Not needed |
| `activePanelIndex` | Derived from focused block position |
| `gridCols` / `groupStart` / `groupSize` | Not needed |
| `syncToFocusIndex()` | Not needed |
| `moveLeft/Right/Up/Down()` on panel focus | `findNextFocus()` handles all |
| Panel-constrained navigation | Free-flowing spatial navigation |
| "Is this a panel page?" branching | One code path for everything |

---

## Internals Summary

### `computeFocusPositions(blocks, width, height, resolveDyn)` -- `src/layout/flex-engine.ts`
- Walks content tree recursively
- Uses existing layout functions (`layoutColumns`, `layoutRows`, `layoutSplit`, `layoutGrid`) for panel positions
- Assigns `FocusRect { focusIndex, x, y, width, height }` to every focusable item
- Recomputed every render cycle

### `findNextFocus(currentIndex, direction, allRects)` -- `src/navigation/spatial.ts`
- Filters candidates in the pressed direction (e.g. right: `target.x > current.x`)
- Scores: `primaryDist + secondaryDist * 2` (prefers aligned items)
- Returns focusIndex of best candidate, or null

### `FocusRect` -- `src/layout/types.ts`
```ts
interface FocusRect {
  focusIndex: number;  // index in pageFocusItems[]
  x: number;           // column position relative to content area
  y: number;           // row position relative to content area
  width: number;
  height: number;
}
```

Stored on runtime as `focusRects: FocusRect[]`. Updated every render.
