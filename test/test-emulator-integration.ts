/**
 * Integration tests for the TUI emulator.
 *
 * Tests the emulator against real framework rendering output by simulating
 * what the runtime.ts would write to stdout.
 */

import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { Assertions } from "../src/emulator/assertions.js";
import { Reporter } from "../src/emulator/reporter.js";

// Import framework rendering
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { renderCard } from "../src/components/Card.js";
import { renderLink } from "../src/components/Link.js";
import { renderText } from "../src/components/Text.js";
import { renderDivider } from "../src/components/Divider.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { themes, defaultTheme } from "../src/style/theme.js";
import { fgColor, bold, dim, italic, reset, setColorMode } from "../src/style/colors.js";
import type { CardBlock } from "../src/config/types.js";

// Force 256-color mode for consistent output
setColorMode("256");

const theme = themes.dracula;

function createCtx(width: number = 80): RenderContext {
  return { width, theme, borderStyle: "rounded" };
}

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

/**
 * Write rendered lines to a vterm as the runtime would.
 * Simulates the TUIRuntime.writeToTerminal flow.
 * Uses absolute cursor positioning per line, like the real runtime does.
 */
function writeToVterm(vt: VirtualTerminal, lines: string[], cols: number, rows: number): void {
  let output = "\x1b[H"; // move to top-left
  for (let i = 0; i < rows; i++) {
    // Position cursor at start of line (1-indexed)
    output += `\x1b[${i + 1};1H`;
    output += "\x1b[2K"; // clear line
    if (i < lines.length) {
      output += lines[i];
    }
  }
  vt.write(output);
}

// ═════════════════════════════════════════════════════════════
// RENDERING → VTERM → SCREEN READER INTEGRATION
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Integration: Menu Rendering → Emulator\x1b[0m\n");

test("Menu renders and is detected by screen reader", () => {
  const items: MenuItem[] = [
    { label: "Menu", icon: "\u25c6", id: "menu" },
    { label: "About", icon: "\u25c6", id: "about" },
    { label: "Contact", icon: "\u25c6", id: "contact" },
  ];
  const ctx = createCtx(80);
  const menuLines = renderMenu(items, 0, ctx);

  const vt = new VirtualTerminal(80, 24);
  // Set up like runtime — enter alt screen, clear, write content
  vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
  writeToVterm(vt, ["", ...menuLines], 80, 24);

  const sr = new ScreenReader(vt);
  const menu = sr.menu();
  assert(menu.items.length === 3, `Expected 3 items, got ${menu.items.length}`);
  assert(menu.items[0] === "Menu", `First item: ${menu.items[0]}`);
  assert(menu.items[1] === "About", `Second item: ${menu.items[1]}`);
  assert(menu.items[2] === "Contact", `Third item: ${menu.items[2]}`);
  assert(menu.selectedIndex === 0, `Selected: ${menu.selectedIndex}`);
});

test("Menu selection changes are detected", () => {
  const items: MenuItem[] = [
    { label: "Home", icon: "\u25c6", id: "home" },
    { label: "Projects", icon: "\u25c6", id: "projects" },
    { label: "Blog", icon: "\u25c6", id: "blog" },
  ];
  const ctx = createCtx(80);

  // Render with second item selected
  const menuLines = renderMenu(items, 1, ctx);
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
  writeToVterm(vt, menuLines, 80, 24);

  const sr = new ScreenReader(vt);
  const menu = sr.menu();
  assert(menu.selectedIndex === 1, `Selected should be 1, got ${menu.selectedIndex}`);
  assert(menu.items[1] === "Projects", `Selected item: ${menu.items[1]}`);
});

console.log("\n\x1b[1m  Integration: Card Rendering → Emulator\x1b[0m\n");

test("Card renders and is detected by screen reader", () => {
  const cardBlock: CardBlock = {
    type: "card",
    title: "Burrata & Heirloom Tomatoes",
    subtitle: "$16",
    body: "Creamy burrata with vine-ripened tomatoes",
    tags: ["Appetizer", "Vegetarian"],
  };
  const ctx = createCtx(60);
  const cardLines = renderCard(cardBlock, ctx);

  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
  writeToVterm(vt, cardLines, 80, 24);

  const sr = new ScreenReader(vt);
  const cards = sr.cards();
  assert(cards.length >= 1, `Expected at least 1 card, got ${cards.length}`);
  assert(cards[0].title.includes("Burrata"), `Card title: ${cards[0].title}`);
  assert(cards[0].tags.length === 2, `Tags: ${cards[0].tags.length}`);
  assert(cards[0].tags[0] === "Appetizer", `First tag: ${cards[0].tags[0]}`);
  assert(cards[0].tags[1] === "Vegetarian", `Second tag: ${cards[0].tags[1]}`);
});

test("Card without subtitle is detected", () => {
  const cardBlock: CardBlock = {
    type: "card",
    title: "Simple Card",
    body: "Just a body",
  };
  const ctx = createCtx(60);
  const cardLines = renderCard(cardBlock, ctx);

  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, cardLines, 80, 24);

  const sr = new ScreenReader(vt);
  const cards = sr.cards();
  assert(cards.length >= 1, `Expected card, got ${cards.length}`);
  assert(cards[0].title.includes("Simple Card"), `Title: ${cards[0].title}`);
});

