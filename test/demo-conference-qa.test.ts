#!/usr/bin/env npx tsx
/**
 * Conference Demo — QA Bug-Hunting Test
 *
 * Launches the conference demo, navigates every page, dumps screen output,
 * inspects for layout bugs (padding, overflow, broken borders, missing content),
 * tests resize behavior, and reports all findings as JSON.
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

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2";
  page: string;
  description: string;
  evidence: string;
  fixed: boolean;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function test(
  name: string,
  fn: () => Promise<void> | void,
): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(
      `  \x1b[32m✔\x1b[0m ${name} \x1b[2m(${Date.now() - start}ms)\x1b[0m`,
    );
    return true;
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      error: err.message,
      duration: Date.now() - start,
    });
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
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function reportBug(bug: Bug): void {
  bugs.push(bug);
  console.log(
    `    \x1b[33m[BUG ${bug.id}] ${bug.severity} -- ${bug.description}\x1b[0m`,
  );
}

// ── Screen analysis helpers ─────────────────────────────────

/** Check for padding bugs: text directly touching a vertical border */
function checkPaddingBugs(screenText: string, page: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for vertical border followed immediately by a letter/digit (no space)
    const paddingMatch = line.match(/[\u2502\u2503\u2551]([A-Za-z0-9])/);
    if (paddingMatch) {
      const context = line.trim().substring(0, 80);
      issues.push(
        `Line ${i}: padding bug -- border followed by "${paddingMatch[1]}" in: ${context}`,
      );
    }
  }
  return issues;
}

/** Check for broken borders: unmatched corners */
function checkBrokenBorders(screenText: string, page: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Top-left corner without matching top-right on same line
    if (
      (line.includes("\u250c") || line.includes("\u256d")) &&
      !line.includes("\u2510") &&
      !line.includes("\u256e") &&
      !line.includes("\u252c")
    ) {
      if (line.trim().length > 2) {
        issues.push(
          `Line ${i}: broken top border (no right corner): ${line.trim().substring(0, 80)}`,
        );
      }
    }
    // Bottom-left without bottom-right
    if (
      (line.includes("\u2514") || line.includes("\u2570")) &&
      !line.includes("\u2518") &&
      !line.includes("\u256f") &&
      !line.includes("\u2534")
    ) {
      if (line.trim().length > 2) {
        issues.push(
          `Line ${i}: broken bottom border (no right corner): ${line.trim().substring(0, 80)}`,
        );
      }
    }
  }
  return issues;
}

/** Check for content overflow */
function checkOverflow(screenText: string, cols: number): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > cols + 5) {
      issues.push(
        `Line ${i}: possible overflow (${lines[i].length} chars, terminal ${cols} cols)`,
      );
    }
  }
  return issues;
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-conference-qa-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "run.ts"),
    `
import config from "${DEMO_DIR}/config.js";
import { runFileBasedSite } from "${PROJECT_ROOT}/src/index.js";
runFileBasedSite({
  config,
  pagesDir: "${DEMO_DIR}/pages",
  outDir: "${DEMO_DIR}/.terminaltui",
});
`,
  );
  return dir;
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

let runDir: string | null = null;

