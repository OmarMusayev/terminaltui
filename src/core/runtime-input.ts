/**
 * Input handling: key dispatch, navigation mode, edit mode routing,
 * search actions, and block matching.
 *
 * Navigation uses spatial algorithm — arrow keys move to the nearest
 * focusable item in that direction based on screen position.
 */
import type {
  ContentBlock, DynamicBlock, TextInputBlock, TextAreaBlock, SelectBlock,
  NumberInputBlock, SearchInputBlock, RadioGroupBlock,
  ColumnsBlock, RowsBlock, GridBlock,
} from "../config/types.js";
import type { KeyPress } from "./input.js";
import { keyToAction } from "../navigation/keybindings.js";
import { findNextFocus } from "../navigation/spatial.js";
import { filterSearchItems } from "../components/SearchInput.js";
import { getInputDefault } from "../components/Form.js";
import type { RuntimeInternal } from "./runtime-internal.js";
import { prevCursorPos, codePointLength, isPrintableChar } from "../components/text-cursor.js";
import {
  handleTextInputKey, handleTextAreaKey, handleSelectKey,
  handleNumberInputKey, handleSearchInputKey, handleRadioGroupKey,
} from "./runtime-edit-handlers.js";
import { walk, ALL_EDGES, type ContainerEdge } from "./block-walker.js";
import {
  resolveDynamic, projectDirOf, frameLimitsOf, imageFrameKey, imageFrameWidths, lastRenderedFrame,
} from "./runtime-block-render.js";
import {
  clampFrameCols, focusSlotsOf, framedImageBlock, isResizableImage, stepFrameCols,
} from "../image/frame.js";
import { imageCellSize } from "../components/Image.js";
import { blockRenderWidth } from "./layout-constants.js";

/** Handle keystrokes in command mode (:command). */
export function handleCommandMode(rt: RuntimeInternal, key: KeyPress): void {
  if (key.name === "escape") {
    rt.commandMode = false;
    rt.commandBuffer = "";
    rt.render();
    return;
  }
  if (key.name === "return") {
    rt.executeCommand(rt.commandBuffer);
    rt.commandMode = false;
    rt.commandBuffer = "";
    rt.render();
    return;
  }
  if (key.name === "backspace") {
    // Delete one full code point — slice(0, -1) would tear a surrogate pair
    // when the buffer ends with an astral char (emoji).
    rt.commandBuffer = rt.commandBuffer.slice(
      0, prevCursorPos(rt.commandBuffer, rt.commandBuffer.length),
    );
    rt.render();
    return;
  }
  if (key.char && codePointLength(key.char) === 1 && isPrintableChar(key.char) && !key.ctrl) {
    rt.commandBuffer += key.char;
    rt.render();
    return;
  }
}

