#!/usr/bin/env npx tsx
/**
 * Coffee Shop Demo — QA Bug-Hunt Test
 *
 * Thoroughly tests every page for:
 *   - Layout bugs (padding, borders, overflow)
 *   - Missing content
 *   - Navigation correctness
 *   - Resize behavior (60 cols, 120 cols)
 *   - Edge cases
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────
const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "coffee-shop");

// ── Test Harness ────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  page: string;
  description: string;
  evidence: string;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  \x1b[32m+\x1b[0m ${name} \x1b[2m(${Date.now() - start}ms)\x1b[0m`);
    return true;
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    console.log(`  \x1b[31mx\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
    return false;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function reportBug(bug: Bug): void {
  bugs.push(bug);
  console.log(`    \x1b[33m[BUG ${bug.severity}] ${bug.description}\x1b[0m`);
}

/**
 * Check for padding bugs: text glued to left border with no space.
 */
function checkPaddingBugs(screenText: string, pageName: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  const verticalChars = ["\u2502", "\u2551", "\u2503", "\u2506", "|"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length - 1; j++) {
      const ch = line[j];
      const next = line[j + 1];
      if (verticalChars.includes(ch) && /[A-Za-z0-9$]/.test(next)) {
        const context = line.substring(Math.max(0, j - 2), Math.min(line.length, j + 25));
        issues.push(`Line ${i + 1}: no left padding after border: "${context}"`);
      }
    }
  }
  return issues;
}

/**
 * Check for right-padding bugs: text touching right border
 */
function checkRightPaddingBugs(screenText: string, pageName: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  const verticalChars = ["\u2502", "\u2551", "\u2503", "\u2506", "|"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 1; j < line.length; j++) {
      const prev = line[j - 1];
      const ch = line[j];
      if (verticalChars.includes(ch) && /[A-Za-z0-9]/.test(prev)) {
        const context = line.substring(Math.max(0, j - 25), Math.min(line.length, j + 2));
        issues.push(`Line ${i + 1}: no right padding before border: "${context}"`);
      }
    }
  }
  return issues;
}

/**
 * Check for broken/misaligned borders.
 * Note: we allow unclosed boxes if content is scrollable (viewport truncation).
 */
function checkBorderIssues(screenText: string, allowViewportTruncation = true): string[] {
  const issues: string[] = [];
  const topLeft = ["\u256d", "\u250c", "\u2554", "\u250f"];
  const bottomLeft = ["\u2570", "\u2514", "\u255a", "\u2517"];

  let openBoxes = 0;
  for (const ch of screenText) {
    if (topLeft.includes(ch)) openBoxes++;
    if (bottomLeft.includes(ch)) openBoxes--;
  }

  // If content is scrollable (has scroll indicators), unclosed boxes at the bottom
  // are expected due to viewport truncation
  if (openBoxes > 0 && allowViewportTruncation) {
    const hasScrollIndicator = screenText.includes("\u2193") || screenText.includes("\u2191") ||
      screenText.includes("more below") || screenText.includes("item below") ||
      screenText.includes("items below");
    if (hasScrollIndicator) {
      return []; // Expected: cards cut off at viewport boundary
    }
  }

  if (openBoxes !== 0) {
    issues.push(`Mismatched box borders: ${openBoxes} unclosed boxes`);
  }
  return issues;
}

/**
 * Check for line wrapping (content that should be single-line broken across two)
 */
function checkLineWrapping(screenText: string, termCols: number): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > termCols) {
      issues.push(`Line ${i + 1} is ${lines[i].length} chars, exceeds terminal width of ${termCols}`);
    }
  }
  return issues;
}

// ── Temp launcher ───────────────────────────────────────────

function createLauncher(): string {
  const dir = join(tmpdir(), `tui-coffee-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const runContent = `
import config from "${PROJECT_ROOT}/demos/coffee-shop/site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;

  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

async function launchSite(dir: string, cols = 100, rows = 35): Promise<TUIEmulator> {
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: dir,
    cols,
    rows,
    timeout: 30000,
  });
}

// ═════════════════════════════════════════════════════════════
//  TESTS
// ═════════════════════════════════════════════════════════════

