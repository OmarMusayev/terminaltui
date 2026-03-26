#!/usr/bin/env npx tsx
/**
 * Freelancer Demo — Emulator Test
 *
 * Launches the freelancer demo (Studio Kira) with TUIEmulator, verifies boot,
 * navigates to each page, tests arrow key navigation, and closes cleanly.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_CONFIG = join(PROJECT_ROOT, "demos/freelancer/site.config.ts");

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

// ── Temp Runner ─────────────────────────────────────────────

function createRunner(): string {
  const dir = join(tmpdir(), `tui-freelancer-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const runContent = `
import config from "${DEMO_CONFIG}";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;

  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Freelancer Demo (Studio Kira) — Emulator Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m\n");

  const startTime = Date.now();
  const siteDir = createRunner();
  let emu: TUIEmulator | null = null;

  try {
    // ── Launch ──
    console.log("\x1b[1m  Section 1: Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await TUIEmulator.launch({
        command: "npx tsx run.ts",
        cwd: siteDir,
        cols: 120,
        rows: 40,
        timeout: 30000,
      });
      assert(emu !== null, "emulator instance is not null");
    });

    if (!emu) throw new Error("Failed to launch emulator");

    await test("boot: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 20000 });
    });

    await test("boot: site name visible on screen (banner or tagline)", () => {
      const text = emu!.screen.text();
      const found = text.includes("Studio Kira") ||
                    text.includes("STUDIO") ||
                    text.includes("design that moves people") ||
                    text.includes("Services");
      assert(found, "site name/tagline not found on screen");
    });

    await test("boot: isRunning() returns true", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("boot: menu items >= 3", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 3, `Expected >= 3 menu items, got ${menu.items.length}: [${menu.items.join(", ")}]`);
    });

    await test("boot: 4 menu items detected (Services, Work, Testimonials, Contact)", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length === 4, `Expected 4 menu items, got ${menu.items.length}: [${menu.items.join(", ")}]`);
    });

    await test("boot: currentPage() is 'home'", () => {
      assertEqual(emu!.screen.currentPage(), "home", "should be home page");
    });

    // ── Page Navigation ──
    console.log("\n\x1b[1m  Section 2: Page Navigation\x1b[0m\n");

    // Navigate to Services
    await test("nav: navigate to Services page", async () => {
      await emu!.navigateTo("Services");
      await sleep(600);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Services page, got "${page}"`);
    });

    await test("nav: Services page contains service content", () => {
      const text = emu!.screen.text();
      assert(text.includes("Brand Identity") || text.includes("Web Design"), "Service content missing");
    });

    await test("nav: Services page contains deliverables", () => {
      const text = emu!.screen.text();
      assert(text.includes("Logo") || text.includes("Figma") || text.includes("Typography"), "Deliverables missing from Services");
    });

    await test("nav: arrow down on Services page", async () => {
      await emu!.press("down");
      await sleep(300);
      assert(emu!.isRunning(), "still running after down arrow in Services");
    });

    await test("nav: arrow right on Services page (row/col layout)", async () => {
      await emu!.press("right");
      await sleep(300);
      assert(emu!.isRunning(), "still running after right arrow in Services");
    });

    await test("nav: arrow left on Services page", async () => {
      await emu!.press("left");
      await sleep(300);
      assert(emu!.isRunning(), "still running after left arrow in Services");
    });

    await test("nav: go back from Services to home", async () => {
      await emu!.goHome();
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be home after goHome");
    });

    // Navigate to Work
    await test("nav: navigate to Work page", async () => {
      await emu!.navigateTo("Work");
      await sleep(600);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Work page, got "${page}"`);
    });

    await test("nav: Work page contains project content", () => {
      const text = emu!.screen.text();
      assert(text.includes("Solstice") || text.includes("Terraform") || text.includes("Luminary"),
        "Project content missing on Work page");
    });

    await test("nav: arrow navigation on Work page (container + row/col)", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("up");
      await sleep(200);
      assert(emu!.isRunning(), "still running after arrow nav in Work");
    });

    await test("nav: go back from Work to home", async () => {
      await emu!.goHome();
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be home");
    });

    // Navigate to Testimonials
    await test("nav: navigate to Testimonials page", async () => {
      await emu!.navigateTo("Testimonials");
      await sleep(600);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Testimonials page, got "${page}"`);
    });

    await test("nav: Testimonials page contains quote content", () => {
      const text = emu!.screen.text();
      assert(text.includes("Kira") || text.includes("design") || text.includes("brand"),
        "Testimonial content missing");
    });

    await test("nav: Testimonials page has section title", () => {
      const text = emu!.screen.text();
      assert(text.includes("What Clients Say"), "Section title 'What Clients Say' missing");
    });

    await test("nav: arrow navigation on Testimonials page (row/col layout)", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("left");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      assert(emu!.isRunning(), "still running after nav in Testimonials");
    });

    await test("nav: go back from Testimonials to home", async () => {
      await emu!.goHome();
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be home");
    });

    // Navigate to Contact
    await test("nav: navigate to Contact page", async () => {
      await emu!.navigateTo("Contact");
      await sleep(600);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Contact page, got "${page}"`);
    });

    await test("nav: Contact page contains booking info or form", () => {
      const text = emu!.screen.text();
      assert(text.includes("Booking") || text.includes("Q3 2026") || text.includes("Name") || text.includes("Send"),
        "Contact page content missing");
    });

    await test("nav: Contact page contains rates table", () => {
      const text = emu!.screen.text();
      assert(text.includes("Service") || text.includes("Starting At") || text.includes("$8,000"),
        "Rates table missing from Contact page");
    });

    await test("nav: arrow navigation on Contact page (split layout)", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("left");
      await sleep(200);
      await emu!.press("up");
      await sleep(200);
      assert(emu!.isRunning(), "still running after nav in Contact split");
    });

    await test("nav: go back from Contact to home", async () => {
      await emu!.goHome();
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be home");
    });

    // ── Stability ──
    console.log("\n\x1b[1m  Section 3: Stability\x1b[0m\n");

    await test("stable: rapid page cycling doesn't crash", async () => {
      const pages = ["Services", "Work", "Testimonials", "Contact"];
      for (const p of pages) {
        await emu!.navigateTo(p);
        await sleep(400);
        await emu!.press("down");
        await sleep(100);
        await emu!.goHome();
        await sleep(400);
      }
      assert(emu!.isRunning(), "still running after rapid page cycling");
    });

    await test("stable: app is still running after all tests", () => {
      assert(emu!.isRunning(), "process should still be running");
    });

    // ── Clean Close ──
    console.log("\n\x1b[1m  Section 4: Cleanup\x1b[0m\n");

    await test("close: quit cleanly with 'q'", async () => {
      await emu!.goHome();
      await sleep(300);
      await emu!.press("q");
      await sleep(2000);
      assert(!emu!.isRunning(), "process should have exited after q");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
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
    agent: "demo-freelancer",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
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
    agent: "demo-freelancer",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
    fatal: err.message,
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