/** Handle keystrokes in navigation mode — spatial navigation for all directions. */
export function handleNavigationMode(rt: RuntimeInternal, key: KeyPress): void {
  const isHome = rt.router.isHome();

  // Auto-enter edit mode for text inputs when typing
  if (!isHome) {
    const focusedBlock = rt.getFocusedInputBlock();
    if (focusedBlock && rt.isTextEntryType(focusedBlock.type) && rt.isAutoEditKey(key)) {
      const id = (focusedBlock as any).id;
      rt.inputMode.enterEdit(id);
      rt.getInputState(id, getInputDefault(focusedBlock));
      rt.handleEditMode(key);
      rt.render();
      return;
    }
  }

  // Resizable images claim their own keys BEFORE keyToAction, and only while
  // one is focused. Nothing is stolen from navigation: `+ = - _` are unbound
  // globally and the number jumps are 1-9, so `0` is dead everywhere else.
  if (!isHome && handleImageResizeKey(rt, key)) {
    rt.render();
    return;
  }

  const action = keyToAction(key, isHome);
  if (!action) return;

  switch (action) {
    case "quit": rt.stop(); break;

    case "back":
      if (rt.router.back()) {
        // Restore the params of the history entry we landed on — title,
        // loading message, and loader must resolve against the params the
        // page was originally opened with, not whatever the last forward
        // navigation set.
        rt.currentParams = rt.router.currentParams;
        rt.scrollOffset = 0;
        rt.pageFocusIndex = 0;
        rt.pageScrollOffset = 0;
        rt.pageFocusItems = [];
        rt.focusRects = [];
        rt.inputMode.reset();
        // Landing back on home resets the menu selection to the first item
        if (rt.router.isHome()) {
          rt.focus.focusFirst();
        } else {
          // Re-run the page lifecycle: restarts refresh timers and reloads
          // async content (cached content for matching params still shows
          // instantly; a params mismatch invalidates it).
          rt.enterPage();
        }
        rt.render();
      }
      break;

    case "up":
      if (isHome) {
        rt.focus.focusPrev();
      } else {
        // Spatial navigation: find nearest focusable above
        const nextUp = findNextFocus(rt.pageFocusIndex, "up", rt.focusRects);
        if (nextUp !== null) {
          rt.pageFocusIndex = nextUp;
        } else {
          // Nothing above — scroll up if possible
          rt.pageFocusPrev();
        }
      }
      rt.render();
      break;

    case "down":
      if (isHome) {
        rt.focus.focusNext();
      } else {
        // Spatial navigation: find nearest focusable below
        const nextDown = findNextFocus(rt.pageFocusIndex, "down", rt.focusRects);
        if (nextDown !== null) {
          rt.pageFocusIndex = nextDown;
        } else {
          // Nothing below — scroll down if possible
          rt.pageFocusNext();
        }
      }
      rt.render();
      break;

    case "left":
      if (isHome) {
        // Do nothing on home page
      } else {
        // If focused block is tabs, switch to previous tab
        const leftFocus = rt.pageFocusItems[rt.pageFocusIndex];
        if (leftFocus?.kind === "block" && leftFocus.block.type === "tabs") {
          const tb = leftFocus.block;
          const tabKey = rt.getBlockKey(tb, () => tb.items.map((i: any) => i.label).join(","));
          const cur = rt.tabState.get(tabKey) ?? 0;
          rt.tabState.set(tabKey, cur > 0 ? cur - 1 : tb.items.length - 1);
        } else {
          // Spatial navigation: find nearest focusable to the left
          const nextLeft = findNextFocus(rt.pageFocusIndex, "left", rt.focusRects);
          if (nextLeft !== null) {
            rt.pageFocusIndex = nextLeft;
          }
          // At leftmost: do nothing (matches right arrow — Escape/Backspace go back)
        }
      }
      rt.render();
      break;

    case "right":
      if (isHome) {
        // Select menu item (navigate to page)
        const focusedId = rt.focus.focusedId;
        if (focusedId) rt.navigateToPage(focusedId);
      } else {
        // If focused block is tabs, switch to next tab
        const rightFocus = rt.pageFocusItems[rt.pageFocusIndex];
        if (rightFocus?.kind === "block" && rightFocus.block.type === "tabs") {
          const tb = rightFocus.block;
          const tabKey = rt.getBlockKey(tb, () => tb.items.map((i: any) => i.label).join(","));
          const cur = rt.tabState.get(tabKey) ?? 0;
          rt.tabState.set(tabKey, (cur + 1) % tb.items.length);
        } else {
          // Spatial navigation: find nearest focusable to the right
          const nextRight = findNextFocus(rt.pageFocusIndex, "right", rt.focusRects);
          if (nextRight !== null) {
            rt.pageFocusIndex = nextRight;
          }
          // At rightmost: do nothing (no wrapping)
        }
      }
      rt.render();
      break;

    case "select":
      if (isHome) {
        const focusedId = rt.focus.focusedId;
        if (focusedId) rt.navigateToPage(focusedId);
      } else {
        rt.handlePageSelect();
      }
      rt.render();
      break;

    case "home":
      if (!rt.router.isHome()) { rt.pageFocusIndex = 0; rt.pageScrollOffset = 0; }
      rt.render();
      break;
    case "pageDown":
      if (!rt.router.isHome() && rt.pageFocusItems.length > 0)
        rt.pageFocusIndex = rt.pageFocusItems.length - 1;
      rt.render();
      break;
    case "command":
      rt.commandMode = true;
      rt.commandBuffer = "";
      rt.render();
      break;
    default:
      if (action.startsWith("jump")) {
        const num = parseInt(action.replace("jump", ""));
        // Number jumps work from any page — pressing "3" from inside Showcase
        // navigates straight to page 3 instead of being a dead keystroke.
        // (Edit/command mode swallow the key before this branch fires.)
        {
          const idx = num - 1;
          if (idx < rt.focus.count) {
            rt.focus.focusIndex = idx;
            const pageId = rt.router.getPageId(idx);
            if (pageId) rt.navigateToPage(pageId);
          }
        }
        rt.render();
      }
      break;
  }
}

// ─── Resizable image frames ─────────────────────────────

/**
 * What a key asks a focused resizable image for: grow, shrink, reset, or
 * "not mine".
 *
 * `=` and `_` are the unshifted twins of `+` and `-` — on a US layout `+` costs
 * a shift, and a viewer who presses the key they see on the keycap must not be
 * told nothing happened. Ctrl/Meta chords are excluded so terminal-level
 * bindings keep working.
 */
