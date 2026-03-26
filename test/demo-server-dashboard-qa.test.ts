#!/usr/bin/env npx tsx
/**
 * Server Dashboard Demo — QA Bug-Hunt Test
 *
 * Exercises every page at multiple terminal widths (60, 100, 120),
 * dumps screens, checks for padding bugs, border breaks, overflow,
 * missing content, and navigation regressions.
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

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2";
  category: string;
  description: string;
  page: string;
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
    console.log(`  \x1b[32m+\x1b[0m ${name} \x1b[2m(${Date.now() - start}ms)\x1b[0m`);
    return true;
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    console.log(`  \x1b[31mX\x1b[0m ${name}`);
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

function fileBug(severity: "P0" | "P1" | "P2", category: string, description: string, page: string, line?: string): void {
  bugCounter++;
  const bug: Bug = { id: `BUG-${bugCounter}`, severity, category, description, page, line };
  bugs.push(bug);
  console.log(`    \x1b[33m[${bug.id}] ${severity} ${category}: ${description}\x1b[0m`);
}

// ── Screen audit helpers ────────────────────────────────────

function auditPadding(screenText: string, page: string): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Missing left padding: border char immediately followed by alphanumeric
    const leftMatch = line.match(/\u2502([A-Za-z0-9])/);
    if (leftMatch) {
      fileBug("P1", "padding", `Line ${i + 1}: missing left padding "\u2502${leftMatch[1]}"`, page, line.trimEnd());
    }
    // Missing right padding: alphanumeric immediately before border char
    const rightMatch = line.match(/([A-Za-z0-9])\u2502/);
    if (rightMatch) {
      fileBug("P1", "padding", `Line ${i + 1}: missing right padding "${rightMatch[1]}\u2502"`, page, line.trimEnd());
    }
  }
}

function auditBorders(screenText: string, page: string): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for top-left corner without matching top-right on same line (truncated border)
    const topLeftCount = (line.match(/[\u250c\u256d\u2554\u250f]/g) || []).length;
    const topRightCount = (line.match(/[\u2510\u256e\u2557\u2513]/g) || []).length;
    if (topLeftCount > 0 && topRightCount === 0 && /[\u2500\u2550\u2501]/.test(line)) {
      fileBug("P1", "border", `Line ${i + 1}: truncated top border (${topLeftCount} openers, 0 closers)`, page, line.trimEnd());
    }
  }
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-sd-qa-${Date.now()}`);
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

async function launchDemo(opts?: { cols?: number; rows?: number }): Promise<TUIEmulator> {
  if (runDir) cleanup(runDir);
  runDir = createRunDir();
  return TUIEmulator.launch({
    command: "npx tsx run.ts",
    cwd: runDir,
    cols: opts?.cols ?? 100,
    rows: opts?.rows ?? 35,
    timeout: 30000,
  });
}

// ── Page names ──────────────────────────────────────────────
const PAGE_NAMES = ["overview", "containers", "network", "logs"];

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m===========================================================\x1b[0m");
  console.log("\x1b[1;36m  Server Dashboard Demo -- QA Bug Hunt\x1b[0m");
  console.log("\x1b[1;36m===========================================================\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // =====================================================
    // SECTION 1: Boot at default size (100x35)
    // =====================================================
    console.log("\n\x1b[1m  Section 1: Boot (100x35)\x1b[0m\n");

    await test("boot: launch resolves", async () => {
      emu = await launchDemo({ cols: 100, rows: 35 });
      assert(emu !== null, "emulator is null");
    });
    if (!emu) throw new Error("Failed to launch emulator");

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: screen shows site content", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("SERVMON") || text.includes("Overview") || text.includes("infrastructure"),
        "no site content on boot screen",
      );
    });

    await test("boot: 4 menu items present", () => {
      emu!.assert.menuItemCount(4);
    });

    await test("boot: currentPage is overview or home", () => {
      const page = emu!.screen.currentPage();
      assert(page === null || page === "overview" || page === "home", `unexpected currentPage: "${page}"`);
    });

    await test("boot: noOverflow", () => {
      emu!.assert.noOverflow();
    });

    // =====================================================
    // SECTION 2: Page-by-page inspection (100x35)
    // =====================================================
    console.log("\n\x1b[1m  Section 2: Page Inspection (100x35)\x1b[0m\n");

    for (const pageName of PAGE_NAMES) {
      await test(`${pageName}: navigateTo`, async () => {
        await emu!.navigateTo(pageName);
        await sleep(500);
        await emu!.waitForIdle(300);
      });

      // Dump screen
      let screenText = "";
      await test(`${pageName}: dump and audit`, () => {
        screenText = emu!.screen.text();
        console.log(`\n--- ${pageName.toUpperCase()} @ 100 cols ---`);
        console.log(screenText);
        console.log("--- END ---\n");
        auditPadding(screenText, `${pageName}@100`);
        auditBorders(screenText, `${pageName}@100`);
      });

      await test(`${pageName}: has content`, () => {
        assert(screenText.trim().length > 50, `page "${pageName}" has very little content`);
      });

      await test(`${pageName}: noOverflow`, () => {
        emu!.assert.noOverflow();
      });

      await test(`${pageName}: borders visible`, () => {
        emu!.assert.borderVisible();
      });

      // Page-specific content checks
      if (pageName === "overview") {
        await test("overview: CPU/Memory/Disk cards", () => {
          assert(screenText.includes("CPU"), "missing CPU");
          assert(screenText.includes("Memory") || screenText.includes("RAM"), "missing Memory");
          assert(screenText.includes("Disk"), "missing Disk");
        });
        await test("overview: progress bar indicators", () => {
          assert(
            screenText.includes("45%") || screenText.includes("72%") || screenText.includes("31%") ||
            screenText.includes("Usage") || screenText.includes("RAM") || screenText.includes("SSD"),
            "no progress bar indicators found",
          );
        });
        await test("overview: cards returned by API", () => {
          const cards = emu!.screen.cards();
          assert(cards.length >= 1, `Expected cards, found ${cards.length}`);
        });
      }

      if (pageName === "containers") {
        await test("containers: table rows", () => {
          assert(screenText.includes("nginx") || screenText.includes("app-web"), "container names missing");
          assert(screenText.includes("Container") || screenText.includes("Status"), "table headers missing");
        });
        await test("containers: access log panel", () => {
          assert(
            screenText.includes("GET /api") || screenText.includes("POST /api") || screenText.includes("Access Logs"),
            "access log entries missing",
          );
        });
      }

      if (pageName === "network") {
        await test("network: bandwidth info", () => {
          assert(screenText.includes("Bandwidth") || screenText.includes("Inbound") || screenText.includes("88 Mbps"),
            "bandwidth info missing");
        });
        await test("network: connection table", () => {
          assert(screenText.includes("443") || screenText.includes("HTTPS") || screenText.includes("Connections"),
            "connection table missing");
        });
      }

      if (pageName === "logs") {
        await test("logs: source cards", () => {
          assert(screenText.includes("nginx") || screenText.includes("app-web"), "log source cards missing");
        });
        await test("logs: stream content", () => {
          assert(
            screenText.includes("Log Stream") || screenText.includes("12:00:0") || screenText.includes("GET /api"),
            "log stream content missing",
          );
        });
      }

      // Navigation within page
      // Note: pressing left at leftmost position acts as goBack (by design),
      // so we only press right then left (which moves right first, giving room to go left).
      await test(`${pageName}: down/right/left nav`, async () => {
        await emu!.press("down", { times: 3 });
        await sleep(200);
        await emu!.press("right");
        await sleep(200);
        // Only press left after right, so we have room to go left without triggering back
        await emu!.press("left");
        await sleep(200);
        assert(emu!.isRunning(), `App crashed during ${pageName} navigation`);
      });

      // After nav, we might have been pushed back to menu by left-at-boundary.
      // Use goHome to ensure we're on menu before next page.
      await test(`${pageName}: return to menu`, async () => {
        await emu!.goHome();
        await sleep(300);
        const menu = emu!.screen.menu();
        assert(menu.items.length >= 3, "menu not visible after returning home");
      });
    }

    // Close first emulator
    await emu!.close();
    await sleep(300);

    // =====================================================
    // SECTION 3: Narrow terminal (60x35)
    // =====================================================
    console.log("\n\x1b[1m  Section 3: Narrow terminal (60x35)\x1b[0m\n");

    await test("narrow: launch at 60x35", async () => {
      emu = await launchDemo({ cols: 60, rows: 35 });
      await emu!.waitForBoot({ timeout: 15000 });
      assert(emu!.isRunning(), "emulator not running at 60 cols");
    });

    for (const pageName of PAGE_NAMES) {
      await test(`narrow[${pageName}]: navigateTo`, async () => {
        await emu!.navigateTo(pageName);
        await sleep(500);
        await emu!.waitForIdle(300);
      });

      await test(`narrow[${pageName}]: dump and audit`, () => {
        const text = emu!.screen.text();
        console.log(`\n--- ${pageName.toUpperCase()} @ 60 cols ---`);
        console.log(text);
        console.log("--- END ---\n");
        auditPadding(text, `${pageName}@60`);
        auditBorders(text, `${pageName}@60`);
        assert(text.trim().length > 30, `page "${pageName}" empty at 60 cols`);
      });

      await test(`narrow[${pageName}]: noOverflow`, () => {
        emu!.assert.noOverflow();
      });

      await test(`narrow[${pageName}]: goBack`, async () => {
        await emu!.goBack();
        await sleep(300);
      });
    }

    await emu!.close();
    await sleep(300);

    // =====================================================
    // SECTION 4: Wide terminal (120x35)
    // =====================================================
    console.log("\n\x1b[1m  Section 4: Wide terminal (120x35)\x1b[0m\n");

    await test("wide: launch at 120x35", async () => {
      emu = await launchDemo({ cols: 120, rows: 35 });
      await emu!.waitForBoot({ timeout: 15000 });
      assert(emu!.isRunning(), "emulator not running at 120 cols");
    });

    for (const pageName of PAGE_NAMES) {
      await test(`wide[${pageName}]: navigateTo`, async () => {
        await emu!.navigateTo(pageName);
        await sleep(500);
        await emu!.waitForIdle(300);
      });

      await test(`wide[${pageName}]: dump and audit`, () => {
        const text = emu!.screen.text();
        console.log(`\n--- ${pageName.toUpperCase()} @ 120 cols ---`);
        console.log(text);
        console.log("--- END ---\n");
        auditPadding(text, `${pageName}@120`);
        auditBorders(text, `${pageName}@120`);
        assert(text.trim().length > 30, `page "${pageName}" empty at 120 cols`);
      });

      await test(`wide[${pageName}]: noOverflow`, () => {
        emu!.assert.noOverflow();
      });

      await test(`wide[${pageName}]: goBack`, async () => {
        await emu!.goBack();
        await sleep(300);
      });
    }

    await emu!.close();
    await sleep(300);

    // =====================================================
    // SECTION 5: Navigation loop
    // =====================================================
    console.log("\n\x1b[1m  Section 5: Navigation Loop\x1b[0m\n");

    await test("navloop: launch fresh emulator", async () => {
      emu = await launchDemo({ cols: 100, rows: 35 });
      await emu!.waitForBoot({ timeout: 15000 });
    });

    for (const pg of PAGE_NAMES) {
      await test(`navloop: visit ${pg} and return`, async () => {
        await emu!.navigateTo(pg);
        await sleep(400);
        const page = emu!.screen.currentPage();
        assert(page !== null, `currentPage is null after navigating to ${pg}`);
        await emu!.goBack();
        await sleep(300);
        assert(emu!.isRunning(), `Crashed after returning from ${pg}`);
      });
    }

    await test("navloop: rapid cycle all pages twice", async () => {
      for (let cycle = 0; cycle < 2; cycle++) {
        for (const pg of PAGE_NAMES) {
          await emu!.navigateTo(pg);
          await sleep(200);
          await emu!.goBack();
          await sleep(200);
        }
      }
      assert(emu!.isRunning(), "Crashed during rapid cycling");
    });

    // =====================================================
    // SECTION 6: Edge cases
    // =====================================================
    console.log("\n\x1b[1m  Section 6: Edge Cases\x1b[0m\n");

    // Helper to ensure we have a running emulator
    async function ensureRunning(): Promise<void> {
      if (!emu || !emu.isRunning()) {
        try { emu?.kill(); } catch {}
        emu = await launchDemo({ cols: 100, rows: 35 });
        await emu.waitForBoot({ timeout: 15000 });
      }
    }

    await test("edge: spam arrows on home menu", async () => {
      await ensureRunning();
      await emu!.goHome();
      await sleep(300);
      await emu!.press("down", { times: 10 });
      await sleep(200);
      await emu!.press("up", { times: 10 });
      await sleep(200);
      assert(emu!.isRunning(), "App crashed on arrow spam on menu");
    });

    await test("edge: enter on last menu item", async () => {
      await ensureRunning();
      await emu!.goHome();
      await sleep(200);
      await emu!.press("down", { times: 10 }); // overshoot to last
      await sleep(200);
      await emu!.press("enter");
      await sleep(500);
      assert(emu!.isRunning(), "Crashed entering last menu item");
      await emu!.goBack();
      await sleep(200);
    });

    await test("edge: spam arrows inside overview", async () => {
      await ensureRunning();
      await emu!.navigateTo("overview");
      await sleep(500);
      await emu!.press("down", { times: 15 });
      await sleep(200);
      await emu!.press("up", { times: 15 });
      await sleep(200);
      await emu!.press("right", { times: 5 });
      await sleep(200);
      assert(emu!.isRunning(), "App crashed on arrow spam inside overview");
      await emu!.goHome();
      await sleep(300);
    });

    await test("edge: tab key does not crash", async () => {
      await ensureRunning();
      await emu!.navigateTo("containers");
      await sleep(500);
      await emu!.press("tab", { times: 3 });
      await sleep(200);
      assert(emu!.isRunning(), "App crashed on tab");
      await emu!.goBack();
      await sleep(200);
    });

    await test("edge: deep navigation in logs split", async () => {
      await ensureRunning();
      await emu!.navigateTo("logs");
      await sleep(500);
      // Navigate through all cards on left panel
      await emu!.press("down", { times: 8 });
      await sleep(200);
      // Cross to right panel
      await emu!.press("right");
      await sleep(200);
      // Navigate down in right panel
      await emu!.press("down", { times: 5 });
      await sleep(200);
      // Cross back
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "App crashed during deep logs navigation");
      await emu!.goHome();
      await sleep(300);
    });

    // =====================================================
    // SECTION 7: Shutdown
    // =====================================================
    console.log("\n\x1b[1m  Section 7: Shutdown\x1b[0m\n");

    await test("shutdown: app still running", () => {
      assert(emu!.isRunning(), "app should still be running");
    });

    await test("shutdown: close() succeeds", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "app should not be running after close");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary ──────────────────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"---".repeat(18)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found: ${bugs.length}\x1b[0m`);
    for (const bug of bugs) {
      console.log(`    [${bug.id}] ${bug.severity} ${bug.category} on ${bug.page}: ${bug.description}`);
      if (bug.line) console.log(`      Line: "${bug.line}"`);
    }
  }

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    X ${r.name}: ${r.error}`);
    }
  }

  // ── JSON Report ──────────────────────────────────────────
  const report = {
    agent: "demo-server-dashboard-qa",
    demo: "demos/server-dashboard",
    timestamp: new Date().toISOString(),
    terminal_sizes_tested: ["100x35", "60x35", "120x35"],
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    bugs_found: bugs.length,
    bugs_by_severity: {
      P0: bugs.filter(b => b.severity === "P0").length,
      P1: bugs.filter(b => b.severity === "P1").length,
      P2: bugs.filter(b => b.severity === "P2").length,
    },
    duration_ms: totalDuration,
    bugs,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  console.log("\n" + JSON.stringify(report, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n\x1b[31mFATAL ERROR:\x1b[0m", err);
  const report = {
    agent: "demo-server-dashboard-qa",
    demo: "demos/server-dashboard",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    bugs_found: bugs.length,
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
