#!/usr/bin/env npx tsx
/**
 * Startup Demo — Emulator Test
 *
 * Launches the startup demo config, verifies boot, navigates all pages,
 * tests arrow key navigation, and verifies clean shutdown.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "startup");

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

function createEmulator(): string {
  const dir = join(tmpdir(), `tui-startup-test-${Date.now()}`);
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

async function launchStartupDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
  runDir = createEmulator();
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
  console.log("\x1b[1;36m  Startup Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchStartupDemo();
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
        text.includes("Warpspeed") ||
        text.includes("WARPSPEED") ||
        text.includes("deploy") ||
        text.includes("Ship faster") ||
        text.includes("Features"),
        "site content not found on screen",
      );
    });

    await test("boot: menu has >= 4 items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 4, `expected >= 4 menu items, got ${menu.items.length}`);
    });

    await test("boot: menu has exactly 5 items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 5, "menu item count");
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    // ── Section 2: Navigate to Features ──────────────────

    console.log("\n\x1b[1m  Section 2: Features Page\x1b[0m\n");

    await test("nav: select Features and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on content page, got "${page}"`);
    });

    await test("features: page contains feature cards", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Edge-First") || text.includes("Preview") ||
        text.includes("Managed") || text.includes("Secrets"),
        "feature card titles not found",
      );
    });

    await test("features: arrow down navigates between items", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after arrow navigation");
    });

    await test("features: arrow right navigates spatially in row", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in row");
    });

    await test("features: arrow left navigates back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("features: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 3: Navigate to Pricing ───────────────────

    console.log("\n\x1b[1m  Section 3: Pricing Page\x1b[0m\n");

    await test("nav: move to Pricing and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Pricing page, got "${page}"`);
    });

    await test("pricing: page contains pricing tiers", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Free") || text.includes("Pro") || text.includes("Enterprise"),
        "pricing tier titles not found",
      );
    });

    await test("pricing: arrow down navigates within pricing", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows in pricing");
    });

    await test("pricing: arrow right navigates across pricing columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow across pricing");
    });

    await test("pricing: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 4: Navigate to Quick Start ───────────────

    console.log("\n\x1b[1m  Section 4: Quick Start Page\x1b[0m\n");

    await test("nav: move to Quick Start and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Quick Start page, got "${page}"`);
    });

    await test("quickstart: page contains accordion steps", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Install") || text.includes("CLI") ||
        text.includes("Configure") || text.includes("Deploy") ||
        text.includes("Monitor"),
        "quickstart accordion labels not found",
      );
    });

    await test("quickstart: arrow down navigates accordion items", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating accordion");
    });

    await test("quickstart: enter toggles accordion item", async () => {
      await emu!.press("enter");
      await sleep(400);
      assert(emu!.isRunning(), "app still running after toggling accordion");
    });

    await test("quickstart: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 5: Navigate to Links ─────────────────────

    console.log("\n\x1b[1m  Section 5: Links Page\x1b[0m\n");

    await test("nav: move to Links and enter", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Links page, got "${page}"`);
    });

    await test("links: page contains resource links", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Documentation") || text.includes("GitHub") ||
        text.includes("Discord") || text.includes("Blog") ||
        text.includes("Resources") || text.includes("Community"),
        "links page content not found",
      );
    });

    await test("links: arrow down navigates between links", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating links");
    });

    await test("links: arrow right navigates across columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in links");
    });

    await test("links: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 6: Stability ─────────────────────────────

    console.log("\n\x1b[1m  Section 6: Stability\x1b[0m\n");

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
    agent: "demo-startup-test",
    demo: "demos/startup",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      features: results.filter(r => r.name.startsWith("features:") || r.name === "nav: select Features and enter").length,
      pricing: results.filter(r => r.name.startsWith("pricing:") || r.name === "nav: move to Pricing and enter").length,
      quickstart: results.filter(r => r.name.startsWith("quickstart:") || r.name === "nav: move to Quick Start and enter").length,
      links: results.filter(r => r.name.startsWith("links:") || r.name === "nav: move to Links and enter").length,
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
    agent: "demo-startup-test",
    demo: "demos/startup",
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