function resizeIntent(key: KeyPress): 1 | -1 | 0 | null {
  if (key.ctrl || key.meta) return null;
  switch (key.char) {
    case "+": case "=": return 1;
    case "-": case "_": return -1;
    case "0": return 0;
    default: return null;
  }
}

/**
 * Resizing changes the image's row count, so every FocusRect below it moves.
 *
 * renderMain's fast path keys on content identity, terminal dimensions and the
 * focus-slot count — none of which change here — so it would happily reuse the
 * rects computed for the old size. Dropping `contentRef` forces the full
 * collect/registerForms/computeFocusPositions pass on the next frame, exactly
 * as entering a page does.
 */
function invalidateFrameLayout(rt: RuntimeInternal): void {
  rt.layoutCache.contentRef = null;
}

/**
 * Grow, shrink or reset the focused image's frame.
 *
 * @returns true when the key belonged to a focused resizable image — the caller
 *   must then stop, so `-`/`0` never fall through to the global bindings.
 */
function handleImageResizeKey(rt: RuntimeInternal, key: KeyPress): boolean {
  const focused = rt.pageFocusItems[rt.pageFocusIndex];
  if (focused?.kind !== "block" || !isResizableImage(focused.block)) return false;
  const intent = resizeIntent(key);
  if (intent === null) return false;

  const block = focused.block;
  const widths = imageFrameWidths(rt);
  const stateKey = imageFrameKey(rt, block);

  if (intent === 0) {
    if (widths.delete(stateKey)) invalidateFrameLayout(rt);
    return true;
  }

  // Step against the allocation the RENDERER last used, not the page's content
  // width. Input has no RenderContext, so this used to budget an image inside a
  // panel as though it had the whole content column: the stored width then ran
  // 17 presses ahead of the picture, with no feedback, and "Frame at maximum
  // size" fired at the wrong ceiling. `renderImageBlock` records both the
  // achieved columns and the limits it clamped against; the page-level budget
  // is only the fallback for a block that has not been drawn yet.
  const drawn = lastRenderedFrame(rt, block);
  const limits = drawn?.limits ?? frameLimitsOf(rt, blockRenderWidth(rt.screenSize.columns));
  const root = projectDirOf(rt);

  /** Columns geometry ACTUALLY yields for a stored width (aspect + caps applied). */
  const measure = (stored: number | undefined): number =>
    imageCellSize(
      framedImageBlock(block, stored, limits),
      limits.availWidth,
      limits.availRows,
      root,
    ).cols;

  const current = drawn?.cols ?? widths.get(stateKey) ?? measure(undefined);
  const wanted = stepFrameCols(current, intent, block, limits);
  // Store what geometry produced, not what was asked for. Near the row cap the
  // two differ (a 24-row terminal answers a request for 64 columns with 61, the
  // widest that still fits), and remembering the request would leave the stored
  // width running ahead of the picture — the next few presses of `-` would move
  // nothing at all. Storing the result also means the last effective `+` lands
  // exactly on the largest frame that fits rather than stopping short of it.
  const applied = wanted === current ? current : clampFrameCols(measure(wanted), block, limits);
  if ((applied - current) * intent <= 0) {
    rt.showFeedback(intent > 0 ? "Frame at maximum size" : "Frame at minimum size");
    return true;
  }

  widths.set(stateKey, applied);
  invalidateFrameLayout(rt);
  return true;
}

/**
 * Handle keystrokes in edit mode — dispatch to type-specific handler.
 * The case set here is INPUT_TYPES ∩ editable (see block-taxonomy.ts);
 * kept as a switch because it dispatches functions, not membership.
 */
export function handleEditMode(rt: RuntimeInternal, key: KeyPress): void {
  const focused = rt.getFocusedInputBlock();
  if (!focused) { rt.inputMode.exitEdit(); rt.render(); return; }

  switch (focused.type) {
    case "textInput":
      handleTextInputKey(rt, focused as TextInputBlock, key);
      break;
    case "textArea":
      handleTextAreaKey(rt, focused as TextAreaBlock, key);
      break;
    case "select":
      handleSelectKey(rt, focused as SelectBlock, key);
      break;
    case "numberInput":
      handleNumberInputKey(rt, focused as NumberInputBlock, key);
      break;
    case "searchInput": {
      const result = handleSearchInputKey(rt, focused as SearchInputBlock, key);
      if (result.action === "search" && result.selected) {
        executeSearchAction(rt, focused as SearchInputBlock, result.selected);
      }
      break;
    }
    case "radioGroup":
      handleRadioGroupKey(rt, focused as RadioGroupBlock, key);
      break;
    default:
      if (key.name === "escape") rt.inputMode.exitEdit();
      break;
  }
  rt.render();
}

