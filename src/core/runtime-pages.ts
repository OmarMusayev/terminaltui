/**
 * Page navigation and focus management logic extracted from TUIRuntime.
 * All functions take `rt` (the runtime instance) as their first parameter.
 *
 * Focus positions are computed using the flex-engine for spatial navigation.
 */
import type {
  ContentBlock, PageConfig, FormBlock, DynamicBlock,
  ColumnsBlock, RowsBlock, SplitBlock, GridBlock, PanelBlock,
} from "../config/types.js";
import type { RouteConfig, RouteParams } from "../routing/types.js";
import { runMiddleware } from "../middleware/index.js";
import { resolveDynamic } from "./runtime-render.js";
import type { FocusItem } from "./runtime-types.js";
import type { FocusRect } from "../layout/types.js";
import { computeFocusPositions } from "../layout/flex-engine.js";
import type { ScreenSize } from "./screen.js";

// Minimal runtime interface for page navigation functions
interface RT {
  site: any;
  theme: any;
  router: any;
  focus: any;
  inputMode: any;
  scrollOffset: number;
  pageFocusIndex: number;
  pageFocusItems: FocusItem[];
  pageScrollOffset: number;
  currentParams: RouteParams;
  asyncManager: any;
  resolvedPageContent: Map<string, ContentBlock[]>;
  formRegistry: Map<string, FormBlock>;
  dynamicCache: Map<string, ContentBlock[]>;
  feedbackMessage: string;
  feedbackTimer: ReturnType<typeof setTimeout> | null;
  focusRects: FocusRect[];
  screenSize: ScreenSize;
  render(): void;
}

/** Navigate to a page or route, with optional params and middleware. */
export function navigateToPage(rt: RT, pageId: string, params?: RouteParams): void {
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
    }).catch(() => {
      doNavigate(rt, pageId, params);
    });
  } else {
    doNavigate(rt, pageId, params);
  }
}

