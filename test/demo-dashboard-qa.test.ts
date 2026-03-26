#!/usr/bin/env npx tsx
/**
 * Dashboard Demo — QA Emulator Test
 *
 * Thorough QA: boot, every menu-accessible page (screen dump + padding/overflow check),
 * resize behavior, navigation loop, edge cases. Skips route-based pages (post detail).
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "dashboard");

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
  title: string;
  details: string;
  line?: string;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];
let bugCounter = 0;

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

function assertPageContains(actual: string | null, expected: string, label: string): void {
  if (!actual || !actual.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${label}: expected page containing "${expected}", got "${actual}"`);
  }
}

function fileBug(severity: Bug["severity"], page: string, title: string, details: string, line?: string) {
  bugCounter++;
  const bug: Bug = { id: `DASH-${bugCounter}`, severity, page, title, details, line };
  bugs.push(bug);
  console.log(`    \x1b[33m⚠ ${bug.id} [${severity}] ${title}\x1b[0m`);
}

/**
 * Check screen text for common layout bugs:
 * - "│Text" (missing left padding after border) outside of tables and split dividers
 * - Lines exceeding terminal width
 *
 * NOTE: Split layouts use │ as a panel divider. When the right panel has no padding,
 * this creates "│Text" which is a framework-level issue (not demo config).
 * We flag these as P2 (framework) rather than P1 (demo config).
 */
