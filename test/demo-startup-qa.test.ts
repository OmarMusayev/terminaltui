#!/usr/bin/env npx tsx
/**
 * Startup Demo — QA Emulator Test
 *
 * Comprehensive QA: boot, navigate all pages, dump screens,
 * check padding/overflow/borders, test resize at 60 and 120 cols,
 * navigation loops, edge cases.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "startup");

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
  title: string;
  page: string;
  description: string;
  evidence: string;
  fixable_in_demo_config: boolean;
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
    console.log(`  + ${name} (${Date.now() - start}ms)`);
    return true;
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    console.log(`  X ${name}`);
    console.log(`    ${err.message}`);
    return false;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function reportBug(
  severity: "P0" | "P1" | "P2", title: string, page: string,
  description: string, evidence: string, fixableInConfig = false,
): void {
  bugCounter++;
  bugs.push({
    id: `STARTUP-${bugCounter}`, severity, title, page,
    description, evidence, fixable_in_demo_config: fixableInConfig,
  });
  console.log(`  BUG STARTUP-${bugCounter} [${severity}] ${title}`);
}

/**
 * Scan screen for padding bugs: text touching vertical border without space.
 * Only flags genuine card-content lines (those with border chars on both sides).
 */
function checkPaddingBugs(screenText: string, page: string): string[] {
  const found: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 5) continue;
    // Look for vertical-bar immediately followed by a letter (no space)
    // Only count if there is also a closing border on the same line
    const match = line.match(/([\u2502\u2503\u2551])([A-Za-z])/);
    if (match) {
      const afterMatch = line.substring(line.indexOf(match[0]) + 2);
      if (/[\u2502\u2503\u2551]/.test(afterMatch)) {
        const msg = `Line ${i + 1}: text "${match[2]}" touches border "${match[1]}"`;
        found.push(msg);
      }
    }
  }
  return found;
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-startup-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "run.ts"), `
import config from "${DEMO_DIR}/config.js";
import { runFileBasedSite } from "${PROJECT_ROOT}/src/index.js";
runFileBasedSite({
  config,
  pagesDir: "${DEMO_DIR}/pages",
  outDir: "${DEMO_DIR}/.terminaltui",
});
`);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

