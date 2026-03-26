#!/usr/bin/env npx tsx
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "developer-portfolio");

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-portfolio-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "run.ts"), `
import config from "${DEMO_DIR}/site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`);
  return dir;
}

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  page: string;
  description: string;
  details: string;
  fixed: boolean;
}

const bugs: Bug[] = [];
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL: ${name}${details ? " -- " + details : ""}`);
  }
}

function checkPaddingBugs(screenText: string, pageName: string): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for border character immediately followed by letter (no padding)
    // Exclude timeline markers like "│ 2024" which are intentional
    const noPadMatch = line.match(/│([A-Za-z])/);
    if (noPadMatch) {
      // Skip known patterns: timeline entries, column separators between cards
      const context = line.trim();
      if (context.startsWith("│") && context.endsWith("│")) continue; // table/timeline row
      if (context.includes("│││")) continue; // column separator between side-by-side cards

      const bugId = `padding-${pageName}-${i}`;
      if (!bugs.find(b => b.id.startsWith(`padding-${pageName}`))) {
        bugs.push({
          id: bugId,
          severity: "P2",
          page: pageName,
          description: `No padding after border on line ${i + 1}`,
          details: `"${line.substring(0, 100).trim()}"`,
          fixed: false,
        });
        console.log(`    BUG: No padding after border: "${line.substring(0, 80).trim()}"`);
      }
    }
  }
}

function checkBrokenBorders(screenText: string, pageName: string): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for top borders that are cut off (┌ or ╭ with ─ but no ┐ or ╮)
    if ((line.includes("┌") || line.includes("╭")) && line.includes("─")) {
      const hasClose = line.includes("┐") || line.includes("╮");
      if (!hasClose) {
        // This is a broken/truncated border
        if (!bugs.find(b => b.id === `broken-border-${pageName}-${i}`)) {
          bugs.push({
            id: `broken-border-${pageName}-${i}`,
            severity: "P1",
            page: pageName,
            description: `Broken/truncated top border on line ${i + 1}`,
            details: `"${line.substring(0, 100).trim()}"`,
            fixed: false,
          });
          console.log(`    BUG: Broken top border: "${line.substring(0, 80).trim()}"`);
        }
      }
    }
    // Check for bottom borders
    if ((line.includes("└") || line.includes("╰")) && line.includes("─")) {
      const hasClose = line.includes("┘") || line.includes("╯");
      if (!hasClose) {
        if (!bugs.find(b => b.id === `broken-border-${pageName}-${i}`)) {
          bugs.push({
            id: `broken-border-${pageName}-${i}`,
            severity: "P1",
            page: pageName,
            description: `Broken/truncated bottom border on line ${i + 1}`,
            details: `"${line.substring(0, 100).trim()}"`,
            fixed: false,
          });
          console.log(`    BUG: Broken bottom border: "${line.substring(0, 80).trim()}"`);
        }
      }
    }
    // Check for side borders that don't close (│ with content but line ends abruptly)
    if (line.includes("├") && line.includes("─") && !line.includes("┤") && !line.includes("╡")) {
      if (!bugs.find(b => b.id === `broken-mid-border-${pageName}-${i}`)) {
        bugs.push({
          id: `broken-mid-border-${pageName}-${i}`,
          severity: "P1",
          page: pageName,
          description: `Broken mid border on line ${i + 1}`,
          details: `"${line.substring(0, 100).trim()}"`,
          fixed: false,
        });
        console.log(`    BUG: Broken mid border: "${line.substring(0, 80).trim()}"`);
      }
    }
  }
}

function checkEmptyPanels(screenText: string, pageName: string): void {
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length - 2; i++) {
    const hasTopBorder = lines[i].includes("┌") || lines[i].includes("╭");
    const isEmpty = lines[i + 1].match(/^[\s│]*$/);
    const hasBottomBorder = lines[i + 2].includes("└") || lines[i + 2].includes("╰");
    if (hasTopBorder && isEmpty && hasBottomBorder) {
      if (!bugs.find(b => b.id === `empty-panel-${pageName}`)) {
        bugs.push({
          id: `empty-panel-${pageName}`,
          severity: "P1",
          page: pageName,
          description: "Empty panel detected",
          details: `Lines ${i + 1}-${i + 3}`,
          fixed: false,
        });
        console.log(`    BUG: Empty panel at lines ${i + 1}-${i + 3}`);
      }
    }
  }
}

async function main() {
  console.log("=== Developer Portfolio QA Test Suite ===\n");

  const runDir = createRunDir();
  let emu: TUIEmulator | null = null;

  try {
    // ── Test A: Boot ──────────────────────────────────────────
    console.log("--- Test A: Boot ---");
    emu = await TUIEmulator.launch({
      command: "npx tsx run.ts",
      cwd: runDir,
      cols: 100,
      rows: 35,
      timeout: 30000,
    });

    await emu.waitForBoot({ timeout: 15000 });
    assert(emu.isRunning(), "App is running after boot");

    const bootScreen = emu.screen.text();
    console.log("\n[BOOT SCREEN DUMP]");
    console.log(bootScreen);
    console.log("[END BOOT SCREEN]\n");

    const menu = emu.screen.menu();
    assert(menu.items.length > 0, "Menu items present");
    console.log(`  Menu items: [${menu.items.join(", ")}]`);
    assert(menu.items.length >= 5, "At least 5 menu items");

    const expectedPages = ["about", "projects", "experience", "writing", "links"];
    for (const p of expectedPages) {
      const found = menu.items.some(item => item.toLowerCase().includes(p));
      assert(found, `Menu contains "${p}"`);
    }

    try {
      emu.assert.noOverflow();
      assert(true, "No overflow on boot screen");
    } catch {
      assert(false, "No overflow on boot screen");
      bugs.push({ id: "overflow-boot", severity: "P1", page: "home", description: "Overflow on boot screen", details: "", fixed: false });
    }

    checkPaddingBugs(bootScreen, "home");
    checkBrokenBorders(bootScreen, "home");

    // ── Test B: Each Page ────────────────────────────────────
    const pages = ["about", "projects", "experience", "writing", "links"];

    for (const pageName of pages) {
      console.log(`\n--- Test B: Page "${pageName}" ---`);

      await emu.navigateTo(pageName);
      await emu.waitForIdle(500);

      const pageScreen = emu.screen.text();
      console.log(`\n[${pageName.toUpperCase()} SCREEN DUMP]`);
      console.log(pageScreen);
      console.log(`[END ${pageName.toUpperCase()} SCREEN]\n`);

      assert(pageScreen.length > 50, `${pageName}: has content`);
      assert(emu.isRunning(), `${pageName}: app still running`);

      // Check no overflow
      try {
        emu.assert.noOverflow();
        assert(true, `${pageName}: no overflow`);
      } catch (e: any) {
        assert(false, `${pageName}: no overflow`, e?.message);
        bugs.push({ id: `overflow-${pageName}`, severity: "P1", page: pageName, description: "Text overflow detected", details: e?.message || "", fixed: false });
      }

      // Check padding/borders
      checkPaddingBugs(pageScreen, pageName);
      checkBrokenBorders(pageScreen, pageName);
      checkEmptyPanels(pageScreen, pageName);

      // Scroll down to see more content, check cards again
      if (["projects", "writing"].includes(pageName)) {
        await emu.press("down", { times: 5 });
        await emu.waitForIdle(300);
        const scrolledScreen = emu.screen.text();
        const cards = emu.screen.cards();
        console.log(`  Cards after scroll: ${cards.length}`);
        if (cards.length > 0) {
          cards.forEach((c, i) => console.log(`    Card ${i}: title="${c.title}"`));
        }
        // Check scrolled screen for border issues too
        checkBrokenBorders(scrolledScreen, `${pageName}-scrolled`);
      }

      if (pageName === "experience") {
        // Scroll to see education cards
        await emu.press("down", { times: 8 });
        await emu.waitForIdle(300);
        const scrolledScreen = emu.screen.text();
        console.log(`\n[${pageName.toUpperCase()} SCROLLED DUMP]`);
        console.log(scrolledScreen);
        console.log(`[END ${pageName.toUpperCase()} SCROLLED]\n`);
        const cards = emu.screen.cards();
        console.log(`  Cards after scroll: ${cards.length}`);
      }

      // Check links on links page
      if (pageName === "links") {
        // Scroll to see more links
        await emu.press("down", { times: 3 });
        await emu.waitForIdle(300);
        const scrolledLinks = emu.screen.text();
        console.log(`\n[LINKS SCROLLED DUMP]`);
        console.log(scrolledLinks);
        console.log(`[END LINKS SCROLLED]\n`);
        const links = emu.screen.links();
        console.log(`  Links found: ${links.length}`);
        links.forEach((l, i) => console.log(`    Link ${i}: "${l.label}" -> ${l.url}`));
      }

      // Test navigation within page (mild)
      await emu.press("down");
      await emu.waitForIdle(200);
      await emu.press("up");
      await emu.waitForIdle(200);
      assert(emu.isRunning(), `${pageName}: vertical nav works`);

      // Test right arrow doesn't crash
      await emu.press("right");
      await emu.waitForIdle(200);
      assert(emu.isRunning(), `${pageName}: right arrow doesn't crash`);

      // Go home for next page
      await emu.goHome();
      await emu.waitForIdle(500);
    }

    // ── Test C: Resize ───────────────────────────────────────
    console.log("\n--- Test C: Resize ---");

    await emu.navigateTo("projects");
    await emu.waitForIdle(500);

    // Resize to narrow
    await emu.resize(60, 35);
    await emu.waitForIdle(1000);

    const narrowScreen = emu.screen.text();
    console.log("\n[NARROW 60 COLS SCREEN DUMP]");
    console.log(narrowScreen);
    console.log("[END NARROW SCREEN]\n");

    try {
      emu.assert.noOverflow();
      assert(true, "Narrow resize (60 cols): no overflow");
    } catch (e: any) {
      assert(false, "Narrow resize (60 cols): no overflow", e?.message);
      bugs.push({ id: "overflow-narrow-resize", severity: "P1", page: "projects", description: "Overflow at 60 cols", details: e?.message || "", fixed: false });
    }

    checkBrokenBorders(narrowScreen, "projects-narrow");
    assert(emu.isRunning(), "App running after narrow resize");

    // Resize to wide
    await emu.resize(120, 35);
    await emu.waitForIdle(1000);

    const wideScreen = emu.screen.text();
    console.log("\n[WIDE 120 COLS SCREEN DUMP]");
    console.log(wideScreen);
    console.log("[END WIDE SCREEN]\n");

    try {
      emu.assert.noOverflow();
      assert(true, "Wide resize (120 cols): no overflow");
    } catch (e: any) {
      assert(false, "Wide resize (120 cols): no overflow", e?.message);
      bugs.push({ id: "overflow-wide-resize", severity: "P1", page: "projects", description: "Overflow at 120 cols", details: e?.message || "", fixed: false });
    }

    checkBrokenBorders(wideScreen, "projects-wide");
    assert(emu.isRunning(), "App running after wide resize");

    // Resize to very narrow
    await emu.resize(40, 35);
    await emu.waitForIdle(1000);

    const veryNarrowScreen = emu.screen.text();
    console.log("\n[VERY NARROW 40 COLS SCREEN DUMP]");
    console.log(veryNarrowScreen);
    console.log("[END VERY NARROW SCREEN]\n");

    checkBrokenBorders(veryNarrowScreen, "projects-very-narrow");
    assert(emu.isRunning(), "App running after very narrow resize");

    // Restore
    await emu.resize(100, 35);
    await emu.waitForIdle(500);
    await emu.goHome();
    await emu.waitForIdle(500);

    // ── Test D: Navigation loop ──────────────────────────────
    console.log("\n--- Test D: Navigation Loop ---");

    for (const pageName of pages) {
      await emu.navigateTo(pageName);
      await emu.waitForIdle(300);
      assert(emu.isRunning(), `Nav loop: ${pageName} - running`);
      const cp = emu.screen.currentPage();
      console.log(`  currentPage() = ${cp}`);
      await emu.goHome();
      await emu.waitForIdle(300);
      assert(emu.isRunning(), `Nav loop: home after ${pageName} - running`);
    }

    // ── Test E: Edge Cases ───────────────────────────────────
    console.log("\n--- Test E: Edge Cases ---");

    // Note: escape on home triggers quit, so we avoid that.
    // Instead test: multiple escapes from a page should end up at home, not quit
    await emu.navigateTo("about");
    await emu.waitForIdle(300);
    await emu.press("escape");
    await emu.waitForIdle(300);
    assert(emu.isRunning(), "Single escape from page: still running (at home)");

    // Second escape on home would quit - that's expected behavior, not a bug
    // So we don't test that.

    // Rapid down presses on a page (not home, to avoid q-quit confusion)
    await emu.navigateTo("writing");
    await emu.waitForIdle(300);
    for (let i = 0; i < 10; i++) {
      await emu.press("down");
    }
    await emu.waitForIdle(300);
    assert(emu.isRunning(), "Rapid down presses on writing page: still running");

    for (let i = 0; i < 10; i++) {
      await emu.press("up");
    }
    await emu.waitForIdle(300);
    assert(emu.isRunning(), "Rapid up presses on writing page: still running");

    // Left/right on page
    await emu.press("left");
    await emu.waitForIdle(100);
    await emu.press("right");
    await emu.waitForIdle(100);
    assert(emu.isRunning(), "Left/right on page: still running");

    // Tab
    await emu.press("tab");
    await emu.waitForIdle(200);
    assert(emu.isRunning(), "Tab on page: still running");

    // Go back home
    await emu.goHome();
    await emu.waitForIdle(300);
    assert(emu.isRunning(), "Final: app still running");

  } catch (err) {
    failed++;
    failures.push(`EXCEPTION: ${err}`);
    console.error(`\n!!! EXCEPTION: ${err}`);
    if (emu) {
      try {
        console.log("\n[CRASH SCREEN DUMP]");
        console.log(emu.screen.text());
        console.log("[END CRASH SCREEN]");
      } catch {}
    }
  } finally {
    if (emu) await emu.close();
    try { rmSync(runDir, { recursive: true, force: true }); } catch {}
  }

  // ── Report ─────────────────────────────────────────────────
  console.log("\n========================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailed tests:");
    failures.forEach(f => console.log(`  - ${f}`));
  }

  if (bugs.length) {
    console.log("\nBugs found:");
    bugs.forEach(b => console.log(`  [${b.severity}] ${b.page}: ${b.description} -- ${b.details}`));
  } else {
    console.log("\nNo bugs found.");
  }

  console.log("\n=== JSON Report ===");
  console.log(JSON.stringify({ passed, failed, failures, bugs }, null, 2));

  process.exit(failed > 0 ? 1 : 0);
}

main();
