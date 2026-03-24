/**
 * Page-level rendering logic: home page, content page, scroll management,
 * and terminal output.
 */
import type { ContentBlock, AsyncContentBlock, FormBlock } from "../config/types.js";
import { fgColor, reset, bold, dim, italic } from "../style/colors.js";
import { gradientLines } from "../style/gradient.js";
import { renderBanner, centerBanner } from "../ascii/banner.js";
import { getSpinnerFrame } from "../animation/spinner.js";
import { getScreenSize } from "./screen.js";
import { renderMenu, type MenuItem } from "../components/Menu.js";
import { pad, wrapText, type RenderContext } from "../components/base.js";
import { renderFormResult } from "../components/Form.js";
import type { FocusItem } from "./runtime-types.js";
import {
  renderBlock, renderContentBlocks, resolveDynamic,
  invalidateDynamicCache, isBlockFocusable,
} from "./runtime-block-render.js";
import { writeToTerminal, createRenderContext } from "./runtime-terminal.js";

// Re-export for runtime.ts
export { renderBlock, renderContentBlocks, resolveDynamic, invalidateDynamicCache, isBlockFocusable };
export { writeToTerminal, createRenderContext };

interface RT {
  site: any;
  theme: any;
  router: any;
  focus: any;
  bootComplete: boolean;
  bootFrame: number;
  pageFocusIndex: number;
  pageFocusItems: FocusItem[];
  pageScrollOffset: number;
  inputMode: any;
  formResults: Map<string, { message: string; type: "success" | "error" | "info" }>;
  asyncManager: any;
  accordionState: Map<string, number>;
  dynamicCache: Map<string, ContentBlock[]>;
  getInputState(id: string, defaultValue?: any): any;
  getCurrentPage(): any;
  getPageContent(page: any): ContentBlock[] | null;
  initializePageContent(content: ContentBlock[]): void;
  resolvePageTitle(page: any): string;
  collectFocusItems(blocks: ContentBlock[]): FocusItem[];
  registerForms(blocks: ContentBlock[]): void;
  render(): void;
}

/** Main render entry point. */
export function renderMain(rt: RT): void {
  invalidateDynamicCache(rt as any);

  const currentPage = rt.getCurrentPage();
  if (currentPage && !rt.router.isHome()) {
    const content = rt.getPageContent(currentPage);
    if (content) {
      const oldIndex = rt.pageFocusIndex;
      rt.pageFocusItems = rt.collectFocusItems(content);
      rt.pageFocusIndex = Math.min(oldIndex, Math.max(0, rt.pageFocusItems.length - 1));
      rt.registerForms(content);
    }
  }

  const { columns, rows } = getScreenSize();
  const lines: string[] = [];
  const ctx = createRenderContext(rt as any, columns);

  if (rt.router.isHome()) {
    renderHomePage(rt, lines, ctx, columns, rows);
  } else {
    renderContentPage(rt, lines, ctx, columns, rows);
  }

  writeToTerminal(rt as any, lines, columns, rows);
}

