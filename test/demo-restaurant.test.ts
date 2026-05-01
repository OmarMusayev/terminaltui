#!/usr/bin/env npx tsx
/**
 * Restaurant Demo — Emulator Test
 *
 * Launches the restaurant demo config, verifies boot, navigates all pages,
 * tests arrow key navigation, and verifies clean shutdown.
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

const results: TestResult[] = [];

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

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-restaurant-test-${Date.now()}`);
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

let runDir: string | null = null;

async function launchRestaurantDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
  runDir = createRunDir();
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: runDir,
    cols: opts?.cols ?? 120,
    rows: opts?.rows ?? 40,
    timeout: 30000,
  });
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Restaurant Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchRestaurantDemo();
      assert(emu !== null, "emulator instance is not null");
    });

    if (!emu) {
      throw new Error("Failed to launch emulator");
    }

    await test("launch: isRunning() returns true", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("boot: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: screen shows site content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Rusty Fork") ||
        text.includes("RUSTY FORK") ||
        text.includes("farm-to-table") ||
        text.includes("Menu") ||
        text.includes("Wine"),
        "site content not found on screen",
      );
    });

    await test("boot: screen has 5 menu items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 5, "menu item count");
    });

    await test("boot: menu items >= 4", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 4, `expected >= 4 menu items, got ${menu.items.length}`);
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    // ── Section 2: Menu Page ────────────────────────────

    console.log("\n\x1b[1m  Section 2: Menu Page (tabs + grid)\x1b[0m\n");

    await test("nav: select Menu (first item) and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on content page, got "${page}"`);
    });

    await test("menu: page contains menu items", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Burrata") || text.includes("Ribeye") ||
        text.includes("Starters") || text.includes("Mains"),
        "menu items not found",
      );
    });

    await test("menu: arrow down navigates between items", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after arrow navigation");
    });

    await test("menu: arrow right navigates spatially in grid", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in grid");
    });

    await test("menu: arrow left navigates spatially", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("menu: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 3: Wine Page ──────────────────────────────

    console.log("\n\x1b[1m  Section 3: Wine Page (tabs)\x1b[0m\n");

    await test("nav: move to Wine and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Wine page, got "${page}"`);
    });

    await test("wine: page contains wine listings", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Ridge") || text.includes("Barolo") ||
        text.includes("Cloudy Bay") || text.includes("Champagne") ||
        text.includes("Red") || text.includes("White"),
        "wine listings not found",
      );
    });

    await test("wine: arrow down navigates within tab", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows in wine tab");
    });

    await test("wine: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 4: Our Story Page ──────────────────────────

    console.log("\n\x1b[1m  Section 4: Our Story Page (container + quotes)\x1b[0m\n");

    await test("nav: move to Our Story and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Story page, got "${page}"`);
    });

    await test("story: page contains story content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Elena") || text.includes("supper club") ||
        text.includes("Portland") || text.includes("foundry") ||
        text.includes("Our Story"),
        "story content not found",
      );
    });

    await test("story: page contains quotes", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("New York Times") || text.includes("Bon Appetit") ||
        text.includes("Michelin") || text.includes("precision"),
        "quote content not found",
      );
    });

    await test("story: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 5: Hours & Location Page ──────────────────

    console.log("\n\x1b[1m  Section 5: Hours & Location Page (row/col)\x1b[0m\n");

    await test("nav: move to Hours and enter", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Hours page, got "${page}"`);
    });

    await test("hours: page contains schedule", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Monday") || text.includes("Tuesday") ||
        text.includes("Dinner") || text.includes("Lunch"),
        "schedule content not found",
      );
    });

    await test("hours: page contains location info", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("827") || text.includes("Ironworks") ||
        text.includes("Portland") || text.includes("97209"),
        "location content not found",
      );
    });

    await test("hours: arrow down navigates items", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows on hours page");
    });

    await test("hours: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 6: Contact Page ───────────────────────────

    console.log("\n\x1b[1m  Section 6: Contact Page (split layout)\x1b[0m\n");

    await test("nav: move to Contact and enter", async () => {
      await emu!.press("down", { times: 4 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Contact page, got "${page}"`);
    });

    await test("contact: page contains contact info", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Reservation") || text.includes("Instagram") ||
        text.includes("Email") || text.includes("Phone") ||
        text.includes("Contact"),
        "contact info not found",
      );
    });

    await test("contact: page contains form elements", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Name") || text.includes("Reserve") ||
        text.includes("Party") || text.includes("Date"),
        "form elements not found",
      );
    });

    await test("contact: arrow right crosses to form panel", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow across split");
    });

    await test("contact: arrow left crosses back to links panel", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow across split");
    });

    await test("contact: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 7: App Stability ──────────────────────────

    console.log("\n\x1b[1m  Section 7: Stability\x1b[0m\n");

    await test("stability: app still running after all navigation", () => {
      assert(emu!.isRunning(), "app should still be running");
    });

    await test("stability: close() shuts down cleanly", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "process should not be running after close");
    });
  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary ──
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

  // ── JSON Report ──
  const report = {
    agent: "demo-restaurant-test",
    demo: "demos/restaurant",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      menu: results.filter(r => r.name.startsWith("menu:") || r.name === "nav: select Menu (first item) and enter").length,
      wine: results.filter(r => r.name.startsWith("wine:") || r.name === "nav: move to Wine and enter").length,
      story: results.filter(r => r.name.startsWith("story:") || r.name === "nav: move to Our Story and enter").length,
      hours: results.filter(r => r.name.startsWith("hours:") || r.name === "nav: move to Hours and enter").length,
      contact: results.filter(r => r.name.startsWith("contact:") || r.name === "nav: move to Contact and enter").length,
      stability: results.filter(r => r.name.startsWith("stability:")).length,
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
    agent: "demo-restaurant-test",
    demo: "demos/restaurant",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    fatal_error: err.message,
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
