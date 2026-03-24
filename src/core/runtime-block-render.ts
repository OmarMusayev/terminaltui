/**
 * Individual block rendering — the big switch statement that maps
 * block types to component renderers.
 */
import type { ContentBlock, DynamicBlock, FormBlock } from "../config/types.js";
import { fgColor, reset, bold } from "../style/colors.js";
import { componentRegistry } from "../components/base.js";
// Initialize the registry (side-effect import)
import "../components/registry.js";
import { renderText } from "../components/Text.js";
import { renderCard } from "../components/Card.js";
import { renderTimeline } from "../components/Timeline.js";
import { renderProgressBar } from "../components/ProgressBar.js";
import { renderTable } from "../components/Table.js";
import { renderLink } from "../components/Link.js";
import { renderDivider } from "../components/Divider.js";
import { renderSpacer } from "../components/Spacer.js";
import { renderQuote } from "../components/Quote.js";
import { renderBadge } from "../components/Badge.js";
import { renderHero } from "../components/Hero.js";
import { renderList } from "../components/List.js";
import { renderImage } from "../components/Image.js";
import { renderAccordion } from "../components/Accordion.js";
import { renderTabs } from "../components/Tabs.js";
import { renderGallery } from "../components/Gallery.js";
import { renderTextInput } from "../components/TextInput.js";
import { renderTextArea } from "../components/TextArea.js";
import { renderSelect } from "../components/Select.js";
import { renderCheckbox } from "../components/Checkbox.js";
import { renderToggle } from "../components/Toggle.js";
import { renderRadioGroup } from "../components/RadioGroup.js";
import { renderNumberInput } from "../components/NumberInput.js";
import { renderSearchInput, filterSearchItems } from "../components/SearchInput.js";
import { renderButton } from "../components/Button.js";
import { renderFormResult } from "../components/Form.js";
import type { RenderContext } from "../components/base.js";

interface RT {
  galleryState: Map<string, number>;
  tabState: Map<string, number>;
  accordionState: Map<string, number>;
  formResults: Map<string, { message: string; type: "success" | "error" | "info" }>;
  buttonLoading: Map<string, boolean>;
  dynamicCache: Map<string, ContentBlock[]>;
  getInputState(id: string, defaultValue?: any): any;
}

/** Resolve a dynamic block's children using cache for stable object references. */
export function resolveDynamic(rt: RT, block: DynamicBlock): ContentBlock[] {
  const id = block._dynamicId ?? "";
  const cached = rt.dynamicCache.get(id);
  if (cached) return cached;
  try {
    const result = block.render();
    const blocks = Array.isArray(result) ? result : [result];
    if (id) rt.dynamicCache.set(id, blocks);
    return blocks;
  } catch {
    return [];
  }
}

/** Invalidate dynamic cache so next render re-evaluates. */
export function invalidateDynamicCache(rt: RT): void {
  rt.dynamicCache.clear();
}

/** Check if a block type is focusable. Uses the component registry. */
export function isBlockFocusable(block: ContentBlock): boolean {
  return componentRegistry.isFocusable(block.type);
}