/** Render the home/menu page. */
function renderHomePage(rt: RT, lines: string[], ctx: RenderContext, columns: number, rows: number): void {
  const contentWidth = ctx.width;
  const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);

  if (rt.site.banner) {
    let bannerLines = renderBanner(rt.site.banner.text, { font: rt.site.banner.font });
    bannerLines = centerBanner(bannerLines, contentWidth);
    if (rt.site.banner.gradient) {
      bannerLines = gradientLines(bannerLines, rt.site.banner.gradient);
    } else {
      bannerLines = bannerLines.map((l: string) => fgColor(rt.theme.accent) + l + reset);
    }
    if (!rt.bootComplete && rt.site.animations?.boot) {
      const revealLines = Math.floor((rt.bootFrame / 30) * bannerLines.length);
      bannerLines = bannerLines.slice(0, revealLines);
    }
    lines.push("");
    for (const bl of bannerLines) lines.push(padStr + bl);
  } else {
    lines.push("");
    const nameStr = fgColor(rt.theme.accent) + bold + rt.site.name + reset;
    lines.push(padStr + pad(nameStr, contentWidth, "center"));
  }

  lines.push("");
  if (rt.site.tagline) {
    const tagStr = fgColor(rt.theme.muted) + italic + rt.site.tagline + reset;
    lines.push(padStr + pad(tagStr, contentWidth, "center"));
    lines.push("");
  }

  lines.push(padStr + fgColor(rt.theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");

  const menuItems: MenuItem[] = rt.site.pages
    .filter((p: any) => typeof p.title === "string")
    .map((p: any) => ({ label: p.title, icon: p.icon, id: p.id }));

  let menuLines: string[];
  if (!rt.bootComplete && rt.site.animations?.boot) {
    const visibleCount = Math.max(0, Math.floor((rt.bootFrame - 15) / 3));
    menuLines = renderMenu(menuItems.slice(0, visibleCount), rt.focus.focusIndex, ctx);
  } else {
    menuLines = renderMenu(menuItems, rt.focus.focusIndex, ctx);
  }
  for (const ml of menuLines) lines.push(padStr + ml);

  lines.push("");
  lines.push(padStr + fgColor(rt.theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");
  lines.push(padStr + fgColor(rt.theme.subtle) + dim +
    "  \u2191\u2193 navigate  \u23ce select  q quit  : command" + reset);
  if (rt.site.handle) {
    lines.push("");
    lines.push(padStr + fgColor(rt.theme.subtle) + dim + "  " + rt.site.handle + reset);
  }
}

/** Render a content page with scroll management. */
function renderContentPage(rt: RT, lines: string[], ctx: RenderContext, columns: number, rows: number): void {
  const currentPage = rt.getCurrentPage();
  if (!currentPage) return;

  const content = rt.getPageContent(currentPage);
  const contentWidth = ctx.width;
  const leftPad = Math.max(0, Math.floor((columns - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);

  if (content === null) {
    const loadingMsg = currentPage.loading ?? "Loading...";
    lines.push("");
    const backHint = fgColor(rt.theme.subtle) + dim + "\u2190 back" + reset;
    const pageTitle = fgColor(rt.theme.accent) + bold +
      (currentPage.icon ? currentPage.icon + " " : "") +
      rt.resolvePageTitle(currentPage) + reset;
    lines.push(padStr + backHint + "  " + pageTitle);
    lines.push(padStr + fgColor(rt.theme.border) + "\u2500".repeat(contentWidth) + reset);
    lines.push("");
    const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
    lines.push(padStr + "  " + fgColor(rt.theme.accent) + spinner + reset +
      fgColor(rt.theme.muted) + " " + loadingMsg + reset);
    return;
  }

  if (rt.pageFocusItems.length === 0 && content.length > 0) {
    rt.initializePageContent(content);
  }

  const currentFocus = rt.pageFocusItems[rt.pageFocusIndex] as FocusItem | undefined;
  const allContentLines: string[] = [];
  let focusedLineStart = -1;
  let focusedLineEnd = -1;

  const isBlockFocusedFn = (block: ContentBlock): boolean =>
    !!currentFocus && currentFocus.kind === "block" && currentFocus.block === block;

  const focusedAccordionItemIdx = (block: ContentBlock): number => {
    if (!currentFocus || currentFocus.kind !== "accordion-item") return -1;
    if (currentFocus.accordion !== block) return -1;
    return currentFocus.itemIndex;
  };

  const indicator = fgColor(rt.theme.accent) + "\u258c" + reset;

  const renderBlocksRecursive = (blocks: ContentBlock[]) => {
    for (const block of blocks) {
      if (block.type === "section") {
        allContentLines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
        allContentLines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, contentWidth - 4)) + reset);
        allContentLines.push("");
        renderBlocksRecursive(block.content);
      } else if (block.type === "form") {
        renderBlocksRecursive((block as FormBlock).fields);
        const formResult = rt.formResults.get((block as FormBlock).id);
        if (formResult) {
          for (const rl of renderFormResult({ resultMessage: formResult.message, resultType: formResult.type }, ctx)) {
            allContentLines.push(" " + rl);
          }
          allContentLines.push("");
        }
      } else if (block.type === "dynamic") {
        renderBlocksRecursive(resolveDynamic(rt as any, block as any));
        continue;
      } else if (block.type === "asyncContent") {
        renderAsyncContentBlock(rt, block as AsyncContentBlock, allContentLines, ctx, renderBlocksRecursive);
      } else if (block.type === "accordion") {
        renderAccordionInline(rt, block, allContentLines, ctx, contentWidth, focusedAccordionItemIdx, indicator, focusedLineStart, focusedLineEnd, (s, e) => { focusedLineStart = s; focusedLineEnd = e; });
      } else if (block.type === "timeline") {
        renderTimelineInline(rt, block, allContentLines, ctx, contentWidth, currentFocus, indicator, focusedLineStart, focusedLineEnd, (s, e) => { focusedLineStart = s; focusedLineEnd = e; });
      } else {
        const focused = isBlockFocusedFn(block);
        if (focused) focusedLineStart = allContentLines.length;
        const blockIsFocusableVal = isBlockFocusable(block);
        const isEditing = focused && rt.inputMode.isEditing;
        const focusCtx = focused ? { ...ctx, focused: true, editing: isEditing } : ctx;
        const rendered = renderBlock(rt as any, block, focusCtx);
        if (blockIsFocusableVal && focused) {
          for (const line of rendered) allContentLines.push(indicator + line);
        } else {
          for (const line of rendered) allContentLines.push(" " + line);
        }
        if (focused) focusedLineEnd = allContentLines.length;
      }
      allContentLines.push("");
    }
  };

  renderBlocksRecursive(content);
  if (allContentLines.length > 0 && allContentLines[allContentLines.length - 1] === "") allContentLines.pop();

  // Scroll adjustment
  const headerLines = 4;
  const footerLines = 3;
  const viewportHeight = Math.max(1, rows - headerLines - footerLines);

  if (focusedLineStart >= 0) {
    const atLast = rt.pageFocusItems.length > 0 && rt.pageFocusIndex === rt.pageFocusItems.length - 1;
    const atFirst = rt.pageFocusItems.length > 0 && rt.pageFocusIndex === 0;
    if (focusedLineStart < rt.pageScrollOffset && !atLast) {
      rt.pageScrollOffset = Math.max(0, focusedLineStart);
    } else if (focusedLineEnd > rt.pageScrollOffset + viewportHeight && !atFirst) {
      rt.pageScrollOffset = Math.max(0, focusedLineEnd - viewportHeight);
    }
  }
  rt.pageScrollOffset = Math.min(rt.pageScrollOffset, Math.max(0, allContentLines.length - viewportHeight));

  let itemsAbove = 0, itemsBelow = 0;
  if (rt.pageFocusItems.length > 0) {
    itemsAbove = rt.pageFocusIndex;
    itemsBelow = rt.pageFocusItems.length - 1 - rt.pageFocusIndex;
  }

  // Header
  lines.push("");
  lines.push(padStr + fgColor(rt.theme.subtle) + dim + "\u2190 back" + reset + "  " +
    fgColor(rt.theme.accent) + bold + (currentPage.icon ? currentPage.icon + " " : "") +
    rt.resolvePageTitle(currentPage) + reset);
  lines.push(padStr + fgColor(rt.theme.border) + "\u2500".repeat(contentWidth) + reset);

  if (rt.pageScrollOffset > 0 && itemsAbove > 0) {
    lines.push(padStr + fgColor(rt.theme.subtle) + dim + "  \u2191 " + itemsAbove + " item" + (itemsAbove > 1 ? "s" : "") + " above" + reset);
  } else if (rt.pageScrollOffset > 0) {
    lines.push(padStr + fgColor(rt.theme.subtle) + dim + "  \u2191 more above" + reset);
  } else {
    lines.push("");
  }

  for (const cl of allContentLines.slice(rt.pageScrollOffset, rt.pageScrollOffset + viewportHeight)) {
    lines.push(padStr + cl);
  }
  while (lines.length < rows - footerLines) lines.push("");

  // Footer
  const hasBelow = rt.pageScrollOffset + viewportHeight < allContentLines.length;
  if (itemsBelow > 0) {
    lines.push(padStr + fgColor(rt.theme.subtle) + dim + "  \u2193 " + itemsBelow + " item" + (itemsBelow > 1 ? "s" : "") + " below" + reset);
  } else if (hasBelow) {
    lines.push(padStr + fgColor(rt.theme.subtle) + dim + "  \u2193 more below" + reset);
  } else {
    lines.push("");
  }
  lines.push(padStr + fgColor(rt.theme.border) + "\u2500".repeat(contentWidth) + reset);

  const pageIdx = rt.router.currentIndex + 1;
  const pageTotal = rt.router.pageCount;
  if (rt.inputMode.isEditing) {
    lines.push(padStr + fgColor(rt.theme.accent) + bold + "  \u2500\u2500 Editing \u2500\u2500" + reset +
      fgColor(rt.theme.subtle) + dim + " Type to input  Esc done  [" + pageIdx + "/" + pageTotal + "]" + reset);
  } else {
    lines.push(padStr + fgColor(rt.theme.subtle) + dim +
      "  \u2191\u2193 navigate  \u23ce select  \u2190 back  q quit  [" + pageIdx + "/" + pageTotal + "]" + reset);
  }
}

/** Render accordion items inline with per-item focus tracking. */
function renderAccordionInline(
  rt: RT, block: ContentBlock, allContentLines: string[], ctx: RenderContext,
  contentWidth: number, focusedAccordionItemIdx: (b: ContentBlock) => number,
  indicator: string, _fls: number, _fle: number,
  setFocus: (s: number, e: number) => void,
): void {
  const accFocusIdx = focusedAccordionItemIdx(block);
  const accKey = (block as any).items.map((i: any) => i.label).join(",");
  const openIdx = rt.accordionState.get(accKey) ?? -1;

  for (let ai = 0; ai < (block as any).items.length; ai++) {
    const item = (block as any).items[ai];
    const isItemFocused = accFocusIdx === ai;
    const isItemOpen = ai === openIdx;
    let fls = -1, fle = -1;

    if (isItemFocused) fls = allContentLines.length;
    const arrow = isItemOpen ? "\u25be" : "\u25b8";
    const labelColor = isItemOpen || isItemFocused ? ctx.theme.accent : ctx.theme.text;
    const maxLabelW = Math.max(0, contentWidth - 8);
    const headerLine = fgColor(labelColor) + bold + `  ${arrow} ${item.label.length > maxLabelW ? item.label.substring(0, maxLabelW - 1) + "\u2026" : item.label}` + reset;
    allContentLines.push(isItemFocused ? indicator + headerLine : " " + headerLine);

    if (isItemOpen) {
      const contentCtx = { ...ctx, width: ctx.width - 4, focused: false };
      for (const cb of item.content) {
        for (const rl of renderBlock(rt as any, cb, contentCtx)) allContentLines.push("     " + rl);
      }
      allContentLines.push("");
    }
    if (isItemFocused) { fle = allContentLines.length; setFocus(fls, fle); }
  }
}

/** Render timeline items inline with per-item focus tracking. */
function renderTimelineInline(
  rt: RT, block: ContentBlock, allContentLines: string[], ctx: RenderContext,
  contentWidth: number, currentFocus: FocusItem | undefined, indicator: string,
  _fls: number, _fle: number, setFocus: (s: number, e: number) => void,
): void {
  const tlFocusIdx = currentFocus?.kind === "timeline-item" && currentFocus.timeline === block
    ? currentFocus.itemIndex : -1;

  for (let ti = 0; ti < (block as any).items.length; ti++) {
    const item = (block as any).items[ti];
    const isItemFocused = tlFocusIdx === ti;
    const isLast = ti === (block as any).items.length - 1;

    let fls = -1, fle = -1;
    if (isItemFocused) fls = allContentLines.length;

    const dot = isItemFocused ? "\u25cf" : "\u25cb";
    let titleStr = item.title;
    if (item.subtitle) titleStr += " \u00b7 " + item.subtitle;
    const dotColor = isItemFocused ? ctx.theme.accent : ctx.theme.border;
    const titleColor = isItemFocused ? ctx.theme.accent : ctx.theme.text;
    allContentLines.push(" " + fgColor(dotColor) + "  " + dot + " " + reset + fgColor(titleColor) + bold + titleStr + reset);

    if (item.period || item.date) {
      allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.muted) + dim + (item.period ?? item.date) + reset);
    }
    if (item.description) {
      for (const wl of wrapText(item.description, Math.max(0, contentWidth - 6))) {
        allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.text) + wl + reset);
      }
    }
    if (!isLast) allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502" + reset);
    if (isItemFocused) { fle = allContentLines.length; setFocus(fls, fle); }
  }
}

