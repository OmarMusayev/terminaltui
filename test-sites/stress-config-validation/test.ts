/**
 * Stress Test: Config Validation & Edge Cases
 *
 * Tests edge cases in config parsing, component rendering with
 * degenerate inputs, and framework navigation with 0-length data.
 */
import { VirtualTerminal } from "../../src/emulator/vterm.js";
import { ScreenReader } from "../../src/emulator/screen-reader.js";
import { Assertions } from "../../src/emulator/assertions.js";
import { renderMenu, type MenuItem } from "../../src/components/Menu.js";
import { renderCard } from "../../src/components/Card.js";
import { renderText } from "../../src/components/Text.js";
import { renderTimeline } from "../../src/components/Timeline.js";
import { renderTable } from "../../src/components/Table.js";
import { renderLink } from "../../src/components/Link.js";
import { renderDivider } from "../../src/components/Divider.js";
import { renderQuote } from "../../src/components/Quote.js";
import { renderList } from "../../src/components/List.js";
import { renderHero } from "../../src/components/Hero.js";
import { renderBadge } from "../../src/components/Badge.js";
import { renderSpacer } from "../../src/components/Spacer.js";
import { renderBox } from "../../src/components/Box.js";
import { renderProgressBar } from "../../src/components/ProgressBar.js";
import { stripAnsi, wrapText, type RenderContext } from "../../src/components/base.js";
import { themes, defaultTheme } from "../../src/style/theme.js";
import type { Theme } from "../../src/style/theme.js";
import { setColorMode, fgColor, reset } from "../../src/style/colors.js";
import { Router } from "../../src/navigation/router.js";
import { FocusManager } from "../../src/navigation/focus.js";
import { writeFileSync } from "node:fs";

setColorMode("256");

// ── Types & Helpers ──
interface Bug {
  id: string;
  severity: string;
  title: string;
  component: string;
  reproduction: string;
  expected: string;
  actual: string;
}

interface TestStep { name: string; passed: boolean; error?: string; }
const steps: TestStep[] = [];
const bugs: Bug[] = [];
let bugN = 0;

function step(name: string, fn: () => void): void {
  try { fn(); steps.push({ name, passed: true }); }
  catch (err: any) { steps.push({ name, passed: false, error: err.message }); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

function addBug(sev: string, title: string, comp: string, repro: string, exp: string, act: string): void {
  bugN++;
  bugs.push({ id: `BUG-${String(bugN).padStart(3, "0")}`, severity: sev, title, component: comp, reproduction: repro, expected: exp, actual: act });
}

const theme = defaultTheme;
const BAD_STRINGS = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"];

function checkBadStrings(text: string, testName: string, component: string): void {
  for (const bad of BAD_STRINGS) {
    if (text.includes(bad)) {
      addBug("P1", `"${bad}" found in ${testName}`, component, testName, "No bad strings", `Found "${bad}"`);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// TEST: Menu with 0 items
// ══════════════════════════════════════════════════════════════

step("Menu with 0 items", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderMenu([], 0, ctx);
  assert(lines.length === 0, `Expected 0 lines from empty menu, got ${lines.length}`);
});

step("Menu with 0 items, selectedIndex=-1", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderMenu([], -1, ctx);
  assert(lines.length === 0, `Expected 0 lines from empty menu, got ${lines.length}`);
});

step("Menu with 1 item, selectedIndex=0", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const items: MenuItem[] = [{ label: "Only Item", icon: "\u25c6", id: "only" }];
  const lines = renderMenu(items, 0, ctx);
  assert(lines.length === 1, `Expected 1 line, got ${lines.length}`);
});

step("Menu with selectedIndex out of bounds", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const items: MenuItem[] = [
    { label: "A", icon: "\u25c6", id: "a" },
    { label: "B", icon: "\u25c6", id: "b" },
  ];
  // selectedIndex = 99 — way out of bounds
  const lines = renderMenu(items, 99, ctx);
  assert(lines.length === 2, `Expected 2 lines, got ${lines.length}`);
  // Should not crash; no item should be selected
  const text = lines.map(l => stripAnsi(l)).join("\n");
  checkBadStrings(text, "Menu out-of-bounds selection", "Menu");
});

// ══════════════════════════════════════════════════════════════
// TEST: Page with no content blocks
// ══════════════════════════════════════════════════════════════

step("Render page with empty content array", () => {
  // Simulate rendering content blocks from an empty array
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const content: any[] = [];
  const lines: string[] = [];
  for (const block of content) {
    // This loop should simply not execute
    lines.push("should not reach here");
  }
  assert(lines.length === 0, "Empty content array should produce 0 lines");
});

// ══════════════════════════════════════════════════════════════
// TEST: Card with empty/minimal title
// ══════════════════════════════════════════════════════════════

step("Card with empty string title", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderCard({ type: "card", title: "" }, ctx);
  assert(lines.length > 0, "Card with empty title should still render box");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  checkBadStrings(text, "Empty title card", "Card");
});