// ─── Search action & block matching ─────────────────────

/** Normalize a string to alphanumeric for fuzzy matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Execute the appropriate action when a search result is selected. */
function executeSearchAction(
  rt: RuntimeInternal, block: SearchInputBlock,
  selected: { label: string; value: string },
): void {
  const action = block.action ?? (block.onSelect ? "callback" : "navigate");

  if (action === "callback" && block.onSelect) {
    block.onSelect(selected.value);
    return;
  }

  const value = selected.value;
  const pageMatch = rt.site.pages.find((p: any) => p.id === value);
  if (pageMatch) {
    rt.router.navigate(value);
    // Param-less navigation: clear params from a previously visited dynamic
    // page so its loader/title don't resolve against stale values.
    rt.currentParams = {};
    rt.enterPage();
    rt.showFeedback(`\u2192 ${rt.resolvePageTitle(pageMatch)}`);
    rt.render();
    return;
  }

  const found = scrollToBlock(rt, value, selected.label);
  if (found) { rt.showFeedback(selected.label); rt.render(); return; }

  // Search inside tabs on the current page — switch to the matching tab
  const currentPage = rt.getCurrentPage();
  const currentContent = currentPage ? (typeof currentPage.content === "function"
    ? rt.resolvedPageContent.get(currentPage.id) : currentPage.content) : null;
  if (currentContent && switchToTabContaining(rt, currentContent, value, selected.label)) {
    rt.render();
    // After tab switch, try scrolling again (the block should now be in focus items)
    setTimeout(() => {
      scrollToBlock(rt, value, selected.label);
      rt.showFeedback(selected.label);
      rt.render();
    }, 50);
    return;
  }

  for (const p of rt.site.pages) {
    if (p.id === rt.router.currentPage) continue;
    const content = typeof p.content === "function" ? rt.resolvedPageContent.get(p.id) : p.content;
    if (!content) continue;
    if (blockExistsInContent(value, selected.label, content)) {
      rt.router.navigate(p.id);
      rt.currentParams = {};
      rt.enterPage();
      scrollToBlock(rt, value, selected.label);
      rt.showFeedback(`\u2192 ${rt.resolvePageTitle(p)} \u203a ${selected.label}`);
      rt.render();
      return;
    }
  }

  if (block.onSelect) block.onSelect(value);
  rt.showFeedback(selected.label);
}

/** Check if a string fuzzy-matches a search value. */
function fuzzyMatch(text: string | undefined, valueLower: string, valueNorm: string): boolean {
  if (!text) return false;
  const n = norm(text);
  return text.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n);
}

/** Scroll focus to a block matching value/label on the current page. */
export function scrollToBlock(rt: RuntimeInternal, value: string, label: string): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  const labelLower = label.toLowerCase();
  const labelNorm = norm(label);

  for (let i = 0; i < rt.pageFocusItems.length; i++) {
    const item = rt.pageFocusItems[i];

    if (item.kind === "block") {
      const b = item.block;
      if ("id" in b && (b as any).id === value) { rt.pageFocusIndex = i; return true; }
      if (b.type === "card") {
        if (fuzzyMatch(b.title, valueLower, valueNorm) ||
            fuzzyMatch(b.subtitle, valueLower, valueNorm) ||
            fuzzyMatch(b.title, labelNorm, labelNorm) ||
            fuzzyMatch(b.subtitle, labelNorm, labelNorm)) {
          rt.pageFocusIndex = i;
          return true;
        }
      }
      if (b.type === "link") {
        if (fuzzyMatch(b.label, valueLower, valueNorm)) { rt.pageFocusIndex = i; return true; }
      }
      if (b.type === "hero") {
        if (fuzzyMatch(b.title, valueLower, valueNorm)) { rt.pageFocusIndex = i; return true; }
      }
    }

    if (item.kind === "accordion-item") {
      const accLabel = item.accordion.items[item.itemIndex].label;
      const accNorm = accLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
      const vNorm = valueLower.replace(/[^a-z0-9]/g, "");
      if (accLabel.toLowerCase().includes(valueLower) || accNorm.includes(vNorm) || vNorm.includes(accNorm) ||
          accLabel.toLowerCase().startsWith(labelLower.split(" — ")[0]?.trim().toLowerCase() ?? "\0")) {
        rt.pageFocusIndex = i;
        const accKey = rt.getBlockKey(item.accordion, () => item.accordion.items.map(it => it.label).join(","));
        rt.accordionState.set(accKey, item.itemIndex);
        return true;
      }
    }

    if (item.kind === "timeline-item") {
      const tlTitle = item.timeline.items[item.itemIndex].title;
      if (tlTitle.toLowerCase().includes(valueLower)) { rt.pageFocusIndex = i; return true; }
    }
  }

  // Fallback: search panel titles in the page content
  const currentPage = rt.getCurrentPage();
  if (currentPage) {
    const content = typeof currentPage.content === "function"
      ? rt.resolvedPageContent.get(currentPage.id) : currentPage.content;
    if (content) {
      const idx = findFocusIndexByPanelTitle(content, value, label, rt);
      if (idx >= 0) {
        rt.pageFocusIndex = idx;
        return true;
      }
    }
  }
  return false;
}

