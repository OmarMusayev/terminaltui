/**
 * Page navigation and focus management logic extracted from TUIRuntime.
 * All functions take `rt` (the runtime instance) as their first parameter.
 *
 * Focus positions are computed using the flex-engine for spatial navigation.
 */
import type {
  ContentBlock, PageConfig, FormBlock, DynamicBlock,
} from "../config/types.js";
import type { RouteParams } from "../router/types.js";
import { runMiddleware } from "../middleware/index.js";
import { resolveDynamic } from "./runtime-block-render.js";
import type { FocusItem } from "./runtime-types.js";
import type { RuntimeInternal } from "./runtime-internal.js";
import { computeFocusPositions } from "../layout/flex-engine.js";
import { layoutAvailHeight, blockRenderWidth } from "./layout-constants.js";
import { walk, findFirst, ALL_EDGES, stampBlockKeys } from "./block-walker.js";
import { focusSlots } from "./block-taxonomy.js";

/** Navigate to a page or route, with optional params and middleware. */
export function navigateToPage(rt: RuntimeInternal, pageId: string, params?: RouteParams): void {
  // Exact match first
  let pageConfig = rt.site.pages.find((p: any) => p.id === pageId);

  // If not found, try dynamic route match (e.g., pageId="blogs" matches "blogs/[slug]")
  if (!pageConfig) {
    pageConfig = rt.site.pages.find((p: any) => {
      if (!p.id.includes("[")) return false;
      const staticPart = p.id.replace(/\/\[.*?\].*$/, "");
      return pageId === staticPart || pageId.startsWith(staticPart + "/");
    });
  }

  if (!pageConfig) {
    // Bug #8: warn on navigation failure instead of silent no-op
    if (typeof process !== "undefined" && process.stderr) {
      process.stderr.write(`[terminaltui] navigate: page '${pageId}' not found. Available: ${rt.site.pages.map((p: any) => p.id).join(", ")}\n`);
      // In local dev stderr is the same TTY: the write lands out-of-band on
      // the alt screen and scrolls it, so the diff buffer no longer matches
      // the screen. Invalidate so the next render is a healing full redraw.
      rt.invalidateFrame();
    }
    return;
  }

  const middlewareChain = [
    ...(rt.site.middleware ?? []),
    ...((pageConfig as any).middleware ?? []),
  ];

  if (middlewareChain.length > 0) {
    runMiddleware(middlewareChain, {
      page: pageId,
      params: params ?? {},
      state: null,
    }).then((result: any) => {
      if (result && "redirect" in result) {
        navigateToPage(rt, result.redirect, result.params);
        return;
      }
      doNavigate(rt, pageId, params);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const firstLine = msg.split("\n")[0];
      showFeedback(rt, `Blocked: ${firstLine}`);
    });
  } else {
    doNavigate(rt, pageId, params);
  }
}

function doNavigate(rt: RuntimeInternal, pageId: string, params?: RouteParams): void {
  const from = rt.router.currentPage;
  rt.router.navigate(pageId);
  rt.currentParams = params ?? {};
  rt.scrollOffset = 0;
  enterPage(rt);

  if (rt.site.onNavigate) {
    rt.site.onNavigate(from, pageId, params);
  }

  rt.render();
}

/** Initialize page focus when entering a page. */
export function enterPage(rt: RuntimeInternal): void {
  rt.pageFocusIndex = 0;
  rt.pageScrollOffset = 0;
  rt.pageFocusItems = [];
  rt.focusRects = [];
  rt.inputMode.reset();
  rt.formRegistry.clear();
  // Invalidate the renderMain layout cache — the new page must lay out fresh.
  rt.layoutCache.contentRef = null;

  // Stop refresh timers from previously-visited pages — a stale timer would
  // keep fetching in the background and clobber this page's focus state.
  // The current page's timer (if any) is re-created by loadAsyncPageContent.
  for (const p of rt.site.pages) {
    rt.asyncManager.clearRefresh(`page-${p.id}`);
  }

  const currentPage = getCurrentPage(rt);
  if (!currentPage) return;

  const content = currentPage.content;
  if (typeof content === "function") {
    loadAsyncPageContent(rt, currentPage);
    return;
  }

  initializePageContent(rt, content);
}

/**
 * Coerce page content to a block array. Page functions plausibly return a
 * single block instead of an array — normalize instead of crashing on
 * iteration in collectFocusItems/registerForms.
 */
function toBlockArray(content: unknown): ContentBlock[] {
  if (Array.isArray(content)) return content as ContentBlock[];
  if (content == null) return [];
  return [content as ContentBlock];
}

