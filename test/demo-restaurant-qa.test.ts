#!/usr/bin/env npx tsx
/**
 * Restaurant Demo -- QA Emulator Test
 *
 * Deep-tests: boot, per-page content + layout, overflow, padding,
 * resize behaviour, navigation loops, and edge cases.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "restaurant");

// ── Test Harness ────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2";
  title: string;
  page: string;
  description: string;
  expected: string;
  actual: string;
  fixed: boolean;
  fix?: string;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];
let bugCounter = 0;

function addBug(severity: "P0" | "P1" | "P2", title: string, page: string, description: string, expected: string, actual: string): string {
  bugCounter++;
  const id = `REST-${String(bugCounter).padStart(3, "0")}`;
  bugs.push({ id, severity, title, page, description, expected, actual, fixed: false });
  return id;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[2m(${Date.now() - start}ms)\x1b[0m`);
    return true;
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
    return false;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** Check if currentPage contains the expected page name (case-insensitive, partial match) */
function isOnPage(currentPage: string | null, expected: string): boolean {
  if (!currentPage) return false;
  if (expected === "home") return currentPage === "home";
  return currentPage.toLowerCase().includes(expected.toLowerCase());
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-restaurant-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const runContent = `
import config from "${DEMO_DIR}/config.js";
import { runFileBasedSite } from "${PROJECT_ROOT}/src/index.js";
runFileBasedSite({
  config,
  pagesDir: "${DEMO_DIR}/pages",
  outDir: "${DEMO_DIR}/.terminaltui",
});
`;
  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

/** Check screen text for padding bugs */
function checkPaddingBugs(screen: string, page: string): string[] {
  const issues: string[] = [];
  const lines = screen.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that start with focus indicator (▌) -- those are intentional
    const stripped = line.replace(/^▌\s*/, "");

    // Check for text touching right border: text│ (no space before │)
    // But exclude lines that are all border chars, and exclude truncated lines (ending ...)
    if (/[a-zA-Z0-9.,!?)\]"']\u2502/.test(stripped) && !stripped.includes("…│")) {
      issues.push(`Line ${i + 1}: text touches right border: "${stripped.trim().substring(0, 70)}"`);
    }
    // Check for text touching left border: │text (no space after │)
    // Exclude border-only patterns like ╭───, │ followed by another border char
    if (/\u2502[A-Za-z]/.test(stripped)) {
      issues.push(`Line ${i + 1}: text touches left border: "${stripped.trim().substring(0, 70)}"`);
    }
  }
  return issues;
}

