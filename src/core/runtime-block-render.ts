/**
 * Individual block rendering — the big switch statement that maps
 * block types to component renderers.
 */
import type { ContentBlock, DynamicBlock, FormBlock, ColumnsBlock, RowsBlock, GridBlock, PanelBlock, RowBlock, ContainerBlock, MenuBlock, ChatBlock } from "../config/types.js";
import { renderChat, type ChatState, type ChatMessage } from "../components/Chat.js";
import { fgColor, reset, bold } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

/** Block types that participate in focus / spatial navigation. */
const FOCUSABLE_TYPES = new Set<string>([
  "card", "link", "hero", "tabs", "accordion", "gallery",
  "textInput", "textArea", "select", "checkbox", "toggle",
  "radioGroup", "numberInput", "searchInput", "button",
]);
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
import { renderMenu as renderMenuComponent, type MenuItem } from "../components/Menu.js";
import type { RenderContext } from "../components/base.js";
import { renderColumns, mergeRects } from "../components/layout/Columns.js";
import { rowColsToPanels, getBreakpoint, getEffectiveSpan } from "../layout/grid-system.js";
import { layoutColumns } from "../layout/panel-layout.js";
import { renderRows } from "../components/layout/Rows.js";
import { renderGrid } from "../components/layout/Grid.js";
import { renderPanel } from "../components/layout/Panel.js";
import type { ScreenSize } from "./screen.js";