function doNavigate(rt: RT, pageId: string, params?: RouteParams): void {
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
export function enterPage(rt: RT): void {
  rt.pageFocusIndex = 0;
  rt.pageScrollOffset = 0;
  rt.pageFocusItems = [];
  rt.focusRects = [];
  rt.inputMode.reset();
  rt.formRegistry.clear();

  const currentPage = getCurrentPage(rt);
  if (!currentPage) return;

  const rawConfig = rt.site.pages.find((p: any) => p.id === currentPage.id);
  if (rawConfig && typeof rawConfig.title === "function") {
    const routeConfig = rawConfig as RouteConfig;
    loadRouteContent(rt, routeConfig);
    return;
  }

  const content = currentPage.content;
  if (typeof content === "function") {
    loadAsyncPageContent(rt, currentPage);
    return;
  }

  initializePageContent(rt, content);
}

/** Load content for a parameterized route. */
function loadRouteContent(rt: RT, routeConfig: RouteConfig): void {
  const params = rt.currentParams;
  const key = `route-${routeConfig.id}-${JSON.stringify(params)}`;

  const loader = async () => {
    const result = routeConfig.content(params);
    return result instanceof Promise ? await result : result;
  };

  rt.asyncManager.load(key, loader, () => {
    const state = rt.asyncManager.getState(key);
    if (state?.status === "loaded" && state.content) {
      rt.resolvedPageContent.set(routeConfig.id, state.content);
      initializePageContent(rt, state.content);
    } else if (state?.status === "error" && routeConfig.onError) {
      const fallback = routeConfig.onError(state.error!, params);
      rt.resolvedPageContent.set(routeConfig.id, fallback);
      initializePageContent(rt, fallback);
    }
    rt.render();
  });
}

function loadAsyncPageContent(rt: RT, page: PageConfig): void {
  const key = `page-${page.id}`;
  const loader = page.content as () => Promise<ContentBlock[]>;

  rt.asyncManager.load(key, loader, () => {
    const state = rt.asyncManager.getState(key);
    if (state?.status === "loaded" && state.content) {
      rt.resolvedPageContent.set(page.id, state.content);
      initializePageContent(rt, state.content);
    } else if (state?.status === "error" && page.onError) {
      const fallback = page.onError(state.error!);
      rt.resolvedPageContent.set(page.id, fallback);
      initializePageContent(rt, fallback);
    }
    rt.render();
  });

  if (page.refreshInterval) {
    rt.asyncManager.setupRefresh(key, page.refreshInterval, loader, () => {
      const state = rt.asyncManager.getState(key);
      if (state?.status === "loaded" && state.content) {
        rt.resolvedPageContent.set(page.id, state.content);
        const oldIndex = rt.pageFocusIndex;
        rt.pageFocusItems = collectFocusItems(rt, state.content);
        rt.pageFocusIndex = Math.min(oldIndex, Math.max(0, rt.pageFocusItems.length - 1));
        registerForms(rt, state.content);
        rebuildFocusPositions(rt, state.content);
      }
      rt.render();
    });
  }
}

/** Initialize page content: collect focus items, register forms, compute positions. */
export function initializePageContent(rt: RT, content: ContentBlock[]): void {
  rt.pageFocusItems = collectFocusItems(rt, content);
  registerForms(rt, content);
  rebuildFocusPositions(rt, content);
}

/** Recompute spatial focus positions from content blocks. */
function rebuildFocusPositions(rt: RT, content: ContentBlock[]): void {
  const { columns } = rt.screenSize;
  const contentWidth = Math.min(120, columns - 2);
  const { rows: termRows } = rt.screenSize;
  const availHeight = Math.max(10, termRows - 8);

  rt.focusRects = computeFocusPositions(
    content,
    contentWidth,
    availHeight,
    (block: DynamicBlock) => resolveDynamic(rt as any, block),
  );
}

/** Register form blocks for submission handling. */
export function registerForms(rt: RT, blocks: ContentBlock[]): void {
  for (const block of blocks) {
    if (block.type === "form") {
      rt.formRegistry.set(block.id, block as FormBlock);
      registerForms(rt, (block as FormBlock).fields);
    } else if (block.type === "section") {
      registerForms(rt, block.content);
    } else if (block.type === "columns") {
      for (const p of (block as ColumnsBlock).panels) registerForms(rt, p.content);
    } else if (block.type === "rows") {
      for (const p of (block as RowsBlock).panels) registerForms(rt, p.content);
    } else if (block.type === "split") {
      const s = block as SplitBlock;
      registerForms(rt, s.config.first);
      registerForms(rt, s.config.second);
    } else if (block.type === "grid") {
      for (const item of (block as GridBlock).config.items) registerForms(rt, item.content);
    } else if (block.type === "panel") {
      registerForms(rt, (block as PanelBlock).config.content);
    } else if (block.type === "box") {
      registerForms(rt, (block as any).config.children);
    } else if (block.type === "row") {
      for (const c of (block as any).cols) registerForms(rt, c.content);
    } else if (block.type === "container") {
      registerForms(rt, (block as any).content);
    }
  }
}

/** Resolve the page title, handling RouteConfig function titles. */
export function resolvePageTitle(rt: RT, page: PageConfig): string {
  const raw = rt.site.pages.find((p: any) => p.id === page.id);
  if (raw && typeof raw.title === "function") {
    return (raw.title as (params: RouteParams) => string)(rt.currentParams);
  }
  return page.title as string;
}

/** Get the effective content for a page (resolved async or static). */
export function getPageContent(rt: RT, page: PageConfig): ContentBlock[] | null {
  if (typeof page.content === "function") {
    return rt.resolvedPageContent.get(page.id) ?? null;
  }
  return page.content;
}

/** Recursively collect focusable items from content blocks. */
export function collectFocusItems(rt: RT, blocks: ContentBlock[]): FocusItem[] {
  const result: FocusItem[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "card":
      case "link":
      case "hero":
        result.push({ kind: "block", block });
        break;
      case "textInput":
      case "textArea":
      case "select":
      case "checkbox":
      case "toggle":
      case "radioGroup":
      case "numberInput":
      case "searchInput":
      case "button":
      case "chat":
        result.push({ kind: "block", block });
        break;
      case "accordion":
        for (let i = 0; i < block.items.length; i++) {
          result.push({ kind: "accordion-item", accordion: block, itemIndex: i });
        }
        break;
      case "timeline":
        for (let i = 0; i < block.items.length; i++) {
          result.push({ kind: "timeline-item", timeline: block, itemIndex: i });
        }
        break;
      case "tabs":
        result.push({ kind: "block", block });
        break;
      case "section":
        result.push(...collectFocusItems(rt, block.content));
        break;
      case "form":
        result.push(...collectFocusItems(rt, (block as FormBlock).fields));
        break;
      case "dynamic": {
        const dynamicBlocks = resolveDynamic(rt as any, block as DynamicBlock);
        result.push(...collectFocusItems(rt, dynamicBlocks));
        break;
      }
      case "columns": {
        const cols = block as ColumnsBlock;
        for (const p of cols.panels) {
          result.push(...collectFocusItems(rt, p.content));
        }
        break;
      }
      case "rows": {
        const rowsBlock = block as RowsBlock;
        for (const p of rowsBlock.panels) {
          result.push(...collectFocusItems(rt, p.content));
        }
        break;
      }
      case "split": {
        const splitBlock = block as SplitBlock;
        result.push(...collectFocusItems(rt, splitBlock.config.first));
        result.push(...collectFocusItems(rt, splitBlock.config.second));
        break;
      }
      case "grid": {
        const gridBlock = block as GridBlock;
        for (const item of gridBlock.config.items) {
          result.push(...collectFocusItems(rt, item.content));
        }
        break;
      }
      case "panel": {
        const panelBlock = block as PanelBlock;
        result.push(...collectFocusItems(rt, panelBlock.config.content));
        break;
      }
      case "box": {
        const boxBlock = block as any;
        result.push(...collectFocusItems(rt, boxBlock.config.children));
        break;
      }
      case "row": {
        const rowBlock = block as any;
        for (const c of rowBlock.cols) {
          result.push(...collectFocusItems(rt, c.content));
        }
        break;
      }
      case "container": {
        const containerBlock = block as any;
        result.push(...collectFocusItems(rt, containerBlock.content));
        break;
      }
      default:
        break;
    }
  }
  return result;
}