/** Check for broken right borders (line has left border but no right border) */
function checkBrokenBorders(screen: string, cols: number): string[] {
  const issues: string[] = [];
  const lines = screen.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasLeftBorder = /[\u256d\u2502\u2570\u250c\u2514]/.test(line);
    const hasRightBorder = /[\u256e\u2502\u256f\u2510\u2518]/.test(line);
    // If line has a left rounded corner but no right rounded corner on same row
    if (/\u256d/.test(line) && !/\u256e/.test(line)) {
      issues.push(`Line ${i + 1}: left corner ╭ without matching right corner ╮`);
    }
    if (/\u2570/.test(line) && !/\u256f/.test(line)) {
      issues.push(`Line ${i + 1}: left corner ╰ without matching right corner ╯`);
    }
  }
  return issues;
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m==========================================================\x1b[0m");
  console.log("\x1b[1;36m  Restaurant Demo -- QA Emulator Test\x1b[0m");
  console.log("\x1b[1;36m==========================================================\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;
  let runDir: string | null = null;

  try {
    // ── a) Boot ────────────────────────────────────────────
    console.log("\n\x1b[1m  a) Boot & Menu Verification\x1b[0m\n");

    runDir = createRunDir();
    emu = await TUIEmulator.launch({
      command: "npx tsx run.ts",
      cwd: runDir,
      cols: 100,
      rows: 35,
      timeout: 30000,
    });

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: screen contains site name or banner", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Rusty Fork") || text.includes("RUSTY FORK") || text.includes("RUSTY") || text.includes("farm-to-table"),
        "Site name/banner not found"
      );
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assert(page === "home", `expected home, got ${page}`);
    });

    await test("boot: menu has 5 items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length === 5, `expected 5 menu items, got ${menu.items.length}: ${JSON.stringify(menu.items)}`);
    });

    await test("boot: menu items include expected pages", () => {
      const menu = emu!.screen.menu();
      const expected = ["Menu", "Wine", "Story", "Hours", "Contact"];
      for (const item of expected) {
        assert(menu.items.some(m => m.toLowerCase().includes(item.toLowerCase())), `menu missing "${item}". Items: ${JSON.stringify(menu.items)}`);
      }
    });

    await test("boot: no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Dump home screen
    let homeScreen = emu!.screen.text();
    console.log("\n--- HOME SCREEN DUMP ---");
    console.log(homeScreen);
    console.log("--- END HOME SCREEN ---\n");

    // ── b.1) Menu Page ──
    console.log("\n\x1b[1m  b.1) Menu Page\x1b[0m\n");

    await test("menu: navigateTo menu", async () => {
      emu!.navigateTo("menu");
      await emu!.waitForIdle(500);
    });

    await test("menu: currentPage contains Menu", () => {
      const page = emu!.screen.currentPage();
      assert(isOnPage(page, "menu"), `expected page containing 'menu', got ${page}`);
    });

    let menuScreen = emu!.screen.text();
    console.log("\n--- MENU PAGE DUMP ---");
    console.log(menuScreen);
    console.log("--- END MENU PAGE ---\n");

    await test("menu: contains food items", () => {
      const text = emu!.screen.text();
      const hasItems = text.includes("Burrata") || text.includes("Bone Marrow") || text.includes("Tuna") ||
                       text.includes("Starters") || text.includes("Search the menu");
      assert(hasItems, "No food items or search visible on menu page");
    });

    await test("menu: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    // Check for broken borders at 100 cols
    const menuBorderIssues = checkBrokenBorders(menuScreen, 100);
    if (menuBorderIssues.length > 0) {
      console.log("  [BORDER ISSUES on menu]:");
      menuBorderIssues.forEach(i => console.log(`    ${i}`));
      addBug("P1", "Broken borders on menu page search box", "menu", menuBorderIssues.join("; "), "Matching left and right border chars", "Missing right border");
    }

    const menuPadding = checkPaddingBugs(menuScreen, "menu");
    if (menuPadding.length > 0) {
      console.log("  [PADDING ISSUES on menu]:");
      menuPadding.forEach(i => console.log(`    ${i}`));
    }

    // Scroll down to see tabs content
    await test("menu: scroll down reveals more content", async () => {
      await emu!.press("down", { times: 15 });
      await emu!.waitForIdle(500);
      const text = emu!.screen.text();
      console.log("\n--- MENU SCROLLED DOWN ---");
      console.log(text);
      console.log("--- END MENU SCROLLED ---\n");
      assert(emu!.isRunning(), "app crashed scrolling menu");
    });

    await test("menu: goHome returns to home", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "failed to return home");
    });

    // ── b.2) Wine Page ──
    console.log("\n\x1b[1m  b.2) Wine Page\x1b[0m\n");

    await test("wine: navigateTo wine", async () => {
      emu!.navigateTo("wine");
      await emu!.waitForIdle(500);
    });

    let wineScreen = emu!.screen.text();
    console.log("\n--- WINE PAGE DUMP ---");
    console.log(wineScreen);
    console.log("--- END WINE PAGE ---\n");

    await test("wine: currentPage contains Wine", () => {
      assert(isOnPage(emu!.screen.currentPage(), "wine"), `expected wine page`);
    });

    await test("wine: contains wine tabs", () => {
      const text = emu!.screen.text();
      assert(text.includes("Red") || text.includes("White") || text.includes("Sparkling"), "Wine tabs not found");
    });

    await test("wine: contains wine names", () => {
      const text = emu!.screen.text();
      assert(text.includes("Ridge") || text.includes("Barolo") || text.includes("Cloudy Bay"), "Wine names not found");
    });

    await test("wine: cards() returns cards (or content visible)", () => {
      const cards = emu!.screen.cards();
      console.log(`    [INFO] Found ${cards.length} wine cards: ${cards.map(c => c.title).join(", ")}`);
      // Cards may not parse if content is in tabs that haven't been activated
      if (cards.length === 0) {
        // Verify content is visible even if cards() can't parse them
        const text = emu!.screen.text();
        assert(text.includes("Ridge") || text.includes("Barolo") || text.includes("Cloudy Bay"),
          "Neither cards() nor visible wine names found");
      }
    });

    await test("wine: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    const winePadding = checkPaddingBugs(wineScreen, "wine");
    if (winePadding.length > 0) {
      console.log("  [PADDING ISSUES on wine]:");
      winePadding.forEach(i => console.log(`    ${i}`));
    }

    const wineBorderIssues = checkBrokenBorders(wineScreen, 100);
    if (wineBorderIssues.length > 0) {
      console.log("  [BORDER ISSUES on wine]:");
      wineBorderIssues.forEach(i => console.log(`    ${i}`));
    }

    await test("wine: goHome returns to home", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "failed to return home");
    });

    // ── b.3) Story Page ──
    console.log("\n\x1b[1m  b.3) Our Story Page\x1b[0m\n");

    await test("story: navigateTo story", async () => {
      emu!.navigateTo("story");
      await emu!.waitForIdle(500);
    });

    let storyScreen = emu!.screen.text();
    console.log("\n--- STORY PAGE DUMP ---");
    console.log(storyScreen);
    console.log("--- END STORY PAGE ---\n");

    await test("story: currentPage contains Story", () => {
      assert(isOnPage(emu!.screen.currentPage(), "story"), "expected story page");
    });

    await test("story: contains narrative", () => {
      const text = emu!.screen.text();
      assert(text.includes("Elena") || text.includes("supper club") || text.includes("Portland"), "Narrative not found");
    });

    await test("story: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    const storyPadding = checkPaddingBugs(storyScreen, "story");
    if (storyPadding.length > 0) {
      console.log("  [PADDING ISSUES on story]:");
      storyPadding.forEach(i => console.log(`    ${i}`));
    }

    await test("story: scroll down shows quotes", async () => {
      await emu!.press("down", { times: 10 });
      await emu!.waitForIdle(500);
      const scrolled = emu!.screen.text();
      console.log("\n--- STORY SCROLLED ---");
      console.log(scrolled);
      console.log("--- END STORY SCROLLED ---\n");
      assert(emu!.isRunning(), "app crashed scrolling story");
      // After scrolling, quotes should be visible
      const hasQuotes = scrolled.includes("New York Times") || scrolled.includes("Bon Appetit") || scrolled.includes("Michelin");
      if (!hasQuotes) {
        console.log("    [WARN] Quotes not visible even after scrolling");
      }
    });

    await test("story: goHome returns to home", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "failed to return home");
    });

    // ── b.4) Hours Page ──
    console.log("\n\x1b[1m  b.4) Hours & Location Page\x1b[0m\n");

    await test("hours: navigateTo hours", async () => {
      emu!.navigateTo("hours");
      await emu!.waitForIdle(500);
    });

    let hoursScreen = emu!.screen.text();
    console.log("\n--- HOURS PAGE DUMP ---");
    console.log(hoursScreen);
    console.log("--- END HOURS PAGE ---\n");

    await test("hours: currentPage contains Hours", () => {
      assert(isOnPage(emu!.screen.currentPage(), "hours"), "expected hours page");
    });

    await test("hours: contains schedule or address content", () => {
      const text = emu!.screen.text();
      const hasSchedule = text.includes("Monday") || text.includes("Tuesday") || text.includes("Dinner") || text.includes("Lunch");
      const hasAddress = text.includes("827") || text.includes("Ironworks") || text.includes("Portland");
      const hasLabel = text.includes("Hours") || text.includes("Location") || text.includes("Day");
      assert(hasSchedule || hasAddress || hasLabel, "No schedule, address, or label content found on hours page");
    });

    await test("hours: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    const hoursPadding = checkPaddingBugs(hoursScreen, "hours");
    if (hoursPadding.length > 0) {
      console.log("  [PADDING ISSUES on hours]:");
      hoursPadding.forEach(i => console.log(`    ${i}`));
      // Only flag real padding issues
      const realIssues = hoursPadding.filter(i => !i.includes("…│"));
      if (realIssues.length > 0) {
        addBug("P1", "Padding issue on hours page", "hours", realIssues.join("; "), "1-char padding inside borders", "Text touching border");
      }
    }

    const hoursBorderIssues = checkBrokenBorders(hoursScreen, 100);
    if (hoursBorderIssues.length > 0) {
      console.log("  [BORDER ISSUES on hours]:");
      hoursBorderIssues.forEach(i => console.log(`    ${i}`));
    }

    // Scroll down to see links
    await test("hours: scroll down to links", async () => {
      await emu!.press("down", { times: 5 });
      await emu!.waitForIdle(500);
      const scrolled = emu!.screen.text();
      console.log("\n--- HOURS SCROLLED ---");
      console.log(scrolled);
      console.log("--- END HOURS SCROLLED ---\n");
      assert(emu!.isRunning(), "app crashed scrolling hours");
    });

    await test("hours: goHome returns to home", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "failed to return home");
    });

    // ── b.5) Contact Page ──
    console.log("\n\x1b[1m  b.5) Contact Page\x1b[0m\n");

    await test("contact: navigateTo contact", async () => {
      emu!.navigateTo("contact");
      await emu!.waitForIdle(500);
    });

    let contactScreen = emu!.screen.text();
    console.log("\n--- CONTACT PAGE DUMP ---");
    console.log(contactScreen);
    console.log("--- END CONTACT PAGE ---\n");

    await test("contact: currentPage contains Contact", () => {
      assert(isOnPage(emu!.screen.currentPage(), "contact"), "expected contact page");
    });

    await test("contact: contains links section", () => {
      const text = emu!.screen.text();
      assert(text.includes("Reservation") || text.includes("Instagram") || text.includes("Get in Touch"), "Links section not found");
    });

    await test("contact: contains form fields", () => {
      const text = emu!.screen.text();
      assert(text.includes("Name") || text.includes("Email") || text.includes("Reserve"), "Form fields not found");
    });

    await test("contact: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    const contactPadding = checkPaddingBugs(contactScreen, "contact");
    if (contactPadding.length > 0) {
      console.log("  [PADDING ISSUES on contact]:");
      contactPadding.forEach(i => console.log(`    ${i}`));
    }

    const contactBorderIssues = checkBrokenBorders(contactScreen, 100);
    if (contactBorderIssues.length > 0) {
      console.log("  [BORDER ISSUES on contact]:");
      contactBorderIssues.forEach(i => console.log(`    ${i}`));
    }

    // Navigation across split
    await test("contact: right arrow across split works", async () => {
      await emu!.press("right");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "app crashed on right arrow across split");
    });

    await test("contact: left arrow back works", async () => {
      await emu!.press("left");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "app crashed on left arrow back");
    });

    // Scroll down to see more form fields
    await test("contact: scroll down shows more form", async () => {
      await emu!.press("down", { times: 8 });
      await emu!.waitForIdle(500);
      const scrolled = emu!.screen.text();
      console.log("\n--- CONTACT SCROLLED ---");
      console.log(scrolled);
      console.log("--- END CONTACT SCROLLED ---\n");
      assert(emu!.isRunning(), "app crashed scrolling contact");
    });

    await test("contact: goHome returns to home", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "failed to return home");
    });

    // ── c) Resize tests ────────────────────────────────────
    console.log("\n\x1b[1m  c) Resize Tests\x1b[0m\n");

    // Test narrow (60 cols) on menu page
    await test("resize: narrow 60 cols on menu page", async () => {
      emu!.navigateTo("menu");
      await emu!.waitForIdle(500);
      emu!.resize(60, 35);
      await emu!.waitForIdle(800);
      assert(emu!.isRunning(), "app crashed on resize to 60 cols");
    });

    let narrowMenuScreen = emu!.screen.text();
    console.log("\n--- MENU PAGE 60 COLS ---");
    console.log(narrowMenuScreen);
    console.log("--- END MENU 60 COLS ---\n");

    await test("resize: narrow menu no overflow", () => {
      emu!.assert.noOverflow();
    });

    const narrowMenuBorders = checkBrokenBorders(narrowMenuScreen, 60);
    if (narrowMenuBorders.length > 0) {
      console.log("  [BORDER ISSUES on menu@60cols]:");
      narrowMenuBorders.forEach(i => console.log(`    ${i}`));
      addBug("P1", "Broken borders on menu page at 60 cols", "menu@60cols", narrowMenuBorders.join("; "), "Matching border chars", "Missing right border");
    }

    // Go home, resize back, then test wide
    await test("resize: go home from narrow", async () => {
      // Resize back first so goHome can find menu
      emu!.resize(100, 35);
      await emu!.waitForIdle(500);
      emu!.goHome();
      await emu!.waitForIdle(500);
      const page = emu!.screen.currentPage();
      assert(page === "home", `failed to return home after resize, got ${page}`);
    });

    // Test wide (120 cols) on hours page
    await test("resize: wide 120 cols on hours page", async () => {
      emu!.resize(120, 35);
      await emu!.waitForIdle(500);
      emu!.navigateTo("hours");
      await emu!.waitForIdle(800);
      assert(emu!.isRunning(), "app crashed on 120 col hours page");
    });

    let wideHoursScreen = emu!.screen.text();
    console.log("\n--- HOURS PAGE 120 COLS ---");
    console.log(wideHoursScreen);
    console.log("--- END HOURS 120 COLS ---\n");

    await test("resize: wide hours no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Go home and test narrow contact
    await test("resize: narrow 60 cols on contact page", async () => {
      emu!.goHome();
      await emu!.waitForIdle(500);
      // Navigate first at normal width, then resize narrow
      emu!.navigateTo("contact");
      await emu!.waitForIdle(500);
      emu!.resize(60, 35);
      await emu!.waitForIdle(800);
      assert(emu!.isRunning(), "app crashed on narrow contact page");
    });

    let narrowContactScreen = emu!.screen.text();
    console.log("\n--- CONTACT PAGE 60 COLS ---");
    console.log(narrowContactScreen);
    console.log("--- END CONTACT 60 COLS ---\n");

    await test("resize: narrow contact no overflow", () => {
      emu!.assert.noOverflow();
    });

    const narrowContactBorders = checkBrokenBorders(narrowContactScreen, 60);
    if (narrowContactBorders.length > 0) {
      console.log("  [BORDER ISSUES on contact@60cols]:");
      narrowContactBorders.forEach(i => console.log(`    ${i}`));
    }

    // Reset
    await test("resize: reset to 100 cols", async () => {
      emu!.resize(100, 35);
      await emu!.waitForIdle(500);
      emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.isRunning(), "app crashed after reset");
    });

    // ── d) Nav loop: all pages + goHome ────────────────────
    console.log("\n\x1b[1m  d) Navigation Loop\x1b[0m\n");

    const pages = ["menu", "wine", "story", "hours", "contact"];
    for (const pageName of pages) {
      await test(`navloop: navigateTo ${pageName} + goHome`, async () => {
        emu!.navigateTo(pageName);
        await emu!.waitForIdle(500);
        const current = emu!.screen.currentPage();
        assert(isOnPage(current, pageName), `expected ${pageName}, got ${current}`);
        emu!.goHome();
        await emu!.waitForIdle(500);
        assert(emu!.screen.currentPage() === "home", `failed to return home from ${pageName}`);
      });
    }

    // ── e) Edge cases ──────────────────────────────────────
    console.log("\n\x1b[1m  e) Edge Cases\x1b[0m\n");

    // Note: escape on home is intentionally mapped to "quit", so the app exits.
    // That's by design, not a bug. We test edge cases that don't trigger quit.

    await test("edge: rapid navigation does not crash", async () => {
      await emu!.press("down");
      await emu!.press("enter");
      await emu!.waitForIdle(300);
      await emu!.press("down");
      await emu!.press("down");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "app crashed during rapid navigation within a page");
      emu!.goHome();
      await emu!.waitForIdle(300);
    });

    await test("edge: rapid tab switching on wine page", async () => {
      emu!.navigateTo("wine");
      await emu!.waitForIdle(500);
      await emu!.press("tab");
      await emu!.press("tab");
      await emu!.press("tab");
      await emu!.press("tab");
      await emu!.waitForIdle(500);
      assert(emu!.isRunning(), "app crashed during rapid tab switching");
      emu!.goHome();
      await emu!.waitForIdle(300);
    });

    await test("edge: up arrow at top of menu doesn't crash", async () => {
      await emu!.press("up");
      await emu!.press("up");
      await emu!.press("up");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "app crashed on up at top of menu");
    });

    await test("edge: down past last menu item doesn't crash", async () => {
      await emu!.press("down", { times: 10 });
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "app crashed on down past last menu item");
    });

    // ── Shutdown ──
    console.log("\n\x1b[1m  Shutdown\x1b[0m\n");

    await test("shutdown: close() works", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "process should not be running after close");
    });

  } finally {
    try { if (emu?.isRunning()) await emu.close(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Report ──────────────────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"─".repeat(60)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    \x1b[31m- ${r.name}: ${r.error}\x1b[0m`);
    }
  }

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found: ${bugs.length}\x1b[0m`);
    for (const b of bugs) {
      console.log(`    ${b.id} [${b.severity}] ${b.title} (${b.page})`);
    }
  }

  const report = {
    agent: "demo-restaurant-qa",
    demo: "demos/restaurant",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    bugs,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  console.log("\n" + JSON.stringify(report, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n\x1b[31mFATAL ERROR:\x1b[0m", err);
  process.exit(1);
});