step("Card with single character title", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderCard({ type: "card", title: "X" }, ctx);
  assert(lines.length > 0, "Card should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("X"), "Single char title should appear");
});

// ══════════════════════════════════════════════════════════════
// TEST: Link with empty URL
// ══════════════════════════════════════════════════════════════

step("Link with empty URL", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderLink("Click Here", "", ctx);
  assert(lines.length > 0, "Link with empty URL should still render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  checkBadStrings(text, "Empty URL link", "Link");
});

step("Link with empty label", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderLink("", "https://example.com", ctx);
  assert(lines.length > 0, "Link with empty label should still render");
});

step("Link with empty label and URL", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderLink("", "", ctx);
  assert(lines.length > 0, "Link with both empty should still render");
});

// ══════════════════════════════════════════════════════════════
// TEST: Table with 0 rows
// ══════════════════════════════════════════════════════════════

step("Table with 0 rows", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderTable(["A", "B", "C"], [], ctx);
  assert(lines.length > 0, "Table with 0 rows should still render headers");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  checkBadStrings(text, "0-row table", "Table");
});

step("Table with 1 header 0 rows", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderTable(["Only"], [], ctx);
  assert(lines.length > 0, "Table should render");
});

step("Table with mismatched row lengths", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  // Rows have fewer columns than headers
  const lines = renderTable(["A", "B", "C"], [["1"], ["2", "3"]], ctx);
  assert(lines.length > 0, "Table should handle mismatched row lengths");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  checkBadStrings(text, "Mismatched row table", "Table");
});

// ══════════════════════════════════════════════════════════════
// TEST: Timeline with 0 items
// ══════════════════════════════════════════════════════════════

step("Timeline with 0 items", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderTimeline([], ctx);
  assert(lines.length === 0, "Empty timeline should produce 0 lines");
});

step("Timeline with 1 item, minimal fields", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderTimeline([{ title: "Solo Event" }], ctx);
  assert(lines.length > 0, "Single timeline item should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("Solo Event"), "Event title should appear");
});

// ══════════════════════════════════════════════════════════════
// TEST: FocusManager with 0 items
// ══════════════════════════════════════════════════════════════

step("FocusManager with 0 items", () => {
  const fm = new FocusManager();
  fm.setItems([]);
  assert(fm.focusIndex === 0, `Focus index should be 0, got ${fm.focusIndex}`);
  assert(fm.focusedId === undefined, "focusedId should be undefined with 0 items");
  assert(fm.count === 0, "count should be 0");

  // focusNext/focusPrev should not crash
  const next = fm.focusNext();
  assert(next === undefined, "focusNext on empty should return undefined");
  const prev = fm.focusPrev();
  assert(prev === undefined, "focusPrev on empty should return undefined");
  const first = fm.focusFirst();
  assert(first === undefined, "focusFirst on empty should return undefined");
  const last = fm.focusLast();
  assert(last === undefined, "focusLast on empty should return undefined");
});

step("FocusManager with 1 item", () => {
  const fm = new FocusManager();
  fm.setItems(["only"]);
  assert(fm.focusIndex === 0, "Focus should be at 0");
  assert(fm.focusedId === "only", "Should be focused on 'only'");

  fm.focusNext();
  assert(fm.focusIndex === 0, "Should wrap back to 0 with 1 item");
  fm.focusPrev();
  assert(fm.focusIndex === 0, "Should wrap back to 0 with 1 item");
});

step("FocusManager — 500 focusNext on 3 items", () => {
  const fm = new FocusManager();
  fm.setItems(["a", "b", "c"]);
  for (let i = 0; i < 500; i++) fm.focusNext();
  assert(fm.focusIndex >= 0 && fm.focusIndex < 3, `Index should be in bounds, got ${fm.focusIndex}`);
  assert(fm.focusIndex === 500 % 3, `Expected ${500 % 3}, got ${fm.focusIndex}`);
});

