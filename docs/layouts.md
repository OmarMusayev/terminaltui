# Layouts

Layout components divide the terminal into panels -- side-by-side, stacked, or in grids. Each panel is an independent area with its own border, title, and content clipping.

```ts
import { columns, rows, grid, panel, row, col, container } from "terminaltui";
```

---

## Navigation (Spatial)

Navigation uses **spatial positioning** -- arrow keys move to the nearest focusable item in that direction based on screen position. This works automatically with all layout functions.

| Key | Action |
|-----|--------|
| Left / h | Move to nearest focusable item to the left. If nothing to the left, go back. |
| Right / l | Move to nearest focusable item to the right. |
| Up / k | Move to nearest focusable item above. |
| Down / j | Move to nearest focusable item below. |
| Enter | Activate focused item (open URL, submit, etc.) |
| Escape | Go back to menu |
| Tab / Shift+Tab | Cycle through all focusable items sequentially |

In a 2-column grid with 6 items:
```
[A] [B]    Right from A -> B, Down from A -> C
[C] [D]    Left from D -> C, Up from D -> B
[E] [F]
```

On single-column pages, Up/Down moves sequentially and Left goes back -- identical to classic TUI navigation.

No configuration needed. Spatial navigation is automatic for all layouts.

---

## columns(panels)

Side-by-side panels. Each panel gets a `width`.

```ts
columns([
  { width: "60%", content: [
    table(["Container", "Status", "CPU"], [
      ["nginx", "running", "2.3%"],
      ["postgres", "running", "5.1%"],
    ]),
  ]},
  { width: "40%", content: [
    markdown("## System Stats"),
    progressBar("CPU", 45),
    progressBar("Memory", 72),
  ]},
])
```

**Width options**: `"50%"` (percentage), `30` (fixed chars), omit for equal split.

---

## rows(panels)

Vertically stacked panels with fixed/flex heights.

```ts
rows([
  { height: "30%", content: [
    markdown("## Active Containers"),
    table(["Name", "Status"], [["nginx", "up"], ["postgres", "up"]]),
  ]},
  { height: "70%", content: [
    markdown("## Logs"),
    markdown("12:00:01 [nginx] GET /health 200"),
  ]},
])
```

**Height options**: `"50%"` (percentage), `10` (fixed rows), omit for equal split.

---

## grid(config)

N*M grid of panels.

```ts
grid({
  cols: 2,     // number of columns
  gap: 1,      // gap between cells in characters (default: 1)
  items: [
    { title: "CPU", content: [progressBar("Usage", 45)] },
    { title: "Memory", content: [progressBar("RAM", 72)] },
    { title: "Network", content: [markdown("125 Mbps")] },
    { title: "Disk I/O", content: [progressBar("Read", 23)] },
  ],
})
```

Rows are auto-calculated from `Math.ceil(items.length / cols)`.

---

## 12-Column Grid System

`row()`, `col()`, and `container()` provide a Bootstrap-style 12-column grid for precise layouts with responsive breakpoints.

```ts
// Basic: sidebar + main content
row([
  col([sidebar], { span: 3 }),         // 25%
  col([mainContent], { span: 9 }),     // 75%
], { gap: 1 })

// Responsive: cards reflow based on terminal width
row([
  col([card1], { span: 4, sm: 6, xs: 12 }),  // 33% wide, 50% medium, full narrow
  col([card2], { span: 4, sm: 6, xs: 12 }),
  col([card3], { span: 4, sm: 12, xs: 12 }),
])

// Centered container with max width
container([
  row([col([hero(...)], { span: 12 })]),
  row([
    col([sidebar], { span: 3 }),
    col([content], { span: 9 }),
  ]),
], { maxWidth: 100, padding: 2 })
```

**ColConfig**: `span` (1-12), `offset` (0-11), `xs`/`sm`/`md`/`lg` (responsive spans), `padding`.
**Responsive breakpoints**: xs (<60 cols), sm (60-89), md (90-119), lg (>=120).

When total spans in a row exceed 12, columns wrap to the next line.

---

## panel(config)

A content area with optional border. Used inside layout components or standalone.

```ts
{
  content: ContentBlock[];      // required
  width?: string | number;      // for columns
  height?: string | number;     // for rows
  title?: string;               // rendered above content
  border?: boolean | BorderStyle; // default: no border
  padding?: number;             // interior padding (default: 0)
}
```

---

## Nested Layouts

Layouts compose freely. A column panel can contain rows, which can contain grids:

```ts
columns([
  { width: "25%", title: "Nav", content: [
    link("Dashboard", "#"),
    link("Logs", "#"),
    link("Settings", "#"),
  ]},
  { width: "75%", content: [
    rows([
      { height: "60%", content: [
        markdown("## Main Content"),
        table(["Name", "Status"], [["nginx", "running"]]),
      ]},
      { height: "40%", title: "Logs", content: [
        markdown("Log output here..."),
      ]},
    ]),
  ]},
])
```

---

## Responsive Behavior

When the terminal is too narrow for side-by-side panels (less than 20 chars per panel), columns automatically collapse to vertical stacking. When the terminal is resized wider, columns restore.

Grid columns also auto-reduce when the terminal is narrow.

The 12-column grid system uses responsive breakpoints (`xs`, `sm`, `md`, `lg`) for fine-grained control.

---

## When to Use Which Layout

| Use Case | Layout |
|----------|--------|
| Dashboard with sidebar | `columns()` or `row()` + `col()` |
| Log viewer with controls | `rows()` |
| Editor with preview | `columns([panel({ width: "30%" }), panel({ width: "70%" })])` |
| Monitoring metrics | `grid()` |
| Responsive card grid | `row()` with `xs:12, sm:6, lg:4` |
| Centered narrow content | `container({ maxWidth: 80 })` |
| Complex dashboard | Nested `columns()` + `rows()` or `row()` + `col()` |

For simple content pages, stick with the default vertical scroll. Layouts are best for dashboards, monitoring, and tool UIs where spatial organization matters.

---

## Examples in Demos

Every demo uses layouts where side-by-side content improves the experience:

| Demo | Layouts Used | Pages |
|------|-------------|-------|
| server-dashboard | columns, rows, grid | All 4 pages — the layout showcase |
| developer-portfolio | columns, grid, row/col | About (text + skills), Projects, Experience, Writing, Links |
| restaurant | columns | Menu (food / cocktails), Wine, Hours (table / location) |
| startup | grid, row/col | Home (features grid), Features (2-col grid), Pricing (3 tiers), Links |
| conference | columns, grid | Home, Schedule (Day 1 / Day 2), Speakers, Venue, Sponsors |
| coffee-shop | columns, grid | Menu (espresso / filter), Beans, Hours, Connect |
| band | grid, columns | Discography, Shows, About (members grid) |
| freelancer | grid, columns | Services, Work, Testimonials, Contact |
| dashboard | columns | Dashboard home (status / posts), Post detail, New Post |

Run `npx terminaltui demo server-dashboard` for the most comprehensive layout example.