/** Move focus to next item sequentially. */
export function pageFocusNext(rt: RT): void {
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
export function pageFocusPrev(rt: RT): void {
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

/** Find link blocks in content. */
export function findLinks(blocks: ContentBlock[]): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  for (const block of blocks) {
    if (block.type === "link") {
      links.push({ label: block.label, url: block.url });
    } else if (block.type === "card" && block.url) {
      links.push({ label: block.title, url: block.url });
    } else if (block.type === "section") {
      links.push(...findLinks(block.content));
    }
  }
  return links;
}

/** Get the current page config. */
export function getCurrentPage(rt: RT): PageConfig | undefined {
  const found = rt.site.pages.find((p: any) => p.id === rt.router.currentPage);
  if (!found) return undefined;
  return found as PageConfig;
}

/** Show a temporary feedback message. */
export function showFeedback(rt: RT, msg: string): void {
  rt.feedbackMessage = msg;
  if (rt.feedbackTimer) clearTimeout(rt.feedbackTimer);
  rt.feedbackTimer = setTimeout(() => {
    rt.feedbackMessage = "";
    rt.render();
  }, 2000);
  rt.render();
}

/** Execute a :command. */
export function executeCommand(rt: RT, cmd: string): void {
  const trimmed = cmd.trim().toLowerCase();

  if (trimmed === "q" || trimmed === "quit") {
    (rt as any).stop();
    return;
  }

  if (trimmed.startsWith("theme ")) {
    const themeName = trimmed.slice(6).trim();
    const { themes } = require("../style/theme.js");
    if (themes[themeName]) {
      rt.theme = themes[themeName];
      showFeedback(rt, `Theme: ${themeName}`);
    } else {
      showFeedback(rt, `Unknown theme: ${themeName}`);
    }
    return;
  }

  if (rt.site.easterEggs?.commands?.[trimmed]) {
    const action = rt.site.easterEggs.commands[trimmed];
    if (typeof action === "string") {
      showFeedback(rt, action);
    } else {
      action();
    }
    return;
  }

  showFeedback(rt, `Unknown command: ${cmd}`);
}