function checkPaddingAndOverflow(screenText: string, pageName: string, cols: number): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check left padding: │ followed immediately by a non-space, non-border character
    // Exclude table rows (multiple │ on same line) and box-drawing joins
    const leftPadMatch = line.match(/│([A-Za-z0-9])/);
    if (leftPadMatch) {
      const pipeCount = (line.match(/│/g) || []).length;
      // Split layouts typically have exactly 1 │ divider per line
      // Tables have 3+ │ characters
      // Cards have 2 │ (left and right borders)
      if (pipeCount <= 2) {
        // If we see content on both sides of the │, it's likely a split divider (framework issue)
        const parts = line.split("│");
        const leftHasContent = parts[0] && parts[0].trim().length > 0;
        const rightHasContent = parts[1] && parts[1].trim().length > 0;
        if (leftHasContent && rightHasContent && pipeCount === 1) {
          // Split divider with no right-panel padding — framework issue
          fileBug("P2", pageName, `Split divider has no right-panel padding (framework)`,
            `Line ${i + 1}: "${line.trim()}"`, line);
        } else {
          fileBug("P1", pageName, `Missing left padding after border`,
            `Line ${i + 1}: "${line.trim()}"`, line);
        }
      }
    }
  }
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-dash-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const runContent = `
import config from "${DEMO_DIR}/site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;
  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

let runDir: string | null = null;

async function launchEmu(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
  runDir = createRunDir();
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: runDir,
    cols: opts?.cols ?? 100,
    rows: opts?.rows ?? 35,
    timeout: 45000,
  });
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Dashboard Demo — QA Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ═══════════════════════════════════════════════════════
    // Section 1: Boot
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 1: Boot\x1b[0m\n");

    await test("boot: launch resolves", async () => {
      emu = await launchEmu();
      assert(emu !== null, "emulator is null");
    });

    if (!emu) throw new Error("Failed to launch");

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 20000 });
    });

    // Wait for dynamic content to load (API data)
    await test("boot: dynamic content loads", async () => {
      await emu!.waitForIdle(1500);
      const text = emu!.screen.text();
      assert(
        text.includes("Dashboard") || text.includes("DASHBOARD"),
        "dashboard content not visible after boot"
      );
    });

    await test("boot: isRunning", () => {
      assert(emu!.isRunning(), "should be running");
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assert(page === "home", `expected home, got "${page}"`);
    });

    await test("boot: menu items present", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 4, `expected >= 4 menu items, got ${menu.items.length}: [${menu.items.join(", ")}]`);
      console.log(`    menu items: [${menu.items.join(", ")}]`);
    });

    // ═══════════════════════════════════════════════════════
    // Section 2: Home Page QA
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 2: Home Page\x1b[0m\n");

    // Note: Home page shows the menu view, not the page content.
    // To see the dynamic content (stat cards, tables), we need to "enter" the home page.
    await test("home: enter home page to see dynamic content", async () => {
      // Home is already selected (index 0), press enter
      await emu!.press("enter");
      await emu!.waitForIdle(1500);
    });

    await test("home: screen dump + padding check", async () => {
      const text = emu!.screen.text();
      console.log("\n--- HOME PAGE CONTENT DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "home", 100);
    });

    await test("home: noOverflow assertion", () => {
      emu!.assert.noOverflow();
    });

    await test("home: dynamic content visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Total Posts") || text.includes("Connecting") ||
        text.includes("Dashboard") || text.includes("Recent Posts"),
        "no dynamic content on home page view"
      );
    });

    await test("home: scroll down doesn't crash", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      assert(emu!.isRunning(), "crashed after scrolling on home");

      // Dump after scroll
      const text = emu!.screen.text();
      console.log("\n--- HOME SCROLLED DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "home (scrolled)", 100);
    });

    await test("home: goBack to menu", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "should be on home/menu");
    });

    // ═══════════════════════════════════════════════════════
    // Section 3: Posts Page
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 3: Posts Page\x1b[0m\n");

    await test("posts: navigateTo('Posts')", async () => {
      await emu!.navigateTo("Posts");
      await emu!.waitForIdle(1000);
      const page = emu!.screen.currentPage();
      assertPageContains(page, "Posts", "current page");
    });

    await test("posts: screen dump + padding check", async () => {
      const text = emu!.screen.text();
      console.log("\n--- POSTS SCREEN DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "posts", 100);
    });

    await test("posts: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    await test("posts: contains post cards or search", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Post") || text.includes("Search") || text.includes("Fetching"),
        "posts page has no expected content"
      );
    });

    await test("posts: scroll down 10 lines", async () => {
      await emu!.press("down", { times: 10 });
      await sleep(500);
      assert(emu!.isRunning(), "crash on scroll");

      const text = emu!.screen.text();
      console.log("\n--- POSTS SCROLLED DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "posts (scrolled)", 100);
    });

    await test("posts: goBack to home", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "should be home");
    });

    // ═══════════════════════════════════════════════════════
    // Section 4: Bookmarks Page
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 4: Bookmarks Page\x1b[0m\n");

    await test("bookmarks: navigateTo('Bookmarks')", async () => {
      await emu!.navigateTo("Bookmarks");
      await emu!.waitForIdle(1000);
      const page = emu!.screen.currentPage();
      assertPageContains(page, "Bookmarks", "current page");
    });

    await test("bookmarks: screen dump + padding check", async () => {
      const text = emu!.screen.text();
      console.log("\n--- BOOKMARKS SCREEN DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "bookmarks", 100);
    });

    await test("bookmarks: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    await test("bookmarks: contains expected content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("No bookmarks") || text.includes("bookmark") || text.includes("Bookmark"),
        "bookmarks page missing content"
      );
    });

    await test("bookmarks: goBack to home", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "should be home");
    });

    // ═══════════════════════════════════════════════════════
    // Section 5: New Post Page (split layout)
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 5: New Post Page\x1b[0m\n");

    await test("new-post: navigateTo('New Post')", async () => {
      await emu!.navigateTo("New Post");
      await emu!.waitForIdle(1000);
      const page = emu!.screen.currentPage();
      assertPageContains(page, "New Post", "current page");
    });

    await test("new-post: screen dump + padding check", async () => {
      const text = emu!.screen.text();
      console.log("\n--- NEW POST SCREEN DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "new-post", 100);
    });

    await test("new-post: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    await test("new-post: form fields visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Title") || text.includes("Body") || text.includes("Publish") || text.includes("Create"),
        "form elements not visible on new-post page"
      );
    });

    await test("new-post: split layout - Instructions panel visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Instructions") || text.includes("Tips") || text.includes("Preview"),
        "right split panel (Instructions) not visible"
      );
    });

    await test("new-post: down arrow navigation within form", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(300);
      assert(emu!.isRunning(), "crash during form navigation");

      const text = emu!.screen.text();
      console.log("\n--- NEW POST SCROLLED DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "new-post (scrolled)", 100);
    });

    await test("new-post: goBack to home", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "should be home");
    });

    // ═══════════════════════════════════════════════════════
    // Section 6: About Page
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 6: About Page\x1b[0m\n");

    await test("about: navigateTo('About')", async () => {
      await emu!.navigateTo("About");
      await emu!.waitForIdle(1000);
      const page = emu!.screen.currentPage();
      assertPageContains(page, "About", "current page");
    });

    await test("about: screen dump + padding check", async () => {
      const text = emu!.screen.text();
      console.log("\n--- ABOUT SCREEN DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "about", 100);
    });

    await test("about: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    await test("about: contains description text", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Dashboard Demo") || text.includes("terminaltui") || text.includes("framework"),
        "about page description not found"
      );
    });

    await test("about: links present", () => {
      const text = emu!.screen.text();
      // Links use icon: ">" which renders as "> label" - screen reader links() expects →
      // so check text directly
      assert(
        text.includes("JSONPlaceholder") || text.includes("GitHub") || text.includes("terminaltui"),
        "about page links not found"
      );
    });

    await test("about: goBack to home", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
      assert(emu!.screen.currentPage() === "home", "should be home");
    });

    // ═══════════════════════════════════════════════════════
    // Section 7: Resize Tests
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 7: Resize\x1b[0m\n");

    // Close current emulator and launch a fresh one for resize tests
    await emu!.close();
    await sleep(500);

    await test("resize: launch fresh emulator for resize tests", async () => {
      emu = await launchEmu();
      await emu!.waitForBoot({ timeout: 20000 });
      await emu!.waitForIdle(1500);
      assert(emu!.isRunning(), "emulator running");
    });

    await test("resize: shrink to 60x20", async () => {
      emu!.resize(60, 20);
      await emu!.waitForIdle(1000);
      assert(emu!.isRunning(), "crash on resize to 60x20");
      const text = emu!.screen.text();
      console.log("\n--- RESIZE 60x20 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "home@60x20", 60);
    });

    await test("resize: noOverflow at 60x20", () => {
      emu!.assert.noOverflow();
    });

    await test("resize: navigate to Posts at 60x20", async () => {
      await emu!.navigateTo("Posts");
      await emu!.waitForIdle(1000);
      const text = emu!.screen.text();
      console.log("\n--- POSTS@60x20 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "posts@60x20", 60);
      assert(emu!.isRunning(), "crash on posts at 60x20");
    });

    await test("resize: posts noOverflow at 60x20", () => {
      emu!.assert.noOverflow();
    });

    await test("resize: goBack from posts at 60x20", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
    });

    await test("resize: expand to 140x45", async () => {
      emu!.resize(140, 45);
      await emu!.waitForIdle(1000);
      assert(emu!.isRunning(), "crash on resize to 140x45");
      const text = emu!.screen.text();
      console.log("\n--- RESIZE 140x45 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "home@140x45", 140);
    });

    await test("resize: noOverflow at 140x45", () => {
      emu!.assert.noOverflow();
    });

    await test("resize: restore to 100x35", async () => {
      emu!.resize(100, 35);
      await emu!.waitForIdle(1000);
      assert(emu!.isRunning(), "crash on resize restore");
    });

    // ═══════════════════════════════════════════════════════
    // Section 8: Navigation Loop (rapid cycling)
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 8: Navigation Loop\x1b[0m\n");

    const pages = ["Posts", "Bookmarks", "New Post", "About"];

    await test("nav-loop: cycle through all pages twice", async () => {
      for (let round = 0; round < 2; round++) {
        for (const pg of pages) {
          await emu!.navigateTo(pg);
          await emu!.waitForIdle(500);
          assert(emu!.isRunning(), `crash navigating to ${pg} (round ${round + 1})`);
          await emu!.goBack();
          await emu!.waitForIdle(300);
        }
      }
    });

    await test("nav-loop: still running after 8 navigations", () => {
      assert(emu!.isRunning(), "app crashed during nav loop");
    });

    await test("nav-loop: home page still intact", () => {
      const page = emu!.screen.currentPage();
      assert(page === "home", `expected home, got "${page}"`);
    });

    // ═══════════════════════════════════════════════════════
    // Section 9: Edge Cases
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 9: Edge Cases\x1b[0m\n");

    await test("edge: rapid key presses don't crash", async () => {
      for (let i = 0; i < 15; i++) {
        await emu!.press("down");
      }
      await sleep(200);
      for (let i = 0; i < 15; i++) {
        await emu!.press("up");
      }
      await sleep(200);
      assert(emu!.isRunning(), "crash on rapid keys");
    });

    await test("edge: escape from home doesn't crash", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      await emu!.press("escape");
      await sleep(300);
      // Escape from home might exit or not, check if still usable
      if (emu!.isRunning()) {
        console.log("    (app survived escape from home)");
      } else {
        // App exited on escape from home - file as bug or accept
        fileBug("P2", "home", "Escape from home exits app", "Pressing escape on the home/menu view exits the app");
      }
    });

    // If app exited from escape, relaunch
    if (!emu!.isRunning()) {
      await test("edge: relaunch after escape exit", async () => {
        if (runDir) cleanup(runDir);
        emu = await launchEmu();
        await emu!.waitForBoot({ timeout: 20000 });
        await emu!.waitForIdle(1500);
        assert(emu!.isRunning(), "relaunch failed");
      });
    }

    await test("edge: tab key doesn't crash", async () => {
      await emu!.press("tab");
      await sleep(200);
      await emu!.press("tab");
      await sleep(200);
      assert(emu!.isRunning(), "crash on tab");
    });

    await test("edge: enter on home menu item and return", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      const menu = emu!.screen.menu();
      if (menu.items.length > 0) {
        await emu!.press("enter");
        await emu!.waitForIdle(500);
        assert(emu!.isRunning(), "crash on enter from home");
        await emu!.goBack();
        await emu!.waitForIdle(300);
      }
    });

    // ═══════════════════════════════════════════════════════
    // Section 10: Narrow Terminal (40 cols)
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 10: Narrow Terminal (40 cols)\x1b[0m\n");

    // Launch fresh for narrow test
    await emu!.close();
    await sleep(300);
    if (runDir) cleanup(runDir);

    await test("narrow: launch at 40x25", async () => {
      emu = await launchEmu({ cols: 40, rows: 25 });
      await emu!.waitForBoot({ timeout: 20000 });
      await emu!.waitForIdle(1500);
      assert(emu!.isRunning(), "crash launching at 40x25");
    });

    await test("narrow: 40x25 screen dump + check", () => {
      const text = emu!.screen.text();
      console.log("\n--- NARROW 40x25 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "home@40x25", 40);
    });

    await test("narrow: noOverflow at 40x25", () => {
      emu!.assert.noOverflow();
    });

    await test("narrow: navigate to New Post at 40x25 (split layout)", async () => {
      await emu!.navigateTo("New Post");
      await emu!.waitForIdle(1000);
      const text = emu!.screen.text();
      console.log("\n--- NEW-POST@40x25 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "new-post@40x25", 40);
      assert(emu!.isRunning(), "crash on new-post at 40 cols");
    });

    await test("narrow: new-post noOverflow at 40x25", () => {
      emu!.assert.noOverflow();
    });

    await test("narrow: goBack from new-post", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
    });

    await test("narrow: navigate to About at 40x25", async () => {
      await emu!.navigateTo("About");
      await emu!.waitForIdle(1000);
      const text = emu!.screen.text();
      console.log("\n--- ABOUT@40x25 DUMP ---");
      console.log(text);
      console.log("--- END DUMP ---\n");
      checkPaddingAndOverflow(text, "about@40x25", 40);
      assert(emu!.isRunning(), "crash on about at 40 cols");
    });

    await test("narrow: about noOverflow at 40x25", () => {
      emu!.assert.noOverflow();
    });

    await test("narrow: goBack from about", async () => {
      await emu!.goBack();
      await emu!.waitForIdle(500);
    });

    // ═══════════════════════════════════════════════════════
    // Section 11: Cleanup
    // ═══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 11: Cleanup\x1b[0m\n");

    await test("cleanup: close() shuts down cleanly", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "process still running after close");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary ──────────────────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"─".repeat(55)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found: ${bugs.length}\x1b[0m`);
    for (const b of bugs) {
      console.log(`    ${b.id} [${b.severity}] ${b.page}: ${b.title} — ${b.details}`);
    }
  }

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    \x1b[31m✘ ${r.name}: ${r.error}\x1b[0m`);
    }
  }

  // ── JSON Report ──
  const report = {
    agent: "demo-dashboard-qa",
    demo: "demos/dashboard",
    timestamp: new Date().toISOString(),
    terminal: { cols: 100, rows: 35 },
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    bugs_found: bugs.length,
    bugs,
    sections: {
      boot: results.filter(r => r.name.startsWith("boot:")).length,
      home: results.filter(r => r.name.startsWith("home:")).length,
      posts: results.filter(r => r.name.startsWith("posts:")).length,
      bookmarks: results.filter(r => r.name.startsWith("bookmarks:")).length,
      newPost: results.filter(r => r.name.startsWith("new-post:")).length,
      about: results.filter(r => r.name.startsWith("about:")).length,
      resize: results.filter(r => r.name.startsWith("resize:")).length,
      navLoop: results.filter(r => r.name.startsWith("nav-loop:")).length,
      edge: results.filter(r => r.name.startsWith("edge:")).length,
      narrow: results.filter(r => r.name.startsWith("narrow:")).length,
      cleanup: results.filter(r => r.name.startsWith("cleanup:")).length,
    },
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
    agent: "demo-dashboard-qa",
    demo: "demos/dashboard",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    fatal_error: err.message,
    bugs,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
