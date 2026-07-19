/**
 * Block taxonomy — the single source of truth for focusability and
 * input-type membership. Both the semantic walkers (block-walker.ts
 * consumers) and the geometry walker (layout/flex-engine.ts) derive their
 * ordering rules from here; test/focus-contract.test.ts pins the parity.
 */
import type { ContentBlock } from "../config/types.js";

/**
 * Blocks that occupy exactly one focus slot.
 * chat IS focusable (it takes input and reacts to Enter); gallery is NOT
 * (it was never selectable or Enter-actionable — its old phantom focus rect
 * skewed spatial navigation by one).
 */
export const FOCUSABLE_TYPES: ReadonlySet<ContentBlock["type"]> = new Set<ContentBlock["type"]>([
  "card", "link", "hero", "tabs", "chat",
  "textInput", "textArea", "select", "checkbox", "toggle",
  "radioGroup", "numberInput", "searchInput", "button",
]);

/** Blocks whose ITEMS each occupy a focus slot. */
export const ITEMIZED_FOCUS_TYPES: ReadonlySet<ContentBlock["type"]> =
  new Set<ContentBlock["type"]>(["accordion", "timeline"]);

/** Input blocks (Enter interacts / edit-state carriers). */
export const INPUT_TYPES: ReadonlySet<string> = new Set([
  "textInput", "textArea", "select", "checkbox", "toggle",
  "radioGroup", "numberInput", "searchInput", "button",
]);

/** Typing auto-enters edit mode for these. */
export const TEXT_ENTRY_TYPES: ReadonlySet<string> =
  new Set(["textInput", "textArea", "searchInput", "numberInput"]);

/** Whether a block occupies at least one focus slot. */
export function isBlockFocusable(block: ContentBlock): boolean {
  return FOCUSABLE_TYPES.has(block.type) || ITEMIZED_FOCUS_TYPES.has(block.type);
}

/**
 * 0 = not focusable, 1 = single slot, n = one per item. THE ordering
 * contract: both collectFocusItems and flex-engine derive slot counts from
 * this one function.
 */
export function focusSlots(block: ContentBlock): number {
  if (FOCUSABLE_TYPES.has(block.type)) return 1;
  if (ITEMIZED_FOCUS_TYPES.has(block.type)) {
    return (block as { items: unknown[] }).items.length;
  }
  return 0;
}