async function runTests(): Promise<void> {
  console.log("\n\x1b[1m  Coffee Shop Demo — QA Bug-Hunt\x1b[0m\n");

  const siteDir = createLauncher();
  let emu: TUIEmulator | null = null;

  try {
    // ── BOOT ──────────────────────────────────────────────
    await test("boot: launch emulator (100x35)", async () => {
      emu = await launchSite(siteDir, 100, 35);
      assert(emu !== null, "emulator created");
      assert(emu.isRunning(), "process running");
    });
    if (!emu) return;

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 20000 });
    });

    await test("boot: home page detected", () => {
      assertEqual(emu!.screen.currentPage(), "home", "should be home");
    });

    await test("boot: menu has 4 items", () => {
      emu!.assert.menuItemCount(4);
    });

    await test("boot: menu items correct", () => {
      const menu = emu!.screen.menu();
      const expected = ["Menu", "Our Beans", "Hours", "Connect"];
      for (const exp of expected) {
        assert(
          menu.items.some(i => i.toLowerCase().includes(exp.toLowerCase())),
          `Missing menu item: ${exp}. Found: [${menu.items}]`,
        );
      }
    });

    await test("boot: banner or tagline visible", () => {
      const text = emu!.screen.text();
      const hasIdentity =
        text.includes("EMBER") ||
        text.includes("Ember") ||
        text.includes("specialty coffee") ||
        text.includes("\u2588");
      assert(hasIdentity, "No site identity on screen");
    });

    await test("boot: no overflow on home", () => {
      emu!.assert.noOverflow();
    });

    // ── MENU PAGE ─────────────────────────────────────────
    console.log("\n  \x1b[1;36m--- Menu Page ---\x1b[0m");

    await test("menu: navigate to Menu page", async () => {
      await emu!.navigateTo("Menu");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Menu page, got "${page}"`);
    });

    let menuDump = "";
    await test("menu: dump screen and check content", () => {
      menuDump = emu!.screen.text();
      console.log("\n--- MENU PAGE DUMP ---");
      console.log(menuDump);
      console.log("--- END DUMP ---\n");

      const essentials = ["Espresso", "Cortado", "Flat White"];
      for (const item of essentials) {
        assert(menuDump.includes(item), `Missing menu item: ${item}`);
      }
    });

    await test("menu: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("menu: check left padding bugs", () => {
      const issues = checkPaddingBugs(menuDump, "Menu");
      for (const issue of issues) {
        reportBug({ id: `MENU-LPAD-${bugs.length + 1}`, severity: "P1", page: "Menu", description: issue, evidence: issue });
      }
    });

    await test("menu: check right padding bugs", () => {
      const issues = checkRightPaddingBugs(menuDump, "Menu");
      for (const issue of issues) {
        reportBug({ id: `MENU-RPAD-${bugs.length + 1}`, severity: "P1", page: "Menu", description: issue, evidence: issue });
      }
    });

    await test("menu: check border issues", () => {
      const issues = checkBorderIssues(menuDump);
      for (const issue of issues) {
        reportBug({ id: `MENU-BORDER-${bugs.length + 1}`, severity: "P1", page: "Menu", description: issue, evidence: issue });
      }
    });

    await test("menu: tab labels visible (Espresso/Filter/Pastries)", () => {
      const text = emu!.screen.text();
      assert(text.includes("Espresso"), "Espresso tab/content missing");
      // Filter and Pastries should be visible as tab labels
      assert(text.includes("Filter"), "Filter tab missing");
      assert(text.includes("Pastries"), "Pastries tab missing");
    });

    await test("menu: prices visible", () => {
      assert(menuDump.includes("$"), "No prices visible on menu page");
    });

    // Scroll down to see more cards
    await test("menu: scroll down to see more content", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const text = emu!.screen.text();
      console.log("\n--- MENU PAGE SCROLLED DOWN ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      // After scrolling, should see card body text that was cut off
      const hasMore = text.includes("Marzocca") || text.includes("syrupy") || text.includes("microfoam") ||
        text.includes("Cappuccino") || text.includes("Oat Latte") || text.includes("Cortado");
      assert(hasMore, "No additional content after scrolling down");
    });

    await test("menu: escape back to home", async () => {
      await emu!.goHome();
      await sleep(300);
      assertEqual(emu!.screen.currentPage(), "home", "back on home");
    });

    // ── OUR BEANS PAGE ────────────────────────────────────
    console.log("\n  \x1b[1;36m--- Our Beans Page ---\x1b[0m");

    await test("beans: navigate to Our Beans", async () => {
      await emu!.navigateTo("Beans");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Beans page, got "${page}"`);
    });

    let beansDump = "";
    await test("beans: dump screen and check content", () => {
      beansDump = emu!.screen.text();
      console.log("\n--- BEANS PAGE DUMP ---");
      console.log(beansDump);
      console.log("--- END DUMP ---\n");

      assert(beansDump.includes("Roast") || beansDump.includes("roast"), "No roasting info");
    });

    await test("beans: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("beans: check left padding bugs", () => {
      const issues = checkPaddingBugs(beansDump, "Beans");
      for (const issue of issues) {
        reportBug({ id: `BEANS-LPAD-${bugs.length + 1}`, severity: "P1", page: "Our Beans", description: issue, evidence: issue });
      }
    });

    await test("beans: check right padding bugs", () => {
      const issues = checkRightPaddingBugs(beansDump, "Beans");
      for (const issue of issues) {
        reportBug({ id: `BEANS-RPAD-${bugs.length + 1}`, severity: "P1", page: "Our Beans", description: issue, evidence: issue });
      }
    });

    await test("beans: check border issues", () => {
      const issues = checkBorderIssues(beansDump);
      for (const issue of issues) {
        reportBug({ id: `BEANS-BORDER-${bugs.length + 1}`, severity: "P1", page: "Our Beans", description: issue, evidence: issue });
      }
    });

    await test("beans: origin names visible", () => {
      const text = emu!.screen.text();
      const origins = ["Ethiopian", "Colombian", "Guatemalan", "Kenyan"];
      const found = origins.filter(o => text.includes(o));
      assert(found.length >= 2, `Expected at least 2 origins, found: [${found}]`);
    });

    await test("beans: tags visible", () => {
      const text = emu!.screen.text();
      const hasTags = text.includes("[Light Roast]") || text.includes("[Medium Roast]") || text.includes("[Washed]");
      assert(hasTags, "Bean tags not visible");
    });

    // Scroll to see remaining beans
    await test("beans: scroll to see all beans", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const text = emu!.screen.text();
      console.log("\n--- BEANS PAGE SCROLLED ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
    });

    await test("beans: escape back to home", async () => {
      await emu!.goHome();
      await sleep(300);
      assertEqual(emu!.screen.currentPage(), "home", "back on home");
    });

    // ── HOURS & LOCATION PAGE ─────────────────────────────
    console.log("\n  \x1b[1;36m--- Hours & Location Page ---\x1b[0m");

    await test("hours: navigate to Hours & Location", async () => {
      await emu!.navigateTo("Hours");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Hours page, got "${page}"`);
    });

    let hoursDump = "";
    await test("hours: dump screen and check content", () => {
      hoursDump = emu!.screen.text();
      console.log("\n--- HOURS PAGE DUMP ---");
      console.log(hoursDump);
      console.log("--- END DUMP ---\n");

      const hasSchedule = hoursDump.includes("Monday") || hoursDump.includes("AM") || hoursDump.includes("PM");
      assert(hasSchedule, "No schedule visible on Hours page");
    });

    await test("hours: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("hours: check left padding bugs", () => {
      const issues = checkPaddingBugs(hoursDump, "Hours");
      for (const issue of issues) {
        reportBug({ id: `HOURS-LPAD-${bugs.length + 1}`, severity: "P1", page: "Hours", description: issue, evidence: issue });
      }
    });

    await test("hours: check right padding bugs (table cells)", () => {
      const issues = checkRightPaddingBugs(hoursDump, "Hours");
      for (const issue of issues) {
        reportBug({ id: `HOURS-RPAD-${bugs.length + 1}`, severity: "P1", page: "Hours", description: issue, evidence: issue });
      }
    });

    await test("hours: check border issues", () => {
      const issues = checkBorderIssues(hoursDump);
      for (const issue of issues) {
        reportBug({ id: `HOURS-BORDER-${bugs.length + 1}`, severity: "P1", page: "Hours", description: issue, evidence: issue });
      }
    });

    await test("hours: table data visible", () => {
      assert(hoursDump.includes("Mon") || hoursDump.includes("Fri") || hoursDump.includes("Saturday"), "No day names in table");
      assert(hoursDump.includes("6:30") || hoursDump.includes("7:00") || hoursDump.includes("AM"), "No times in table");
    });

    await test("hours: location info visible", () => {
      const hasLocation = hoursDump.includes("Portland") || hoursDump.includes("Alberta") || hoursDump.includes("Find Us");
      assert(hasLocation, "No location info visible");
    });

    await test("hours: links detected", () => {
      const hasLinks = hoursDump.includes("Directions") || hoursDump.includes("Order") || hoursDump.includes("Call");
      assert(hasLinks, "No links visible on Hours page");
    });

    await test("hours: escape back to home", async () => {
      await emu!.goHome();
      await sleep(300);
      assertEqual(emu!.screen.currentPage(), "home", "back on home");
    });

    // ── CONNECT PAGE ──────────────────────────────────────
    console.log("\n  \x1b[1;36m--- Connect Page ---\x1b[0m");

    await test("connect: navigate to Connect", async () => {
      await emu!.navigateTo("Connect");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Connect page, got "${page}"`);
    });

    let connectDump = "";
    await test("connect: dump screen and check content", () => {
      connectDump = emu!.screen.text();
      console.log("\n--- CONNECT PAGE DUMP ---");
      console.log(connectDump);
      console.log("--- END DUMP ---\n");

      const hasForm = connectDump.includes("Name") || connectDump.includes("Email") || connectDump.includes("Submit");
      const hasLinks = connectDump.includes("Instagram") || connectDump.includes("Follow") || connectDump.includes("Gift");
      assert(hasForm || hasLinks, "No form or links visible on Connect page");
    });

    await test("connect: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("connect: check left padding bugs", () => {
      const issues = checkPaddingBugs(connectDump, "Connect");
      for (const issue of issues) {
        reportBug({ id: `CONNECT-LPAD-${bugs.length + 1}`, severity: "P1", page: "Connect", description: issue, evidence: issue });
      }
    });

    await test("connect: check right padding bugs", () => {
      const issues = checkRightPaddingBugs(connectDump, "Connect");
      for (const issue of issues) {
        reportBug({ id: `CONNECT-RPAD-${bugs.length + 1}`, severity: "P1", page: "Connect", description: issue, evidence: issue });
      }
    });

    await test("connect: check border issues", () => {
      const issues = checkBorderIssues(connectDump);
      for (const issue of issues) {
        reportBug({ id: `CONNECT-BORDER-${bugs.length + 1}`, severity: "P1", page: "Connect", description: issue, evidence: issue });
      }
    });

    await test("connect: form fields visible", () => {
      const fields = ["Name", "Email", "Inquiry", "Details", "Submit"];
      const found = fields.filter(f => connectDump.includes(f));
      assert(found.length >= 2, `Expected form fields, found: [${found}]`);
    });

    await test("connect: social links visible", () => {
      const links = ["Instagram", "Order", "Wholesale", "Gift"];
      const found = links.filter(l => connectDump.includes(l));
      assert(found.length >= 2, `Expected social links, found: [${found}]`);
    });

    // Scroll down to see submit button and remaining form
    await test("connect: scroll down to see full form", async () => {
      await emu!.press("down", { times: 8 });
      await sleep(300);
      const text = emu!.screen.text();
      console.log("\n--- CONNECT PAGE SCROLLED ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
    });

    await test("connect: escape back to home", async () => {
      await emu!.goHome();
      await sleep(300);
      assertEqual(emu!.screen.currentPage(), "home", "back on home");
    });

    // ── NAV LOOP ──────────────────────────────────────────
    console.log("\n  \x1b[1;36m--- Navigation Loop ---\x1b[0m");

    await test("nav-loop: cycle through all pages twice", async () => {
      const pages = ["Menu", "Beans", "Hours", "Connect"];
      for (let cycle = 0; cycle < 2; cycle++) {
        for (const page of pages) {
          await emu!.navigateTo(page);
          await sleep(300);
          assert(emu!.isRunning(), `App crashed navigating to ${page} (cycle ${cycle + 1})`);
          const currentPage = emu!.screen.currentPage();
          assert(currentPage !== "home" && currentPage !== null,
            `Failed to navigate to ${page} (cycle ${cycle + 1}), got "${currentPage}"`);
          await emu!.goHome();
          await sleep(200);
        }
      }
    });

    // ── EDGE CASES ────────────────────────────────────────
    console.log("\n  \x1b[1;36m--- Edge Cases ---\x1b[0m");

    await test("edge: rapid keypresses don't crash", async () => {
      await emu!.navigateTo("Menu");
      await sleep(300);
      for (let i = 0; i < 5; i++) {
        await emu!.press("down");
      }
      for (let i = 0; i < 5; i++) {
        await emu!.press("up");
      }
      await sleep(300);
      assert(emu!.isRunning(), "App crashed during rapid keypresses");
      await emu!.goHome();
      await sleep(500);
    });

    await test("edge: escape from home is no-op", async () => {
      // Ensure we're on home first
      if (!emu!.isRunning()) {
        reportBug({ id: "EDGE-CRASH-1", severity: "P0", page: "home", description: "App exited unexpectedly before escape-from-home test", evidence: "" });
        return;
      }
      const beforePage = emu!.screen.currentPage();
      if (beforePage !== "home") {
        reportBug({ id: "EDGE-NAV-1", severity: "P1", page: "home", description: `goHome() did not return to home, got: ${beforePage}`, evidence: emu!.screen.text().substring(0, 200) });
        return;
      }
      await emu!.press("escape");
      await sleep(300);
      const afterPage = emu!.screen.currentPage();
      assertEqual(afterPage, "home", "Should stay on home after escape");
    });

    await test("edge: double escape from page", async () => {
      if (!emu!.isRunning()) {
        reportBug({ id: "EDGE-CRASH-2", severity: "P0", page: "Connect", description: "App not running for double-escape test", evidence: "" });
        return;
      }
      await emu!.navigateTo("Connect");
      await sleep(500);
      await emu!.press("escape");
      await sleep(300);
      await emu!.press("escape");
      await sleep(300);
      assert(emu!.isRunning(), "App crashed after double escape");
    });

    // ── STABILITY + SHUTDOWN ──────────────────────────────
    await test("stability: app still running", () => {
      assert(emu!.isRunning(), "App should still be running");
    });

    await test("shutdown: press q to quit", async () => {
      await emu!.goHome();
      await sleep(200);
      await emu!.press("q");
      await sleep(2000);
      assert(!emu!.isRunning(), "App should have exited after q");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
  }

  // ── RESIZE TESTS (separate emulator instances) ──────────
  console.log("\n  \x1b[1;36m--- Resize: 60 cols (fresh instance) ---\x1b[0m");

  let emu60: TUIEmulator | null = null;
  try {
    await test("resize-60: launch at 60 cols", async () => {
      emu60 = await launchSite(siteDir, 60, 35);
      await emu60.waitForBoot({ timeout: 20000 });
      assert(emu60.isRunning(), "app running at 60 cols");
    });

    if (emu60) {
      await test("resize-60: home page no overflow", () => {
        emu60!.assert.noOverflow();
      });

      // At 60 cols, navigate using arrow keys + enter since menu item detection
      // may fail (the [N] suffix gets truncated at narrow widths)
      const pages60 = ["Menu", "Beans", "Hours", "Connect"];
      for (let idx = 0; idx < pages60.length; idx++) {
        const pageName = pages60[idx];
        await test(`resize-60: ${pageName} page renders`, async () => {
          // Navigate manually: go home, press down idx times, press enter
          try {
            await emu60!.navigateTo(pageName);
          } catch {
            // Menu detection fails at 60 cols -- navigate manually
            // First go home
            for (let i = 0; i < 5; i++) {
              await emu60!.press("escape");
              await sleep(100);
            }
            await sleep(300);
            // Navigate by index
            await emu60!.press("down", { times: idx });
            await sleep(100);
            await emu60!.press("enter");
            await sleep(300);
          }
          await sleep(500);
          assert(emu60!.isRunning(), `App crashed on ${pageName} at 60 cols`);

          const dump = emu60!.screen.text();
          console.log(`\n--- ${pageName.toUpperCase()} @ 60 COLS DUMP ---`);
          console.log(dump);
          console.log("--- END DUMP ---\n");

          // Check overflow
          try {
            emu60!.assert.noOverflow();
          } catch {
            reportBug({
              id: `${pageName.toUpperCase()}-60-OVERFLOW`,
              severity: "P0",
              page: `${pageName}@60cols`,
              description: `Content overflows at 60 cols on ${pageName} page`,
              evidence: dump.substring(0, 200),
            });
          }

          // Check padding
          const lpadIssues = checkPaddingBugs(dump, `${pageName}@60`);
          for (const issue of lpadIssues) {
            reportBug({ id: `${pageName.toUpperCase()}-60-LPAD-${bugs.length + 1}`, severity: "P1", page: `${pageName}@60cols`, description: issue, evidence: issue });
          }

          // Check borders
          const borderIssues = checkBorderIssues(dump);
          for (const issue of borderIssues) {
            reportBug({ id: `${pageName.toUpperCase()}-60-BORDER-${bugs.length + 1}`, severity: "P1", page: `${pageName}@60cols`, description: issue, evidence: issue });
          }

          // Go home for next iteration
          for (let i = 0; i < 5; i++) {
            await emu60!.press("escape");
            await sleep(100);
          }
          await sleep(300);
        });
      }

      await test("resize-60: quit", async () => {
        await emu60!.goHome();
        await sleep(200);
        await emu60!.press("q");
        await sleep(2000);
      });
    }
  } finally {
    try { if (emu60?.isRunning()) emu60.kill(); } catch {}
  }

  // ── RESIZE: 120 cols ────────────────────────────────────
  console.log("\n  \x1b[1;36m--- Resize: 120 cols (fresh instance) ---\x1b[0m");

  let emu120: TUIEmulator | null = null;
  try {
    await test("resize-120: launch at 120 cols", async () => {
      emu120 = await launchSite(siteDir, 120, 40);
      await emu120.waitForBoot({ timeout: 20000 });
      assert(emu120.isRunning(), "app running at 120 cols");
    });

    if (emu120) {
      await test("resize-120: home page no overflow", () => {
        emu120!.assert.noOverflow();
      });

      const pages120 = ["Menu", "Beans", "Hours", "Connect"];
      for (const pageName of pages120) {
        await test(`resize-120: ${pageName} page renders`, async () => {
          await emu120!.navigateTo(pageName);
          await sleep(500);
          assert(emu120!.isRunning(), `App crashed on ${pageName} at 120 cols`);

          const dump = emu120!.screen.text();
          console.log(`\n--- ${pageName.toUpperCase()} @ 120 COLS DUMP ---`);
          console.log(dump);
          console.log("--- END DUMP ---\n");

          try {
            emu120!.assert.noOverflow();
          } catch {
            reportBug({
              id: `${pageName.toUpperCase()}-120-OVERFLOW`,
              severity: "P0",
              page: `${pageName}@120cols`,
              description: `Content overflows at 120 cols on ${pageName} page`,
              evidence: dump.substring(0, 200),
            });
          }

          const lpadIssues = checkPaddingBugs(dump, `${pageName}@120`);
          for (const issue of lpadIssues) {
            reportBug({ id: `${pageName.toUpperCase()}-120-LPAD-${bugs.length + 1}`, severity: "P2", page: `${pageName}@120cols`, description: issue, evidence: issue });
          }

          const rpadIssues = checkRightPaddingBugs(dump, `${pageName}@120`);
          for (const issue of rpadIssues) {
            reportBug({ id: `${pageName.toUpperCase()}-120-RPAD-${bugs.length + 1}`, severity: "P2", page: `${pageName}@120cols`, description: issue, evidence: issue });
          }

          await emu120!.goHome();
          await sleep(300);
        });
      }

      await test("resize-120: quit", async () => {
        await emu120!.goHome();
        await sleep(200);
        await emu120!.press("q");
        await sleep(2000);
      });
    }
  } finally {
    try { if (emu120?.isRunning()) emu120.kill(); } catch {}
  }

  // Cleanup temp dir
  cleanup(siteDir);
}

// ═════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m===============================================\x1b[0m");
  console.log("\x1b[1;36m  Coffee Shop Demo — QA Bug-Hunt Test\x1b[0m");
  console.log("\x1b[1;36m===============================================\x1b[0m");

  const startTime = Date.now();
  await runTests();

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"=".repeat(55)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs Found: ${bugs.length}\x1b[0m`);
    for (const bug of bugs) {
      console.log(`    [${bug.severity}] ${bug.page}: ${bug.description}`);
    }
  }

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    x ${r.name}: ${r.error}`);
    }
  }

  const report = {
    agent: "demo-coffee-shop-qa",
    demo: "coffee-shop",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    bugs_found: bugs.length,
    bugs,
    duration_ms: totalDuration,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  console.log("\n" + JSON.stringify(report, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31mFATAL ERROR:\x1b[0m", err);
  const report = {
    agent: "demo-coffee-shop-qa",
    demo: "coffee-shop",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    bugs_found: bugs.length,
    bugs,
    duration_ms: 0,
    fatal: err.message,
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
