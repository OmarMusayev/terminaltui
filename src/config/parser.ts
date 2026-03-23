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
} from "./types.js";
import type { Theme } from "../style/theme.js";

// ─── Site Definition ───────────────────────────────────────

export function defineSite(config: SiteConfig): Site {
  // Validate
  if (!config.name) throw new Error("Site config must have a name");
  if (!config.pages || config.pages.length === 0) throw new Error("Site must have at least one page");

  // Ensure all pages have ids
  for (const p of config.pages) {
    if (!p.id) throw new Error(`Page must have an id: ${JSON.stringify(p)}`);
  }

  return { config };
}

// ─── Page Builder ──────────────────────────────────────────

export function page(id: string, config: Omit<PageConfig, "id">): PageConfig {
  return { id, ...config };
}

// ─── Content Helpers ───────────────────────────────────────

export function section(title: string, content: ContentBlock[]): SectionBlock {
  return { type: "section", title, content };
}

export function card(config: Omit<CardBlock, "type">): CardBlock {
  return { type: "card", ...config };
}

export function timeline(items: TimelineItem[]): TimelineBlock {
  return { type: "timeline", items };
}

export function table(headers: string[], rows: string[][]): TableBlock {
  return { type: "table", headers, rows };
}

export function list(items: string[], style?: ListBlock["style"]): ListBlock {
  return { type: "list", items, style };
}

export function quote(text: string, attribution?: string): QuoteBlock {
  return { type: "quote", text, attribution };
}

export function hero(config: Omit<HeroBlock, "type">): HeroBlock {
  return { type: "hero", ...config };
}

export function gallery(items: Omit<CardBlock, "type">[]): GalleryBlock {
  return { type: "gallery", items: items.map(i => ({ type: "card" as const, ...i })) };
}

export function tabs(items: { label: string; content: ContentBlock[] }[]): TabsBlock {
  return { type: "tabs", items };
}

export function accordion(items: { label: string; content: ContentBlock[] }[]): AccordionBlock {
  return { type: "accordion", items };
}

export function link(label: string, url: string, options?: LinkOptions): LinkBlock {
  return { type: "link", label, url, icon: options?.icon };
}

export function skillBar(label: string, value: number): ProgressBarBlock {
  return { type: "progressBar", label, value, max: 100, showPercent: true };
}

export function progressBar(label: string, value: number, max?: number): ProgressBarBlock {
  return { type: "progressBar", label, value, max: max ?? 100, showPercent: true };
}

export function badge(text: string, color?: string): BadgeBlock {
  return { type: "badge", text, color };
}

export function image(path: string, options?: { width?: number; mode?: "ascii" | "braille" | "blocks" }): ImageBlock {
  return { type: "image", path, ...options };
}

// ─── Visual Helpers ────────────────────────────────────────

export function ascii(text: string, options?: AsciiBannerOptions): BannerConfig {
  return { text, ...options };
}

export function markdown(text: string): TextBlock {
  return { type: "text", content: text.replace(/\n\s+/g, "\n"), style: "markdown" };
}

export function gradient(text: string, colors: string[]): TextBlock {
  // Gradient text is handled at render time; store the info
  return { type: "text", content: text, style: "plain" } as TextBlock & { _gradient: string[] };
}

export function sparkline(data: number[]): ContentBlock {
  const chars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const line = data.map(v => chars[Math.round(((v - min) / range) * (chars.length - 1))]).join("");
  return { type: "text", content: line, style: "plain" };
}

export function divider(style?: DividerBlock["style"] | string, label?: string): DividerBlock {
  if (typeof style === "string" && style !== "solid" && style !== "dashed" && style !== "dotted" && style !== "double" && style !== "label") {
    // first arg is actually a label
    return { type: "divider", style: "label", label: style };
  }
  return { type: "divider", style: style as DividerBlock["style"], label };
}

export function spacer(lines?: number): SpacerBlock {
  return { type: "spacer", lines: lines ?? 1 };
}

// ─── Input Component Helpers ──────────────────────────────

let asyncIdCounter = 0;

export function textInput(config: Omit<TextInputBlock, "type">): TextInputBlock {
  return { type: "textInput", ...config };
}

export function textArea(config: Omit<TextAreaBlock, "type">): TextAreaBlock {
  return { type: "textArea", ...config };
}

export function select(config: Omit<SelectBlock, "type">): SelectBlock {
  return { type: "select", ...config };
}

export function checkbox(config: Omit<CheckboxBlock, "type">): CheckboxBlock {
  return { type: "checkbox", ...config };
}

export function toggle(config: Omit<ToggleBlock, "type">): ToggleBlock {
  return { type: "toggle", ...config };
}

export function radioGroup(config: Omit<RadioGroupBlock, "type">): RadioGroupBlock {
  return { type: "radioGroup", ...config };
}

export function numberInput(config: Omit<NumberInputBlock, "type">): NumberInputBlock {
  return { type: "numberInput", ...config };
}

export function searchInput(config: Omit<SearchInputBlock, "type">): SearchInputBlock {
  return { type: "searchInput", ...config };
}

export function button(config: Omit<ButtonBlock, "type">): ButtonBlock {
  return { type: "button", ...config };
}

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

export function asyncContent(config: Omit<AsyncContentBlock, "type">): AsyncContentBlock {
  return { type: "asyncContent", ...config, _asyncId: `async-${asyncIdCounter++}` };
}

// ─── Re-exports from other modules ────────────────────────

// These are re-exported here for convenience so users can import everything from one place.
// The actual implementations live in their respective modules.
