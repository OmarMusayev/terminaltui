# Components

Every component is imported from `"terminaltui"` and returns a content block. Content blocks are always used inside an array:

```ts
content: [markdown("Hello"), card({ title: "World" })]
```

---

## Display Components

### markdown(text)

Renders text with markdown formatting (bold, italic, inline code, code blocks). Not focusable.

```ts
markdown("This is **bold** and *italic* with `inline code`.")
```

### card(config)

A bordered card. Focusable -- each card is an individual navigation target.

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Card heading (required) |
| `subtitle` | `string` | Secondary text (price, date, stars) |
| `body` | `string` | Body text |
| `tags` | `string[]` | Tags rendered as badges |
| `url` | `string` | URL opened on Enter |
| `border` | `BorderStyle` | Override default border style |
| `action` | `CardAction` | Action on select |

`CardAction` supports `onPress`, `navigate` (page ID), `params` (route params), `confirm` (confirmation prompt), `label`, and `style` (`"primary"`, `"secondary"`, `"danger"`).

```ts
card({
  title: "My Project",
  subtitle: "★ 200",
  body: "A brief description of the project.",
  tags: ["TypeScript", "Open Source"],
  url: "https://github.com/user/repo",
  action: { navigate: "project-detail", params: { id: "my-project" } },
})
```

### timeline(items)

Vertical timeline with connected dots. Each item is focusable but display-only (no action on Enter). For browsable items, prefer `card()` blocks instead.

| Item Prop | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Entry heading |
| `subtitle` | `string` | Organization or company |
| `period` | `string` | Time range |
| `description` | `string` | Details |

```ts
timeline([
  { title: "Senior Engineer", subtitle: "Acme Corp", period: "2023 -- present", description: "Platform team lead" },
  { title: "BS Computer Science", subtitle: "University", period: "2017 -- 2021" },
])
```

### table(headers, rows)

A bordered data table. Not focusable.

```ts
table(
  ["Plan", "Price", "Features"],
  [
    ["Free", "$0/mo", "Basic features"],
    ["Pro", "$10/mo", "Everything + priority support"],
  ]
)
```

### list(items, style?)

A styled list. Not focusable. Styles: `"bullet"` (default), `"number"`, `"dash"`, `"check"`, `"arrow"`.

```ts
list(["First item", "Second item", "Third item"], "check")
```

### quote(text, attribution?)

Block quote with optional attribution. Not focusable.

```ts
quote("The best way to predict the future is to invent it.", "-- Alan Kay")
```

### hero(config)

Large hero section. Focusable if `cta` is set (opens URL on Enter).

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Large heading |
| `subtitle` | `string` | Description |
| `cta` | `{ label, url }` | Call-to-action link |
| `art` | `string` | Custom ASCII art |

```ts
hero({
  title: "Welcome",
  subtitle: "Build beautiful terminal apps.",
  cta: { label: "Get Started", url: "https://example.com" },
})
```

### gallery(items)

Grid of cards. Items use the same shape as `card()`.

```ts
gallery([
  { title: "Photo 1", body: "Description", tags: ["nature"] },
  { title: "Photo 2", body: "Description", tags: ["urban"] },
])
```

### tabs(items)

Tabbed content. Focusable as one block -- Enter cycles through tabs. Best for mutually exclusive views of the same data, not for organizing sequential page sections (use `divider()` for that).

```ts
tabs([
  { label: "Frontend", content: [list(["React", "Vue", "Svelte"], "check")] },
  { label: "Backend", content: [list(["Node.js", "Python", "Go"], "check")] },
])
```

### accordion(items)

Collapsible sections. Each item is separately focusable. Enter toggles open/close.

```ts
accordion([
  { label: "What is terminaltui?", content: [markdown("A framework for building terminal websites.")] },
  { label: "How do I deploy?", content: [markdown("Run `terminaltui build` then `npm publish`.")] },
])
```

### link(label, url, options?)

A clickable link. Focusable -- opens URL in the user's browser on Enter.

Options: `icon` (single character displayed before the label).

```ts
link("GitHub", "https://github.com/user")
link("Email", "mailto:hello@example.com", { icon: "✉" })
```

### progressBar(label, value, max?)