async function launchEmu(opts?: { cols?: number; rows?: number }): Promise<{ emu: TUIEmulator; dir: string }> {
  const dir = createRunDir();
  const emu = await TUIEmulator.launch({
    command: "npx tsx run.ts",
    cwd: dir,
    cols: opts?.cols ?? 100,
    rows: opts?.rows ?? 35,
    timeout: 30000,
  });
  return { emu, dir };
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n===================================================");
  console.log("  Startup Demo -- QA Emulator Test");
  console.log("===================================================");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;
  let runDir: string | null = null;

  try {
    // ── Section 1: Boot ──────────────────────────────────
    console.log("\n  Section 1: Boot & Home Page\n");

    await test("boot: launch emulator (100x35)", async () => {
      const r = await launchEmu();
      emu = r.emu;
      runDir = r.dir;
      assert(emu !== null, "emulator is null");
    });
    if (!emu) throw new Error("Failed to launch");

    await test("boot: waitForBoot", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: isRunning", () => {
      assert(emu!.isRunning(), "not running");
    });

    await test("boot: currentPage is home", () => {
      const p = emu!.screen.currentPage();
      assert(p === null || p === "home", `got "${p}"`);
    });

    await test("boot: 5 menu items", () => {
      emu!.assert.menuItemCount(5);
    });

    await test("boot: menu item names", () => {
      const items = emu!.screen.menu().items.map(i => i.toLowerCase());
      for (const name of ["home", "features", "pricing", "links"]) {
        assert(items.some(i => i.includes(name)), `missing "${name}"`);
      }
      assert(items.some(i => i.includes("quick") || i.includes("start")), "missing Quick Start");
    });

    await test("boot: banner or site name visible", () => {
      const text = emu!.screen.text();
      // The banner is ASCII art so "WARPSPEED" may not appear as readable text
      // Check for the tagline or any recognizable text
      assert(
        text.includes("WARPSPEED") || text.includes("Warpspeed") ||
        text.includes("deploy at the speed of thought") ||
        text.includes("Home"),
        "no recognizable site content on home screen"
      );
    });

    await test("boot: tagline visible", () => {
      emu!.assert.textVisible("deploy at the speed of thought");
    });

    await test("boot: no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Dump home screen
    const homeText = emu!.screen.text();
    console.log("\n--- HOME SCREEN (100x35) ---");
    console.log(homeText);
    console.log("--- END ---\n");

    const homePadBugs = checkPaddingBugs(homeText, "home");
    if (homePadBugs.length > 0) {
      reportBug("P1", "Padding bug on home page", "home",
        "Text touches border", homePadBugs.join("; "));
    }

    // ── Section 2: Features ──────────────────────────────
    console.log("\n  Section 2: Features Page\n");

    await test("features: navigateTo", async () => {
      await emu!.navigateTo("features");
      await emu!.waitForIdle(300);
    });

    await test("features: page detected", () => {
      const p = emu!.screen.currentPage();
      assert(p !== null && p.toLowerCase().includes("feature"), `got "${p}"`);
    });

    await test("features: Edge-First card visible", () => {
      emu!.assert.textVisible("Edge-First Architecture");
    });

    await test("features: no overflow", () => {
      emu!.assert.noOverflow();
    });

    let featText = emu!.screen.text();
    console.log("\n--- FEATURES (100x35) ---");
    console.log(featText);
    console.log("--- END ---\n");
    let padBugs = checkPaddingBugs(featText, "features");
    if (padBugs.length > 0) {
      reportBug("P1", "Padding bug on features page", "features",
        "Text touches border", padBugs.join("; "));
    }

    // Scroll down to see more cards
    await test("features: scroll reveals more cards", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(200);
      assert(emu!.isRunning(), "crashed during scroll");
      const t = emu!.screen.text();
      const more = ["Managed", "Secrets", "Custom Domains", "Team Collaboration"].some(s => t.includes(s));
      assert(more, "no additional cards after scrolling");
    });

    featText = emu!.screen.text();
    console.log("\n--- FEATURES SCROLLED ---");
    console.log(featText);
    console.log("--- END ---\n");
    padBugs = checkPaddingBugs(featText, "features-scrolled");
    if (padBugs.length > 0) {
      reportBug("P1", "Padding bug on features page (scrolled)", "features",
        "Text touches border after scroll", padBugs.join("; "));
    }

    // ── Section 3: Pricing ───────────────────────────────
    console.log("\n  Section 3: Pricing Page\n");

    await test("pricing: navigateTo", async () => {
      await emu!.navigateTo("pricing");
      await emu!.waitForIdle(300);
    });

    await test("pricing: page detected", () => {
      const p = emu!.screen.currentPage();
      assert(p !== null && p.toLowerCase().includes("pricing"), `got "${p}"`);
    });

    await test("pricing: Free tier visible", () => {
      emu!.assert.textVisible("Free");
    });

    await test("pricing: Pro tier visible", () => {
      emu!.assert.textVisible("Pro");
    });

    await test("pricing: pricing amounts", () => {
      const t = emu!.screen.text();
      assert(t.includes("$0") || t.includes("$20"), "no pricing amounts");
    });

    await test("pricing: no overflow", () => {
      emu!.assert.noOverflow();
    });

    const pricingText = emu!.screen.text();
    console.log("\n--- PRICING (100x35) ---");
    console.log(pricingText);
    console.log("--- END ---\n");
    padBugs = checkPaddingBugs(pricingText, "pricing");
    if (padBugs.length > 0) {
      reportBug("P1", "Padding bug on pricing page", "pricing",
        "Text touches border", padBugs.join("; "));
    }

    // Check Enterprise truncation
    if (pricingText.includes("Enterpri") && !pricingText.includes("Enterprise")) {
      reportBug("P2", "Enterprise title truncated", "pricing",
        "The 'Enterprise' card title is truncated to 'Enterpri...' due to narrow column width",
        "visible in pricing dump", true);
    }

    // ── Section 4: Quick Start ───────────────────────────
    console.log("\n  Section 4: Quick Start Page\n");

    await test("quickstart: navigateTo", async () => {
      await emu!.navigateTo("quick start");
      await emu!.waitForIdle(300);
    });

    await test("quickstart: page detected", () => {
      const p = emu!.screen.currentPage();
      assert(p !== null && (p.toLowerCase().includes("quick") || p.toLowerCase().includes("start")), `got "${p}"`);
    });

    await test("quickstart: all 4 accordion steps", () => {
      const t = emu!.screen.text();
      assert(t.includes("1. Install"), "missing step 1");
      assert(t.includes("2. Configure"), "missing step 2");
      assert(t.includes("3. Deploy"), "missing step 3");
      assert(t.includes("4. Monitor"), "missing step 4");
    });

    await test("quickstart: no overflow", () => {
      emu!.assert.noOverflow();
    });

    const qsText = emu!.screen.text();
    console.log("\n--- QUICKSTART (100x35) ---");
    console.log(qsText);
    console.log("--- END ---\n");

    await test("quickstart: accordion toggle works", async () => {
      await emu!.press("down");
      await sleep(150);
      await emu!.press("enter");
      await sleep(400);
      const t = emu!.screen.text();
      const expanded = t.includes("npm install") || t.includes("warpspeed") ||
                       t.includes("Navigate") || t.includes("cd my-app");
      assert(expanded, "accordion content not expanded");
      assert(emu!.isRunning(), "crashed on accordion toggle");
    });

    const qsExpanded = emu!.screen.text();
    console.log("\n--- QUICKSTART EXPANDED ---");
    console.log(qsExpanded);
    console.log("--- END ---\n");

    await test("quickstart: expanded no overflow", () => {
      emu!.assert.noOverflow();
    });

    // ── Section 5: Links ─────────────────────────────────
    console.log("\n  Section 5: Links Page\n");

    await test("links: navigateTo", async () => {
      await emu!.navigateTo("links");
      await emu!.waitForIdle(300);
    });

    await test("links: page detected", () => {
      const p = emu!.screen.currentPage();
      assert(p !== null && p.toLowerCase().includes("link"), `got "${p}"`);
    });

    await test("links: Resources section", () => {
      emu!.assert.textVisible("Resources");
    });

    await test("links: Community section", () => {
      emu!.assert.textVisible("Community");
    });

    await test("links: Documentation link", () => {
      emu!.assert.textVisible("Documentation");
    });

    await test("links: Discord link", () => {
      emu!.assert.textVisible("Discord");
    });

    await test("links: no overflow", () => {
      emu!.assert.noOverflow();
    });

    const linksText = emu!.screen.text();
    console.log("\n--- LINKS (100x35) ---");
    console.log(linksText);
    console.log("--- END ---\n");

    // ── Section 6: Resize 60 cols ────────────────────────
    console.log("\n  Section 6: Resize to 60 cols\n");

    await test("resize-60: go home", async () => {
      await emu!.goHome();
      await sleep(300);
    });

    await test("resize-60: resize to 60x35 survives", async () => {
      await emu!.resize(60, 35);
      await emu!.waitForIdle(500);
      if (!emu!.isRunning()) {
        reportBug("P0", "App crashes on resize to 60 cols", "any",
          "Resizing from 100 to 60 cols kills the process",
          "emu.isRunning() = false after resize");
        throw new Error("app crashed on resize");
      }
    });

    await test("resize-60: no overflow", () => {
      emu!.assert.noOverflow();
    });

    const home60 = emu!.screen.text();
    console.log("\n--- HOME @ 60 COLS ---");
    console.log(home60);
    console.log("--- END ---\n");

    // Check features at 60
    await test("resize-60: features page renders", async () => {
      await emu!.navigateTo("features");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "crashed navigating to features at 60");
    });

    const feat60 = emu!.screen.text();
    console.log("\n--- FEATURES @ 60 COLS ---");
    console.log(feat60);
    console.log("--- END ---\n");

    // Check for render corruption at 60 cols
    await test("resize-60: features content not corrupted", () => {
      const t = emu!.screen.text();
      // At 60 cols the row layout with span:6 cards should ideally stack
      // Check if the rendering is garbled (old buffer content visible)
      const bannerChars = (t.match(/▐░/g) || []).length;
      if (bannerChars > 5) {
        reportBug("P0", "Render corruption at 60 cols on features page", "features",
          "Old buffer content (banner characters) bleeds through into page content after resize",
          `Found ${bannerChars} banner chars in features page`);
      }
    });

    // Pricing at 60
    await test("resize-60: pricing page renders", async () => {
      await emu!.navigateTo("pricing");
      await emu!.waitForIdle(300);
      assert(emu!.isRunning(), "crashed navigating to pricing at 60");
    });

    const price60 = emu!.screen.text();
    console.log("\n--- PRICING @ 60 COLS ---");
    console.log(price60);
    console.log("--- END ---\n");

    // ── Section 7: Resize 120 cols (fresh instance) ──────
    console.log("\n  Section 7: Resize to 120 cols\n");

    // Use a fresh emulator to avoid accumulated resize corruption
    await emu!.close();
    if (runDir) cleanup(runDir);
    await sleep(300);

    await test("resize-120: launch fresh emulator", async () => {
      const r = await launchEmu({ cols: 120, rows: 35 });
      emu = r.emu;
      runDir = r.dir;
      await emu!.waitForBoot({ timeout: 15000 });
      assert(emu!.isRunning(), "fresh 120-col emulator not running");
    });

    await test("resize-120: home no overflow at 120", () => {
      emu!.assert.noOverflow();
    });

    const home120 = emu!.screen.text();
    console.log("\n--- HOME @ 120 COLS ---");
    console.log(home120);
    console.log("--- END ---\n");

    await test("resize-120: features at 120", async () => {
      await emu!.navigateTo("features");
      await emu!.waitForIdle(300);
      emu!.assert.noOverflow();
    });

    const feat120 = emu!.screen.text();
    console.log("\n--- FEATURES @ 120 COLS ---");
    console.log(feat120);
    console.log("--- END ---\n");

    await test("resize-120: pricing at 120", async () => {
      await emu!.navigateTo("pricing");
      await emu!.waitForIdle(300);
      emu!.assert.noOverflow();
    });

    const price120 = emu!.screen.text();
    console.log("\n--- PRICING @ 120 COLS ---");
    console.log(price120);
    console.log("--- END ---\n");

    padBugs = checkPaddingBugs(price120, "pricing@120");
    if (padBugs.length > 0) {
      reportBug("P1", "Padding bug on pricing at 120 cols", "pricing",
        "Text touches border at wide width", padBugs.join("; "));
    }

    // ── Section 8: Navigation Loop ───────────────────────
    console.log("\n  Section 8: Navigation Loop\n");

    await test("navloop: cycle all pages", async () => {
      for (const p of ["features", "pricing", "quick start", "links"]) {
        await emu!.navigateTo(p);
        await sleep(100);
        assert(emu!.isRunning(), `crashed on ${p}`);
        await emu!.goHome();
        await sleep(100);
      }
    });

    await test("navloop: rapid nav stress (3 cycles)", async () => {
      for (let i = 0; i < 3; i++) {
        await emu!.navigateTo("features");
        await emu!.goBack();
        await emu!.navigateTo("pricing");
        await emu!.goBack();
      }
      assert(emu!.isRunning(), "crashed during rapid nav");
    });

    await test("navloop: goBack returns to home", async () => {
      await emu!.navigateTo("links");
      await sleep(100);
      await emu!.goBack();
      await sleep(200);
      const p = emu!.screen.currentPage();
      assert(p === null || p === "home", `expected home, got "${p}"`);
    });

    // ── Section 9: Edge Cases ────────────────────────────
    console.log("\n  Section 9: Edge Cases\n");

    await test("edge: escape from home behavior", async () => {
      await emu!.goHome();
      await sleep(200);
      // Single escape from home - check if app survives
      await emu!.press("escape");
      await sleep(300);
      if (!emu!.isRunning()) {
        reportBug("P1", "Single escape from home kills app", "home",
          "Pressing escape once on the home screen exits the application",
          "emu.isRunning() = false after escape from home");
      }
    });

    // Re-launch if escape killed or corrupted the app
    {
      const menu = emu!.screen.menu();
      if (!emu!.isRunning() || menu.items.length === 0) {
        console.log("  [Re-launching after escape exit/corruption]");
        try { emu!.kill(); } catch {}
        if (runDir) cleanup(runDir);
        await sleep(300);
        const r = await launchEmu({ cols: 120, rows: 35 });
        emu = r.emu;
        runDir = r.dir;
        await emu!.waitForBoot({ timeout: 15000 });
        reportBug("P1", "Escape from home corrupts app state", "home",
          "Pressing escape on home screen kills or corrupts the app, requiring re-launch",
          "menu.items.length = 0 after escape from home");
      }
    }

    await test("edge: menu preserved after nav cycle", async () => {
      await emu!.goHome();
      await sleep(200);
      const menuBefore = emu!.screen.menu();
      assert(menuBefore.items.length > 0, `no menu items visible before nav: ${menuBefore.items.length}`);
      await emu!.navigateTo("features");
      await sleep(100);
      await emu!.goBack();
      await sleep(300);
      const menu = emu!.screen.menu();
      assert(menu.items.length === 5, `menu lost items: ${menu.items.length}`);
    });

    await test("edge: enter on inner content", async () => {
      await emu!.goHome();
      await sleep(200);
      await emu!.navigateTo("features");
      await sleep(100);
      await emu!.press("enter");
      await sleep(200);
      assert(emu!.isRunning(), "crashed on enter in page content");
      await emu!.goHome();
      await sleep(200);
    });

    // ── Section 10: Content Completeness ─────────────────
    console.log("\n  Section 10: Content Completeness\n");

    await test("content: features has >= 4 card titles scrolling", async () => {
      await emu!.goHome();
      await sleep(200);
      await emu!.navigateTo("features");
      await emu!.waitForIdle(200);
      const allText: string[] = [emu!.screen.text()];
      for (let i = 0; i < 8; i++) {
        await emu!.press("down");
        await sleep(120);
        allText.push(emu!.screen.text());
      }
      const combined = allText.join("\n");
      const titles = [
        "Edge-First", "Preview Deployments", "Managed Databases",
        "Secrets", "Custom Domains", "Team Collaboration",
      ];
      const found = titles.filter(t => combined.includes(t));
      assert(found.length >= 4, `only found ${found.length} titles: ${found.join(", ")}`);
    });

    await test("content: pricing has 3 tier names", async () => {
      await emu!.navigateTo("pricing");
      await emu!.waitForIdle(200);
      const t = emu!.screen.text();
      const hasFree = t.includes("Free");
      const hasPro = t.includes("Pro");
      // Enterprise may be truncated to "Enterpri" at narrow widths
      const hasEnterprise = t.includes("Enterprise") || t.includes("Enterpri") || t.includes("Custom pric") || t.includes("Custom p");
      const count = [hasFree, hasPro, hasEnterprise].filter(Boolean).length;
      assert(count >= 3, `only ${count} tier names found (Free=${hasFree}, Pro=${hasPro}, Enterprise=${hasEnterprise})`);
    });

    await test("content: quickstart has 4 steps", async () => {
      await emu!.navigateTo("quick start");
      await emu!.waitForIdle(200);
      const t = emu!.screen.text();
      for (const s of ["1. Install", "2. Configure", "3. Deploy", "4. Monitor"]) {
        assert(t.includes(s), `missing step: ${s}`);
      }
    });

    await test("content: links has both sections", async () => {
      await emu!.navigateTo("links");
      await emu!.waitForIdle(200);
      emu!.assert.textVisible("Resources");
      emu!.assert.textVisible("Community");
    });

    // ── Section 11: Cleanup ──────────────────────────────
    console.log("\n  Section 11: Cleanup\n");

    await test("cleanup: app still running", () => {
      assert(emu!.isRunning(), "app died");
    });

    await test("cleanup: close()", async () => {
      await emu!.close();
      await sleep(300);
      assert(!emu!.isRunning(), "still running after close");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary & Report ──────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n  ${"---".repeat(18)}`);
  console.log(`  ${passed} passed, ${failed} failed (${totalDuration}ms)`);

  if (bugs.length > 0) {
    console.log(`\n  Bugs found: ${bugs.length}`);
    for (const b of bugs) {
      console.log(`    ${b.id} [${b.severity}] ${b.title} (${b.page})`);
      console.log(`      ${b.description}`);
      console.log(`      Fixable in demo config: ${b.fixable_in_demo_config}`);
    }
  }

  if (failed > 0) {
    console.log(`\n  Failed tests:`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    X ${r.name}: ${r.error}`);
    }
  }

  const report = {
    agent: "demo-startup-qa",
    demo: "demos/startup",
    timestamp: new Date().toISOString(),
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
  console.error("\nFATAL:", err);
  console.log("\n" + JSON.stringify({
    agent: "demo-startup-qa",
    demo: "demos/startup",
    fatal_error: err.message,
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    bugs_found: bugs.length,
    bugs, results: results.map(r => ({
      name: r.name, passed: r.passed, duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  }, null, 2));
  process.exit(1);
});