function loadAsyncPageContent(rt: RuntimeInternal, page: PageConfig): void {
  const key = `page-${page.id}`;
  const loader = page.content as () => Promise<ContentBlock[]>;

  rt.asyncManager.load(key, loader, () => {
    const state = rt.asyncManager.getState(key);
    let content: ContentBlock[] | null = null;
    if (state?.status === "loaded" && state.content) {
      content = toBlockArray(state.content);
    } else if (state?.status === "error" && page.onError) {
      content = toBlockArray(page.onError(state.error!));
    }
    if (content) {
      rt.resolvedPageContent.set(page.id, content);
      // Stamp under the OWNING page id at the writeback site. The user may
      // have navigated away before this load resolved; initializePageContent
      // stamps with rt.router.currentPage, which would then write ANOTHER
      // page's keys onto these blocks — cross-page component-state sharing
      // at matching structural positions.
      stampBlockKeys(rt, page.id, content);
      // Never touch focus/form/layout state for a non-current page (mirrors
      // the refresh-callback guard below).
      if (rt.router.currentPage === page.id) {
        initializePageContent(rt, content);
      }
    }
    rt.render();
  });

  if (page.refreshInterval) {
    rt.asyncManager.setupRefresh(key, page.refreshInterval, loader, () => {
      const state = rt.asyncManager.getState(key);
      const content = state?.status === "loaded" && state.content
        ? toBlockArray(state.content) : null;
      if (content) {
        rt.resolvedPageContent.set(page.id, content);
        // Stamp at the writeback site under the owning page id: when the
        // refresh resolves after navigating away (guard below), no later
        // path stamps this array before it can render on re-entry, and
        // getBlockKey would silently fall back to legacy label keys —
        // invisible to component state saved under the path keys.
        stampBlockKeys(rt, page.id, content);
      }
      // A refresh can complete just after navigating away (in-flight load
      // resolving after the timer was cleared). Keep the data fresh above,
      // but never touch focus/form state or repaint for a non-current page.
      if (rt.router.currentPage !== page.id) return;
      if (content) {
        const oldIndex = rt.pageFocusIndex;
        // Full rebuild: re-stamps block keys (refreshed content arrays are
        // new objects each interval; deterministic paths yield the same keys,
        // so component state survives refresh) and resets the layout cache
        // to the new content array.
        initializePageContent(rt, content);
        rt.pageFocusIndex = Math.min(oldIndex, Math.max(0, rt.pageFocusItems.length - 1));
      }
      rt.render();
    });
  }
}

/** Initialize page content: stamp state keys, collect focus items, register forms, compute positions. */
export function initializePageContent(rt: RuntimeInternal, content: ContentBlock[]): void {
  const blocks = toBlockArray(content);
  // Stamp structural-path state keys BEFORE focus collection: the walk
  // resolves dynamic blocks, and resolveDynamic keys freshly-generated
  // children under their (already stamped) parent's path.
  stampBlockKeys(rt, rt.router.currentPage, blocks);
  rt.pageFocusItems = collectFocusItems(rt, blocks);
  registerForms(rt, blocks);
  computeFocusLayout(rt, blocks);

  // Prime the renderMain layout cache. Volatile trees (dynamic/asyncContent
  // anywhere, incl. inside tabs/accordion items) keep the per-frame
  // recompute path; static trees skip it until content identity or
  // dimensions change.
  const { columns, rows } = rt.screenSize;
  rt.layoutCache.contentRef = blocks;
  rt.layoutCache.columns = columns;
  rt.layoutCache.rows = rows;
  rt.layoutCache.volatile = isVolatileContent(blocks);
}

/**
 * Total focus-slot count for a tree — the cheap fingerprint renderMain's
 * fast path uses to detect in-place mutation of a static tree (blocks pushed
 * onto the content array, items pushed onto accordion/timeline) that cannot
 * change array identity. Equals collectFocusItems(...).length by
 * construction: both derive counts from focusSlots(). No dynamic resolver is
 * passed because only non-volatile (dynamic-free) trees are fingerprinted;
 * counting a tree WITH dynamic() this way would diverge from the focus walk.
 */
export function countFocusSlots(blocks: ContentBlock[]): number {
  let n = 0;
  for (const e of walk(blocks)) n += focusSlots(e.block);
  return n;
}

/** Whether a tree contains blocks whose children materialize per-frame/late. */
export function isVolatileContent(blocks: ContentBlock[]): boolean {
  return findFirst(
    blocks,
    (e) => e.block.type === "dynamic" || e.block.type === "asyncContent",
    { descend: ALL_EDGES },
  ) !== null;
}

/**
 * Recompute spatial focus rects for the given content. Single shared layout
 * pass for renderMain and page initialization/refresh.
 *
 * The rect walk uses the same width the blocks actually render at
 * (contentWidth minus the 1-col focus gutter) so spatial navigation geometry
 * matches the screen exactly.
 */
export function computeFocusLayout(rt: RuntimeInternal, content: ContentBlock[]): void {
  const { columns, rows } = rt.screenSize;
  rt.focusRects = computeFocusPositions(
    content,
    blockRenderWidth(columns),
    layoutAvailHeight(rows),
    (block: DynamicBlock) => resolveDynamic(rt, block),
  );
}