Progress bar with percentage. Max defaults to 100. Not focusable.

```ts
progressBar("Project Alpha", 7, 10)
progressBar("Completion", 65)
```

`skillBar(label, value)` is a shorthand for `progressBar(label, value, 100)`:

```ts
skillBar("TypeScript", 90)
skillBar("Rust", 75)
```

### badge(text, color?)

Inline badge or tag. Not focusable. Color is a hex string.

```ts
badge("v2.0")
badge("NEW", "#50fa7b")
```

### image(path, options?)

Renders an image in the terminal. Not focusable.

Options: `width` (number), `mode` (`"ascii"`, `"braille"`, `"blocks"`).

```ts
image("./logo.png")
image("./photo.jpg", { width: 60, mode: "braille" })
```

### section(title, content)

Groups content under a titled section header with a divider line. Not focusable itself -- children inherit their own focusability.

```ts
section("Appetizers", [
  card({ title: "Bruschetta", subtitle: "$12", body: "Toasted bread with tomatoes" }),
])
```

### divider(style?, label?)

Horizontal divider line. Not focusable. Styles: `"solid"`, `"dashed"`, `"dotted"`, `"double"`, `"label"`. If the first argument is not a known style, it becomes a label automatically.

```ts
divider()                    // solid line
divider("dashed")            // dashed line
divider("My Section")        // labeled divider (auto-detected)
```

### spacer(lines?)

Vertical whitespace. Defaults to 1 line. Not focusable.

```ts
spacer()     // 1 blank line
spacer(3)    // 3 blank lines
```

---

## Input Components

All inputs are focusable. In navigation mode, press Enter to start editing, Escape to return to navigation.

### textInput(config)

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique input ID (required) |
| `label` | `string` | Label text (required) |
| `placeholder` | `string` | Placeholder text |
| `defaultValue` | `string` | Initial value |
| `maxLength` | `number` | Max character count |
| `validate` | `(value) => string \| null` | Return error message or null |
| `mask` | `boolean` | Mask input (for passwords) |
| `transform` | `(value) => string` | Transform input on change |

```ts
textInput({ id: "name", label: "Your Name", placeholder: "Enter name...", maxLength: 50 })
textInput({ id: "password", label: "Password", mask: true })
```

### textArea(config)

Same as `textInput` plus `rows` (visible rows). Supports multi-line editing.

```ts
textArea({ id: "bio", label: "Bio", placeholder: "Tell us about yourself...", rows: 4, maxLength: 500 })
```

### select(config)

Dropdown select. Enter opens the dropdown, arrow keys pick an option.

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique input ID (required) |
| `label` | `string` | Label text (required) |
| `options` | `{ label, value }[]` | Options array (required) |
| `defaultValue` | `string` | Initial selected value |
| `placeholder` | `string` | Placeholder text |
| `onChange` | `(value) => void` | Change handler |

```ts
select({
  id: "color",
  label: "Favorite Color",
  options: [{ label: "Red", value: "red" }, { label: "Blue", value: "blue" }],
  onChange: (val) => console.log("Selected:", val),
})
```

### checkbox(config)

Toggle checkbox. Enter or Space toggles.

```ts
checkbox({ id: "agree", label: "I agree to the terms", onChange: (val) => console.log(val) })
```

### toggle(config)

Toggle switch with on/off labels. Enter or Space toggles.

```ts
toggle({ id: "dark", label: "Dark Mode", onLabel: "ON", offLabel: "OFF", defaultValue: true })
```

### radioGroup(config)

Radio button group. Enter starts selection, arrow keys move between options.

```ts
radioGroup({
  id: "plan",
  label: "Select Plan",
  options: [{ label: "Free", value: "free" }, { label: "Pro", value: "pro" }],
  defaultValue: "free",
})
```

### numberInput(config)

Numeric input. Left/Right arrow keys change the value.

```ts
numberInput({ id: "qty", label: "Quantity", defaultValue: 1, min: 1, max: 99, step: 1 })
```

### searchInput(config)

Search with filtering. Type to filter, arrows to pick, Enter to select. Set `action: "navigate"` to navigate to the selected value as a page ID.

