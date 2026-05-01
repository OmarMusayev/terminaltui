/**
 * Unit tests for Select and RadioGroup component rendering.
 *
 * Run with: npx tsx test/test-select-radio.ts
 */

import { select, radioGroup } from "../src/index.js";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { renderSelect } from "../src/components/Select.js";
import { renderRadioGroup } from "../src/components/RadioGroup.js";
import type { RenderContext } from "../src/components/base.js";
import { stripAnsi, stringWidth } from "../src/components/base.js";
import { themes, defaultTheme } from "../src/style/theme.js";
import type { Theme } from "../src/style/theme.js";
import type { SelectBlock, RadioGroupBlock } from "../src/config/types.js";
import { fgColor, setColorMode } from "../src/style/colors.js";

// Force truecolor mode so ANSI output is deterministic in test
setColorMode("truecolor");

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2714\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m\u2718\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function createCtx(width: number = 80, theme: Theme = defaultTheme, focused: boolean = false): RenderContext {
  return { width, theme, borderStyle: "rounded", focused };
}

// ─── Test Data ────────────────────────────────────────────

const selectConfig: SelectBlock = select({
  id: "color",
  label: "Favorite Color",
  options: [
    { label: "Red", value: "red" },
    { label: "Green", value: "green" },
    { label: "Blue", value: "blue" },
  ],
  placeholder: "Pick a color...",
});

const radioConfig: RadioGroupBlock = radioGroup({
  id: "size",
  label: "T-Shirt Size",
  options: [
    { label: "Small", value: "sm" },
    { label: "Medium", value: "md" },
    { label: "Large", value: "lg" },
    { label: "X-Large", value: "xl" },
  ],
  defaultValue: "md",
});

// ═══════════════════════════════════════════════════════════
// SELECT — COLLAPSED
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Select — Collapsed\x1b[0m\n");

test("Collapsed select renders without error", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  assert(lines.length > 0, "should render at least one line");
});

test("Collapsed select shows the label", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("Favorite Color"), `label not found in output: ${plain}`);
});

test("Collapsed select shows placeholder when no value selected", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("Pick a color..."), `placeholder not found in output: ${plain}`);
});

test("Collapsed select shows down arrow indicator", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("\u25be"), `down arrow \u25be not found in output: ${plain}`);
});

test("Collapsed select shows selected value label", () => {
  const ctx = createCtx(80);
  const state = { value: "green", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("Green"), `selected value 'Green' not found in output: ${plain}`);
});

test("Collapsed select does NOT show option list", () => {
  const ctx = createCtx(80);
  const state = { value: "red", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  // In collapsed mode, the options list should NOT appear
  // (Red is shown as the selected value, but Blue/Green should not be listed)
  assert(!plain.includes("Blue"), `collapsed select should not list 'Blue': ${plain}`);
  assert(!plain.includes("Green"), `collapsed select should not list 'Green': ${plain}`);
});

// ═══════════════════════════════════════════════════════════
// SELECT — EXPANDED
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Select — Expanded\x1b[0m\n");

test("Expanded select renders without error", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: true, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  assert(lines.length > 0, "should render at least one line");
});

test("Expanded select shows all options", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: true, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("Red"), `'Red' not found in options list`);
  assert(plain.includes("Green"), `'Green' not found in options list`);
  assert(plain.includes("Blue"), `'Blue' not found in options list`);
});

test("Expanded select shows highlight indicator on selected option", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: true, highlightIndex: 1 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  // The highlighted option should have the cursor indicator
  assert(plain.includes("\u276f"), `highlight indicator \u276f not found in output: ${plain}`);
  // Find the line with Green and check it has the indicator
  const greenLine = lines.find(l => stripAnsi(l).includes("Green"));
  assert(greenLine !== undefined, "should find a line with Green");
  assert(stripAnsi(greenLine!).includes("\u276f"), `Green line should have \u276f indicator`);
});

test("Expanded select shows up arrow indicator", () => {
  const ctx = createCtx(80);
  const state = { value: "", open: true, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("\u25b4"), `up arrow \u25b4 not found in expanded select: ${plain}`);
});

test("Expanded select renders more lines than collapsed", () => {
  const ctx = createCtx(80);
  const collapsed = renderSelect(selectConfig, { value: "", open: false, highlightIndex: 0 }, ctx);
  const expanded = renderSelect(selectConfig, { value: "", open: true, highlightIndex: 0 }, ctx);
  assert(expanded.length > collapsed.length, `expanded (${expanded.length} lines) should have more lines than collapsed (${collapsed.length} lines)`);
});

// ═══════════════════════════════════════════════════════════
// RADIOGROUP
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  RadioGroup\x1b[0m\n");

test("RadioGroup renders without error", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  assert(lines.length > 0, "should render at least one line");
});

test("RadioGroup shows the label", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("T-Shirt Size"), `label not found in output: ${plain}`);
});

