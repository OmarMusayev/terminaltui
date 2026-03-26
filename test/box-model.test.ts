/**
 * Box model unit tests — computeBoxDimensions + COMPONENT_DEFAULTS
 */
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../src/layout/box-model.js";
import type { BoxDimensions } from "../src/layout/box-model.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name} — expected ${expected}, got ${actual}`);
  }
}

// ─── computeBoxDimensions basic math ─────────────────────

console.log("\x1b[1m  computeBoxDimensions\x1b[0m");

// No chrome
{
  const dims = computeBoxDimensions(80, {});
  assertEqual(dims.content, 80, "no options → content = allocated");
  assertEqual(dims.margin, 0, "no options → margin = 0");
  assertEqual(dims.border, 0, "no options → border = 0");
  assertEqual(dims.padding, 0, "no options → padding = 0");
  assertEqual(dims.allocated, 80, "no options → allocated preserved");
}

// Border only (boolean)
{
  const dims = computeBoxDimensions(80, { border: true });
  assertEqual(dims.content, 78, "border true → content = 78");
  assertEqual(dims.border, 1, "border true → border = 1");
}

// Border only (number)
{
  const dims = computeBoxDimensions(80, { border: 1 });
  assertEqual(dims.content, 78, "border 1 → content = 78");
}

// Border false
{
  const dims = computeBoxDimensions(80, { border: false });
  assertEqual(dims.content, 80, "border false → content = 80");
  assertEqual(dims.border, 0, "border false → border = 0");
}

// Padding only
{
  const dims = computeBoxDimensions(80, { padding: 2 });
  assertEqual(dims.content, 76, "padding 2 → content = 76");
}

// Border + padding
{
  const dims = computeBoxDimensions(40, { border: true, padding: 1 });
  assertEqual(dims.content, 36, "40 w/ border+pad1 → content = 36");
}

// Margin + border + padding
{
  const dims = computeBoxDimensions(40, { margin: 2, border: true, padding: 1 });
  assertEqual(dims.content, 32, "40 w/ margin2+border+pad1 → content = 32");
}

// Content cannot go negative
{
  const dims = computeBoxDimensions(5, { border: true, padding: 3 });
  assertEqual(dims.content, 0, "5 w/ border+pad3 → content = max(0, 5-2-6) = 0");
}

// Zero allocated
{
  const dims = computeBoxDimensions(0, { border: true, padding: 1 });
  assertEqual(dims.content, 0, "0 allocated → content = 0");
}

// Card-like: border + padding 1
{
  const dims = computeBoxDimensions(80, { border: true, padding: 1 });
  assertEqual(dims.content, 76, "card-like (80, border+pad1) → content = 76");
}

// Quote-like: margin 1 + border + padding 1
{
  const dims = computeBoxDimensions(80, { margin: 1, border: true, padding: 1 });
  assertEqual(dims.content, 74, "quote-like (80, m1+border+p1) → content = 74");
}

// Button-like: margin 1 + border + padding 2
{
  const dims = computeBoxDimensions(80, { margin: 1, border: true, padding: 2 });
  assertEqual(dims.content, 72, "button-like (80, m1+border+p2) → content = 72");
}

// Accordion-like: padding 2 only
{
  const dims = computeBoxDimensions(80, { padding: 2 });
  assertEqual(dims.content, 76, "accordion-like (80, pad2) → content = 76");
}

// ─── COMPONENT_DEFAULTS completeness ─────────────────────

console.log("\x1b[1m  COMPONENT_DEFAULTS\x1b[0m");

const expectedTypes = [
  // Display
  "card", "text", "hero", "table", "quote", "badge", "progressBar",
  "link", "list", "section", "divider", "spacer", "timeline",
  "gallery", "image", "markdown",
  // Interactive
  "menu", "accordion", "tabs", "scrollView",
  // Input
  "textInput", "textArea", "select", "checkbox", "toggle",
  "radioGroup", "numberInput", "searchInput", "button", "form",
  // Layout
  "box",
];

