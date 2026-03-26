/**
 * Input handling: key dispatch, navigation mode, edit mode routing,
 * search actions, and block matching.
 *
 * Navigation uses spatial algorithm — arrow keys move to the nearest
 * focusable item in that direction based on screen position.
 */
import type {
  ContentBlock, TextInputBlock, TextAreaBlock, SelectBlock,
  NumberInputBlock, SearchInputBlock, RadioGroupBlock,
  FormBlock, DynamicBlock,
  ColumnsBlock, RowsBlock, SplitBlock, GridBlock, PanelBlock,
} from "../config/types.js";
import type { KeyPress } from "./input.js";
import { keyToAction } from "../navigation/keybindings.js";
import { findNextFocus } from "../navigation/spatial.js";
import { filterSearchItems } from "../components/SearchInput.js";
import { getInputDefault } from "../components/Form.js";
import type { FocusItem } from "./runtime-types.js";
import type { FocusRect } from "../layout/types.js";
import {
  handleTextInputKey, handleTextAreaKey, handleSelectKey,
  handleNumberInputKey, handleSearchInputKey, handleRadioGroupKey,
} from "./runtime-edit-handlers.js";

interface RT {
  site: any;
  router: any;
  focus: any;
  inputMode: any;
  commandMode: boolean;
  commandBuffer: string;
  pageFocusIndex: number;
  pageFocusItems: FocusItem[];
  pageScrollOffset: number;
  scrollOffset: number;
  accordionState: Map<string, number>;
  tabState: Map<string, number>;
  resolvedPageContent: Map<string, ContentBlock[]>;
  focusRects: FocusRect[];
  render(): void;
  stop(): Promise<void>;
  navigateToPage(pageId: string, params?: any): void;
  pageFocusNext(): void;
  pageFocusPrev(): void;
  handleEditMode(key: KeyPress): void;
  showFeedback(msg: string): void;
  getInputState(id: string, defaultValue?: any): any;
  validateInput(block: ContentBlock): boolean;
  handlePageSelect(): void;
  enterPage(): void;
  executeCommand(cmd: string): void;
  getFocusedInputBlock(): ContentBlock | null;
  isTextEntryType(type: string): boolean;
  isAutoEditKey(key: KeyPress): boolean;
  getCurrentPage(): any;
  getPageContent(page: any): ContentBlock[] | null;
}

/** Handle keystrokes in command mode (:command). */
export function handleCommandMode(rt: RT, key: KeyPress): void {
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
    rt.commandBuffer = rt.commandBuffer.slice(0, -1);
    rt.render();
    return;
  }
  if (key.char && key.char.length === 1 && !key.ctrl) {
    rt.commandBuffer += key.char;
    rt.render();
    return;
  }
}