test("RadioGroup shows all option labels", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("Small"), `'Small' not found`);
  assert(plain.includes("Medium"), `'Medium' not found`);
  assert(plain.includes("Large"), `'Large' not found`);
  assert(plain.includes("X-Large"), `'X-Large' not found`);
});

test("RadioGroup shows filled circle for selected option", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  // Find the line with "Medium" (selected) — it should have filled radio
  const mediumLine = lines.find(l => stripAnsi(l).includes("Medium"));
  assert(mediumLine !== undefined, "should find a line with Medium");
  assert(stripAnsi(mediumLine!).includes("\u25c9"), `Medium line should have filled radio \u25c9`);
});

test("RadioGroup shows empty circle for unselected options", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  // Find a line with "Small" (unselected) — it should have empty radio
  const smallLine = lines.find(l => stripAnsi(l).includes("Small"));
  assert(smallLine !== undefined, "should find a line with Small");
  assert(stripAnsi(smallLine!).includes("\u25cb"), `Small line should have empty radio \u25cb`);
});

test("RadioGroup has exactly one filled circle", () => {
  const ctx = createCtx(80);
  const state = { value: "lg", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  const filledCount = (plain.match(/\u25c9/g) || []).length;
  const emptyCount = (plain.match(/\u25cb/g) || []).length;
  assertEqual(filledCount, 1, "filled radio count");
  assertEqual(emptyCount, 3, "empty radio count");
});

test("RadioGroup renders correct count of lines (label + options)", () => {
  const ctx = createCtx(80);
  const state = { value: "md", highlightIndex: 0 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  // 1 label line + 4 option lines = 5
  assertEqual(lines.length, 5, "line count");
});

// ═══════════════════════════════════════════════════════════
// MULTI-WIDTH RENDERING
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Multi-Width Rendering\x1b[0m\n");

for (const width of [40, 80, 100]) {
  test(`Select collapsed renders at width ${width} without overflow`, () => {
    const ctx = createCtx(width);
    const state = { value: "red", open: false, highlightIndex: 0 };
    const lines = renderSelect(selectConfig, state, ctx);
    assert(lines.length > 0, "should render lines");
    for (let i = 0; i < lines.length; i++) {
      const w = stringWidth(lines[i]);
      assert(w <= width + 2, `line ${i} overflows: ${w} > ${width} -- "${stripAnsi(lines[i])}"`);
    }
  });

  test(`Select expanded renders at width ${width} without overflow`, () => {
    const ctx = createCtx(width);
    const state = { value: "", open: true, highlightIndex: 2 };
    const lines = renderSelect(selectConfig, state, ctx);
    assert(lines.length > 0, "should render lines");
    for (let i = 0; i < lines.length; i++) {
      const w = stringWidth(lines[i]);
      assert(w <= width + 2, `line ${i} overflows: ${w} > ${width} -- "${stripAnsi(lines[i])}"`);
    }
  });

  test(`RadioGroup renders at width ${width} without overflow`, () => {
    const ctx = createCtx(width);
    const state = { value: "sm", highlightIndex: 0 };
    const lines = renderRadioGroup(radioConfig, state, ctx);
    assert(lines.length > 0, "should render lines");
    for (let i = 0; i < lines.length; i++) {
      const w = stringWidth(lines[i]);
      assert(w <= width + 2, `line ${i} overflows: ${w} > ${width} -- "${stripAnsi(lines[i])}"`);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// FOCUSED STATE
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Focused State\x1b[0m\n");

test("Focused select collapsed uses accent color in label", () => {
  const theme = themes.cyberpunk;
  const ctx = createCtx(80, theme, true);
  const state = { value: "red", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const labelLine = lines[0];
  const accentAnsi = fgColor(theme.accent);
  assert(labelLine.includes(accentAnsi),
    `focused label should render with accent color ANSI sequence`);
});

test("Unfocused select collapsed uses text color in label", () => {
  const theme = themes.cyberpunk;
  const ctx = createCtx(80, theme, false);
  const state = { value: "red", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const labelLine = lines[0];
  const textAnsi = fgColor(theme.text);
  assert(labelLine.includes(textAnsi),
    `unfocused label should use text color ANSI sequence`);
});

test("Focused radioGroup uses accent color in label", () => {
  const theme = themes.nord;
  const ctx = createCtx(80, theme, true);
  const state = { value: "md", highlightIndex: 1 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const labelLine = lines[0];
  const accentAnsi = fgColor(theme.accent);
  assert(labelLine.includes(accentAnsi),
    `focused radioGroup label should include accent color ANSI sequence`);
});

test("Unfocused radioGroup uses text color in label", () => {
  const theme = themes.nord;
  const ctx = createCtx(80, theme, false);
  const state = { value: "md", highlightIndex: 1 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const labelLine = lines[0];
  const textAnsi = fgColor(theme.text);
  assert(labelLine.includes(textAnsi),
    `unfocused radioGroup label should include text color ANSI sequence`);
});

test("Focused select collapsed has accent-colored border", () => {
  const theme = themes.dracula;
  const ctx = createCtx(60, theme, true);
  const state = { value: "blue", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const borderLine = lines[1];
  const accentAnsi = fgColor(theme.accent);
  assert(borderLine !== undefined, "should have a border line");
  assert(borderLine.includes(accentAnsi),
    `focused select border should include accent color ANSI sequence`);
});

test("Unfocused select collapsed has normal border color", () => {
  const theme = themes.dracula;
  const ctx = createCtx(60, theme, false);
  const state = { value: "blue", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const borderLine = lines[1];
  const borderAnsi = fgColor(theme.border);
  assert(borderLine !== undefined, "should have a border line");
  assert(borderLine.includes(borderAnsi),
    `unfocused select border should include border color ANSI sequence`);
});

// ═══════════════════════════════════════════════════════════
// THEME VARIATIONS
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Theme Variations\x1b[0m\n");

for (const [themeName, theme] of Object.entries(themes).slice(0, 4)) {
  test(`Select renders with ${themeName} theme`, () => {
    const ctx = createCtx(80, theme);
    const state = { value: "red", open: false, highlightIndex: 0 };
    const lines = renderSelect(selectConfig, state, ctx);
    assert(lines.length > 0, "should render lines");
    const plain = lines.map(l => stripAnsi(l)).join("\n");
    assert(plain.includes("Favorite Color"), "should contain label");
  });

  test(`RadioGroup renders with ${themeName} theme`, () => {
    const ctx = createCtx(80, theme);
    const state = { value: "md", highlightIndex: 0 };
    const lines = renderRadioGroup(radioConfig, state, ctx);
    assert(lines.length > 0, "should render lines");
    const plain = lines.map(l => stripAnsi(l)).join("\n");
    assert(plain.includes("T-Shirt Size"), "should contain label");
  });
}

// ═══════════════════════════════════════════════════════════
// INTEGRATION — VirtualTerminal + ScreenReader
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  VirtualTerminal Integration\x1b[0m\n");

test("Select output writes to VirtualTerminal and is readable", () => {
  const ctx = createCtx(60);
  const state = { value: "green", open: false, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const vt = new VirtualTerminal(60, 20);
  vt.write(lines.join("\n"));
  const sr = new ScreenReader(vt);
  assert(sr.contains("Favorite Color"), "label visible in vterm");
  assert(sr.contains("Green"), "selected value visible in vterm");
});

test("RadioGroup output writes to VirtualTerminal and is readable", () => {
  const ctx = createCtx(60);
  const state = { value: "lg", highlightIndex: 2 };
  const lines = renderRadioGroup(radioConfig, state, ctx);
  const vt = new VirtualTerminal(60, 20);
  vt.write(lines.join("\n"));
  const sr = new ScreenReader(vt);
  assert(sr.contains("T-Shirt Size"), "label visible in vterm");
  assert(sr.contains("Large"), "selected option visible in vterm");
  assert(sr.contains("Small"), "unselected option visible in vterm");
});

test("Expanded select with options renders in VirtualTerminal", () => {
  const ctx = createCtx(60);
  const state = { value: "", open: true, highlightIndex: 0 };
  const lines = renderSelect(selectConfig, state, ctx);
  const vt = new VirtualTerminal(60, 30);
  vt.write(lines.join("\n"));
  const sr = new ScreenReader(vt);
  assert(sr.contains("Red"), "option Red visible");
  assert(sr.contains("Green"), "option Green visible");
  assert(sr.contains("Blue"), "option Blue visible");
});

// ═══════════════════════════════════════════════════════════
// PARSER HELPERS
// ═══════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Parser Helpers\x1b[0m\n");

test("select() parser returns correct type", () => {
  const block = select({ id: "test", label: "Test", options: [{ label: "A", value: "a" }] });
  assertEqual(block.type, "select", "type");
  assertEqual(block.id, "test", "id");
  assertEqual(block.label, "Test", "label");
  assertEqual(block.options.length, 1, "options length");
});

test("radioGroup() parser returns correct type", () => {
  const block = radioGroup({ id: "test", label: "Test", options: [{ label: "A", value: "a" }] });
  assertEqual(block.type, "radioGroup", "type");
  assertEqual(block.id, "test", "id");
  assertEqual(block.label, "Test", "label");
  assertEqual(block.options.length, 1, "options length");
});

test("select() and radioGroup() compose as content blocks", () => {
  const blocks = [
    select({
      id: "lang",
      label: "Language",
      options: [
        { label: "TypeScript", value: "ts" },
        { label: "Rust", value: "rs" },
      ],
    }),
    radioGroup({
      id: "level",
      label: "Level",
      options: [
        { label: "Beginner", value: "beg" },
        { label: "Advanced", value: "adv" },
      ],
    }),
  ];
  assertEqual(blocks.length, 2, "two content blocks");
  assertEqual(blocks[0].type, "select", "first block is select");
  assertEqual(blocks[1].type, "radioGroup", "second block is radioGroup");
});

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