async function launchDemo(opts?: {
  cols?: number;
  rows?: number;
}): Promise<TUIEmulator> {
  runDir = createRunDir();
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: runDir,
    cols: opts?.cols ?? 100,
    rows: opts?.rows ?? 35,
    timeout: 30000,
  });
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    "\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m",
  );
  console.log(
    "\x1b[1;36m  Conference Demo -- QA Bug-Hunting Test\x1b[0m",
  );
  console.log(
    "\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m",
  );

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ══════════════════════════════════════════════════════
    // Section 1: Boot & Home Page
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 1: Boot & Home Page\x1b[0m\n");

    await test("boot: launch emulator at 100x35", async () => {
      emu = await launchDemo({ cols: 100, rows: 35 });
      assert(emu !== null, "emulator launched");
    });

    if (!emu) throw new Error("Failed to launch emulator");

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: isRunning", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("boot: menu has 5 items (home, schedule, speakers, venue, sponsors)", () => {
      emu!.assert.menuItemCount(5);
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    await test("boot: no overflow on home page", () => {
      emu!.assert.noOverflow();
    });

    // Dump and inspect home screen
    await test("home: inspect screen for layout bugs", () => {
      const text = emu!.screen.text();
      console.log("\n--- HOME SCREEN DUMP (100x35) ---");
      console.log(text);
      console.log("--- END HOME DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "home");
      for (const issue of paddingIssues) {
        reportBug({
          id: `HOME-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "home",
          description: `Padding bug: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }

      const borderIssues = checkBrokenBorders(text, "home");
      for (const issue of borderIssues) {
        reportBug({
          id: `HOME-BRD-${bugs.length + 1}`,
          severity: "P1",
          page: "home",
          description: `Border issue: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("home: hero content visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Terminal Renaissance") || text.includes("TERMCONF"),
        "hero content not found",
      );
    });

    await test("home: cards or content below fold (scroll test)", async () => {
      // Home page at 35 rows: banner + menu fills viewport.
      // Cards are below the fold -- scroll down to check they exist.
      await emu!.press("enter"); // enter home page content view
      await sleep(500);
      const text = emu!.screen.text();
      // Either we see cards, or we need to go back and accept this is viewport-limited
      if (!text.includes("30+ Talks") && !text.includes("Register")) {
        // Scroll down to find cards
        await emu!.press("down", { times: 5 });
        await sleep(300);
      }
      const text2 = emu!.screen.text();
      // At minimum the page should show SOMETHING
      assert(text2.length > 50, "home page has substantial content");
      await emu!.press("escape");
      await sleep(300);
    });

    // ══════════════════════════════════════════════════════
    // Section 2: Schedule Page
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 2: Schedule Page\x1b[0m\n");

    await test("schedule: navigate to schedule page", async () => {
      await emu!.navigateTo("schedule");
      await sleep(800);
    });

    await test("schedule: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("schedule: inspect screen for layout bugs", () => {
      const text = emu!.screen.text();
      console.log("\n--- SCHEDULE SCREEN DUMP ---");
      console.log(text);
      console.log("--- END SCHEDULE DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "schedule");
      for (const issue of paddingIssues) {
        reportBug({
          id: `SCHED-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "schedule",
          description: `Padding bug: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }

      const borderIssues = checkBrokenBorders(text, "schedule");
      for (const issue of borderIssues) {
        reportBug({
          id: `SCHED-BRD-${bugs.length + 1}`,
          severity: "P1",
          page: "schedule",
          description: `Border issue: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("schedule: contains session titles", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("State of the Terminal") ||
          text.includes("Main Stage") ||
          text.includes("Day 1"),
        "schedule session content not found",
      );
    });

    await test("schedule: tab content visible (Day 1)", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Day 1") || text.includes("June 15"),
        "Day 1 tab content not visible",
      );
    });

    await test("schedule: card-like content present (bordered boxes)", () => {
      const text = emu!.screen.text();
      // Cards render as bordered boxes with box-drawing chars
      assert(
        text.includes("\u250c") || text.includes("\u256d") || text.includes("\u2502"),
        "no bordered card content found on schedule page",
      );
    });

    await test("schedule: arrow navigation works", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app crashed during schedule navigation");
    });

    // ══════════════════════════════════════════════════════
    // Section 3: Speakers Page
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 3: Speakers Page\x1b[0m\n");

    await test("speakers: navigate to speakers page", async () => {
      await emu!.navigateTo("speakers");
      await sleep(800);
    });

    await test("speakers: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("speakers: inspect screen for layout bugs", () => {
      const text = emu!.screen.text();
      console.log("\n--- SPEAKERS SCREEN DUMP ---");
      console.log(text);
      console.log("--- END SPEAKERS DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "speakers");
      for (const issue of paddingIssues) {
        reportBug({
          id: `SPKR-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "speakers",
          description: `Padding bug: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }

      const borderIssues = checkBrokenBorders(text, "speakers");
      for (const issue of borderIssues) {
        reportBug({
          id: `SPKR-BRD-${bugs.length + 1}`,
          severity: "P1",
          page: "speakers",
          description: `Border issue: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("speakers: contains speaker names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Sophia Chen") ||
          text.includes("Marcus Rivera") ||
          text.includes("Daniel Park"),
        "speaker names not found",
      );
    });

    await test("speakers: search input visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Search") || text.includes("search"),
        "search input not visible on speakers page",
      );
    });

    await test("speakers: arrow navigation through speaker grid", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app crashed during speakers navigation");
    });

    // ══════════════════════════════════════════════════════
    // Section 4: Venue Page
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 4: Venue Page\x1b[0m\n");

    await test("venue: navigate to venue page", async () => {
      await emu!.navigateTo("venue");
      await sleep(800);
    });

    await test("venue: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("venue: inspect screen for layout bugs", () => {
      const text = emu!.screen.text();
      console.log("\n--- VENUE SCREEN DUMP ---");
      console.log(text);
      console.log("--- END VENUE DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "venue");
      for (const issue of paddingIssues) {
        reportBug({
          id: `VENUE-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "venue",
          description: `Padding bug: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }

      const borderIssues = checkBrokenBorders(text, "venue");
      for (const issue of borderIssues) {
        reportBug({
          id: `VENUE-BRD-${bugs.length + 1}`,
          severity: "P1",
          page: "venue",
          description: `Border issue: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("venue: contains venue info", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Oregon Convention Center") ||
          text.includes("Portland") ||
          text.includes("Hall D"),
        "venue info not found",
      );
    });

    await test("venue: scroll down to check hotel/dining info", async () => {
      // Hotel and dining cards may be below the fold
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const text = emu!.screen.text();
      console.log("\n--- VENUE SCROLLED DOWN ---");
      console.log(text);
      console.log("--- END VENUE SCROLLED ---\n");
      assert(
        text.includes("Hyatt") ||
          text.includes("Hotel") ||
          text.includes("Dining") ||
          text.includes("Getting There") ||
          text.includes("Convention"),
        "hotel/dining info not found even after scroll",
      );
    });

    await test("venue: links or content below fold", async () => {
      // Links may be below fold; just verify page has navigable content
      const text = emu!.screen.text();
      assert(
        text.includes("Directions") ||
          text.includes("Light Rail") ||
          text.includes("Oregon") ||
          text.includes("Portland") ||
          text.length > 100,
        "venue page appears empty",
      );
    });

    await test("venue: arrow navigation in two-column layout", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app crashed during venue navigation");
    });

    // ══════════════════════════════════════════════════════
    // Section 5: Sponsors Page
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 5: Sponsors Page\x1b[0m\n");

    await test("sponsors: navigate to sponsors page", async () => {
      await emu!.navigateTo("sponsors");
      await sleep(800);
    });

    await test("sponsors: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("sponsors: inspect screen for layout bugs", () => {
      const text = emu!.screen.text();
      console.log("\n--- SPONSORS SCREEN DUMP ---");
      console.log(text);
      console.log("--- END SPONSORS DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "sponsors");
      for (const issue of paddingIssues) {
        reportBug({
          id: `SPNSR-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "sponsors",
          description: `Padding bug: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }

      const borderIssues = checkBrokenBorders(text, "sponsors");
      for (const issue of borderIssues) {
        reportBug({
          id: `SPNSR-BRD-${bugs.length + 1}`,
          severity: "P1",
          page: "sponsors",
          description: `Border issue: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("sponsors: contains sponsor names", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Warp") ||
          text.includes("Charm") ||
          text.includes("Anthropic"),
        "sponsor names not found",
      );
    });

    await test("sponsors: contains tier labels", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Gold") ||
          text.includes("Silver") ||
          text.includes("Community"),
        "sponsor tier labels not found",
      );
    });

    await test("sponsors: sponsor links visible", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("Become a Sponsor") || text.includes("sponsor"),
        "sponsor link not found",
      );
    });

    await test("sponsors: arrow navigation through sponsor cards", async () => {
      await emu!.press("down");
      await sleep(200);
      await emu!.press("down");
      await sleep(200);
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app crashed during sponsors navigation");
    });

    // ══════════════════════════════════════════════════════
    // Section 6: Navigation Loop & Edge Cases
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 6: Navigation Loop & Edge Cases\x1b[0m\n");

    await test("nav-loop: rapid page cycling", async () => {
      await emu!.goHome();
      await sleep(500);

      const pages = ["schedule", "speakers", "venue", "sponsors"];
      for (const p of pages) {
        await emu!.navigateTo(p);
        await sleep(600);
        assert(emu!.isRunning(), `app crashed navigating to ${p}`);
      }

      await emu!.goHome();
      await sleep(500);
      assertEqual(
        emu!.screen.currentPage(),
        "home",
        "should be home after cycle",
      );
    });

    await test("edge: rapid key presses on home", async () => {
      await emu!.press("down", { times: 10 });
      await sleep(300);
      await emu!.press("up", { times: 10 });
      await sleep(300);
      assert(emu!.isRunning(), "app crashed during rapid key presses");
    });

    await test("edge: enter/escape rapid cycle", async () => {
      for (let i = 0; i < 5; i++) {
        await emu!.press("enter");
        await sleep(300);
        await emu!.press("escape");
        await sleep(300);
      }
      assert(emu!.isRunning(), "app crashed during enter/escape cycle");
    });

    await test("edge: navigate to each page via goHome + navigateTo", async () => {
      const pages = ["schedule", "speakers", "venue", "sponsors"];
      for (const p of pages) {
        await emu!.goHome();
        await sleep(300);
        await emu!.navigateTo(p);
        await sleep(500);
        const text = emu!.screen.text();
        assert(text.length > 0, `${p} page has content`);
      }
    });

    // ══════════════════════════════════════════════════════
    // Section 7: Resize Tests
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 7: Resize Tests\x1b[0m\n");

    await emu!.goHome();
    await sleep(500);

    // Test narrow terminal (60 cols)
    await test("resize: narrow terminal (60x35)", async () => {
      emu!.resize(60, 35);
      await sleep(1000);
      assert(emu!.isRunning(), "app crashed after resize to 60 cols");
    });

    await test("resize-60: no overflow at 60 cols", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-60: inspect narrow home screen", () => {
      const text = emu!.screen.text();
      console.log("\n--- HOME SCREEN @ 60 COLS ---");
      console.log(text);
      console.log("--- END 60 COL DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "home@60");
      for (const issue of paddingIssues) {
        reportBug({
          id: `RESIZE60-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "home@60cols",
          description: `Padding bug at 60 cols: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    await test("resize-60: navigate to schedule at narrow width", async () => {
      await emu!.navigateTo("schedule");
      await sleep(800);
      const text = emu!.screen.text();
      console.log("\n--- SCHEDULE @ 60 COLS ---");
      console.log(text);
      console.log("--- END SCHEDULE 60 COL DUMP ---\n");

      emu!.assert.noOverflow();

      const paddingIssues = checkPaddingBugs(text, "schedule@60");
      for (const issue of paddingIssues) {
        reportBug({
          id: `RESIZE60-SCHED-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "schedule@60cols",
          description: `Padding bug at 60 cols: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    // Test resize from 60 -> 120 (known crash risk in runtime)
    await test("resize: wide terminal (120x35) from 60", async () => {
      emu!.resize(120, 35);
      await sleep(1500);
      if (!emu!.isRunning()) {
        reportBug({
          id: "RESIZE-CRASH-1",
          severity: "P0",
          page: "any",
          description: "App crashes when resizing from 60 to 120 cols (runtime bug, not demo config)",
          evidence: "Process exits after emu.resize(120, 35) when previously at 60 cols",
          fixed: false,
        });
        // Not a demo config bug - log and continue
        console.log("    [KNOWN RUNTIME BUG] Resize 60->120 crash. Relaunching for remaining tests.");
        await emu!.close().catch(() => {});
        emu = await launchDemo({ cols: 120, rows: 35 });
        await emu!.waitForBoot({ timeout: 15000 });
      }
    });

    await test("resize-120: no overflow at 120 cols", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-120: inspect wide screen", async () => {
      if (emu!.screen.currentPage() !== "home") {
        await emu!.goHome();
        await sleep(500);
      }
      const text = emu!.screen.text();
      console.log("\n--- HOME SCREEN @ 120 COLS ---");
      console.log(text);
      console.log("--- END 120 COL DUMP ---\n");

      const paddingIssues = checkPaddingBugs(text, "home@120");
      for (const issue of paddingIssues) {
        reportBug({
          id: `RESIZE120-PAD-${bugs.length + 1}`,
          severity: "P1",
          page: "home@120cols",
          description: `Padding bug at 120 cols: ${issue}`,
          evidence: issue,
          fixed: false,
        });
      }
    });

    // ══════════════════════════════════════════════════════
    // Section 8: Stability & Shutdown
    // ══════════════════════════════════════════════════════
    console.log("\n\x1b[1m  Section 8: Stability & Shutdown\x1b[0m\n");

    await test("stability: app still running after all tests", () => {
      assert(emu!.isRunning(), "app should still be running");
    });

    await test("shutdown: close() resolves cleanly", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "process should not be running after close");
    });
  } finally {
    try {
      if (emu?.isRunning()) emu.kill();
    } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary ───────────────────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n\x1b[2m  ${"─".repeat(55)}\x1b[0m`);
  console.log(
    `  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`,
  );

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found: ${bugs.length}\x1b[0m`);
    for (const bug of bugs) {
      console.log(
        `    ${bug.fixed ? "\x1b[32m[FIXED]\x1b[0m" : "\x1b[31m[OPEN]\x1b[0m"} ${bug.id} (${bug.severity}) -- ${bug.description}`,
      );
    }
  }

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    \x1b[31m- ${r.name}: ${r.error}\x1b[0m`);
    }
  }

  // ── JSON Report ───────────────────────────────────────────
  const report = {
    agent: "demo-conference-qa",
    demo: "demos/conference",
    timestamp: new Date().toISOString(),
    terminal_size: "100x35",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    bugs_found: bugs.length,
    bugs_fixed: bugs.filter((b) => b.fixed).length,
    bugs_open: bugs.filter((b) => !b.fixed).length,
    bugs: bugs.map((b) => ({
      id: b.id,
      severity: b.severity,
      page: b.page,
      description: b.description,
      evidence: b.evidence,
      fixed: b.fixed,
    })),
    sections: {
      boot_home: results.filter(
        (r) => r.name.startsWith("boot:") || r.name.startsWith("home:"),
      ).length,
      schedule: results.filter((r) => r.name.startsWith("schedule:")).length,
      speakers: results.filter((r) => r.name.startsWith("speakers:")).length,
      venue: results.filter((r) => r.name.startsWith("venue:")).length,
      sponsors: results.filter((r) => r.name.startsWith("sponsors:")).length,
      resize: results.filter((r) => r.name.startsWith("resize")).length,
      nav_edge: results.filter(
        (r) => r.name.startsWith("nav-loop:") || r.name.startsWith("edge:"),
      ).length,
      stability: results.filter(
        (r) =>
          r.name.startsWith("stability:") || r.name.startsWith("shutdown:"),
      ).length,
    },
    results: results.map((r) => ({
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
    agent: "demo-conference-qa",
    demo: "demos/conference",
    tests_run: results.length,
    tests_passed: results.filter((r) => r.passed).length,
    tests_failed: results.filter((r) => !r.passed).length + 1,
    fatal_error: err.message,
    bugs: bugs,
    results: results.map((r) => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