console.log("\n\x1b[1m  Integration: Link Rendering → Emulator\x1b[0m\n");

test("Link renders and is detected by screen reader", () => {
  const ctx = createCtx(80);
  const linkLines = renderLink("GitHub", "https://github.com/user/repo", ctx, { focused: false });

  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, linkLines, 80, 24);

  const sr = new ScreenReader(vt);
  const links = sr.links();
  assert(links.length >= 1, `Expected link, got ${links.length}`);
  assert(links[0].label === "GitHub", `Label: ${links[0].label}`);
  assert(links[0].url === "https://github.com/user/repo", `URL: ${links[0].url}`);
});

console.log("\n\x1b[1m  Integration: Full Home Page Rendering\x1b[0m\n");

test("Full home page — banner, menu, hints", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");

  // Simulate home page rendering
  const contentWidth = 80;
  const lines: string[] = [];

  // Banner (simplified)
  lines.push("");
  lines.push(fgColor(theme.accent) + bold + "  MY SITE" + reset);
  lines.push("");

  // Tagline
  lines.push(fgColor(theme.muted) + italic + "  A test site for the emulator" + reset);
  lines.push("");

  // Divider
  lines.push(fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");

  // Menu items
  const items: MenuItem[] = [
    { label: "Menu", icon: "\u25c6", id: "menu" },
    { label: "About", icon: "\u25c6", id: "about" },
    { label: "Contact", icon: "\u25c6", id: "contact" },
  ];
  const ctx = createCtx(contentWidth);
  const menuLines = renderMenu(items, 0, ctx);
  lines.push(...menuLines);

  // Footer
  lines.push("");
  lines.push(fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");
  lines.push(fgColor(theme.subtle) + dim + "  \u2191\u2193 navigate  \u23ce select  q quit  : command" + reset);

  writeToVterm(vt, lines, 80, 24);

  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);

  // Verify home page content
  asserts.textVisible("MY SITE");
  asserts.textVisible("A test site for the emulator");

  // Menu should be detected
  const menu = sr.menu();
  assert(menu.items.length === 3, `Menu items: ${menu.items.length}`);
  assert(menu.selectedIndex === 0, `Selected: ${menu.selectedIndex}`);

  // Hints visible
  assert(sr.contains("navigate"), "navigate hint");
  assert(sr.contains("quit"), "quit hint");

  // No overflow
  asserts.noOverflow();
});

console.log("\n\x1b[1m  Integration: Page Header Detection\x1b[0m\n");

test("Content page header is detected", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");

  const contentWidth = 80;
  const lines: string[] = [];

  // Page header
  lines.push("");
  const backHint = fgColor(theme.subtle) + dim + "\u2190 back" + reset;
  const pageTitle = fgColor(theme.accent) + bold + "\ud83c\udf7d Menu" + reset;
  lines.push(backHint + "  " + pageTitle);
  lines.push(fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");

  // Section title
  lines.push(fgColor(theme.accent) + bold + "  Appetizers" + reset);
  lines.push(fgColor(theme.border) + "  " + "\u2500".repeat(contentWidth - 4) + reset);
  lines.push("");
  lines.push("  Some content here");

  writeToVterm(vt, lines, 80, 24);

  const sr = new ScreenReader(vt);
  const page = sr.currentPage();
  assert(page !== null, "page detected");
  assert(page!.includes("Menu"), `Page should contain Menu, got: ${page}`);
});

