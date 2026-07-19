/**
 * Page-level rendering logic: home page, content page, scroll management,
 * and terminal output.
 */
import type { ContentBlock, AsyncContentBlock, FormBlock } from "../config/types.js";
import { fgColor, reset, bold, dim, italic } from "../style/colors.js";
import { gradientLines } from "../style/gradient.js";
import { renderBanner, centerBanner } from "../ascii/banner.js";
import { getSpinnerFrame } from "../animation/spinner.js";
import { renderMenu, type MenuItem } from "../components/Menu.js";
import { pad, wrapText, stringWidth, truncate, type RenderContext } from "../components/base.js";
import { renderFormResult } from "../components/Form.js";
import type { FocusItem } from "./runtime-types.js";
import type { RuntimeInternal } from "./runtime-internal.js";
import {
  renderBlock, renderContentBlocks, resolveDynamic,
  invalidateDynamicCache, isBlockFocusable, renderSectionHeader,
} from "./runtime-block-render.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";
import { writeToTerminal, createRenderContext } from "./runtime-terminal.js";
import { FOOTER_LINES, viewportHeight } from "./layout-constants.js";
import { computeFocusLayout, isVolatileContent, countFocusSlots } from "./runtime-pages.js";
import {
  findFirst, containsBlock, stampBlockKeys, STRUCTURAL_EDGES, type ContainerEdge,
} from "./block-walker.js";

// Re-export for runtime.ts
export { renderBlock, renderContentBlocks, resolveDynamic, invalidateDynamicCache, isBlockFocusable };
export { writeToTerminal, createRenderContext };

/** Main render entry point. */
export function renderMain(rt: RuntimeInternal): void {
  const currentPage = rt.getCurrentPage();
  const { columns, rows } = rt.screenSize;
  const cache = rt.layoutCache;
  const content = currentPage && !rt.router.isHome()
    ? rt.getPageContent(currentPage) : null;

  // Fast path (§D.4): a static (non-volatile) tree with unchanged content
  // identity and dimensions keeps its focus items, form registry, and rects.
  // Accordion open/close, tab switches, and input editing don't change rect
  // geometry (flex-engine uses fixed per-item heights), so skipping the
  // collect/registerForms/computeFocusPositions passes is golden-identical.
  // The focus-slot fingerprint guards legal in-place mutation of a static
  // tree (a callback pushing blocks onto the content array, or items onto an
  // accordion/timeline, then triggering a render): a changed slot count
  // falls back to the slow path so the new blocks stay reachable.
  const cacheHit = content !== null && !cache.volatile &&
    cache.contentRef === content && cache.columns === columns && cache.rows === rows &&
    countFocusSlots(content) === rt.pageFocusItems.length;

  if (!cacheHit) {
    invalidateDynamicCache(rt);
    if (content) {
      // Rebuild caused by content identity change without enterPage (e.g.
      // "back" navigation restoring a previous page) or by in-place mutation
      // of a static tree (fingerprint miss): re-derive volatility and
      // re-stamp block keys before collecting focus (resolveDynamic reads
      // the parent's stamp). Stamping is idempotent and deterministic, and
      // it must re-run here: a block object shared between two pages'
      // content trees carries the most recently entered page's key, and
      // freshly pushed blocks carry none. Volatile trees miss the cache
      // every frame but keep a stable contentRef, so they skip both.
      if (cache.contentRef !== content || !cache.volatile) {
        cache.volatile = isVolatileContent(content);
        stampBlockKeys(rt, rt.router.currentPage, content);
      }
      rt.pageFocusItems = rt.collectFocusItems(content);
      rt.registerForms(content);

      // Recompute spatial focus positions for navigation
      computeFocusLayout(rt, content);

      cache.contentRef = content;
      cache.columns = columns;
      cache.rows = rows;
    }
  }
  if (content) {
    // The re-clamp stays per-frame (cheap): a shrinking item list from a
    // refresh must never leave a dangling focus index.
    rt.pageFocusIndex = Math.min(rt.pageFocusIndex, Math.max(0, rt.pageFocusItems.length - 1));
  }

  const lines: string[] = [];
  const ctx = createRenderContext(rt, columns);

  if (rt.router.isHome()) {
    renderHomePage(rt, lines, ctx, columns, rows);
  } else {
    renderContentPage(rt, lines, ctx, columns, rows);
  }

  writeToTerminal(rt, lines, columns, rows);
}

