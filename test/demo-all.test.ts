#!/usr/bin/env npx tsx
/**
 * Unified demo test — tests all 9 demos with the same reliable pattern.
 * For each demo: boot, verify menu, visit every page, test nav, verify no crash.
 */
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");

const DEMOS = [
  "developer-portfolio",
  "restaurant",
  "startup",
  "band",
  "coffee-shop",
  "conference",
  "freelancer",
  "dashboard",
  "server-dashboard",
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createRunDir(demoName: string): string {
  const dir = join(tmpdir(), `tui-${demoName}-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const demoDir = join(PROJECT_ROOT, "demos", demoName);
  writeFileSync(join(dir, "run.ts"), `
import config from "${demoDir}/site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`);
  return dir;
}

interface DemoResult {
  demo: string;
  passed: number;
  failed: number;
  failures: string[];
  duration: number;
}

async function testDemo(demoName: string): Promise<DemoResult> {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  const start = Date.now();

  function assert(cond: boolean, name: string) {
    if (cond) { passed++; }
    else { failed++; failures.push(name); }
  }

  const runDir = createRunDir(demoName);
  let emu: TUIEmulator | null = null;

  try {
    emu = await TUIEmulator.launch({
      command: "npx tsx run.ts",
      cwd: runDir,
      cols: 120,
      rows: 40,
      timeout: 30000,
    });
    assert(emu.isRunning(), "launch: app running");

    await emu.waitForBoot({ timeout: 15000 });
    assert(emu.screen.text().length > 0, "boot: screen has content");

    const menu = emu.screen.menu();
    const pageCount = menu.items.length;
    assert(pageCount >= 3, `boot: has >= 3 menu items (got ${pageCount})`);

    // Visit every page by pressing enter then escape
    for (let i = 0; i < pageCount; i++) {
      // Press enter to go to current selection
      await emu.press("enter");
      await sleep(800);
      assert(emu.isRunning(), `page ${i}: app running after enter`);

      // Test vertical navigation
      await emu.press("down");
      await sleep(150);
      await emu.press("down");
      await sleep(150);
      await emu.press("up");
      await sleep(150);
      assert(emu.isRunning(), `page ${i}: vertical nav OK`);

      // Test horizontal navigation (right only — left can trigger "go back")
      await emu.press("right");
      await sleep(150);
      assert(emu.isRunning(), `page ${i}: horizontal nav OK`);

      // Go back to home via escape (not left — left may have already gone back)
      await emu.press("escape");
      await sleep(600);

      // If still on a content page (right arrow didn't go back), escape again
      if (emu.isRunning() && emu.screen.menu().items.length === 0) {
        await emu.press("escape");
        await sleep(600);
      }

      assert(emu.isRunning(), `page ${i}: back to home OK`);

      // Move down to next menu item for the next iteration
      await emu.press("down");
      await sleep(200);
    }

    assert(emu.isRunning(), "stability: app still running");

  } catch (err) {
    failed++;
    failures.push(`exception: ${(err as Error).message}`);
  } finally {
    if (emu) {
      try { await emu.close(); } catch {}
    }
    try { rmSync(runDir, { recursive: true, force: true }); } catch {}
  }

  return { demo: demoName, passed, failed, failures, duration: Date.now() - start };
}

async function main() {
  console.log("\n\x1b[1m  Unified Demo Test Suite\x1b[0m\n");

  let totalPassed = 0;
  let totalFailed = 0;
  const results: DemoResult[] = [];

  for (const demo of DEMOS) {
    process.stdout.write(`  Testing ${demo}... `);
    const result = await testDemo(demo);
    results.push(result);
    totalPassed += result.passed;
    totalFailed += result.failed;

    if (result.failed === 0) {
      console.log(`\x1b[32m${result.passed} passed\x1b[0m \x1b[2m(${result.duration}ms)\x1b[0m`);
    } else {
      console.log(`\x1b[31m${result.failed} failed\x1b[0m, ${result.passed} passed \x1b[2m(${result.duration}ms)\x1b[0m`);
      for (const f of result.failures) {
        console.log(`    \x1b[31m- ${f}\x1b[0m`);
      }
    }
  }

  console.log(`\n  \x1b[2m──────────────────────────────────────────────────\x1b[0m`);
  if (totalFailed === 0) {
    console.log(`  \x1b[32m✓ All demos passed: ${totalPassed} tests across ${DEMOS.length} demos\x1b[0m\n`);
  } else {
    console.log(`  \x1b[31m✘ ${totalFailed} failed\x1b[0m, \x1b[32m${totalPassed} passed\x1b[0m across ${DEMOS.length} demos\n`);
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