for (const type of expectedTypes) {
  assert(COMPONENT_DEFAULTS[type] !== undefined, `COMPONENT_DEFAULTS has entry for "${type}"`);
}

// Verify specific known values
{
  const card = COMPONENT_DEFAULTS.card;
  assertEqual(card.border, true, "card border = true");
  assertEqual(card.padding, 1, "card padding = 1");

  const text = COMPONENT_DEFAULTS.text;
  assertEqual(text.border, false, "text border = false");
  assertEqual(text.padding, 0, "text padding = 0");

  const quote = COMPONENT_DEFAULTS.quote;
  assertEqual(quote.border, true, "quote border = true");
  assertEqual(quote.padding, 1, "quote padding = 1");
  assertEqual(quote.margin, 1, "quote margin = 1");

  const button = COMPONENT_DEFAULTS.button;
  assertEqual(button.border, true, "button border = true");
  assertEqual(button.padding, 2, "button padding = 2");
  assertEqual(button.margin, 1, "button margin = 1");

  const table = COMPONENT_DEFAULTS.table;
  assertEqual(table.border, true, "table border = true");
  assertEqual(table.padding, 0, "table padding = 0");

  const timeline = COMPONENT_DEFAULTS.timeline;
  assertEqual(timeline.border, true, "timeline border = true");
  assertEqual(timeline.margin, 1, "timeline margin = 1");

  const accordion = COMPONENT_DEFAULTS.accordion;
  assertEqual(accordion.border, false, "accordion border = false");
  assertEqual(accordion.padding, 2, "accordion padding = 2");

  const tabs = COMPONENT_DEFAULTS.tabs;
  assertEqual(tabs.padding, 2, "tabs padding = 2");

  const checkbox = COMPONENT_DEFAULTS.checkbox;
  assertEqual(checkbox.border, false, "checkbox border = false");
  assertEqual(checkbox.padding, 0, "checkbox padding = 0");
}

// ─── Integration: COMPONENT_DEFAULTS with computeBoxDimensions ───

console.log("\x1b[1m  Integration\x1b[0m");

const expectedContent80: Record<string, number> = {
  card: 76,
  text: 80,
  hero: 80,
  table: 78,
  quote: 74,
  badge: 80,
  progressBar: 80,
  link: 80,
  list: 80,
  section: 80,
  divider: 80,
  spacer: 80,
  timeline: 74,
  gallery: 80,
  image: 78,
  markdown: 80,
  menu: 80,
  accordion: 76,
  tabs: 76,
  scrollView: 80,
  textInput: 76,
  textArea: 76,
  select: 76,
  checkbox: 80,
  toggle: 80,
  radioGroup: 80,
  numberInput: 76,
  searchInput: 76,
  button: 72,
  form: 76,
  box: 80,
};

for (const [type, expectedW] of Object.entries(expectedContent80)) {
  const dims = computeBoxDimensions(80, COMPONENT_DEFAULTS[type]);
  assertEqual(dims.content, expectedW, `${type} at width 80 → content = ${expectedW}`);
}

// ─── Edge cases ──────────────────────────────────────────

console.log("\x1b[1m  Edge cases\x1b[0m");

// Very narrow terminal — card still gives non-negative
{
  const dims = computeBoxDimensions(3, COMPONENT_DEFAULTS.card);
  assertEqual(dims.content, 0, "card at width 3 → content = max(0, 3-4) = 0");
}

// width=1
{
  const dims = computeBoxDimensions(1, { border: true });
  assertEqual(dims.content, 0, "border at width 1 → content = 0");
}

// Large width
{
  const dims = computeBoxDimensions(200, COMPONENT_DEFAULTS.card);
  assertEqual(dims.content, 196, "card at width 200 → content = 196");
}

// ─── Summary ─────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`  \x1b[32m${passed} passed\x1b[0m, 0 failed`);
} else {
  console.log(`  \x1b[31m${failed} failed\x1b[0m, ${passed} passed`);
  process.exit(1);
}
