#!/usr/bin/env npx tsx
/**
 * Server Dashboard Demo — Emulator Test
 *
 * Launches the server-dashboard demo config, verifies boot, navigates all pages,
 * tests arrow key navigation across row/col grid and split layouts,
 * and verifies clean shutdown.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "server-dashboard");

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
  const dir = join(tmpdir(), `tui-server-dashboard-test-${Date.now()}`);
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

async function launchDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
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
  console.log("\x1b[1;36m  Server Dashboard Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchDemo();
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
        text.includes("SERVMON") ||
        text.includes("infrastructure") ||
        text.includes("Overview") ||
        text.includes("CPU"),
        "site content not found on screen",
      );
    });

    await test("boot: screen has at least 3 menu items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 3, `expected >= 3 menu items, got ${menu.items.length}`);
    });

    await test("boot: screen has 4 menu items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 4, "menu item count");
    });

    await test("boot: currentPage is overview", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "overview", "should start on overview");
    });

    // ── Section 2: Navigate to Containers ────────────────

    console.log("\n\x1b[1m  Section 2: Containers Page (split horizontal)\x1b[0m\n");

    await test("nav: select Containers and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "overview", `should be on content page, got "${page}"`);
    });

    await test("containers: page contains container names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("nginx") || text.includes("postgres") || text.includes("redis"),
        "container names not found",
      );
    });

    await test("containers: arrow down navigates within split", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows in split");
    });

    await test("containers: arrow right crosses to log panel", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow across split");
    });

    await test("containers: arrow left crosses back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow back");
    });

    await test("containers: escape returns to overview", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "overview", "should be back on overview");
    });

    // ── Section 3: Navigate to Network ───────────────────

    console.log("\n\x1b[1m  Section 3: Network Page (row/col grid)\x1b[0m\n");

    await test("nav: move to Network and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "overview", `should be on Network page, got "${page}"`);
    });

    await test("network: page contains bandwidth or connection data", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Bandwidth") || text.includes("Connections") ||
        text.includes("HTTPS") || text.includes("443"),
        "network content not found",
      );
    });

    await test("network: arrow down navigates within row layout", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows in row");
    });

    await test("network: arrow right navigates across columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow across columns");
    });

    await test("network: arrow left navigates back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow back");
    });

    await test("network: escape returns to overview", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "overview", "should be back on overview");
    });

    // ── Section 4: Navigate to Logs ──────────────────────

    console.log("\n\x1b[1m  Section 4: Logs Page (split with cards + sparklines)\x1b[0m\n");

    await test("nav: move to Logs and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "overview", `should be on Logs page, got "${page}"`);
    });

    await test("logs: page contains log source names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("nginx") || text.includes("app-web") ||
        text.includes("postgres") || text.includes("worker"),
        "log source names not found",
      );
    });

    await test("logs: arrow down navigates log cards", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating log cards");
    });

    await test("logs: arrow right crosses to log stream panel", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow to log stream");
    });

    await test("logs: arrow left crosses back to log sources", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow back");
    });

    await test("logs: escape returns to overview", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "overview", "should be back on overview");
    });

    // ── Section 5: Stability ─────────────────────────────

    console.log("\n\x1b[1m  Section 5: Stability\x1b[0m\n");

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
    agent: "demo-server-dashboard-test",
    demo: "demos/server-dashboard",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      containers: results.filter(r => r.name.startsWith("containers:") || r.name === "nav: select Containers and enter").length,
      network: results.filter(r => r.name.startsWith("network:") || r.name === "nav: move to Network and enter").length,
      logs: results.filter(r => r.name.startsWith("logs:") || r.name === "nav: move to Logs and enter").length,
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
    agent: "demo-server-dashboard-test",
    demo: "demos/server-dashboard",
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
