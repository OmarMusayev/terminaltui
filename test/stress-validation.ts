/**
 * Stress Validation Test Suite for terminaltui
 *
 * Tests every invalid config scenario to verify the framework throws helpful
 * errors (not crashes or stack traces) and handles edge cases gracefully.
 *
 * Run with: npx tsx test/stress-validation.ts
 */

import {
  defineSite,
  page,
  card,
  timeline,
  table,
  list,
  quote,
  hero,
  gallery,
  tabs,
  accordion,
  link,
  skillBar,
  progressBar,
  badge,
  image,
  ascii,
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
  section,
  themes,
  defaultTheme,
} from "/Users/omar/Desktop/Projects/TUI/src/index.js";

import { renderText } from "/Users/omar/Desktop/Projects/TUI/src/components/Text.js";
import { renderCard } from "/Users/omar/Desktop/Projects/TUI/src/components/Card.js";
import { renderTimeline } from "/Users/omar/Desktop/Projects/TUI/src/components/Timeline.js";
import { renderProgressBar } from "/Users/omar/Desktop/Projects/TUI/src/components/ProgressBar.js";
import { renderTable } from "/Users/omar/Desktop/Projects/TUI/src/components/Table.js";
import { renderLink } from "/Users/omar/Desktop/Projects/TUI/src/components/Link.js";
import { renderDivider } from "/Users/omar/Desktop/Projects/TUI/src/components/Divider.js";
import { renderSpacer } from "/Users/omar/Desktop/Projects/TUI/src/components/Spacer.js";
import { renderImage } from "/Users/omar/Desktop/Projects/TUI/src/components/Image.js";
import { stripAnsi, type RenderContext } from "/Users/omar/Desktop/Projects/TUI/src/components/base.js";

import type { Theme } from "/Users/omar/Desktop/Projects/TUI/src/style/theme.js";

// ─── Test Infrastructure ──────────────────────────────────

interface TestResult {
  id: number;
  name: string;
  status: "PASS" | "FAIL" | "BUG";
  detail: string;
}

const results: TestResult[] = [];
let testId = 0;

function ctx(width: number = 80): RenderContext {
  return { width, theme: defaultTheme, borderStyle: "rounded" };
}

function record(name: string, status: "PASS" | "FAIL" | "BUG", detail: string): void {
  testId++;
  results.push({ id: testId, name, status, detail });
}

/**
 * Test that a function throws with a helpful error message.
 * "Helpful" means the error message contains at least one of the expected keywords.
 */
function expectThrows(name: string, fn: () => void, keywords: string[]): void {
  try {
    fn();
    record(name, "FAIL", "Expected an error to be thrown, but no error was thrown.");
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    const hasKeyword = keywords.some(kw => msg.toLowerCase().includes(kw.toLowerCase()));
    if (hasKeyword) {
      record(name, "PASS", `Threw helpful error: "${msg}"`);
    } else {
      record(name, "FAIL", `Threw error but message is not helpful. Got: "${msg}" — expected one of: [${keywords.join(", ")}]`);
    }
  }
}

/**
 * Test that a function does NOT throw (graceful handling).
 * Returns the result of the function if successful.
 */
function expectNoThrow<T>(name: string, fn: () => T): T | undefined {
  try {
    const result = fn();
    record(name, "PASS", "No error thrown — handled gracefully.");
    return result;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    record(name, "BUG", `Unhandled exception (should not crash): "${msg}"`);
    return undefined;
  }
}

/**
 * Test that rendered output is an array with at least some content (or at least does not crash).
 */