/** Render content blocks as string lines. */
export function renderContentBlocks(rt: RT, blocks: ContentBlock[], ctx: RenderContext): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    const blockLines = renderBlock(rt, block, ctx);
    lines.push(...blockLines);
    lines.push("");
  }
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/** Render a single content block to string lines. */
export function renderBlock(rt: RT, block: ContentBlock, ctx: RenderContext): string[] {
  switch (block.type) {
    case "text":
      return renderText(block.content, ctx, block.style);
    case "card":
      return renderCard(block, ctx);
    case "timeline":
      return renderTimeline(block.items, ctx, block.style);
    case "table":
      return renderTable(block.headers, block.rows, ctx);
    case "list":
      return renderList(block.items, ctx, block.style);
    case "quote":
      return renderQuote(block.text, ctx, { attribution: block.attribution, style: block.style });
    case "hero":
      return renderHero(block, ctx);
    case "gallery": {
      const galleryKey = JSON.stringify(block.items.map((i: any) => i.title));
      const scrollIdx = rt.galleryState.get(galleryKey) ?? 0;
      return renderGallery(block.items, ctx, { columns: block.columns, scrollIndex: scrollIdx });
    }
    case "tabs": {
      const tabKey = block.items.map((i: any) => i.label).join(",");
      const activeIdx = rt.tabState.get(tabKey) ?? 0;
      return renderTabs(block.items, activeIdx, ctx, (blocks, c) => renderContentBlocks(rt, blocks, c));
    }
    case "accordion": {
      const accKey = block.items.map((i: any) => i.label).join(",");
      const openIdx = rt.accordionState.get(accKey) ?? -1;
      return renderAccordion(block.items, openIdx, ctx, (blocks, c) => renderContentBlocks(rt, blocks, c));
    }
    case "link":
      return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "progressBar":
      return renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent });
    case "badge":
      return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];
    case "image":
      return renderImage(block.path, ctx, { width: block.width, mode: block.mode });
    case "divider":
      return renderDivider(ctx, { style: block.style, label: block.label, color: block.color });
    case "spacer":
      return renderSpacer(block.lines);
    case "section": {
      const sectionLines: string[] = [];
      sectionLines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
      sectionLines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, ctx.width - 4)) + reset);
      sectionLines.push("");
      sectionLines.push(...renderContentBlocks(rt, block.content, ctx));
      return sectionLines;
    }
    case "custom":
      return block.render(ctx.width, ctx.theme);
    case "textInput": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderTextInput(block, { value: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, error: state.error }, ctx);
    }
    case "textArea": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderTextArea(block, { value: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, error: state.error, scrollOffset: state.scrollOffset }, ctx);
    }
    case "select": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderSelect(block, { value: state.value as string, open: state.open, highlightIndex: state.highlightIndex }, ctx);
    }
    case "checkbox": {
      const state = rt.getInputState(block.id, block.defaultValue ?? false);
      return renderCheckbox(block, state.value as boolean, ctx);
    }
    case "toggle": {
      const state = rt.getInputState(block.id, block.defaultValue ?? false);
      return renderToggle(block, state.value as boolean, ctx);
    }
    case "radioGroup": {
      const state = rt.getInputState(block.id, block.defaultValue ?? "");
      return renderRadioGroup(block, { value: state.value as string, highlightIndex: state.highlightIndex }, ctx);
    }
    case "numberInput": {
      const state = rt.getInputState(block.id, block.defaultValue ?? 0);
      return renderNumberInput(block, { value: state.value as number, editing: !!ctx.editing, textBuffer: "" }, ctx);
    }
    case "searchInput": {
      const state = rt.getInputState(block.id, "");
      const maxResults = block.maxResults ?? 10;
      const filtered = filterSearchItems(block.items, state.value as string, maxResults);
      return renderSearchInput(block, { query: state.value as string, cursorPos: state.cursorPos, editing: !!ctx.editing, highlightIndex: state.highlightIndex, filteredItems: filtered }, ctx);
    }
    case "button": {
      const isLoading = rt.buttonLoading.get(block.label) ?? false;
      return renderButton(block, ctx, isLoading);
    }
    case "form": {
      const formLines = renderContentBlocks(rt, block.fields, ctx);
      const formResult = rt.formResults.get(block.id);
      if (formResult) {
        formLines.push("");
        formLines.push(...renderFormResult({ resultMessage: formResult.message, resultType: formResult.type }, ctx));
      }
      return formLines;
    }
    case "asyncContent":
      return [];
    case "dynamic": {
      const dynamicBlocks = resolveDynamic(rt, block as DynamicBlock);
      return renderContentBlocks(rt, dynamicBlocks, ctx);
    }
    default:
      return [];
  }
}
