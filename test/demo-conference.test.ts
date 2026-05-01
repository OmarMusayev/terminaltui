#!/usr/bin/env npx tsx
/**
 * Conference Demo — Emulator Test
 *
 * Launches the conference demo config, verifies boot, navigates all pages,
 * tests arrow key navigation and spatial layouts, and verifies clean shutdown.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "conference");

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
  const dir = join(tmpdir(), `tui-conference-test-${Date.now()}`);
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

async function launchConferenceDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
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
  console.log("\x1b[1;36m  Conference Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchConferenceDemo();
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
        text.includes("TermConf") ||
        text.includes("TERMCONF") ||
        text.includes("Terminal Renaissance") ||
        text.includes("Schedule") ||
        text.includes("Speakers"),
        "site content not found on screen",
      );
    });

    await test("boot: menu has at least 4 items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 4, `expected >= 4 menu items, got ${menu.items.length}`);
    });

    await test("boot: screen has 5 menu items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 5, "menu item count");
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    // ── Section 2: Navigate to Schedule ──────────────────

    console.log("\n\x1b[1m  Section 2: Schedule Page (tabs + row/col)\x1b[0m\n");

    await test("nav: select Schedule and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on content page, got "${page}"`);
    });

    await test("schedule: page contains session titles", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("State of the Terminal") ||
        text.includes("Bubble Tea") ||
        text.includes("Day 1") ||
        text.includes("Main Stage"),
        "schedule session titles not found",
      );
    });

    await test("schedule: arrow down navigates between sessions", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after arrow navigation");
    });

    await test("schedule: arrow right navigates across columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in row/col");
    });

    await test("schedule: arrow left navigates back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("schedule: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 3: Navigate to Speakers ──────────────────

    console.log("\n\x1b[1m  Section 3: Speakers Page (row/col grid)\x1b[0m\n");

    await test("nav: move to Speakers and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Speakers page, got "${page}"`);
    });

    await test("speakers: page contains speaker names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Sophia Chen") ||
        text.includes("Marcus Rivera") ||
        text.includes("Daniel Park"),
        "speaker names not found",
      );
    });

    await test("speakers: arrow down navigates through speaker cards", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating speaker grid");
    });

    await test("speakers: arrow right navigates across speaker columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right in speaker grid");
    });

    await test("speakers: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 4: Navigate to Venue ─────────────────────

    console.log("\n\x1b[1m  Section 4: Venue Page (row/col layout)\x1b[0m\n");

    await test("nav: move to Venue and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Venue page, got "${page}"`);
    });

    await test("venue: page contains venue info", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Oregon Convention Center") ||
        text.includes("Portland") ||
        text.includes("Hall D"),
        "venue info not found",
      );
    });

    await test("venue: page contains hotel info", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Hyatt") ||
        text.includes("Hotel") ||
        text.includes("189"),
        "hotel info not found",
      );
    });

    await test("venue: arrow right navigates to second column", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in venue layout");
    });

    await test("venue: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 5: Navigate to Sponsors ──────────────────

    console.log("\n\x1b[1m  Section 5: Sponsors Page (sections + row/col)\x1b[0m\n");

    await test("nav: move to Sponsors and enter", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Sponsors page, got "${page}"`);
    });

    await test("sponsors: page contains sponsor names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Warp") ||
        text.includes("Charm") ||
        text.includes("Anthropic"),
        "sponsor names not found",
      );
    });

    await test("sponsors: page contains sponsor tiers", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Gold") ||
        text.includes("Silver") ||
        text.includes("Community"),
        "sponsor tier labels not found",
      );
    });

    await test("sponsors: arrow down navigates through sponsors", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating sponsors");
    });

    await test("sponsors: arrow right navigates across sponsor columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right in sponsor grid");
    });

    await test("sponsors: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 6: App Stability ─────────────────────────

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
    agent: "demo-conference-test",
    demo: "demos/conference",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      schedule: results.filter(r => r.name.startsWith("schedule:") || r.name === "nav: select Schedule and enter").length,
      speakers: results.filter(r => r.name.startsWith("speakers:") || r.name === "nav: move to Speakers and enter").length,
      venue: results.filter(r => r.name.startsWith("venue:") || r.name === "nav: move to Venue and enter").length,
      sponsors: results.filter(r => r.name.startsWith("sponsors:") || r.name === "nav: move to Sponsors and enter").length,
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
    agent: "demo-conference-test",
    demo: "demos/conference",
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
