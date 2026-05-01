import type {
  SiteConfig,
  Site,
  PageConfig,
  ContentBlock,
  CardBlock,
  TimelineBlock,
  TimelineItem,
  TableBlock,
  ListBlock,
  QuoteBlock,
  HeroBlock,
  GalleryBlock,
  TabsBlock,
  AccordionBlock,
  LinkBlock,
  ProgressBarBlock,
  BadgeBlock,
  ImageBlock,
  DividerBlock,
  SpacerBlock,
  SectionBlock,
  TextBlock,
  BannerConfig,
  AsciiBannerOptions,
  LinkOptions,
  TextInputBlock,
  TextAreaBlock,
  SelectBlock,
  CheckboxBlock,
  ToggleBlock,
  RadioGroupBlock,
  NumberInputBlock,
  SearchInputBlock,
  ButtonBlock,
  FormBlock,
  AsyncContentBlock,
  PanelConfig,
  GridConfig,
  ColumnsBlock,
  RowsBlock,
  GridBlock,
  PanelBlock,
  ColConfig,
  RowBlock,
  ContainerBlock,
  MenuBlock,
  MenuBlockItem,
  ChatBlock,
} from "./types.js";
import type { Theme } from "../style/theme.js";

// ─── Content Helpers ───────────────────────────────────────

/** Groups content blocks under a titled section with a divider. */
export function section(title: string, content: ContentBlock[]): SectionBlock {
  if (typeof title !== "string") {
    throw new Error(
      `section() expects (title: string, content: ContentBlock[]), got ${typeof title}. Use section("Title", [...]) instead.`
    );
  }
  return { type: "section", title, content };
}

/**
 * Creates a card content block with a framed border, title, body, and tags.
 *
 * @param config - Card configuration (title, subtitle, body, tags, url, action)
 * @returns A CardBlock content block
 *
 * @example
 * card({ title: "My Project", subtitle: "★ 1.2k", body: "A cool tool", tags: ["Rust"] })
 */
export function card(config: Omit<CardBlock, "type">): CardBlock {
  return { type: "card", ...config };
}

/** Creates a vertical timeline with dated entries. */
export function timeline(items: TimelineItem[]): TimelineBlock {
  return { type: "timeline", items };
}

/** Creates a data table with headers and rows. */
export function table(headers: string[], rows: string[][]): TableBlock {
  return { type: "table", headers, rows };
}

/** Creates a bullet or numbered list. */
export function list(items: string[], style?: ListBlock["style"]): ListBlock {
  return { type: "list", items, style };
}

/** Creates a styled blockquote with optional attribution. */
export function quote(text: string, attribution?: string): QuoteBlock {
  return { type: "quote", text, attribution };
}

/** Creates a hero banner with title, subtitle, and optional call-to-action. */
export function hero(config: Omit<HeroBlock, "type">): HeroBlock {
  return { type: "hero", ...config };
}

/** Creates a scrollable card gallery. */
export function gallery(items: Omit<CardBlock, "type">[]): GalleryBlock {
  return { type: "gallery", items: items.map(i => ({ type: "card" as const, ...i })) };
}

/** Creates a tabbed content switcher. Press Enter to cycle tabs. */
export function tabs(items: { label: string; content: ContentBlock[] }[]): TabsBlock {
  return { type: "tabs", items };
}

/** Creates a collapsible accordion. Press Enter to toggle items. */
export function accordion(items: { label: string; content: ContentBlock[] }[]): AccordionBlock {
  return { type: "accordion", items };
}

/** Creates a focusable link that opens a URL when activated. */
export function link(label: string, url: string, options?: LinkOptions): LinkBlock {
  return { type: "link", label, url, icon: options?.icon };
}

/** Creates a skill/progress bar showing a labeled percentage (0-100). */
export function skillBar(label: string, value: number): ProgressBarBlock {
  return { type: "progressBar", label, value, max: 100, showPercent: true };
}

/** Creates a progress bar with a custom max value. */
export function progressBar(label: string, value: number, max?: number): ProgressBarBlock {
  return { type: "progressBar", label, value, max: max ?? 100, showPercent: true };
}

/** Creates an inline badge/tag with optional custom color. */
export function badge(text: string, color?: string): BadgeBlock {
  return { type: "badge", text, color };
}

/** Renders an image file as ASCII art in the terminal. */
export function image(path: string, options?: { width?: number; mode?: "ascii" | "braille" | "blocks" }): ImageBlock {
  return { type: "image", path, ...options };
}

// ─── Visual Helpers ────────────────────────────────────────

/** Creates a plain text content block. */
export function text(content: string): TextBlock {
  return { type: "text", content, style: "plain" };
}

/** Creates an ASCII art banner configuration for the site header. */
export function ascii(text: string, options?: AsciiBannerOptions): BannerConfig {
  return { text, ...options };
}

/** Creates a text block rendered with basic markdown formatting. */
export function markdown(text: string): TextBlock {
  return { type: "text", content: text.replace(/\n\s+/g, "\n"), style: "markdown" };
}

/** Creates text with a multi-color gradient effect. */
export function gradient(text: string, colors: string[]): TextBlock {
  // Gradient text is handled at render time; store the info
  return { type: "text", content: text, style: "plain" } as TextBlock & { _gradient: string[] };
}