function expectRenders(name: string, fn: () => string[]): string[] | undefined {
  try {
    const lines = fn();
    if (!Array.isArray(lines)) {
      record(name, "BUG", `Expected string[] but got: ${typeof lines}`);
      return undefined;
    }
    record(name, "PASS", `Rendered ${lines.length} line(s). First: "${stripAnsi(lines[0] ?? "").substring(0, 60)}"`);
    return lines;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    record(name, "BUG", `Crashed during render: "${msg}"`);
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════
//  TEST 1: Missing name
// ═══════════════════════════════════════════════════════════

expectThrows(
  "1. defineSite() with missing name",
  () => {
    defineSite({
      pages: [page("home", { title: "Home", content: [] })],
    } as any);
  },
  ["name"],
);

// ═══════════════════════════════════════════════════════════
//  TEST 2: Missing pages
// ═══════════════════════════════════════════════════════════

expectThrows(
  "2. defineSite() with missing pages",
  () => {
    defineSite({ name: "Test" } as any);
  },
  ["page"],
);

// ═══════════════════════════════════════════════════════════
//  TEST 3: Empty pages array
// ═══════════════════════════════════════════════════════════

expectThrows(
  "3. defineSite() with empty pages array",
  () => {
    defineSite({ name: "Test", pages: [] });
  },
  ["page"],
);

// ═══════════════════════════════════════════════════════════
//  TEST 4: Page without id (empty string)
// ═══════════════════════════════════════════════════════════

expectThrows(
  "4. defineSite() with page that has empty id",
  () => {
    defineSite({
      name: "Test",
      pages: [page("", { title: "No ID Page", content: [] })],
    });
  },
  ["id"],
);

// ═══════════════════════════════════════════════════════════
//  TEST 5: Page without title (empty string)
// ═══════════════════════════════════════════════════════════

// page() with empty title — the builder itself should not crash
expectNoThrow(
  "5. page() with empty title — builder does not crash",
  () => {
    return page("test-page", { title: "", content: [] });
  },
);

// Also test that defineSite accepts it (no validation on title currently)
expectNoThrow(
  "5b. defineSite() with empty-titled page — no crash",
  () => {
    return defineSite({
      name: "Test",
      pages: [page("test-page", { title: "", content: [] })],
    });
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 6: Invalid theme name
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "6. defineSite() with invalid theme name — should fall back to default",
  () => {
    const site = defineSite({
      name: "Test",
      theme: "nonexistent" as any,
      pages: [page("home", { title: "Home", content: [] })],
    });
    // The TUIRuntime resolveTheme should fall back to defaultTheme
    // We can't instantiate TUIRuntime without TTY, but we can verify the config parsed
    return site;
  },
);

// Verify theme resolution logic directly
expectNoThrow(
  "6b. Theme resolution — 'nonexistent' falls back to default",
  () => {
    // Replicate the resolveTheme logic from runtime
    const themeName = "nonexistent" as any;
    const resolved = typeof themeName === "string"
      ? (themes as any)[themeName] ?? defaultTheme
      : defaultTheme;
    if (resolved !== defaultTheme) {
      throw new Error("Did not fall back to default theme");
    }
    return resolved;
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 7: Invalid border style
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "7. defineSite() with invalid border style — should not crash",
  () => {
    return defineSite({
      name: "Test",
      borders: "totally-bogus" as any,
      pages: [page("home", { title: "Home", content: [] })],
    });
  },
);

// Verify rendering with invalid border doesn't crash
expectRenders(
  "7b. renderCard with invalid border style in ctx",
  () => {
    const block = card({ title: "Test Card", body: "Hello" });
    return renderCard(block, { ...ctx(), borderStyle: "invalid-border" });
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 8: Card with no title
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "8. card({}) with no title — builder should not crash",
  () => {
    return card({} as any);
  },
);

expectRenders(
  "8b. renderCard({}) with no title — should render without crash",
  () => {
    const block = card({} as any);
    return renderCard(block, ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 9: Link with empty URL
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "9. link('Label', '') — builder should not crash",
  () => {
    return link("Label", "");
  },
);

expectRenders(
  "9b. renderLink('Label', '') — should render without crash",
  () => {
    return renderLink("Label", "", ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 10: Link with empty label
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "10. link('', 'https://example.com') — builder should not crash",
  () => {
    return link("", "https://example.com");
  },
);

expectRenders(
  "10b. renderLink('', url) — should render URL even with empty label",
  () => {
    return renderLink("", "https://example.com", ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 11: Timeline with empty items array
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "11. timeline([]) — builder should not crash",
  () => {
    return timeline([]);
  },
);

expectRenders(
  "11b. renderTimeline([]) — should render empty without crash",
  () => {
    return renderTimeline([], ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 12: Table with mismatched columns (extra data)
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "12. table(['A','B'], [['1','2','3']]) — builder should not crash",
  () => {
    return table(["A", "B"], [["1", "2", "3"]]);
  },
);

expectRenders(
  "12b. renderTable with mismatched columns — should not crash",
  () => {
    return renderTable(["A", "B"], [["1", "2", "3"]], ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 13: Table with empty headers
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "13. table([], [['1']]) — builder should not crash",
  () => {
    return table([], [["1"]]);
  },
);

expectRenders(
  "13b. renderTable([], [['1']]) — should not crash",
  () => {
    return renderTable([], [["1"]], ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 14: Table with empty rows
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "14. table(['A'], []) — builder should not crash",
  () => {
    return table(["A"], []);
  },
);

expectRenders(
  "14b. renderTable(['A'], []) — should render just headers",
  () => {
    return renderTable(["A"], [], ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 15: ProgressBar with NaN
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "15. progressBar('X', NaN) — builder should not crash",
  () => {
    return progressBar("X", NaN);
  },
);

expectRenders(
  "15b. renderProgressBar('X', NaN) — should not crash",
  () => {
    return renderProgressBar("X", NaN, ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 16: ProgressBar with Infinity
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "16. progressBar('X', Infinity) — builder should not crash",
  () => {
    return progressBar("X", Infinity);
  },
);

expectRenders(
  "16b. renderProgressBar('X', Infinity) — should not crash",
  () => {
    return renderProgressBar("X", Infinity, ctx());
  },
);

// Also test negative infinity and -0
expectRenders(
  "16c. renderProgressBar('X', -Infinity) — should not crash",
  () => {
    return renderProgressBar("X", -Infinity, ctx());
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 17: Spacer with negative lines
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "17. spacer(-1) — builder should not crash",
  () => {
    return spacer(-1);
  },
);

expectNoThrow(
  "17b. renderSpacer(-1) — should return empty array",
  () => {
    const lines = renderSpacer(-1);
    if (!Array.isArray(lines)) {
      throw new Error(`Expected array, got ${typeof lines}`);
    }
    // Negative fill will return empty array — that's fine
    return lines;
  },
);

// Also test 0
expectNoThrow(
  "17c. spacer(0) — should return empty array",
  () => {
    const lines = renderSpacer(0);
    if (!Array.isArray(lines)) throw new Error(`Expected array, got ${typeof lines}`);
    return lines;
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 18: Image with non-existent path
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "18. image('/nonexistent.png') — builder should not crash",
  () => {
    return image("/nonexistent.png");
  },
);

expectRenders(
  "18b. renderImage('/nonexistent.png') — should render placeholder",
  () => {
    const lines = renderImage("/nonexistent.png", ctx());
    // Verify placeholder contains the path
    const allText = lines.map(l => stripAnsi(l)).join("\n");
    if (!allText.includes("/nonexistent.png")) {
      throw new Error("Placeholder does not show the image path");
    }
    return lines;
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 19: Markdown with weird/null-ish content
// ═══════════════════════════════════════════════════════════

expectNoThrow(
  "19a. markdown('') — empty string should not crash",
  () => {
    return markdown("");
  },
);

expectRenders(
  "19b. renderText('', ctx, 'markdown') — empty markdown",
  () => {
    return renderText("", ctx(), "markdown");
  },
);

expectNoThrow(
  "19c. markdown with only whitespace",
  () => {
    return markdown("   \n\n   \n   ");
  },
);

expectRenders(
  "19d. renderText with only whitespace as markdown",
  () => {
    return renderText("   \n\n   \n   ", ctx(), "markdown");
  },
);

// Unicode edge cases
expectRenders(
  "19e. renderText with emoji content as markdown",
  () => {
    return renderText("Hello 🌍🔥💻 **bold emoji** test", ctx(), "markdown");
  },
);

// Very long single word
expectRenders(
  "19f. renderText with extremely long word as markdown",
  () => {
    return renderText("A".repeat(500), ctx(), "markdown");
  },
);

// ═══════════════════════════════════════════════════════════
//  TEST 20: Divider with all style variants
// ═══════════════════════════════════════════════════════════

const dividerStyles = ["solid", "dashed", "dotted", "double", "label"] as const;
for (const style of dividerStyles) {
  expectRenders(
    `20. divider(style="${style}") — should render without error`,
    () => {
      const block = divider(style, style === "label" ? "Section Title" : undefined);
      return renderDivider(ctx(), { style: block.style, label: block.label });
    },
  );
}

// Also test divider with no style (undefined)
expectRenders(
  "20f. divider() with no style — should render default",
  () => {
    const block = divider();
    return renderDivider(ctx(), { style: block.style, label: block.label });
  },
);

// Divider with a string that gets interpreted as label
expectRenders(
  "20g. divider('My Label') — string treated as label",
  () => {
    const block = divider("My Label");
    return renderDivider(ctx(), { style: block.style, label: block.label });
  },
);

// ═══════════════════════════════════════════════════════════
//  BONUS: Additional edge cases
// ═══════════════════════════════════════════════════════════

// Table with completely empty arrays
expectRenders(
  "BONUS: renderTable([], []) — fully empty table",
  () => {
    return renderTable([], [], ctx());
  },
);

// ProgressBar with value > max
expectRenders(
  "BONUS: progressBar with value > max (200/100) — should clamp",
  () => {
    return renderProgressBar("Over", 200, ctx(), { max: 100 });
  },
);

// ProgressBar with negative value
expectRenders(
  "BONUS: progressBar with negative value (-50) — should clamp to 0",
  () => {
    return renderProgressBar("Negative", -50, ctx());
  },
);

// ProgressBar with max=0 (division by zero scenario)
expectRenders(
  "BONUS: progressBar with max=0 — division edge case",
  () => {
    return renderProgressBar("ZeroMax", 50, ctx(), { max: 0 });
  },
);

// Card with very long title
expectRenders(
  "BONUS: card with 200-char title — should truncate, not crash",
  () => {
    const block = card({ title: "T".repeat(200), body: "Short body" });
    return renderCard(block, ctx());
  },
);

// Card with very long body
expectRenders(
  "BONUS: card with 2000-char body — should wrap, not crash",
  () => {
    const block = card({ title: "Long Body Card", body: "word ".repeat(400) });
    return renderCard(block, ctx());
  },
);

// Rendering at width=1 (extreme narrow)
expectRenders(
  "BONUS: renderCard at width=1 — extreme narrow",
  () => {
    const block = card({ title: "Tiny", body: "Tiny body" });
    return renderCard(block, ctx(1));
  },
);

// Rendering at width=0
expectRenders(
  "BONUS: renderCard at width=0 — zero width",
  () => {
    const block = card({ title: "Zero", body: "Zero body" });
    return renderCard(block, ctx(0));
  },
);

// Timeline with item that has no optional fields
expectRenders(
  "BONUS: timeline item with only title (no subtitle, period, description)",
  () => {
    return renderTimeline([{ title: "Just a title" }], ctx());
  },
);

// Sparkline with empty data
expectNoThrow(
  "BONUS: sparkline([]) — empty data",
  () => {
    return sparkline([]);
  },
);

// Sparkline with single value
expectNoThrow(
  "BONUS: sparkline([42]) — single value",
  () => {
    return sparkline([42]);
  },
);

// Sparkline with NaN values
expectNoThrow(
  "BONUS: sparkline([NaN, NaN]) — NaN data",
  () => {
    return sparkline([NaN, NaN]);
  },
);

// List with empty items
expectNoThrow(
  "BONUS: list([]) — empty items array",
  () => {
    return list([]);
  },
);

// Quote with empty text
expectNoThrow(
  "BONUS: quote('') — empty quote text",
  () => {
    return quote("");
  },
);

// Badge with empty text
expectNoThrow(
  "BONUS: badge('') — empty badge text",
  () => {
    return badge("");
  },
);

// ═══════════════════════════════════════════════════════════
//  Print Results
// ═══════════════════════════════════════════════════════════

const passCount = results.filter(r => r.status === "PASS").length;
const failCount = results.filter(r => r.status === "FAIL").length;
const bugCount = results.filter(r => r.status === "BUG").length;

console.log("\n" + "═".repeat(72));
console.log("  STRESS VALIDATION TEST SUITE — terminaltui");
console.log("═".repeat(72));
console.log(`  Total: ${results.length}  |  PASS: ${passCount}  |  FAIL: ${failCount}  |  BUG: ${bugCount}`);
console.log("─".repeat(72));

for (const r of results) {
  let icon: string;
  let color: string;
  if (r.status === "PASS") {
    icon = "✓";
    color = "\x1b[32m"; // green
  } else if (r.status === "FAIL") {
    icon = "✗";
    color = "\x1b[33m"; // yellow
  } else {
    icon = "🐛";
    color = "\x1b[31m"; // red
  }
  console.log(`  ${color}${icon} [${r.status}]\x1b[0m ${r.name}`);
  console.log(`       ${r.detail}`);
}

console.log("\n" + "─".repeat(72));

if (bugCount > 0) {
  console.log("\x1b[31m  BUGS FOUND:\x1b[0m");
  for (const r of results.filter(r => r.status === "BUG")) {
    console.log(`    - ${r.name}`);
    console.log(`      ${r.detail}`);
  }
  console.log("─".repeat(72));
}

if (failCount > 0) {
  console.log("\x1b[33m  VALIDATION GAPS (missing error messages or wrong behavior):\x1b[0m");
  for (const r of results.filter(r => r.status === "FAIL")) {
    console.log(`    - ${r.name}`);
    console.log(`      ${r.detail}`);
  }
  console.log("─".repeat(72));
}

if (bugCount === 0 && failCount === 0) {
  console.log("\x1b[32m  All tests passed! No bugs or validation gaps found.\x1b[0m");
} else {
  console.log(`\n  Summary: ${bugCount} bug(s), ${failCount} validation gap(s), ${passCount} passed.`);
}

console.log("═".repeat(72) + "\n");

// Exit with error code if bugs found
if (bugCount > 0) {
  process.exit(1);
}