/** Handle keystrokes in navigation mode — spatial navigation for all directions. */
export function handleNavigationMode(rt: RT, key: KeyPress): void {
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

  const action = keyToAction(key, isHome);
  if (!action) return;

  switch (action) {
    case "quit": rt.stop(); break;

    case "back":
      if (rt.router.back()) {
        rt.scrollOffset = 0;
        rt.pageFocusIndex = 0;
        rt.pageScrollOffset = 0;
        rt.pageFocusItems = [];
        rt.focusRects = [];
        rt.inputMode.reset();
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
          const tabKey = tb.items.map((i: any) => i.label).join(",");
          const cur = rt.tabState.get(tabKey) ?? 0;
          rt.tabState.set(tabKey, cur > 0 ? cur - 1 : tb.items.length - 1);
        } else {
          // Spatial navigation: find nearest focusable to the left
          const nextLeft = findNextFocus(rt.pageFocusIndex, "left", rt.focusRects);
          if (nextLeft !== null) {
            rt.pageFocusIndex = nextLeft;
          } else {
            // Nothing to the left — go back (like pressing Escape)
            if (rt.router.back()) {
              rt.scrollOffset = 0;
              rt.pageFocusIndex = 0;
              rt.pageScrollOffset = 0;
              rt.pageFocusItems = [];
              rt.focusRects = [];
              rt.inputMode.reset();
            }
          }
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
          const tabKey = tb.items.map((i: any) => i.label).join(",");
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
        if (rt.router.isHome()) {
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

/** Handle keystrokes in edit mode — dispatch to type-specific handler. */
export function handleEditMode(rt: RT, key: KeyPress): void {
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
  rt: RT, block: SearchInputBlock,
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
    rt.enterPage();
    rt.showFeedback(`\u2192 ${pageMatch.title}`);
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
      rt.enterPage();
      scrollToBlock(rt, value, selected.label);
      rt.showFeedback(`\u2192 ${p.title} \u203a ${selected.label}`);
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
export function scrollToBlock(rt: RT, value: string, label: string): boolean {
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
        const accKey = item.accordion.items.map(it => it.label).join(",");
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
  rt: RT, blocks: ContentBlock[], value: string, label: string,
): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);

  for (const block of blocks) {
    if (block.type === "tabs") {
      const tabs = block as any;
      for (let ti = 0; ti < tabs.items.length; ti++) {
        const tabContent: ContentBlock[] = tabs.items[ti].content;
        if (blockExistsInContent(value, label, tabContent)) {
          const tabKey = tabs.items.map((i: any) => i.label).join(",");
          rt.tabState.set(tabKey, ti);
          return true;
        }
      }
    }
    // Recurse into layout containers
    if (block.type === "section" && (block as any).content) {
      if (switchToTabContaining(rt, (block as any).content, value, label)) return true;
    }
    if (block.type === "columns") {
      for (const p of (block as ColumnsBlock).panels) {
        if (switchToTabContaining(rt, p.content, value, label)) return true;
      }
    }
    if (block.type === "split") {
      const s = block as SplitBlock;
      if (switchToTabContaining(rt, s.config.first, value, label)) return true;
      if (switchToTabContaining(rt, s.config.second, value, label)) return true;
    }
  }
  return false;
}

/** Search layout blocks for a panel whose title matches, return its first focus index. */
function findFocusIndexByPanelTitle(
  blocks: ContentBlock[], value: string, label: string, rt: RT,
): number {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  const labelNorm = norm(label);
  let focusOffset = 0;

  for (const block of blocks) {
    if (block.type === "grid") {
      const gridBlock = block as GridBlock;
      for (const item of gridBlock.config.items) {
        const itemFocusCount = collectFocusItemsStatic(item.content);
        if (item.title && (fuzzyMatch(item.title, valueLower, valueNorm) || fuzzyMatch(item.title, labelNorm, labelNorm))) {
          return focusOffset;
        }
        focusOffset += itemFocusCount;
      }
    } else if (block.type === "columns") {
      for (const p of (block as ColumnsBlock).panels) {
        const pCount = collectFocusItemsStatic(p.content);
        if (p.title && (fuzzyMatch(p.title, valueLower, valueNorm) || fuzzyMatch(p.title, labelNorm, labelNorm))) {
          return focusOffset;
        }
        focusOffset += pCount;
      }
    } else if (block.type === "split") {
      const s = block as SplitBlock;
      focusOffset += collectFocusItemsStatic(s.config.first);
      focusOffset += collectFocusItemsStatic(s.config.second);
    } else if (block.type === "rows") {
      for (const p of (block as RowsBlock).panels) {
        focusOffset += collectFocusItemsStatic(p.content);
      }
    } else {
      focusOffset += collectFocusItemsStatic([block]);
    }
  }
  return -1;
}

/** Count focusable items in content (static, no dynamic resolution). */
function collectFocusItemsStatic(blocks: ContentBlock[]): number {
  let count = 0;
  for (const b of blocks) {
    if (["card", "link", "hero", "textInput", "textArea", "select", "checkbox",
         "toggle", "radioGroup", "numberInput", "searchInput", "button"].includes(b.type)) {
      count++;
    } else if (b.type === "accordion") count += (b as any).items.length;
    else if (b.type === "timeline") count += (b as any).items.length;
    else if (b.type === "tabs") count++;
    else if (b.type === "section") count += collectFocusItemsStatic((b as any).content);
    else if (b.type === "form") count += collectFocusItemsStatic((b as any).fields);
    else if (b.type === "columns") { for (const p of (b as any).panels) count += collectFocusItemsStatic(p.content); }
    else if (b.type === "rows") { for (const p of (b as any).panels) count += collectFocusItemsStatic(p.content); }
    else if (b.type === "split") { count += collectFocusItemsStatic((b as any).config.first); count += collectFocusItemsStatic((b as any).config.second); }
    else if (b.type === "grid") { for (const item of (b as any).config.items) count += collectFocusItemsStatic(item.content); }
    else if (b.type === "panel") count += collectFocusItemsStatic((b as any).config.content);
    else if (b.type === "box") count += collectFocusItemsStatic((b as any).config.children);
    else if (b.type === "row") { for (const c of (b as any).cols) count += collectFocusItemsStatic(c.content); }
    else if (b.type === "container") count += collectFocusItemsStatic((b as any).content);
  }
  return count;
}

/** Check if a block matching value/label exists in a content array. */
export function blockExistsInContent(value: string, label: string, blocks: ContentBlock[]): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  for (const b of blocks) {
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
    if (b.type === "section") { if (blockExistsInContent(value, label, b.content)) return true; }
    if (b.type === "form") { if (blockExistsInContent(value, label, (b as FormBlock).fields)) return true; }
    if (b.type === "columns") { for (const p of (b as ColumnsBlock).panels) if (blockExistsInContent(value, label, p.content)) return true; }
    if (b.type === "rows") { for (const p of (b as RowsBlock).panels) if (blockExistsInContent(value, label, p.content)) return true; }
    if (b.type === "split") { const s = b as SplitBlock; if (blockExistsInContent(value, label, s.config.first) || blockExistsInContent(value, label, s.config.second)) return true; }
    if (b.type === "grid") { for (const item of (b as GridBlock).config.items) if (blockExistsInContent(value, label, item.content)) return true; }
    if (b.type === "panel") { if (blockExistsInContent(value, label, (b as PanelBlock).config.content)) return true; }
    if (b.type === "box") { if (blockExistsInContent(value, label, (b as any).config.children)) return true; }
    if (b.type === "row") { for (const c of (b as any).cols) if (blockExistsInContent(value, label, c.content)) return true; }
    if (b.type === "container") { if (blockExistsInContent(value, label, (b as any).content)) return true; }
  }
  return false;
}