/** Render an asyncContent block. */
function renderAsyncContentBlock(
  rt: RT, block: AsyncContentBlock, allContentLines: string[],
  ctx: RenderContext, renderRecursive: (blocks: ContentBlock[]) => void,
): void {
  const asyncId = block._asyncId ?? "async-anon";
  const state = rt.asyncManager.getState(asyncId);

  if (!state) {
    rt.asyncManager.load(asyncId, block.load, () => rt.render());
    const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
    allContentLines.push(" " + fgColor(ctx.theme.accent) + spinner + reset +
      fgColor(ctx.theme.muted) + " " + (block.loading ?? "Loading...") + reset);
    return;
  }
  if (state.status === "loading") {
    const spinner = getSpinnerFrame("dots", Math.floor(Date.now() / 80));
    allContentLines.push(" " + fgColor(ctx.theme.accent) + spinner + reset +
      fgColor(ctx.theme.muted) + " " + (block.loading ?? "Loading...") + reset);
    setTimeout(() => rt.render(), 100);
    return;
  }
  if (state.status === "error") {
    if (block.fallback) { renderRecursive(block.fallback); }
    else { allContentLines.push(" " + fgColor(ctx.theme.error) + "\u26a0 " + (state.error?.message ?? "Failed to load content") + reset); }
    return;
  }
  if (state.content) renderRecursive(state.content);
}