```ts
searchInput({
  id: "search",
  placeholder: "Search pages...",
  items: [
    { label: "About", value: "about", keywords: ["bio", "info"] },
    { label: "Projects", value: "projects", keywords: ["work", "code"] },
  ],
  action: "navigate",
})
```

### button(config)

A pressable button. Enter triggers the action.

```ts
button({ label: "Submit", style: "primary", onPress: async () => { /* ... */ } })
```

Styles: `"primary"`, `"secondary"`, `"danger"`.

### form(config)

Groups input fields and a submit button. On submit, collects all field values by their `id`.

The `onSubmit` handler must return an `ActionResult`: `{ success: "..." }`, `{ error: "..." }`, or `{ info: "..." }`.

```ts
form({
  id: "contact",
  onSubmit: async (data) => {
    await sendEmail(data.name, data.email, data.message);
    return { success: "Message sent!" };
  },
  fields: [
    textInput({ id: "name", label: "Name" }),
    textInput({ id: "email", label: "Email" }),
    textArea({ id: "message", label: "Message", rows: 4 }),
    button({ label: "Send", style: "primary" }),
  ],
})
```

---

## Layout Components

Layout components divide the terminal into panels. See [layouts.md](layouts.md) for full documentation.

### columns(panels)

Side-by-side panels. Each panel gets a `width` (`"50%"`, `30`, or omit for equal split).

```ts
columns([
  panel({ width: "60%", content: [table(["Name", "Status"], [["nginx", "running"]])] }),
  panel({ width: "40%", content: [progressBar("CPU", 45)] }),
])
```

### rows(panels)

Vertically stacked panels with `height` (`"50%"`, `10`, or omit for equal split).

```ts
rows([
  panel({ height: "40%", content: [markdown("## Top")] }),
  panel({ height: "60%", content: [markdown("## Bottom")] }),
])
```

### grid(config)

N×M grid. `cols`: columns. `gap`: character gap (default 1). `items`: array of `panel()` configs.

```ts
grid({ cols: 2, items: [
  panel({ title: "CPU", content: [progressBar("Usage", 45)] }),
  panel({ title: "Mem", content: [progressBar("RAM", 72)] }),
]})
```

### panel(config)

Bordered content area with optional `title`, `border`, `padding`, `width`, `height`.

```ts
panel({ title: "Stats", border: "rounded", padding: 1, content: [progressBar("CPU", 45)] })
```

### row(cols, config?) + col(content, config?)

12-column grid system. `span` is 1-12 (default: auto). Responsive breakpoints: `xs`, `sm`, `md`, `lg`.

```ts
row([
  col([sidebar], { span: 3 }),
  col([content], { span: 9 }),
], { gap: 1 })
```

### container(content, config?)

Centers content with optional `maxWidth` and `padding`.

```ts
container([row([...])], { maxWidth: 100, padding: 2 })
```

**Navigation**: Arrow keys navigate spatially between focusable items in any layout. No configuration needed.

---

## Dynamic Components

### dynamic(renderFn) / dynamic(deps, renderFn)

Reactive content block that re-renders when state changes. Optionally specify dependency keys to limit re-renders.

```ts
dynamic(() => markdown(`Count: ${state.get("count")}`))
dynamic(["count"], () => markdown(`Count: ${state.get("count")}`))
```

### asyncContent(config)

Lazily-loaded async content with loading and fallback states.

```ts
asyncContent({
  load: async () => {
    const data = await fetchData();
    return [card({ title: data.name, body: data.description })];
  },
  loading: "Loading data...",
  fallback: [markdown("Failed to load.")],
})
```

---

## Custom Components

You can register custom component renderers using the `componentRegistry`:

```ts
import { componentRegistry } from "terminaltui";
import type { RenderContext } from "terminaltui";

componentRegistry.register("myWidget", (block, ctx: RenderContext) => {
  // Return an array of ANSI-styled lines
  return [`  ${block.label}: ${block.value}`];
}, true); // true = focusable
```

Use your custom component in content arrays by creating a block with a matching `type`:

```ts
content: [
  { type: "myWidget", label: "Score", value: "42" } as any,
]
```

For architecture details and how to contribute new built-in components, see [ARCHITECTURE.md](../ARCHITECTURE.md).