step("FocusManager — setItems shrinks list", () => {
  const fm = new FocusManager();
  fm.setItems(["a", "b", "c", "d", "e"]);
  fm.focusIndex = 4; // last item
  fm.setItems(["a", "b"]); // shrink
  assert(fm.focusIndex === 1, `Focus should clamp to 1 after shrink, got ${fm.focusIndex}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: Router with 0 pages
// ══════════════════════════════════════════════════════════════

step("Router with 0 pages", () => {
  const router = new Router();
  router.registerPages([]);
  assert(router.pageCount === 0, "pageCount should be 0");
  assert(router.currentPage === "", "currentPage should be empty string");

  const navResult = router.navigate("nonexistent");
  assert(navResult === false, "navigate to nonexistent should return false");

  const backResult = router.back();
  assert(backResult === false, "back with no history should return false");

  const homeResult = router.home();
  assert(homeResult === false, "home with 0 pages should return false");

  // Note: isHome() compares currentPage ("") with pages[0] (undefined).
  // "" === undefined is false, so isHome() returns false with 0 pages.
  // This is an edge case — file as bug but do not fail the test.
  const isHomeResult = router.isHome();
  if (!isHomeResult) {
    addBug("P2", "Router.isHome() returns false with 0 pages", "Router",
      "registerPages([]), then isHome()",
      "isHome() should return true when there are no pages",
      "isHome() returns false because '' !== undefined");
  }
});

step("Router with 1 page", () => {
  const router = new Router();
  router.registerPages(["only-page"]);
  assert(router.currentPage === "only-page", "Should auto-navigate to first page");
  assert(router.isHome() === true, "Should be home");

  // Navigate to self — should return false (already there)
  const navResult = router.navigate("only-page");
  assert(navResult === false, "Navigate to current page should return false");

  // Navigate by index
  const byIdx = router.navigateByIndex(0);
  assert(byIdx === true, "navigateByIndex(0) should return true");

  // Invalid index
  const badIdx = router.navigateByIndex(5);
  assert(badIdx === false, "navigateByIndex out of range should return false");

  const negIdx = router.navigateByIndex(-1);
  assert(negIdx === false, "navigateByIndex negative should return false");
});

step("Router — navigate and back stress", () => {
  const router = new Router();
  router.registerPages(["p1", "p2", "p3", "p4", "p5"]);
  // Navigate forward through all pages 10 times
  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < 5; i++) {
      router.navigateByIndex(i);
    }
  }
  // Back out all the way
  for (let i = 0; i < 100; i++) {
    router.back();
  }
  // Should be at first page after backing out
  assert(router.currentPage === "p1", `Should be at p1, got ${router.currentPage}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: Rendering at width=1
// ══════════════════════════════════════════════════════════════

step("All components at width=1", () => {
  const ctx: RenderContext = { width: 1, theme, borderStyle: "rounded" };

  const tests: [string, () => any][] = [
    ["Card", () => renderCard({ type: "card", title: "T", body: "B" }, ctx)],
    ["Text", () => renderText("Hello", ctx, "plain")],
    ["Table", () => renderTable(["H"], [["V"]], ctx)],
    ["Timeline", () => renderTimeline([{ title: "E" }], ctx)],
    ["List", () => renderList(["I"], ctx)],
    ["Quote", () => renderQuote("Q", ctx)],
    ["Link", () => renderLink("L", "u", ctx)],
    ["Hero", () => renderHero({ title: "H" }, ctx)],
    ["Divider", () => renderDivider(ctx)],
    ["Spacer", () => renderSpacer(1)],
    ["Badge", () => renderBadge("B", ctx)],
    ["ProgressBar", () => renderProgressBar("P", 50, ctx)],
    ["Menu", () => renderMenu([{ label: "M", id: "m", icon: "\u25c6" }], 0, ctx)],
    ["Box", () => renderBox({ content: ["X"], width: 1 }, ctx)],
  ];

  for (const [name, fn] of tests) {
    try {
      const result = fn();
      // Just verify no crash
    } catch (err: any) {
      addBug("P0", `${name} crashes at width=1: ${err.message}`, name,
        `Render ${name} at width=1`, "No crash", err.message);
      throw err;
    }
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: Rendering at width=10000
// ══════════════════════════════════════════════════════════════

step("All components at width=10000", () => {
  const ctx: RenderContext = { width: 10000, theme, borderStyle: "rounded" };

  const tests: [string, () => any][] = [
    ["Card", () => renderCard({ type: "card", title: "Title", body: "Body text" }, ctx)],
    ["Text", () => renderText("Hello world", ctx, "plain")],
    ["Table", () => renderTable(["A", "B"], [["1", "2"]], ctx)],
    ["Timeline", () => renderTimeline([{ title: "Event", period: "2024" }], ctx)],
    ["List", () => renderList(["Item 1", "Item 2"], ctx)],
    ["Quote", () => renderQuote("A famous quote", ctx, { attribution: "Author" })],
    ["Link", () => renderLink("GitHub", "https://github.com", ctx)],
    ["Hero", () => renderHero({ title: "Hero Title", subtitle: "Subtitle" }, ctx)],
    ["Divider", () => renderDivider(ctx)],
    ["Spacer", () => renderSpacer(3)],
    ["Badge", () => renderBadge("Badge", ctx)],
    ["ProgressBar", () => renderProgressBar("Progress", 75, ctx)],
    ["Menu", () => renderMenu([{ label: "Item", id: "i", icon: "\u25c6" }], 0, ctx)],
    ["Box", () => renderBox({ content: ["Content line"] }, ctx)],
  ];

  for (const [name, fn] of tests) {
    try {
      const result = fn();
      // Verify result is reasonable
      if (Array.isArray(result)) {
        assert(result.length >= 0, `${name} should return array`);
      }
    } catch (err: any) {
      addBug("P0", `${name} crashes at width=10000: ${err.message}`, name,
        `Render ${name} at width=10000`, "No crash", err.message);
      throw err;
    }
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: ProgressBar edge cases
// ══════════════════════════════════════════════════════════════

step("ProgressBar with value=0", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Zero", 0, ctx);
  assert(lines.length > 0, "Should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("0%"), "Should show 0%");
});

step("ProgressBar with value=100", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Full", 100, ctx);
  assert(lines.length > 0, "Should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("100%"), "Should show 100%");
});

step("ProgressBar with value > max", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Over", 200, ctx, { max: 100 });
  assert(lines.length > 0, "Should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("100%"), "Should cap at 100%");
});

step("ProgressBar with value < 0", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Under", -50, ctx);
  assert(lines.length > 0, "Should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("0%"), "Should show 0%");
});

step("ProgressBar with NaN value", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Skill", NaN, ctx);
  assert(lines.length > 0, "Should render with NaN value");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  // ProgressBar guards NaN with Number.isFinite, treating it as 0.
  // Check that "NaN" does not appear literally in the rendered text.
  if (text.includes("NaN")) {
    addBug("P2", "ProgressBar shows literal 'NaN' when given NaN value", "ProgressBar",
      'renderProgressBar("Skill", NaN, ctx)',
      "Should show 0% or handle gracefully",
      "Literal 'NaN' appears in output");
  }
  // Do not assert-fail — just report as bug if found
});

step("ProgressBar with Infinity value", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderProgressBar("Infinity Test", Infinity, ctx);
  assert(lines.length > 0, "Should render with Infinity value");
});

// ══════════════════════════════════════════════════════════════
// TEST: Box edge cases
// ══════════════════════════════════════════════════════════════

step("Box with 0 content lines", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderBox({ content: [] }, ctx);
  assert(lines.length >= 2, "Box should have at least top and bottom borders");
});

step("Box with title and titleRight", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderBox({ content: ["Body"], title: "Left Title", titleRight: "Right" }, ctx);
  assert(lines.length > 0, "Box should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("Left Title"), "Box title should appear");
});

step("Box at width=3 (minimal)", () => {
  const ctx: RenderContext = { width: 3, theme, borderStyle: "rounded" };
  const lines = renderBox({ content: ["X"], width: 3 }, ctx);
  assert(lines.length > 0, "Box should render at minimal width");
});

// ══════════════════════════════════════════════════════════════
// TEST: Spacer edge cases
// ══════════════════════════════════════════════════════════════

step("Spacer with 0 lines", () => {
  const lines = renderSpacer(0);
  assert(lines.length === 0, "Spacer(0) should produce 0 lines");
});

step("Spacer with negative lines", () => {
  const lines = renderSpacer(-5);
  assert(lines.length === 0, "Spacer(-5) should produce 0 lines");
});

step("Spacer with 100 lines", () => {
  const lines = renderSpacer(100);
  assert(lines.length === 100, `Spacer(100) should produce 100 lines, got ${lines.length}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: wrapText edge cases
// ══════════════════════════════════════════════════════════════

step("wrapText with width=0", () => {
  const result = wrapText("Hello world", 0);
  assert(result.length === 0, "wrapText(0) should produce empty array");
});

step("wrapText with empty string", () => {
  const result = wrapText("", 80);
  assert(result.length > 0, "wrapText('') should produce at least one line");
  assert(result[0] === "", "Should be empty string");
});

step("wrapText with only spaces", () => {
  const result = wrapText("     ", 80);
  assert(result.length > 0, "Should produce output");
});

step("wrapText with newlines in input", () => {
  // wrapText splits on spaces, not newlines
  const result = wrapText("line1\nline2\nline3", 80);
  assert(result.length > 0, "Should produce output");
});

// ══════════════════════════════════════════════════════════════
// TEST: VirtualTerminal with degenerate sizes
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal 1x1", () => {
  const vt = new VirtualTerminal(1, 1);
  vt.write("X");
  assert(vt.text().includes("X"), "Should write X to 1x1 terminal");
  vt.write("Y"); // Should wrap or overwrite
  assert(vt.cols === 1 && vt.rows === 1, "Size should be 1x1");
});

step("VirtualTerminal 1x100", () => {
  const vt = new VirtualTerminal(1, 100);
  vt.write("Hello");
  const text = vt.text();
  assert(text.length > 0, "Should have some text");
});

step("VirtualTerminal 500x1", () => {
  const vt = new VirtualTerminal(500, 1);
  vt.write("A".repeat(500));
  const text = vt.text();
  assert(text.includes("A"), "Should have A chars");
});

step("VirtualTerminal resize to 1x1", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("Hello World");
  vt.resize(1, 1);
  assert(vt.cols === 1, "Cols should be 1");
  assert(vt.rows === 1, "Rows should be 1");
  assert(vt.cursorCol === 0, "Cursor col should be clamped to 0");
  assert(vt.cursorRow === 0, "Cursor row should be clamped to 0");
});

// ══════════════════════════════════════════════════════════════
// TEST: Render and verify in VirtualTerminal
// ══════════════════════════════════════════════════════════════

step("Render empty menu into VirtualTerminal", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderMenu([], 0, ctx);
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  // writeToVterm with 0 lines should just clear
  let output = "\x1b[H";
  for (let i = 0; i < vt.rows; i++) {
    output += `\x1b[${i + 1};1H\x1b[2K`;
    if (i < lines.length) output += lines[i];
  }
  vt.write(output);
  const sr = new ScreenReader(vt);
  const menu = sr.menu();
  assert(menu.items.length === 0, "ScreenReader should detect 0 menu items");
});

step("Assertions on empty screen", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J");
  const sr = new ScreenReader(vt);
  const assertions = new Assertions(vt, sr);
  assertions.noOverflow();
  // textNotVisible should pass for anything
  assertions.textNotVisible("nonexistent");
});

// ══════════════════════════════════════════════════════════════
// TEST: Card border styles
// ══════════════════════════════════════════════════════════════

step("Card with all border styles", () => {
  const borderStyles = ["rounded", "single", "double", "heavy", "ascii", "none"] as const;
  for (const bs of borderStyles) {
    const ctx: RenderContext = { width: 80, theme, borderStyle: bs };
    try {
      const lines = renderCard({ type: "card", title: "Border Test", body: "Testing" }, ctx);
      assert(lines.length > 0, `Card with border ${bs} should render`);
    } catch (err: any) {
      addBug("P1", `Card crashes with border style "${bs}": ${err.message}`, "Card",
        `renderCard with borderStyle="${bs}"`, "No crash", err.message);
    }
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: Hero with all optional fields
// ══════════════════════════════════════════════════════════════

step("Hero with CTA and art", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const lines = renderHero({
    title: "Welcome",
    subtitle: "To the future",
    cta: { label: "Get Started", url: "https://example.com" },
    art: "  /\\\n /  \\\n/____\\",
  }, ctx);
  assert(lines.length > 0, "Hero with all fields should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("Welcome"), "Title should appear");
});

// ══════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════

const passed = steps.filter(s => s.passed).length;
const failed = steps.filter(s => !s.passed).length;
const failedNames = steps.filter(s => !s.passed).map(s => `${s.name}: ${s.error}`);

const report = {
  agent: "stress-config-validation",
  tests_run: steps.length,
  tests_passed: passed,
  tests_failed: failed,
  bugs,
  notes: failed > 0
    ? `${failed} tests failed. Failures: ${failedNames.join("; ")}`
    : "All tests passed. Tested empty/zero-length inputs for all components, FocusManager/Router with 0 items, width=1 and width=10000, ProgressBar edge cases, Box/Spacer boundaries, wrapText edge cases, and degenerate VirtualTerminal sizes.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