/** Search tabs blocks in content for an item matching value/label, switch to that tab. */
function switchToTabContaining(
  rt: RuntimeInternal, blocks: ContentBlock[], value: string, label: string,
): boolean {
  // Structural walk: finds tabs nested in any layout container.
  for (const { block } of walk(blocks)) {
    if (block.type !== "tabs") continue;
    for (let ti = 0; ti < block.items.length; ti++) {
      if (blockExistsInContent(value, label, block.items[ti].content)) {
        const tabKey = rt.getBlockKey(block, () => block.items.map((i) => i.label).join(","));
        rt.tabState.set(tabKey, ti);
        return true;
      }
    }
  }
  return false;
}

/**
 * Search layout blocks for a panel whose title matches, return the focus
 * index of the first focusable item inside that panel.
 *
 * Path-based: the matched panel's walk path prefixes exactly the paths of
 * the blocks inside it, and focus indices are focusSlotsOf() sums in walk
 * order — the same ordering contract collectFocusItems uses.
 */
function findFocusIndexByPanelTitle(
  blocks: ContentBlock[], value: string, label: string, rt: RuntimeInternal,
): number {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  const labelNorm = norm(label);
  const walkOpts = { resolveDynamic: (b: DynamicBlock) => resolveDynamic(rt, b) };

  const titleMatches = (t: string | undefined): boolean =>
    !!t && (fuzzyMatch(t, valueLower, valueNorm) || fuzzyMatch(t, labelNorm, labelNorm));

  // Locate the matched panel's structural path prefix.
  let panelPrefix: string | null = null;
  outer:
  for (const e of walk(blocks, walkOpts)) {
    const b = e.block;
    if (b.type === "columns" || b.type === "rows") {
      const panels = (b as ColumnsBlock | RowsBlock).panels;
      for (let i = 0; i < panels.length; i++) {
        if (titleMatches(panels[i].title)) { panelPrefix = `${e.path}/panels.${i}`; break outer; }
      }
    } else if (b.type === "grid") {
      const items = (b as GridBlock).config.items;
      for (let i = 0; i < items.length; i++) {
        if (titleMatches(items[i].title)) { panelPrefix = `${e.path}/items.${i}`; break outer; }
      }
    }
  }
  if (panelPrefix === null) return -1;

  // Focus index of the first focus slot inside that panel.
  let focusIdx = 0;
  for (const e of walk(blocks, walkOpts)) {
    const slots = focusSlotsOf(e.block);
    if (slots === 0) continue;
    if (e.path.startsWith(panelPrefix + "/")) return focusIdx;
    focusIdx += slots;
  }
  return -1;
}

/** Container edges searched by fuzzy matching: everything except dynamic/async. */
const SEARCH_EDGES: ReadonlySet<ContainerEdge> = new Set<ContainerEdge>(
  [...ALL_EDGES].filter(e => e !== "dynamic" && e !== "asyncContent"),
);

/** Check if a block matching value/label exists in a content array. */
export function blockExistsInContent(value: string, label: string, blocks: ContentBlock[]): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  for (const { block: b } of walk(blocks, { descend: SEARCH_EDGES })) {
    if ("id" in b && (b as any).id === value) return true;
    if (b.type === "card") {
      if (fuzzyMatch(b.title, valueLower, valueNorm) || fuzzyMatch(b.subtitle, valueLower, valueNorm)) return true;
    }
    if (b.type === "link") {
      const n = norm(b.label);
      if (b.label.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) return true;
    }
    if (b.type === "accordion") {
      for (const item of b.items) {
        const itemNorm = item.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (item.label.toLowerCase().includes(valueLower) || itemNorm.includes(valueNorm) || valueNorm.includes(itemNorm)) return true;
      }
    }
    if (b.type === "timeline") {
      for (const item of b.items) { if (item.title.toLowerCase().includes(valueLower)) return true; }
    }
  }
  return false;
}