/** Creates an inline sparkline chart from numeric data using Unicode block chars. */
export function sparkline(data: number[]): ContentBlock {
  const chars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const line = data.map(v => chars[Math.round(((v - min) / range) * (chars.length - 1))]).join("");
  return { type: "text", content: line, style: "plain" };
}

/** Creates a horizontal divider line. Pass a string as first arg for a labeled divider. */
export function divider(style?: DividerBlock["style"] | string, label?: string): DividerBlock {
  if (typeof style === "string" && style !== "solid" && style !== "dashed" && style !== "dotted" && style !== "double" && style !== "label") {
    // first arg is actually a label
    return { type: "divider", style: "label", label: style };
  }
  return { type: "divider", style: style as DividerBlock["style"], label };
}

/** Creates vertical whitespace (default 1 line). */
export function spacer(lines?: number): SpacerBlock {
  return { type: "spacer", lines: lines ?? 1 };
}

// ─── Input Component Helpers ──────────────────────────────

let asyncIdCounter = 0;

/** Creates a single-line text input field. */
export function textInput(config: Omit<TextInputBlock, "type">): TextInputBlock {
  return { type: "textInput", ...config };
}

/** Creates a multi-line text area input. */
export function textArea(config: Omit<TextAreaBlock, "type">): TextAreaBlock {
  return { type: "textArea", ...config };
}

/** Creates a dropdown select input with predefined options. */
export function select(config: Omit<SelectBlock, "type">): SelectBlock {
  return { type: "select", ...config };
}

/** Creates a checkbox input that toggles on Enter. */
export function checkbox(config: Omit<CheckboxBlock, "type">): CheckboxBlock {
  return { type: "checkbox", ...config };
}

/** Creates a toggle switch input. */
export function toggle(config: Omit<ToggleBlock, "type">): ToggleBlock {
  return { type: "toggle", ...config };
}

/** Creates a radio button group for single selection from options. */
export function radioGroup(config: Omit<RadioGroupBlock, "type">): RadioGroupBlock {
  return { type: "radioGroup", ...config };
}

/** Creates a numeric input with increment/decrement via arrow keys. */
export function numberInput(config: Omit<NumberInputBlock, "type">): NumberInputBlock {
  return { type: "numberInput", ...config };
}

/** Creates a searchable input with filtered suggestions from a list of items. */
export function searchInput(config: Omit<SearchInputBlock, "type">): SearchInputBlock {
  return { type: "searchInput", ...config };
}

/** Creates a pressable button that triggers an action. */
export function button(config: Omit<ButtonBlock, "type">): ButtonBlock {
  return { type: "button", ...config };
}

/** Groups input fields into a form with submission handling and validation. */
export function form(config: Omit<FormBlock, "type">): FormBlock {
  const formBlock: FormBlock = { type: "form", ...config };
  // Tag buttons with form ID so the runtime knows which form to submit
  for (const field of formBlock.fields) {
    if (field.type === "button") {
      (field as ButtonBlock)._formId = formBlock.id;
    }
  }
  return formBlock;
}

/** Creates content that loads asynchronously with loading/error states. */
export function asyncContent(config: Omit<AsyncContentBlock, "type">): AsyncContentBlock {
  return { type: "asyncContent", ...config, _asyncId: `async-${asyncIdCounter++}` };
}

// ─── Layout Components ───────────────────────────────────

/** Creates side-by-side panel columns. */
export function columns(panels: PanelConfig[]): ColumnsBlock {
  return { type: "columns", panels };
}

/** Creates vertically stacked panel rows. */
export function rows(panels: PanelConfig[]): RowsBlock {
  return { type: "rows", panels };
}

/** Creates an N×M grid of panels. */
export function grid(config: GridConfig): GridBlock {
  return { type: "grid", config };
}

/** Creates a panel with optional border, title, and independent scrolling. */
export function panel(config: PanelConfig): PanelBlock {
  return { type: "panel", config };
}

// ─── Grid System (12-column) ─────────────────────────

/** Creates a column within a row(). Span is 1-12 (default: auto = 12/numCols). */
export function col(content: ContentBlock[], config?: Omit<ColConfig, "content">): ColConfig {
  return { content, ...config };
}

/** Creates a 12-column grid row with responsive columns. */
export function row(cols: ColConfig[], config?: { gap?: number }): RowBlock {
  return { type: "row", cols, gap: config?.gap };
}

/** Creates a centered container with optional max width and padding. */
export function container(content: ContentBlock[], config?: { maxWidth?: number; padding?: number; center?: boolean }): ContainerBlock {
  return { type: "container", content, ...config };
}

// ─── Menu Component ──────────────────────────────────────

/** Creates a menu block. Use { source: "auto" } for auto-generated menu from pages/. */
export function menu(config: Omit<MenuBlock, "type">): MenuBlock {
  return { type: "menu", ...config };
}

/** Creates a chat interface that sends messages to an API endpoint. */
export function chat(config: Omit<ChatBlock, "type">): ChatBlock {
  return { type: "chat", ...config };
}

// ─── Re-exports from other modules ────────────────────────

// These are re-exported here for convenience so users can import everything from one place.
// The actual implementations live in their respective modules.
