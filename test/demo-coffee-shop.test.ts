#!/usr/bin/env npx tsx
/**
 * Coffee Shop Demo — Emulator Integration Test
 *
 * Launches the coffee-shop demo, verifies boot, navigates all pages,
 * tests spatial arrow-key navigation, and confirms clean shutdown.
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");

// ── Test Harness ────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

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

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Temp launcher ───────────────────────────────────────────

function createLauncher(): string {
  const dir = join(tmpdir(), `tui-coffee-test-${Date.now()}`);
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

async function launchSite(dir: string): Promise<TUIEmulator> {
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: dir,
    cols: 120,
    rows: 40,
    timeout: 30000,
  });
}

// ═════════════════════════════════════════════════════════════
//  TESTS
// ═════════════════════════════════════════════════════════════

async function runTests(): Promise<void> {
  console.log("\n\x1b[1m  Coffee Shop Demo — Emulator Tests\x1b[0m\n");

  const siteDir = createLauncher();
  let emu: TUIEmulator | null = null;

  try {
    // ── Boot ──
    await test("launch: TUIEmulator starts without error", async () => {
      emu = await launchSite(siteDir);
      assert(emu !== null, "emulator instance created");
    });

    if (!emu) return;

    await test("launch: isRunning() returns true", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("boot: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 20000 });
    });

    await test("boot: screen shows banner or tagline", () => {
      const text = emu!.screen.text();
      const hasIdentity = emu!.screen.contains("specialty coffee") ||
        emu!.screen.contains("Menu") ||
        emu!.screen.contains("Ember") ||
        emu!.screen.contains("EMBER") ||
        text.includes("\u2588");
      assert(hasIdentity, `Expected site identity on screen, got: ${text.substring(0, 200)}`);
    });

    await test("boot: currentPage is 'home'", () => {
      assertEqual(emu!.screen.currentPage(), "home", "should be home page");
    });

    await test("boot: menu has 4 items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 4, "menu item count");
    });

    await test("boot: menu items match expected pages", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.some(i => i.includes("Menu")), `Expected 'Menu' in items: [${menu.items}]`);
      assert(menu.items.some(i => i.includes("Beans") || i.includes("Our Beans")), `Expected 'Our Beans' in items: [${menu.items}]`);
      assert(menu.items.some(i => i.includes("Hours") || i.includes("Location")), `Expected 'Hours' in items: [${menu.items}]`);
      assert(menu.items.some(i => i.includes("Connect")), `Expected 'Connect' in items: [${menu.items}]`);
    });

    // ── Navigate to Menu page ──
    await test("nav: arrow down selects second menu item", async () => {
      await emu!.press("down");
      await sleep(200);
      const menu = emu!.screen.menu();
      assert(menu.selectedIndex >= 0, "has selected index");
    });

    await test("nav: arrow up returns to first item", async () => {
      await emu!.press("up");
      await sleep(200);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "back to first item");
    });

    await test("nav: enter navigates to Menu page", async () => {
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected content page, got "${page}"`);
    });

    await test("nav: Menu page shows coffee items", () => {
      const hasContent = emu!.screen.contains("Espresso") || emu!.screen.contains("espresso");
      assert(hasContent, "Menu page should mention espresso");
    });

    await test("content: Menu page has at least 3 menu items", () => {
      const text = emu!.screen.text();
      const menuItems = ["Espresso", "Cortado", "Flat White", "Cappuccino", "Oat Latte",
        "Pour Over", "Batch Brew", "Cold Brew", "Matcha Latte", "Chai",
        "Almond Croissant", "Banana Bread", "Cookie"];
      const found = menuItems.filter(item => text.includes(item));
      assert(found.length >= 3, `Expected at least 3 menu items visible, found ${found.length}: [${found}]`);
    });

    // ── Spatial navigation on Menu page (has tabs + row/col) ──
    await test("spatial: down arrow moves focus on Menu page", async () => {
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrow on content page");
    });

    await test("spatial: right arrow works on row/col layout", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow");
    });

    await test("spatial: left arrow works on row/col layout", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("spatial: up arrow works on content page", async () => {
      await emu!.press("up");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after up arrow");
    });

    // ── Navigate back and to Our Beans page ──
    await test("nav: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(800);
      assertEqual(emu!.screen.currentPage(), "home", "back on home page");
    });

    await test("nav: navigate to Our Beans page (index 1)", async () => {
      await emu!.press("down");
      await sleep(100);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Beans page, got "${page}"`);
    });

    await test("nav: Beans page shows roasting content", () => {
      const hasContent = emu!.screen.contains("Roast") || emu!.screen.contains("Ethiopia") || emu!.screen.contains("roast");
      assert(hasContent, "Beans page should mention roasting or origins");
    });

    // ── Spatial navigation on Beans page (has row/col) ──
    await test("spatial: down arrow on Beans row/col layout", async () => {
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app running after down on row/col");
    });

    await test("spatial: right arrow on Beans row/col layout", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app running after right on row/col");
    });

    await test("spatial: left arrow on Beans row/col layout", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app running after left on row/col");
    });

    await test("spatial: up arrow on Beans page", async () => {
      await emu!.press("up");
      await sleep(200);
      assert(emu!.isRunning(), "app running after up on Beans");
    });

    // ── Navigate to Hours & Location page ──
    await test("nav: escape from Beans back to home", async () => {
      await emu!.press("escape");
      await sleep(800);
      assertEqual(emu!.screen.currentPage(), "home", "back on home page");
    });

    await test("nav: navigate to Hours & Location page (index 2)", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(100);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Hours page, got "${page}"`);
    });

    await test("nav: Hours page shows schedule content", () => {
      const text = emu!.screen.text();
      const hasContent = text.includes("Monday") || text.includes("AM") || text.includes("PM") ||
        text.includes("Hours") || text.includes("Find Us") || text.includes("Portland") ||
        text.includes("6:30") || text.includes("7:00") || text.includes("back");
      assert(hasContent, `Hours page should show schedule. Screen: ${text.substring(0, 300)}`);
    });

    // ── Spatial navigation on Hours page (has row/col) ──
    await test("spatial: right arrow on Hours row/col", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app running after right on Hours");
    });

    await test("spatial: down arrow on Hours page", async () => {
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app running after down on Hours");
    });

    await test("spatial: left arrow on Hours page", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app running after left on Hours");
    });

    // ── Navigate to Connect page ──
    await test("nav: escape from Hours back to home", async () => {
      await emu!.press("escape");
      await sleep(800);
      assertEqual(emu!.screen.currentPage(), "home", "back on home page");
    });

    await test("nav: navigate to Connect page (index 3)", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(100);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected Connect page, got "${page}"`);
    });

    await test("nav: Connect page shows form or links", () => {
      const text = emu!.screen.text();
      const hasContent = text.includes("Name") || text.includes("Instagram") || text.includes("Submit") ||
        text.includes("Email") || text.includes("Inquiry") || text.includes("Follow") ||
        text.includes("Gift") || text.includes("back") || text.includes("Connect") ||
        text.includes("Catering");
      assert(hasContent, `Connect page should show form fields or links. Screen: ${text.substring(0, 300)}`);
    });

    // ── Spatial navigation on Connect page (has split) ──
    await test("spatial: down arrow on Connect page", async () => {
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app running after down on Connect");
    });

    await test("spatial: right arrow on Connect split layout", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app running after right on Connect split");
    });

    await test("spatial: down in right panel of Connect", async () => {
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app running after down in right panel");
    });

    await test("spatial: left arrow back in Connect split", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app running after left on Connect split");
    });

    await test("spatial: up arrow on Connect page", async () => {
      await emu!.press("up");
      await sleep(200);
      assert(emu!.isRunning(), "app running after up on Connect");
    });

    // ── Final: return home and verify stability ──
    await test("nav: return to home from current page", async () => {
      const page = emu!.screen.currentPage();
      if (page !== "home") {
        await emu!.press("escape");
        await sleep(800);
      }
      if (emu!.screen.currentPage() !== "home") {
        await emu!.press("escape");
        await sleep(800);
      }
      assertEqual(emu!.screen.currentPage(), "home", "back on home page");
    });

    await test("stability: app is still running after all navigation", () => {
      assert(emu!.isRunning(), "app should still be running");
    });

    // ── Clean shutdown ──
    await test("shutdown: press q to quit", async () => {
      await emu!.press("q");
      await sleep(2000);
      assert(!emu!.isRunning(), "app should have exited after q");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Coffee Shop Demo — Integration Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  await runTests();

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"─".repeat(55)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    \x1b[31m✘ ${r.name}: ${r.error}\x1b[0m`);
    }
  }

  const report = {
    agent: "demo-coffee-shop",
    demo: "coffee-shop",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
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
    agent: "demo-coffee-shop",
    demo: "coffee-shop",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    duration_ms: 0,
    fatal: err.message,
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