interface RT {
  galleryState: Map<string, number>;
  tabState: Map<string, number>;
  accordionState: Map<string, number>;
  formResults: Map<string, { message: string; type: "success" | "error" | "info" }>;
  buttonLoading: Map<string, boolean>;
  dynamicCache: Map<string, ContentBlock[]>;
  currentFocusedBlock?: ContentBlock;
  screenSize: ScreenSize;
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

/** Check if a block type is focusable. */
export function isBlockFocusable(block: ContentBlock): boolean {
  return FOCUSABLE_TYPES.has(block.type);
}

/** Whether the given block type participates in focus navigation. */
export function isFocusableType(type: string): boolean {
  return FOCUSABLE_TYPES.has(type);
}

/** Render content blocks as string lines. */
export function renderContentBlocks(rt: RT, blocks: ContentBlock[], ctx: RenderContext): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    // Pass focused context to blocks inside layouts when they match the current focus
    let blockCtx = ctx;
    if (rt.currentFocusedBlock && block === rt.currentFocusedBlock) {
      blockCtx = { ...ctx, focused: true };
    }
    const blockLines = renderBlock(rt, block, blockCtx);
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
      const sectionDims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.section);
      const sectionLines: string[] = [];
      sectionLines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
      sectionLines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, sectionDims.content - 4)) + reset);
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
    case "columns": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = Math.max(10, termRows - 8);
      const colsBlock = block as ColumnsBlock;
      const activeIdx = findActivePanelIndex(colsBlock.panels.map(p => p.content), rt.currentFocusedBlock);
      return renderColumns(colsBlock, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "rows": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = Math.max(10, termRows - 8);
      const rowsBlk = block as RowsBlock;
      const activeIdx = findActivePanelIndex(rowsBlk.panels.map(p => p.content), rt.currentFocusedBlock);
      return renderRows(rowsBlk, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "grid": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = Math.max(10, termRows - 8);
      const gridBlk = block as GridBlock;
      const activeIdx = findActivePanelIndex(gridBlk.config.items.map(i => i.content), rt.currentFocusedBlock);
      return renderGrid(gridBlk, ctx, {
        availableHeight: availHeight,
        activePanelIndex: activeIdx,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "panel": {
      const { rows: termRows } = rt.screenSize;
      const availHeight = Math.max(10, termRows - 8);
      return renderPanel((block as PanelBlock).config, ctx, {
        width: ctx.width,
        height: availHeight,
        renderContent: (blocks, c) => renderContentBlocks(rt, blocks, c),
      });
    }
    case "row": {
      return renderRowBlock(rt, block as RowBlock, ctx);
    }
    case "container": {
      return renderContainerBlock(rt, block as ContainerBlock, ctx);
    }
    case "menu": {
      // Menu block — render inline menu (auto or manual items)
      return renderMenuBlock(rt, block as any, ctx);
    }
    case "chat": {
      const chatBlock = block as ChatBlock;
      const state = rt.getInputState(chatBlock.id, {
        messages: [] as ChatMessage[],
        input: "",
        cursorPos: 0,
        loading: false,
        error: null,
      });
      const chatState: ChatState = {
        messages: (state.value as any)?.messages ?? [],
        input: (state.value as any)?.input ?? state.value as string ?? "",
        cursorPos: state.cursorPos ?? 0,
        loading: (state.value as any)?.loading ?? false,
        error: (state.value as any)?.error ?? null,
      };
      return renderChat(chatBlock, chatState, ctx);
    }
    default:
      return [];
  }
}

/** Find which panel (by content array index) contains the focused block. */
function findActivePanelIndex(contentArrays: ContentBlock[][], focusedBlock?: ContentBlock): number {
  if (!focusedBlock) return -1;
  for (let i = 0; i < contentArrays.length; i++) {
    if (containsBlockDeep(contentArrays[i], focusedBlock)) return i;
  }
  return -1;
}

/** Check if a block exists anywhere in a content tree. */
function containsBlockDeep(blocks: ContentBlock[], target: ContentBlock): boolean {
  for (const block of blocks) {
    if (block === target) return true;
    if (block.type === "columns") {
      for (const p of (block as ColumnsBlock).panels) {
        if (containsBlockDeep(p.content, target)) return true;
      }
    } else if (block.type === "rows") {
      for (const p of (block as RowsBlock).panels) {
        if (containsBlockDeep(p.content, target)) return true;
      }
    } else if (block.type === "grid") {
      for (const item of (block as GridBlock).config.items) {
        if (containsBlockDeep(item.content, target)) return true;
      }
    } else if (block.type === "panel") {
      if (containsBlockDeep((block as PanelBlock).config.content, target)) return true;
    } else if (block.type === "section") {
      if (containsBlockDeep(block.content, target)) return true;
    } else if (block.type === "form") {
      if (containsBlockDeep((block as FormBlock).fields, target)) return true;
    } else if (block.type === "row") {
      for (const c of (block as RowBlock).cols) {
        if (containsBlockDeep(c.content, target)) return true;
      }
    } else if (block.type === "container") {
      if (containsBlockDeep((block as ContainerBlock).content, target)) return true;
    }
  }
  return false;
}

/** Render a 12-column grid row with responsive wrapping. */
function renderRowBlock(rt: RT, block: RowBlock, ctx: RenderContext): string[] {
  const { cols, gap = 1 } = block;
  if (cols.length === 0) return [];

  const { rows: termRows, columns: termCols } = rt.screenSize;
  const availHeight = Math.max(10, termRows - 8);

  // Resolve effective spans based on current terminal breakpoint
  const bp = getBreakpoint(termCols);
  const autoSpan = Math.max(1, Math.floor(12 / cols.length));
  const spans = cols.map(c => getEffectiveSpan(c, bp, autoSpan));

  // Group columns into wrapped rows (each row gets up to 12 spans)
  const wrappedRows: { col: typeof cols[number]; span: number }[][] = [[]];
  let currentRowSpan = 0;
  for (let i = 0; i < cols.length; i++) {
    const offset = cols[i].offset ?? 0;
    const totalSpan = spans[i] + offset;
    if (currentRowSpan + totalSpan > 12 && wrappedRows[wrappedRows.length - 1].length > 0) {
      wrappedRows.push([]);
      currentRowSpan = 0;
    }
    wrappedRows[wrappedRows.length - 1].push({ col: cols[i], span: spans[i] });
    currentRowSpan += totalSpan;
  }

  // Render each wrapped row independently
  const allLines: string[] = [];
  for (const rowCols of wrappedRows) {
    const rowColConfigs = rowCols.map(r => r.col);
    const panels = rowColsToPanels(rowColConfigs, ctx.width, gap, termCols);
    const activeIdx = findActivePanelIndex(panels.map(p => p.content), rt.currentFocusedBlock);
    const rects = layoutColumns(panels, ctx.width, availHeight);
    const rowLines = mergeRects(rects, ctx, ctx.width, availHeight, activeIdx,
      (blocks, c) => renderContentBlocks(rt, blocks, c));

    // Trim trailing blank lines so rows take only as much space as content needs.
    // Blank lines are those containing only spaces, ANSI codes, and divider chars.
    while (rowLines.length > 0) {
      const last = rowLines[rowLines.length - 1];
      const visual = last.replace(/\x1b\[[0-9;]*m/g, "");
      if (/^[\s\u2502\u2506\u250a\u2503]*$/.test(visual)) {
        rowLines.pop();
      } else {
        break;
      }
    }

    if (allLines.length > 0) allLines.push(""); // gap between wrapped rows
    allLines.push(...rowLines);
  }
  return allLines;
}

/** Render a menu block (for file-based routing auto-menu or inline manual menu). */
function renderMenuBlock(rt: RT, block: any, ctx: RenderContext): string[] {
  let items: MenuItem[] = [];

  if (block.items && block.items.length > 0) {
    // Manual items
    items = block.items.map((item: any) => ({
      label: item.label,
      icon: item.icon,
      id: item.page,
    }));
  } else if (block.source === "auto") {
    // Auto-generated from file router or site pages
    const fileRouter = (rt as any)._fileRouter;
    if (fileRouter) {
      const menuItems = fileRouter.getMenuItems();
      items = menuItems.map((m: any) => ({
        label: m.label,
        icon: m.icon,
        id: m.page,
      }));
    } else {
      // Fallback: use site pages (single-file mode)
      const site = (rt as any).site;
      if (site?.pages) {
        items = site.pages
          .filter((p: any) => typeof p.title === "string")
          .map((p: any) => ({ label: p.title, icon: p.icon, id: p.id }));
      }
    }
  }

  // Render using the existing menu renderer
  return renderMenuComponent(items, 0, ctx);
}

/** Render a container block (centers content with optional max width). */
function renderContainerBlock(rt: RT, block: ContainerBlock, ctx: RenderContext): string[] {
  const padding = block.padding ?? 0;
  const maxWidth = block.maxWidth ?? ctx.width;
  const innerWidth = Math.max(1, Math.min(ctx.width, maxWidth) - padding * 2);
  const containerCtx: RenderContext = { ...ctx, width: innerWidth };

  const lines: string[] = [];
  for (const child of block.content) {
    let childCtx = containerCtx;
    if (rt.currentFocusedBlock && child === rt.currentFocusedBlock) {
      childCtx = { ...containerCtx, focused: true };
    }
    const rendered = renderBlock(rt, child, childCtx);

    // Center if needed and padding
    const center = block.center !== false;
    const totalPad = ctx.width - innerWidth;
    const leftPad = center ? Math.floor(totalPad / 2) : padding;
    const padStr = " ".repeat(leftPad);

    for (const line of rendered) {
      lines.push(padStr + line);
    }
    lines.push("");
  }
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
