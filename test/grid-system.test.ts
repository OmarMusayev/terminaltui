#!/usr/bin/env npx tsx
/**
 * Grid system unit tests — validates the 12-column grid layout math,
 * responsive breakpoints, and integration with the rendering pipeline.
 */
import {
  getBreakpoint, getEffectiveSpan, layoutRow, rowColsToPanels,
} from "../src/layout/grid-system.js";
import type { ColConfig } from "../src/config/types.js";
import { col, row, container, card, markdown, link } from "../src/config/parser.js";
import { collectFocusItems } from "../src/core/runtime-pages.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";

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

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m ${message}: expected ${expected}, got ${actual}`);
  }
}

// ─── Breakpoint Tests ────────────────────────────────

console.log("\x1b[1m  Breakpoints\x1b[0m");

assertEqual(getBreakpoint(40), "xs", "40 cols → xs");
assertEqual(getBreakpoint(59), "xs", "59 cols → xs");
assertEqual(getBreakpoint(60), "sm", "60 cols → sm");
assertEqual(getBreakpoint(89), "sm", "89 cols → sm");
assertEqual(getBreakpoint(90), "md", "90 cols → md");
assertEqual(getBreakpoint(119), "md", "119 cols → md");
assertEqual(getBreakpoint(120), "lg", "120 cols → lg");
assertEqual(getBreakpoint(200), "lg", "200 cols → lg");

// ─── Effective Span Tests ────────────────────────────

console.log("\x1b[1m  Effective Span\x1b[0m");

const col1: ColConfig = { content: [], span: 6 };
assertEqual(getEffectiveSpan(col1, "lg", 4), 6, "span:6 at lg");
assertEqual(getEffectiveSpan(col1, "md", 4), 6, "span:6 at md (no md override)");

const col2: ColConfig = { content: [], span: 4, sm: 6, xs: 12 };
assertEqual(getEffectiveSpan(col2, "lg", 3), 4, "span:4, sm:6, xs:12 at lg → 4");
assertEqual(getEffectiveSpan(col2, "md", 3), 4, "span:4, sm:6, xs:12 at md → 4");
assertEqual(getEffectiveSpan(col2, "sm", 3), 6, "span:4, sm:6, xs:12 at sm → 6");
assertEqual(getEffectiveSpan(col2, "xs", 3), 12, "span:4, sm:6, xs:12 at xs → 12");

const col3: ColConfig = { content: [] };
assertEqual(getEffectiveSpan(col3, "lg", 4), 4, "no span → auto (4)");
assertEqual(getEffectiveSpan(col3, "xs", 6), 6, "no span → auto (6)");

// ─── Column Width Calculation ────────────────────────

console.log("\x1b[1m  Column Width Calculation\x1b[0m");

// 2 equal columns in 120 cols
const panels2 = rowColsToPanels(
  [{ content: [], span: 6 }, { content: [], span: 6 }],
  120, 1, 120,
);
assertEqual(panels2.length, 2, "2 panels created");
// Total should be <= 120 (after 1 gap)
const total2 = (panels2[0].width as number) + (panels2[1].width as number) + 1;
assert(total2 <= 120, `2 equal cols total (${total2}) <= 120`);

// 3 equal columns in 120 cols
const panels3 = rowColsToPanels(
  [{ content: [], span: 4 }, { content: [], span: 4 }, { content: [], span: 4 }],
  120, 1, 120,
);
assertEqual(panels3.length, 3, "3 panels created");
const total3 = (panels3[0].width as number) + (panels3[1].width as number) + (panels3[2].width as number) + 2;
assert(total3 <= 120, `3 equal cols total (${total3}) <= 120`);

// Unequal: span:3 + span:9 in 120 cols
const panelsUnequal = rowColsToPanels(
  [{ content: [], span: 3 }, { content: [], span: 9 }],
  120, 1, 120,
);
const w3 = panelsUnequal[0].width as number;
const w9 = panelsUnequal[1].width as number;
assert(w9 > w3, `span:9 (${w9}) should be wider than span:3 (${w3})`);
assert(w9 > w3 * 2, `span:9 (${w9}) should be roughly 3x span:3 (${w3})`);

// Gap math: 3 cols with gap:2
const panelsGap = rowColsToPanels(
  [{ content: [], span: 4 }, { content: [], span: 4 }, { content: [], span: 4 }],
  100, 2, 100,
);
const totalGap = (panelsGap[0].width as number) + (panelsGap[1].width as number) + (panelsGap[2].width as number) + 4;
assert(totalGap <= 100, `3 cols with gap:2, total (${totalGap}) <= 100`);

// ─── Responsive Collapse ─────────────────────────────

console.log("\x1b[1m  Responsive\x1b[0m");

// At xs (<60), col with xs:12 should get full span
const panelsXs = rowColsToPanels(
  [{ content: [], span: 4, xs: 12 }, { content: [], span: 4, xs: 12 }, { content: [], span: 4, xs: 12 }],
  50, 1, 50, // xs breakpoint
);
// Each panel should get roughly 50/3 width since they all have span=12 out of total 36
// But the responsive logic in rowColsToPanels uses proportional spans
assertEqual(panelsXs.length, 3, "3 responsive panels created");

// ─── Parser Functions ────────────────────────────────

console.log("\x1b[1m  Parser Functions\x1b[0m");

const testCol = col([markdown("hello")], { span: 6 });
assertEqual(testCol.span, 6, "col() sets span");
assertEqual(testCol.content.length, 1, "col() sets content");

const testRow = row([testCol, testCol], { gap: 2 });
assertEqual(testRow.type, "row", "row() type is 'row'");
assertEqual(testRow.cols.length, 2, "row() has 2 cols");
assertEqual(testRow.gap, 2, "row() sets gap");

const testContainer = container([testRow], { maxWidth: 100, padding: 2 });
assertEqual(testContainer.type, "container", "container() type is 'container'");
assertEqual(testContainer.maxWidth, 100, "container() sets maxWidth");
assertEqual(testContainer.padding, 2, "container() sets padding");

// ─── Focus Collection ────────────────────────────────

console.log("\x1b[1m  Focus Collection\x1b[0m");

const focusRow = row([
  col([card({ title: "A" }), card({ title: "B" })], { span: 6 }),
  col([card({ title: "C" }), link("D", "http://d")], { span: 6 }),
]);

const items = collectFocusItems({} as any, [focusRow]);
assertEqual(items.length, 4, "row with 4 focusable items collects all 4");

const focusContainer = container([
  card({ title: "E" }),
  row([
    col([card({ title: "F" })], { span: 6 }),
    col([card({ title: "G" })], { span: 6 }),
  ]),
]);

const containerItems = collectFocusItems({} as any, [focusContainer]);
assertEqual(containerItems.length, 3, "container with nested row collects 3 items");

// ─── Spatial Position Computation ────────────────────

console.log("\x1b[1m  Spatial Positions\x1b[0m");

const spatialRow = row([
  col([card({ title: "Left" })], { span: 6 }),
  col([card({ title: "Right" })], { span: 6 }),
]);

const rects = computeFocusPositions([spatialRow], 100, 40, () => []);
assertEqual(rects.length, 2, "2 focusable items in row");
if (rects.length === 2) {
  assert(rects[1].x > rects[0].x, `Right col x (${rects[1].x}) > Left col x (${rects[0].x})`);
  assertEqual(rects[0].focusIndex, 0, "Left col focusIndex = 0");
  assertEqual(rects[1].focusIndex, 1, "Right col focusIndex = 1");
}

// Container positions should be offset by padding
const spatialContainer = container([
  card({ title: "Centered" }),
], { maxWidth: 60, padding: 5 });

const containerRects = computeFocusPositions([spatialContainer], 100, 40, () => []);
assertEqual(containerRects.length, 1, "1 focusable item in container");
if (containerRects.length === 1) {
  assert(containerRects[0].x > 0, `Container item has x offset (${containerRects[0].x}) > 0`);
  assert(containerRects[0].width <= 50, `Container item width (${containerRects[0].width}) <= 50 (60 - 2*5)`);
}

// ─── Summary ─────────────────────────────────────────

console.log("");
if (failed > 0) {
  console.log(`  \x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
}
