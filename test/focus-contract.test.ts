#!/usr/bin/env npx tsx
/**
 * Focus contract test — pins the parity between the two focus-ordering
 * engines:
 *
 *   collectFocusItems (semantic walk, src/core/runtime-pages.ts)
 *   computeFocusPositions (geometry walk, src/layout/flex-engine.ts)
 *
 * Both derive their slot counts from focusSlots() in block-taxonomy.ts.
 * The fixture contains every container kind plus accordion/timeline/tabs/
 * chat/gallery/dynamic. Asserts:
 *   1. rect count === focus item count,
 *   2. focusIndex values are 0..N-1 in emission order,
 *   3. a golden (path, type) array pins the walk ordering,
 *   4. chat is focusable and gallery is not (the §B.2 unification).
 */
import type { ContentBlock, DynamicBlock } from "../src/config/types.js";
import {
  card, link, hero, section, form, columns, rows, grid, panel,
  col, row, container, accordion, timeline, tabs, chat, gallery,
  asyncContent, text, textInput, button, toggle, checkbox, select,
  radioGroup, numberInput, searchInput,
} from "../src/config/parser.js";
import { collectFocusItems } from "../src/core/runtime-pages.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";
import { walk } from "../src/core/block-walker.js";
import { focusSlots } from "../src/core/block-taxonomy.js";

// ─── Test Harness ────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m ${message}: expected ${expected}, got ${actual}`);
  }
}

// ─── Fixture: every container kind + focus leaf variants ──

// Dynamic children are a fixed array so both walks resolve identically.
const dynChildren: ContentBlock[] = [card({ title: "N (dynamic)" })];
const dynamicBlock: DynamicBlock = {
  type: "dynamic",
  render: () => dynChildren,
  _dynamicId: "dyn-contract",
};

const tree: ContentBlock[] = [
  card({ title: "A" }),                                                     // 0
  section("S", [link("B", "https://b.example")]),                           // 1
  form({
    id: "f1",
    onSubmit: () => ({ success: "ok" }),
    fields: [textInput({ id: "ti", label: "C" }), button({ label: "D" })],
  }),                                                                       // 2
  columns([
    { content: [card({ title: "E" })] },
    { content: [toggle({ id: "tg", label: "F" })] },
  ]),                                                                       // 3
  rows([{ content: [checkbox({ id: "cb", label: "G" })] }]),                // 4
  grid({
    cols: 2,
    items: [
      { content: [select({ id: "sel", label: "H", options: [{ label: "h1", value: "h1" }] })] },
      { content: [card({ title: "I" })] },
    ],
  }),                                                                       // 5
  panel({ content: [radioGroup({ id: "rg", label: "J", options: [{ label: "j1", value: "j1" }] })] }), // 6
  row([
    col([numberInput({ id: "ni", label: "K" })], { span: 6 }),
    col([searchInput({ id: "si", items: [] })], { span: 6 }),
  ]),                                                                       // 7
  container([hero({ title: "M" })]),                                        // 8
  dynamicBlock,                                                             // 9
  accordion([
    { label: "acc-1", content: [text("inside accordion")] },
    { label: "acc-2", content: [] },
  ]),                                                                       // 10
  timeline([{ title: "t1" }, { title: "t2" }, { title: "t3" }]),            // 11
  tabs([
    { label: "tab-1", content: [card({ title: "X (inside tab)" })] },
    { label: "tab-2", content: [] },
  ]),                                                                       // 12
  chat({ id: "ch", endpoint: "/api/chat" }),                                // 13
  gallery([{ title: "g1" }, { title: "g2" }]),                              // 14 — not focusable
  asyncContent({ load: async () => [] }),                                   // 15 — not focusable
];

// ─── 1. Slot-count parity ────────────────────────────

console.log("\x1b[1m  Focus contract: item/rect parity\x1b[0m");

const rtStub = { dynamicCache: new Map<string, ContentBlock[]>() };
const items = collectFocusItems(rtStub as never, tree);
const rects = computeFocusPositions(
  tree, 100, 40,
  (b) => { const r = b.render(); return Array.isArray(r) ? r : [r]; },
);

assertEqual(items.length, 21, "collectFocusItems finds 21 focus items");
assertEqual(rects.length, 21, "computeFocusPositions emits 21 rects");
assertEqual(rects.length, items.length, "rect count === focus item count");

// ─── 2. focusIndex is 0..N-1 in emission order ───────

console.log("\x1b[1m  Focus contract: focusIndex sequence\x1b[0m");

let sequential = true;
for (let i = 0; i < rects.length; i++) {
  if (rects[i].focusIndex !== i) sequential = false;
}
assert(sequential, "focusIndex values are 0..N-1 in emission order");

// ─── 3. Golden (path, type) ordering ─────────────────

console.log("\x1b[1m  Focus contract: golden (path, type) ordering\x1b[0m");

const expectedGolden: [string, string][] = [
  ["0", "card"],
  ["1/0", "link"],
  ["2/0", "textInput"],
  ["2/1", "button"],
  ["3/panels.0/0", "card"],
  ["3/panels.1/0", "toggle"],
  ["4/panels.0/0", "checkbox"],
  ["5/items.0/0", "select"],
  ["5/items.1/0", "card"],
  ["6/0", "radioGroup"],
  ["7/cols.0/0", "numberInput"],
  ["7/cols.1/0", "searchInput"],
  ["8/0", "hero"],
  ["9/dyn/0", "card"],
  ["10", "accordion"], // slot 1 of 2
  ["10", "accordion"], // slot 2 of 2
  ["11", "timeline"],  // slot 1 of 3
  ["11", "timeline"],  // slot 2 of 3
  ["11", "timeline"],  // slot 3 of 3
  ["12", "tabs"],
  ["13", "chat"],
];

const actualGolden: [string, string][] = [];
for (const e of walk(tree, { resolveDynamic: (b) => { const r = b.render(); return Array.isArray(r) ? r : [r]; } })) {
  const slots = focusSlots(e.block);
  for (let s = 0; s < slots; s++) actualGolden.push([e.path, e.block.type]);
}

assertEqual(actualGolden.length, expectedGolden.length, "golden array length");
const goldenMatch = JSON.stringify(actualGolden) === JSON.stringify(expectedGolden);
if (!goldenMatch) {
  console.error("    expected:", JSON.stringify(expectedGolden));
  console.error("    actual:  ", JSON.stringify(actualGolden));
}
assert(goldenMatch, "golden (path, type) array matches walk emission order");

// ─── 4. Taxonomy pins: chat in, gallery out ──────────

console.log("\x1b[1m  Focus contract: chat/gallery unification\x1b[0m");

assertEqual(focusSlots(chat({ id: "c2", endpoint: "/x" })), 1, "chat occupies one focus slot");
assertEqual(focusSlots(gallery([{ title: "g" }])), 0, "gallery occupies no focus slot");

const kinds = { block: 0, "accordion-item": 0, "timeline-item": 0 };
for (const it of items) kinds[it.kind]++;
assertEqual(kinds.block, 16, "16 single-slot block items");
assertEqual(kinds["accordion-item"], 2, "2 accordion item slots");
assertEqual(kinds["timeline-item"], 3, "3 timeline item slots");

const chatItem = items.find((it) => it.kind === "block" && it.block.type === "chat");
assert(chatItem !== undefined, "chat block is present in the focus item list");
const galleryItem = items.find((it) => it.kind === "block" && it.block.type === "gallery");
assert(galleryItem === undefined, "gallery block is absent from the focus item list");

// ─── Summary ─────────────────────────────────────────

console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