/**
 * Register form blocks for submission handling.
 * Descends STRUCTURAL_EDGES including `dynamic` — everything the focus walk
 * reaches must be form-registered, so forms inside dynamic() are submittable.
 */
export function registerForms(rt: RuntimeInternal, blocks: ContentBlock[]): void {
  for (const e of walk(blocks, { resolveDynamic: (b) => resolveDynamic(rt, b) })) {
    if (e.block.type === "form") {
      rt.formRegistry.set(e.block.id, e.block as FormBlock);
    }
  }
}

/** Resolve the page title for the given page, supporting params for dynamic file-based routes. */
export function resolvePageTitle(rt: RuntimeInternal, page: PageConfig): string {
  return page.title as string;
}

/** Get the effective content for a page (resolved async or static). */
export function getPageContent(rt: RuntimeInternal, page: PageConfig): ContentBlock[] | null {
  if (typeof page.content === "function") {
    return rt.resolvedPageContent.get(page.id) ?? null;
  }
  return page.content == null ? null : toBlockArray(page.content);
}

/**
 * Recursively collect focusable items from content blocks (pre-order,
 * items in declaration order). Slot counts come from focusSlots() — the
 * same contract that drives the flex-engine rect walk.
 */
export function collectFocusItems(rt: RuntimeInternal, blocks: ContentBlock[]): FocusItem[] {
  const result: FocusItem[] = [];
  for (const e of walk(blocks, { resolveDynamic: (b) => resolveDynamic(rt, b) })) {
    const block = e.block;
    if (focusSlots(block) === 0) continue;
    if (block.type === "accordion") {
      for (let i = 0; i < block.items.length; i++) {
        result.push({ kind: "accordion-item", accordion: block, itemIndex: i });
      }
    } else if (block.type === "timeline") {
      for (let i = 0; i < block.items.length; i++) {
        result.push({ kind: "timeline-item", timeline: block, itemIndex: i });
      }
    } else {
      result.push({ kind: "block", block });
    }
  }
  return result;
}

/** Move focus to next item sequentially. */
export function pageFocusNext(rt: RuntimeInternal): void {
  if (rt.pageFocusItems.length === 0) {
    rt.pageScrollOffset++;
    return;
  }

  if (rt.pageFocusIndex < rt.pageFocusItems.length - 1) {
    rt.pageFocusIndex++;
  } else {
    rt.pageScrollOffset++;
  }
}

/** Move focus to previous item sequentially. */
export function pageFocusPrev(rt: RuntimeInternal): void {
  if (rt.pageFocusItems.length === 0) {
    if (rt.pageScrollOffset > 0) rt.pageScrollOffset--;
    return;
  }

  if (rt.pageFocusIndex > 0) {
    rt.pageFocusIndex--;
  } else {
    if (rt.pageScrollOffset > 0) rt.pageScrollOffset--;
  }
}

/** Get the current page config. */
export function getCurrentPage(rt: RuntimeInternal): PageConfig | undefined {
  const found = rt.site.pages.find((p: any) => p.id === rt.router.currentPage);
  if (!found) return undefined;
  return found as PageConfig;
}

/** Show a temporary feedback message. */
export function showFeedback(rt: RuntimeInternal, msg: string): void {
  rt.feedbackMessage = msg;
  if (rt.feedbackTimer) clearTimeout(rt.feedbackTimer);
  rt.feedbackTimer = setTimeout(() => {
    rt.feedbackMessage = "";
    rt.render();
  }, 2000);
  rt.render();
}

/** Execute a :command. */
export function executeCommand(rt: RuntimeInternal, cmd: string): void {
  const trimmed = cmd.trim();
  // The verb is matched case-insensitively (`:theme`, `:THEME`, `:Theme` all
  // work) but the argument keeps its original case — theme names like
  // `tokyoNight` and `rosePine` are camelCase and would never match if we
  // lowercased them.
  const spaceIdx = trimmed.indexOf(" ");
  const verb = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const arg = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (verb === "q" || verb === "quit") {
    rt.stop();
    return;
  }

  if (verb === "theme") {
    if (rt.setTheme(arg)) {
      showFeedback(rt, `Theme: ${arg}`);
    } else {
      showFeedback(rt, `Unknown theme: ${arg}`);
    }
    return;
  }

  // Easter-egg commands are matched against the lowercased full command,
  // preserving the prior behavior (egg keys were always defined lowercase).
  const easterKey = trimmed.toLowerCase();
  if (rt.site.easterEggs?.commands?.[easterKey]) {
    const action = rt.site.easterEggs.commands[easterKey];
    if (typeof action === "string") {
      showFeedback(rt, action);
    } else if (!rt.isServeMode) {
      action();
    } else {
      showFeedback(rt, `Command disabled in serve mode`);
    }
    return;
  }

  showFeedback(rt, `Unknown command: ${cmd}`);
}
