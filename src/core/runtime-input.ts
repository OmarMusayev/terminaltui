/**
 * Input handling: key dispatch, navigation mode, edit mode routing,
 * search actions, and block matching.
 */
import type {
  ContentBlock, TextInputBlock, TextAreaBlock, SelectBlock,
  NumberInputBlock, SearchInputBlock, RadioGroupBlock,
  FormBlock, DynamicBlock,
} from "../config/types.js";
import type { KeyPress } from "./input.js";
import { keyToAction } from "../navigation/keybindings.js";
import { filterSearchItems } from "../components/SearchInput.js";
import { getInputDefault } from "../components/Form.js";
import type { FocusItem } from "./runtime-types.js";
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
  resolvedPageContent: Map<string, ContentBlock[]>;
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

/** Handle keystrokes in navigation mode. */
export function handleNavigationMode(rt: RT, key: KeyPress): void {
  const isHome = rt.router.isHome();

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
        rt.inputMode.reset();
        rt.render();
      }
      break;
    case "up":
      if (rt.router.isHome()) rt.focus.focusPrev();
      else rt.pageFocusPrev();
      rt.render();
      break;
    case "down":
      if (rt.router.isHome()) rt.focus.focusNext();
      else rt.pageFocusNext();
      rt.render();
      break;
    case "select":
    case "right":
      if (rt.router.isHome()) {
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

/** Scroll focus to a block matching value/label on the current page. */
export function scrollToBlock(rt: RT, value: string, label: string): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  const labelLower = label.toLowerCase();

  for (let i = 0; i < rt.pageFocusItems.length; i++) {
    const item = rt.pageFocusItems[i];

    if (item.kind === "block") {
      const b = item.block;
      if ("id" in b && (b as any).id === value) { rt.pageFocusIndex = i; return true; }
      if (b.type === "card") {
        const n = norm(b.title);
        if (b.title.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) { rt.pageFocusIndex = i; return true; }
      }
      if (b.type === "link") {
        const n = norm(b.label);
        if (b.label.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) { rt.pageFocusIndex = i; return true; }
      }
      if (b.type === "hero") {
        const n = norm(b.title);
        if (b.title.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) { rt.pageFocusIndex = i; return true; }
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
  return false;
}

/** Check if a block matching value/label exists in a content array. */
export function blockExistsInContent(value: string, label: string, blocks: ContentBlock[]): boolean {
  const valueLower = value.toLowerCase();
  const valueNorm = norm(value);
  for (const b of blocks) {
    if ("id" in b && (b as any).id === value) return true;
    if (b.type === "card") {
      const n = norm(b.title);
      if (b.title.toLowerCase().includes(valueLower) || n.includes(valueNorm) || valueNorm.includes(n)) return true;
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
  }
  return false;
}
