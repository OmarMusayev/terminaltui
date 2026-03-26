#!/usr/bin/env npx tsx
/**
 * Dashboard Demo — Emulator Test
 *
 * Launches the dashboard demo config, verifies boot, navigates all static pages
 * (skips route pages that need params), tests nav, asserts menu items >= 4.
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
  const dir = join(tmpdir(), `tui-dashboard-test-${Date.now()}`);
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

async function launchDashboardDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
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
  console.log("\x1b[1;36m  Dashboard Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchDashboardDemo();
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
        text.includes("Dashboard") ||
        text.includes("DASHBOARD") ||
        text.includes("API-powered") ||
        text.includes("Posts") ||
        text.includes("Bookmarks"),
        "site content not found on screen",
      );
    });

    await test("boot: menu has at least 4 items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 4, `expected >= 4 menu items, got ${menu.items.length}`);
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    // ── Section 2: Navigate to Posts ────────────────────────

    console.log("\n\x1b[1m  Section 2: Posts Page\x1b[0m\n");

    await test("nav: select Posts and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Posts page, got "${page}"`);
    });

    await test("posts: page contains post content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Post") || text.includes("post") ||
        text.includes("Search") || text.includes("search") ||
        text.includes("User"),
        "posts page content not found",
      );
    });

    await test("posts: arrow down navigates", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after arrow navigation");
    });

    await test("posts: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 3: Navigate to Bookmarks ────────────────────

    console.log("\n\x1b[1m  Section 3: Bookmarks Page\x1b[0m\n");

    await test("nav: move to Bookmarks and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Bookmarks page, got "${page}"`);
    });

    await test("bookmarks: page contains bookmark content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("bookmark") || text.includes("Bookmark") ||
        text.includes("No bookmarks") || text.includes("saved"),
        "bookmarks page content not found",
      );
    });

    await test("bookmarks: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 4: Navigate to New Post ─────────────────────

    console.log("\n\x1b[1m  Section 4: New Post Page (split layout)\x1b[0m\n");

    await test("nav: move to New Post and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on New Post page, got "${page}"`);
    });

    await test("new-post: page contains form elements", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Title") || text.includes("title") ||
        text.includes("Body") || text.includes("Publish") ||
        text.includes("Create") || text.includes("Instructions"),
        "new post form content not found",
      );
    });

    await test("new-post: arrow down navigates within split", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows in split");
    });

    await test("new-post: arrow right crosses to second split panel", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow across split");
    });

    await test("new-post: arrow left crosses back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow across split");
    });

    await test("new-post: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 5: Navigate to About ────────────────────────

    console.log("\n\x1b[1m  Section 5: About Page\x1b[0m\n");

    await test("nav: move to About and enter", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on About page, got "${page}"`);
    });

    await test("about: page contains description", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Dashboard Demo") || text.includes("terminaltui") ||
        text.includes("framework") || text.includes("API"),
        "about page content not found",
      );
    });

    await test("about: page contains links", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("JSONPlaceholder") || text.includes("jsonplaceholder") ||
        text.includes("GitHub") || text.includes("terminaltui"),
        "about page links not found",
      );
    });

    await test("about: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 6: Stability ────────────────────────────────

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
    agent: "demo-dashboard-test",
    demo: "demos/dashboard",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      posts: results.filter(r => r.name.startsWith("posts:") || r.name === "nav: select Posts and enter").length,
      bookmarks: results.filter(r => r.name.startsWith("bookmarks:") || r.name === "nav: move to Bookmarks and enter").length,
      newPost: results.filter(r => r.name.startsWith("new-post:") || r.name === "nav: move to New Post and enter").length,
      about: results.filter(r => r.name.startsWith("about:") || r.name === "nav: move to About and enter").length,
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
    agent: "demo-dashboard-test",
    demo: "demos/dashboard",
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