/** Render the home/menu page. */
function renderHomePage(rt: RuntimeInternal, lines: string[], ctx: RenderContext, columns: number, rows: number): void {
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

  // Check if home page content already contains a menu block (avoid duplicates)
  const homePage = rt.site.pages.find((p: any) => p.id === "home");
  const homeContent = homePage ? rt.getPageContent(homePage) : null;
  const homeHasMenuBlock = homeContent
    ? findFirst(homeContent, (e) => e.block.type === "menu") !== null
    : false;

  if (!homeHasMenuBlock) {
    // Build menu items: explicit menu config > file router > fallback to pages
    let menuItems: MenuItem[];
    if (rt.site.menu?.items && rt.site.menu.items.length > 0) {
      menuItems = rt.site.menu.items.map((item: any) => ({
        label: item.label, icon: item.icon, id: item.page,
      }));
    } else if (rt.fileRouter) {
      const fileMenuItems = rt.fileRouter.getMenuItems();
      menuItems = fileMenuItems.map((m: any) => ({
        label: m.label, icon: m.icon, id: m.page,
      }));
    } else {
      menuItems = rt.site.pages
        .filter((p: any) => typeof p.title === "string" && !(p as any)._hidden)
        .map((p: any) => ({ label: p.title, icon: p.icon, id: p.id }));
    }

    let menuLines: string[];
    if (!rt.bootComplete && rt.site.animations?.boot) {
      const visibleCount = Math.max(0, Math.floor((rt.bootFrame - 15) / 3));
      menuLines = renderMenu(menuItems.slice(0, visibleCount), rt.focus.focusIndex, ctx);
    } else {
      menuLines = renderMenu(menuItems, rt.focus.focusIndex, ctx);
    }
    for (const ml of menuLines) lines.push(padStr + ml);
  } else if (homeContent) {
    // Home page has its own menu block — render the page content instead
    const blockWidth = Math.max(1, contentWidth - 1);
    const blockCtx: RenderContext = { ...ctx, width: blockWidth };
    for (const block of homeContent) {
      const rendered = renderBlock(rt, block, blockCtx);
      for (const line of rendered) lines.push(padStr + " " + line);
      lines.push("");
    }
  }

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
function renderContentPage(rt: RuntimeInternal, lines: string[], ctx: RenderContext, columns: number, rows: number): void {
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

  // Expose the focused block to the layout rendering pipeline so cards inside
  // panels can show the filled ◆ indicator when focused.
  rt.currentFocusedBlock = currentFocus?.kind === "block" ? currentFocus.block : undefined;

  const isBlockFocusedFn = (block: ContentBlock): boolean =>
    !!currentFocus && currentFocus.kind === "block" && currentFocus.block === block;

  const focusedAccordionItemIdx = (block: ContentBlock): number => {
    if (!currentFocus || currentFocus.kind !== "accordion-item") return -1;
    if (currentFocus.accordion !== block) return -1;
    return currentFocus.itemIndex;
  };

  const indicator = fgColor(rt.theme.accent) + "\u258c" + reset;

  // Block rendering width: 1 less than contentWidth to account for the 1-col
  // focus prefix (" " or "▌") prepended to every content line.
  const blockWidth = Math.max(1, contentWidth - 1);
  const blockCtx: RenderContext = { ...ctx, width: blockWidth };

  const renderBlocksRecursive = (blocks: ContentBlock[]) => {
    for (const block of blocks) {
      if (block.type === "section") {
        allContentLines.push(...renderSectionHeader(block.title, blockCtx));
        renderBlocksRecursive(block.content);
      } else if (block.type === "form") {
        renderBlocksRecursive((block as FormBlock).fields);
        const formResult = rt.formResults.get((block as FormBlock).id);
        if (formResult) {
          for (const rl of renderFormResult({ resultMessage: formResult.message, resultType: formResult.type }, blockCtx)) {
            allContentLines.push(" " + rl);
          }
          allContentLines.push("");
        }
      } else if (block.type === "dynamic") {
        renderBlocksRecursive(resolveDynamic(rt, block));
        continue;
      } else if (block.type === "asyncContent") {
        renderAsyncContentBlock(rt, block as AsyncContentBlock, allContentLines, blockCtx, renderBlocksRecursive);
      } else if (block.type === "accordion") {
        renderAccordionInline(rt, block, allContentLines, blockCtx, blockWidth, focusedAccordionItemIdx, indicator, focusedLineStart, focusedLineEnd, (s, e) => { focusedLineStart = s; focusedLineEnd = e; });
      } else if (block.type === "timeline") {
        renderTimelineInline(rt, block, allContentLines, blockCtx, blockWidth, currentFocus, indicator, focusedLineStart, focusedLineEnd, (s, e) => { focusedLineStart = s; focusedLineEnd = e; });
      } else {
        const focused = isBlockFocusedFn(block);
        // For layout containers (any structural edge, incl. panel), check if
        // the focused item is inside them so scroll-follow tracks it.
        const isLayout = STRUCTURAL_EDGES.has(block.type as ContainerEdge);
        const layoutContainsFocus = isLayout && !focused && !!rt.currentFocusedBlock &&
          containsBlock([block], rt.currentFocusedBlock);
        if (focused || layoutContainsFocus) focusedLineStart = allContentLines.length;
        const blockIsFocusableVal = isBlockFocusable(block);
        const isEditing = focused && rt.inputMode.isEditing;
        const focusCtx = focused ? { ...blockCtx, focused: true, editing: isEditing } : blockCtx;
        const rendered = renderBlock(rt, block, focusCtx);
        if (blockIsFocusableVal && focused) {
          for (const line of rendered) allContentLines.push(indicator + line);
        } else {
          for (const line of rendered) allContentLines.push(" " + line);
        }
        if (focused || layoutContainsFocus) focusedLineEnd = allContentLines.length;
      }
      allContentLines.push("");
    }
  };

  renderBlocksRecursive(content);
  if (allContentLines.length > 0 && allContentLines[allContentLines.length - 1] === "") allContentLines.pop();

  // Scroll adjustment
  const viewport = viewportHeight(rows);

  if (focusedLineStart >= 0) {
    const focusedHeight = focusedLineEnd - focusedLineStart;
    if (focusedHeight > viewport) {
      // Focused block is taller than the viewport — anchor to its start
      // (so headers like tab labels stay visible) and allow manual
      // scrolling within the block's extent.
      rt.pageScrollOffset = Math.max(
        focusedLineStart,
        Math.min(rt.pageScrollOffset, focusedLineEnd - viewport),
      );
    } else if (focusedLineStart < rt.pageScrollOffset) {
      // Scroll up to keep the focused block fully visible
      rt.pageScrollOffset = Math.max(0, focusedLineStart);
    } else if (focusedLineEnd > rt.pageScrollOffset + viewport) {
      // Scroll down to keep the focused block fully visible
      rt.pageScrollOffset = Math.max(0, focusedLineEnd - viewport);
    }
  }
  rt.pageScrollOffset = Math.min(rt.pageScrollOffset, Math.max(0, allContentLines.length - viewport));

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

  for (const cl of allContentLines.slice(rt.pageScrollOffset, rt.pageScrollOffset + viewport)) {
    lines.push(padStr + cl);
  }
  while (lines.length < rows - FOOTER_LINES) lines.push("");

  // Footer
  const hasBelow = rt.pageScrollOffset + viewport < allContentLines.length;
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

/**
 * Render accordion items inline with per-item focus tracking.
 *
 * Distinct from `renderAccordion` in components/Accordion.ts: this variant
 * walks items in the runtime's content-page render loop so each item gets
 * its own focus rect. The standalone version is used when accordions appear
 * inside layout cells (panel/columns/rows/grid) where per-item focus isn't
 * tracked. Visual styling (cursor character, indent) differs between them
 * by design.
 */
function renderAccordionInline(
  rt: RuntimeInternal, block: ContentBlock, allContentLines: string[], ctx: RenderContext,
  contentWidth: number, focusedAccordionItemIdx: (b: ContentBlock) => number,
  indicator: string, _fls: number, _fle: number,
  setFocus: (s: number, e: number) => void,
): void {
  const accFocusIdx = focusedAccordionItemIdx(block);
  const accKey = rt.getBlockKey(block, () => (block as any).items.map((i: any) => i.label).join(","));
  const openIdx = rt.accordionState.get(accKey) ?? -1;

  for (let ai = 0; ai < (block as any).items.length; ai++) {
    const item = (block as any).items[ai];
    const isItemFocused = accFocusIdx === ai;
    const isItemOpen = ai === openIdx;
    let fls = -1, fle = -1;

    if (isItemFocused) fls = allContentLines.length;
    const arrow = isItemOpen ? "\u25be" : "\u25b8";
    const labelColor = isItemOpen || isItemFocused ? ctx.theme.accent : ctx.theme.text;
    const accDims = computeBoxDimensions(contentWidth, COMPONENT_DEFAULTS.accordion);
    const maxLabelW = Math.max(0, accDims.content - 2);
    const truncatedLabel = stringWidth(item.label) > maxLabelW ? truncate(item.label, maxLabelW) : item.label;
    const headerLine = fgColor(labelColor) + bold + `  ${arrow} ${truncatedLabel}` + reset;
    allContentLines.push(isItemFocused ? indicator + headerLine : " " + headerLine);

    if (isItemOpen) {
      const contentCtx = { ...ctx, width: accDims.content, focused: false };
      for (const cb of item.content) {
        for (const rl of renderBlock(rt, cb, contentCtx)) allContentLines.push("     " + rl);
      }
      allContentLines.push("");
    }
    if (isItemFocused) { fle = allContentLines.length; setFocus(fls, fle); }
  }
}

/**
 * Render timeline items inline with per-item focus tracking.
 * See `renderAccordionInline` doc-comment for the design split.
 */
function renderTimelineInline(
  rt: RuntimeInternal, block: ContentBlock, allContentLines: string[], ctx: RenderContext,
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
      const tlDims = computeBoxDimensions(contentWidth, COMPONENT_DEFAULTS.timeline);
      for (const wl of wrapText(item.description, tlDims.content)) {
        allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502 " + reset + fgColor(ctx.theme.text) + wl + reset);
      }
    }
    if (!isLast) allContentLines.push(" " + fgColor(ctx.theme.border) + "  \u2502" + reset);
    if (isItemFocused) { fle = allContentLines.length; setFocus(fls, fle); }
  }
}