console.log("\n\x1b[1m  Integration: Narrow Width Rendering\x1b[0m\n");

test("Components render correctly at narrow width (40 cols)", () => {
  const items: MenuItem[] = [
    { label: "Very Long Menu Item Name", icon: "\u25c6", id: "long" },
    { label: "Short", icon: "\u25c6", id: "short" },
  ];
  const ctx = createCtx(40);
  const menuLines = renderMenu(items, 0, ctx);

  const vt = new VirtualTerminal(40, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, menuLines, 40, 24);

  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);

  // Menu should still be detected
  const menu = sr.menu();
  assert(menu.items.length === 2, `Menu items at 40 cols: ${menu.items.length}`);

  // No overflow
  asserts.noOverflow();
});

test("Card renders at narrow width without overflow", () => {
  const cardBlock: CardBlock = {
    type: "card",
    title: "Test Card",
    body: "This is a long body text that should wrap properly at narrow widths without overflowing",
    tags: ["Tag1"],
  };
  const ctx = createCtx(40);
  const cardLines = renderCard(cardBlock, ctx);

  const vt = new VirtualTerminal(40, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, cardLines, 40, 24);

  const sr = new ScreenReader(vt);
  const asserts = new Assertions(vt, sr);

  const cards = sr.cards();
  assert(cards.length >= 1, `Card detected at 40 cols`);
  asserts.noOverflow();
});

console.log("\n\x1b[1m  Integration: Style Detection\x1b[0m\n");

test("Bold text is detected in rendered menu", () => {
  const items: MenuItem[] = [
    { label: "Selected", icon: "\u25c6", id: "sel" },
  ];
  const ctx = createCtx(80);
  const menuLines = renderMenu(items, 0, ctx);

  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, menuLines, 80, 24);

  // The selected menu item label should be bold
  const asserts = new Assertions(vt, new ScreenReader(vt));
  asserts.textIsBold("Selected");
});

test("Color is preserved in rendered output", () => {
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");

  // Write colored text with known hex
  vt.write("\x1b[38;2;255;107;107mRedText\x1b[0m");

  const cell = vt.cellAt(0, 0)!;
  assert(cell.fg === "#ff6b6b", `Expected #ff6b6b, got ${cell.fg}`);
});

console.log("\n\x1b[1m  Integration: Assertions with Real Renders\x1b[0m\n");

test("borderVisible detects card borders", () => {
  const cardBlock: CardBlock = {
    type: "card",
    title: "Bordered",
    body: "Has borders",
  };
  const ctx = createCtx(60);
  const cardLines = renderCard(cardBlock, ctx);

  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, cardLines, 80, 24);

  const asserts = new Assertions(vt, new ScreenReader(vt));
  asserts.borderVisible();
});

test("menuItemSelected assertion works with rendered menu", () => {
  const items: MenuItem[] = [
    { label: "First", icon: "\u25c6", id: "first" },
    { label: "Second", icon: "\u25c6", id: "second" },
    { label: "Third", icon: "\u25c6", id: "third" },
  ];
  const ctx = createCtx(80);

  // Select second item
  const menuLines = renderMenu(items, 1, ctx);
  const vt = new VirtualTerminal(80, 24);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, menuLines, 80, 24);

  const asserts = new Assertions(vt, new ScreenReader(vt));
  asserts.menuItemSelected("Second");
  asserts.menuItemCount(3);
});

// ═════════════════════════════════════════════════════════════
// REPORTER INTEGRATION
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Integration: Reporter\x1b[0m\n");

test("Reporter.runStep catches errors and records them", async () => {
  const reporter = new Reporter("Test Suite", "terminaltui dev", 80, 24);

  await reporter.runStep("passing step", () => {
    // no-op — passes
  });

  await reporter.runStep("failing step", () => {
    throw new Error("expected failure");
  });

  const report = reporter.getReport();
  assert(report.passed === 1, `passed: ${report.passed}`);
  assert(report.failed === 1, `failed: ${report.failed}`);
  assert(report.steps[1].error === "expected failure", `error: ${report.steps[1].error}`);
});

// ═════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
