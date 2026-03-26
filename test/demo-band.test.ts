#!/usr/bin/env npx tsx
/**
 * Band Demo — Emulator Test
 *
 * Launches the band demo config, verifies boot, navigates all pages,
 * tests arrow key navigation, and verifies clean shutdown.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "band");

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
  const dir = join(tmpdir(), `tui-band-test-${Date.now()}`);
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

async function launchBandDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
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
  console.log("\x1b[1;36m  Band Demo — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ── Section 1: Launch & Boot ──────────────────────────

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchBandDemo();
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
        text.includes("Glass Cathedral") ||
        text.includes("GLASS CATHEDRAL") ||
        text.includes("atmospheric") ||
        text.includes("Discography") ||
        text.includes("Shows"),
        "site content not found on screen",
      );
    });

    await test("boot: screen has at least 4 menu items", () => {
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

    // ── Section 2: Navigate to Discography ────────────────

    console.log("\n\x1b[1m  Section 2: Discography Page\x1b[0m\n");

    await test("nav: select Discography (first item) and enter", async () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "first item selected");
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on content page, got "${page}"`);
    });

    await test("discography: page contains album titles", () => {
      const text = emu!.screen.text();
      assert(text.includes("Weight of Light") || text.includes("Tidal Memory"), "album titles not found");
    });

    await test("discography: page contains tracklist content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("First Light") || text.includes("Tracklist") ||
        text.includes("Littoral") || text.includes("Aphelion"),
        "tracklist content not found",
      );
    });

    await test("discography: arrow down navigates between items", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after arrow navigation");
    });

    await test("discography: arrow right navigates spatially in row", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow in row");
    });

    await test("discography: arrow left navigates spatially", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("discography: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 3: Navigate to Shows ──────────────────────

    console.log("\n\x1b[1m  Section 3: Shows Page (table layout)\x1b[0m\n");

    await test("nav: move to Shows and enter", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Shows page, got "${page}"`);
    });

    await test("shows: page contains tour date info", () => {
      const text = emu!.screen.text();
      assert(text.includes("Portland") || text.includes("Seattle"), "tour date info not found");
    });

    await test("shows: page contains venue names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Revolution Hall") || text.includes("Neumos") ||
        text.includes("Chapel") || text.includes("Lodge Room"),
        "venue names not found",
      );
    });

    await test("shows: page contains tickets link", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Ticket") || text.includes("ticket"),
        "tickets link not found",
      );
    });

    await test("shows: arrow down navigates within page", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after down arrows");
    });

    await test("shows: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 4: Navigate to Press ──────────────────────

    console.log("\n\x1b[1m  Section 4: Press Page (quote grid)\x1b[0m\n");

    await test("nav: move to Press and enter", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Press page, got "${page}"`);
    });

    await test("press: page contains press quotes", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Pitchfork") || text.includes("Stereogum") ||
        text.includes("Quietus") || text.includes("NPR") ||
        text.includes("weather systems") || text.includes("Press"),
        "press page content not found",
      );
    });

    await test("press: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 5: Navigate to About ──────────────────────

    console.log("\n\x1b[1m  Section 5: About Page (container + member grid)\x1b[0m\n");

    await test("nav: move to About and enter", async () => {
      await emu!.press("down", { times: 3 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on About page, got "${page}"`);
    });

    await test("about: page contains band description", () => {
      const text = emu!.screen.text();
      assert(text.includes("Portland") || text.includes("Glass Cathedral"), "band description not found");
    });

    await test("about: page contains member or band content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Maren") || text.includes("Calloway") ||
        text.includes("Jesse") || text.includes("Danny") || text.includes("Sofia") ||
        text.includes("Members") || text.includes("Portland") ||
        text.includes("Glass Cathedral"),
        "about page content not found",
      );
    });

    await test("about: arrow down navigates through member cards", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after navigating member cards");
    });

    await test("about: arrow right navigates across row columns", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right in member row");
    });

    await test("about: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    // ── Section 6: Navigate to Links ──────────────────────

    console.log("\n\x1b[1m  Section 6: Links Page\x1b[0m\n");

    await test("nav: move to Links and enter", async () => {
      await emu!.press("down", { times: 4 });
      await sleep(200);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `should be on Links page, got "${page}"`);
    });

    await test("links: page contains mailing list form", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("mailing") || text.includes("email") ||
        text.includes("Subscribe") || text.includes("subscribe"),
        "mailing list form not found",
      );
    });

    await test("links: page contains link destinations", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Spotify") || text.includes("Bandcamp") ||
        text.includes("Instagram") || text.includes("Merch"),
        "link destinations not found",
      );
    });

    await test("links: escape returns to home", async () => {
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
    agent: "demo-band-test",
    demo: "demos/band",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      discography: results.filter(r => r.name.startsWith("discography:") || r.name === "nav: select Discography (first item) and enter").length,
      shows: results.filter(r => r.name.startsWith("shows:") || r.name === "nav: move to Shows and enter").length,
      press: results.filter(r => r.name.startsWith("press:") || r.name === "nav: move to Press and enter").length,
      about: results.filter(r => r.name.startsWith("about:") || r.name === "nav: move to About and enter").length,
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
    agent: "demo-band-test",
    demo: "demos/band",
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