/** Render an asyncContent block. */
function renderAsyncContentBlock(
  rt: RuntimeInternal, block: AsyncContentBlock, allContentLines: string[],
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
    // Schedule one spinner tick per runtime — multiple loading blocks share it.
    // Without this guard, every render scheduled a new timer, compounding to
    // a render storm proportional to (loading-blocks × renders).
    if (!rt.spinnerTimer) {
      rt.spinnerTimer = setTimeout(() => {
        rt.spinnerTimer = null;
        rt.render();
      }, 100);
    }
    return;
  }
  if (state.status === "error") {
    if (block.fallback) { renderRecursive(block.fallback); }
    else { allContentLines.push(" " + fgColor(ctx.theme.error) + "\u26a0 " + (state.error?.message ?? "Failed to load content") + reset); }
    return;
  }
  if (state.content) {
    // Stamp loaded children once when first seen (idempotent via the WeakMap
    // has-check on the array's blocks) so path-keyed component state inside
    // async content is stable. Prefix: the async block's own stamped path.
    if (state.content.length > 0 && !rt.blockKeys.has(state.content[0])) {
      const parentKey = rt.blockKeys.get(block);
      if (parentKey) {
        const sep = parentKey.indexOf("#");
        stampBlockKeys(rt, parentKey.slice(0, sep), state.content, `${parentKey.slice(sep + 1)}/async`);
      }
    }
    renderRecursive(state.content);
  }
}

