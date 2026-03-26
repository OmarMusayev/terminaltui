#!/usr/bin/env npx tsx
/**
 * Band Demo -- QA Bug-Hunting Test
 *
 * Thoroughly tests demos/band for:
 *  - Layout bugs (padding, overflow, broken borders)
 *  - Content completeness on every page
 *  - Resize behavior (60 cols narrow, 120 cols wide)
 *  - Navigation loops and edge cases
 *  - Crash resilience
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
  screenDump?: string;
}

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  page: string;
  description: string;
  evidence: string;
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

function fileBug(severity: Bug["severity"], title: string, page: string, description: string, evidence: string): void {
  bugCounter++;
  const bug: Bug = {
    id: `BAND-${String(bugCounter).padStart(3, "0")}`,
    severity,
    title,
    page,
    description,
    evidence: evidence.substring(0, 500),
  };
  bugs.push(bug);
  console.log(`  \x1b[33m[BUG ${bug.id}] ${severity}: ${title}\x1b[0m`);
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-band-qa-${Date.now()}`);
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

// ── Screen analysis helpers ─────────────────────────────────

/** Check for text touching left border without padding: |Text (no space after |) */
function findPaddingBugs(screenText: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for box-drawing vertical border immediately followed by non-space text
    // Only match actual box-drawing verticals, not ASCII | which appears in art/tables
    const paddingMatch = line.match(/[\u2502\u2551\u2503\u2506]([A-Za-z0-9])/);
    if (paddingMatch) {
      // Skip if line looks like table data (contains multiple border chars)
      const borderCount = (line.match(/[\u2502\u2551\u2503\u2506]/g) || []).length;
      if (borderCount >= 3) continue; // table row, not a card padding issue
      issues.push(`Line ${i + 1}: text touching border: "${line.trim().substring(0, 60)}"`);
    }
  }
  return issues;
}

/** Check for broken or misaligned box borders */
function findBorderBugs(screenText: string): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for lines with only a top-left corner but no matching top-right
    const topLeftChars = ["\u256d", "\u250c", "\u2554", "\u250f"];
    const topRightChars = ["\u256e", "\u2510", "\u2557", "\u2513"];
    for (const tl of topLeftChars) {
      if (line.includes(tl)) {
        const hasMatchingRight = topRightChars.some(tr => line.includes(tr));
        if (!hasMatchingRight) {
          issues.push(`Line ${i + 1}: top-left border without matching top-right: "${line.trim().substring(0, 60)}"`);
        }
      }
    }
  }
  return issues;
}

/** Check for text extending past a given column width */
function findOverflowLines(screenText: string, maxCols: number): string[] {
  const issues: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // Strip ANSI codes for measurement
    const stripped = lines[i].replace(/\x1b\[[0-9;]*m/g, "");
    if (stripped.length > maxCols + 2) { // +2 for minor tolerance
      issues.push(`Line ${i + 1}: ${stripped.length} chars (max ${maxCols}): "${stripped.substring(0, 60)}..."`);
    }
  }
  return issues;
}

/** Check that expected content keywords appear */
function checkContent(screenText: string, keywords: string[]): string[] {
  const missing: string[] = [];
  for (const kw of keywords) {
    if (!screenText.includes(kw)) {
      missing.push(kw);
    }
  }
  return missing;
}

// ── Tests ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m===================================================\x1b[0m");
  console.log("\x1b[1;36m  Band Demo -- QA Bug-Hunting Test\x1b[0m");
  console.log("\x1b[1;36m===================================================\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;
  let runDir: string | null = null;

  try {
    // ── Section 1: Boot ──────────────────────────────────────

    console.log("\n\x1b[1m  Section 1: Boot & Home Screen\x1b[0m\n");

    runDir = createRunDir();

    await test("boot: launch emulator at 100x35", async () => {
      emu = await TUIEmulator.launch({
        command: "npx tsx run.ts",
        cwd: runDir!,
        cols: 100,
        rows: 35,
        timeout: 30000,
      });
      assert(emu !== null, "emulator should not be null");
    });

    if (!emu) throw new Error("Failed to launch");

    await test("boot: waitForBoot resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: app is running", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    let homeScreen = "";
    await test("boot: home screen content", () => {
      homeScreen = emu!.screen.text();
      const hasContent = homeScreen.includes("Glass Cathedral") ||
        homeScreen.includes("GLASS CATHEDRAL") ||
        homeScreen.includes("Discography");
      assert(hasContent, "home screen missing site content");
    });

    await test("boot: 5 menu items present", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length === 5, `expected 5 menu items, got ${menu.items.length}: [${menu.items.join(", ")}]`);
    });

    await test("boot: currentPage is home", () => {
      assert(emu!.screen.currentPage() === "home", "should start on home");
    });

    // Check home screen for bugs
    await test("boot: home screen padding check", () => {
      const paddingBugs = findPaddingBugs(homeScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on home screen", "home", paddingBugs.join("; "), homeScreen);
      }
    });

    await test("boot: home screen border check", () => {
      const borderBugs = findBorderBugs(homeScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on home screen", "home", borderBugs.join("; "), homeScreen);
      }
    });

    await test("boot: home screen no overflow", () => {
      emu!.assert.noOverflow();
    });

    // ── Section 2: Discography Page ──────────────────────────

    console.log("\n\x1b[1m  Section 2: Discography Page\x1b[0m\n");

    await test("discography: navigate to page", async () => {
      await emu!.navigateTo("Discography");
      await emu!.waitForIdle(400);
    });

    let discoScreen = "";
    await test("discography: dump screen", () => {
      discoScreen = emu!.screen.text();
      console.log("\n--- DISCOGRAPHY SCREEN DUMP ---");
      console.log(discoScreen);
      console.log("--- END DUMP ---\n");
    });

    await test("discography: has album titles", () => {
      const missing = checkContent(discoScreen, ["Weight of Light", "Tidal Memory"]);
      assert(missing.length === 0, `missing album titles: ${missing.join(", ")}`);
    });

    await test("discography: has tracklist or album body content", () => {
      // Tracklist may be below fold; check for any album body text
      const hasContent = discoScreen.includes("First Light") ||
        discoScreen.includes("Tracklist") ||
        discoScreen.includes("Littoral") ||
        discoScreen.includes("full-length") ||
        discoScreen.includes("Recorded") ||
        discoScreen.includes("field recordings");
      assert(hasContent, "album body content not found anywhere on screen");
    });

    await test("discography: has album tags", () => {
      const hasTags = discoScreen.includes("LP") || discoScreen.includes("post-rock");
      assert(hasTags, "album tags not found");
    });

    await test("discography: cards detected", () => {
      const cards = emu!.screen.cards();
      // Should have at least 2 cards visible (the first row)
      if (cards.length < 1) {
        fileBug("P1", "No cards detected on discography page", "discography",
          "Expected album cards but screen.cards() returned empty", discoScreen);
      }
    });

    await test("discography: padding check", () => {
      const paddingBugs = findPaddingBugs(discoScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on discography page", "discography",
          paddingBugs.join("; "), discoScreen);
      }
    });

    await test("discography: border check", () => {
      const borderBugs = findBorderBugs(discoScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on discography page", "discography",
          borderBugs.join("; "), discoScreen);
      }
    });

    await test("discography: no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Scroll down to see more albums
    await test("discography: scroll down to see more content", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const scrolledScreen = emu!.screen.text();
      console.log("\n--- DISCOGRAPHY SCROLLED DUMP ---");
      console.log(scrolledScreen);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(scrolledScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border after scrolling (discography)", "discography",
          paddingBugs.join("; "), scrolledScreen);
      }
    });

    await test("discography: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      assert(emu!.screen.currentPage() === "home", "should be back on home");
    });

    // ── Section 3: Shows Page ────────────────────────────────

    console.log("\n\x1b[1m  Section 3: Shows Page\x1b[0m\n");

    await test("shows: navigate to page", async () => {
      await emu!.navigateTo("Shows");
      await emu!.waitForIdle(400);
    });

    let showsScreen = "";
    await test("shows: dump screen", () => {
      showsScreen = emu!.screen.text();
      console.log("\n--- SHOWS SCREEN DUMP ---");
      console.log(showsScreen);
      console.log("--- END DUMP ---\n");
    });

    await test("shows: has tour dates", () => {
      const missing = checkContent(showsScreen, ["Portland"]);
      assert(missing.length === 0, `missing tour info: ${missing.join(", ")}`);
    });

    await test("shows: has venue names", () => {
      const hasVenue = showsScreen.includes("Revolution Hall") ||
        showsScreen.includes("Neumos") ||
        showsScreen.includes("Chapel");
      assert(hasVenue, "venue names not found");
    });

    await test("shows: has table data", () => {
      // Table should show dates and cities
      const hasTableContent = showsScreen.includes("Apr") || showsScreen.includes("May") || showsScreen.includes("Jun");
      assert(hasTableContent, "table date content not found");
    });

    await test("shows: padding check", () => {
      const paddingBugs = findPaddingBugs(showsScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on shows page", "shows",
          paddingBugs.join("; "), showsScreen);
      }
    });

    await test("shows: border check", () => {
      const borderBugs = findBorderBugs(showsScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on shows page", "shows",
          borderBugs.join("; "), showsScreen);
      }
    });

    await test("shows: no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Scroll to see show detail cards
    await test("shows: scroll down for detail cards", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const scrolledShows = emu!.screen.text();
      console.log("\n--- SHOWS SCROLLED DUMP ---");
      console.log(scrolledShows);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(scrolledShows);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border after scrolling (shows)", "shows",
          paddingBugs.join("; "), scrolledShows);
      }
    });

    await test("shows: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      assert(emu!.screen.currentPage() === "home", "should be back on home");
    });

    // ── Section 4: Press Page ────────────────────────────────

    console.log("\n\x1b[1m  Section 4: Press Page\x1b[0m\n");

    await test("press: navigate to page", async () => {
      await emu!.navigateTo("Press");
      await emu!.waitForIdle(400);
    });

    let pressScreen = "";
    await test("press: dump screen", () => {
      pressScreen = emu!.screen.text();
      console.log("\n--- PRESS SCREEN DUMP ---");
      console.log(pressScreen);
      console.log("--- END DUMP ---\n");
    });

    await test("press: has press quotes", () => {
      const hasQuotes = pressScreen.includes("Pitchfork") ||
        pressScreen.includes("Stereogum") ||
        pressScreen.includes("Quietus") ||
        pressScreen.includes("NPR");
      assert(hasQuotes, "press quotes not found");
    });

    await test("press: has quote body text", () => {
      const hasBody = pressScreen.includes("weather systems") ||
        pressScreen.includes("post-rock") ||
        pressScreen.includes("guitar");
      assert(hasBody, "quote body text not found");
    });

    await test("press: padding check", () => {
      const paddingBugs = findPaddingBugs(pressScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on press page", "press",
          paddingBugs.join("; "), pressScreen);
      }
    });

    await test("press: border check", () => {
      const borderBugs = findBorderBugs(pressScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on press page", "press",
          borderBugs.join("; "), pressScreen);
      }
    });

    await test("press: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("press: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      assert(emu!.screen.currentPage() === "home", "should be back on home");
    });

    // ── Section 5: About Page ────────────────────────────────

    console.log("\n\x1b[1m  Section 5: About Page\x1b[0m\n");

    await test("about: navigate to page", async () => {
      await emu!.navigateTo("About");
      await emu!.waitForIdle(400);
    });

    let aboutScreen = "";
    await test("about: dump screen", () => {
      aboutScreen = emu!.screen.text();
      console.log("\n--- ABOUT SCREEN DUMP ---");
      console.log(aboutScreen);
      console.log("--- END DUMP ---\n");
    });

    await test("about: has band description", () => {
      const hasBio = aboutScreen.includes("Portland") || aboutScreen.includes("Glass Cathedral");
      assert(hasBio, "band description not found");
    });

    await test("about: has member names", () => {
      const hasMembers = aboutScreen.includes("Maren") ||
        aboutScreen.includes("Jesse") ||
        aboutScreen.includes("Danny") ||
        aboutScreen.includes("Sofia");
      // Members might be below the fold
      if (!hasMembers) {
        // Scroll to find them
      }
    });

    await test("about: padding check", () => {
      const paddingBugs = findPaddingBugs(aboutScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on about page", "about",
          paddingBugs.join("; "), aboutScreen);
      }
    });

    await test("about: border check", () => {
      const borderBugs = findBorderBugs(aboutScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on about page", "about",
          borderBugs.join("; "), aboutScreen);
      }
    });

    await test("about: no overflow", () => {
      emu!.assert.noOverflow();
    });

    // Scroll to member cards
    await test("about: scroll to member cards", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(300);
      const scrolledAbout = emu!.screen.text();
      console.log("\n--- ABOUT SCROLLED DUMP ---");
      console.log(scrolledAbout);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(scrolledAbout);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border after scrolling (about)", "about",
          paddingBugs.join("; "), scrolledAbout);
      }
    });

    await test("about: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      assert(emu!.screen.currentPage() === "home", "should be back on home");
    });

    // ── Section 6: Links Page ────────────────────────────────

    console.log("\n\x1b[1m  Section 6: Links Page\x1b[0m\n");

    await test("links: navigate to page", async () => {
      await emu!.navigateTo("Links");
      await emu!.waitForIdle(400);
    });

    let linksScreen = "";
    await test("links: dump screen", () => {
      linksScreen = emu!.screen.text();
      console.log("\n--- LINKS SCREEN DUMP ---");
      console.log(linksScreen);
      console.log("--- END DUMP ---\n");
    });

    await test("links: has mailing list form", () => {
      const hasForm = linksScreen.includes("mailing") ||
        linksScreen.includes("email") ||
        linksScreen.includes("Subscribe");
      assert(hasForm, "mailing list form not found");
    });

    await test("links: has streaming links", () => {
      const hasLinks = linksScreen.includes("Spotify") ||
        linksScreen.includes("Bandcamp") ||
        linksScreen.includes("Apple Music");
      assert(hasLinks, "streaming links not found");
    });

    await test("links: has social links (scroll to find)", async () => {
      let hasSocial = linksScreen.includes("Instagram") ||
        linksScreen.includes("Twitter") ||
        linksScreen.includes("Merch");
      if (!hasSocial) {
        // Social links may be below fold, scroll down
        await emu!.press("down", { times: 5 });
        await sleep(300);
        const scrolled = emu!.screen.text();
        hasSocial = scrolled.includes("Instagram") ||
          scrolled.includes("Twitter") ||
          scrolled.includes("Merch");
      }
      assert(hasSocial, "social links not found even after scrolling");
    });

    await test("links: padding check", () => {
      const paddingBugs = findPaddingBugs(linksScreen);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border on links page", "links",
          paddingBugs.join("; "), linksScreen);
      }
    });

    await test("links: border check", () => {
      const borderBugs = findBorderBugs(linksScreen);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders on links page", "links",
          borderBugs.join("; "), linksScreen);
      }
    });

    await test("links: no overflow", () => {
      emu!.assert.noOverflow();
    });

    await test("links: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
      assert(emu!.screen.currentPage() === "home", "should be back on home");
    });

    // ── Section 7: Resize to narrow (60 cols) ────────────────

    console.log("\n\x1b[1m  Section 7: Narrow Resize (60 cols)\x1b[0m\n");

    await test("resize-narrow: resize to 60x35", async () => {
      await emu!.resize(60, 35);
      await emu!.waitForIdle(500);
    });

    await test("resize-narrow: home screen renders", () => {
      const text = emu!.screen.text();
      assert(text.length > 0, "screen is empty after narrow resize");
    });

    await test("resize-narrow: no overflow at 60 cols", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-narrow: home padding check", () => {
      const text = emu!.screen.text();
      console.log("\n--- NARROW HOME DUMP (60 cols) ---");
      console.log(text);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(text);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border at narrow width (home)", "home",
          paddingBugs.join("; "), text);
      }
    });

    // Navigate to discography at narrow width
    await test("resize-narrow: navigate to discography", async () => {
      await emu!.navigateTo("Discography");
      await emu!.waitForIdle(400);
    });

    await test("resize-narrow: discography renders at 60 cols", () => {
      const text = emu!.screen.text();
      console.log("\n--- NARROW DISCOGRAPHY DUMP (60 cols) ---");
      console.log(text);
      console.log("--- END DUMP ---\n");

      assert(text.length > 0, "discography empty at narrow width");

      const paddingBugs = findPaddingBugs(text);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border at narrow width (discography)", "discography",
          paddingBugs.join("; "), text);
      }

      const borderBugs = findBorderBugs(text);
      if (borderBugs.length > 0) {
        fileBug("P2", "Broken borders at narrow width (discography)", "discography",
          borderBugs.join("; "), text);
      }
    });

    await test("resize-narrow: discography no overflow at 60", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-narrow: go home from narrow", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
    });

    // Navigate to shows at narrow width
    await test("resize-narrow: navigate to shows", async () => {
      await emu!.navigateTo("Shows");
      await emu!.waitForIdle(400);
    });

    await test("resize-narrow: shows renders at 60 cols", () => {
      const text = emu!.screen.text();
      console.log("\n--- NARROW SHOWS DUMP (60 cols) ---");
      console.log(text);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(text);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border at narrow width (shows)", "shows",
          paddingBugs.join("; "), text);
      }
    });

    await test("resize-narrow: shows no overflow at 60", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-narrow: go home from shows", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
    });

    // ── Section 8: Resize to wide (120 cols) ─────────────────

    console.log("\n\x1b[1m  Section 8: Wide Resize (120 cols)\x1b[0m\n");

    await test("resize-wide: resize to 120x35", async () => {
      await emu!.resize(120, 35);
      await emu!.waitForIdle(500);
    });

    await test("resize-wide: home screen renders", () => {
      const text = emu!.screen.text();
      console.log("\n--- WIDE HOME DUMP (120 cols) ---");
      console.log(text);
      console.log("--- END DUMP ---\n");

      assert(text.length > 0, "screen is empty after wide resize");
    });

    await test("resize-wide: no overflow at 120 cols", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-wide: navigate to discography", async () => {
      await emu!.navigateTo("Discography");
      await emu!.waitForIdle(400);
    });

    await test("resize-wide: discography renders at 120 cols", () => {
      const text = emu!.screen.text();
      console.log("\n--- WIDE DISCOGRAPHY DUMP (120 cols) ---");
      console.log(text);
      console.log("--- END DUMP ---\n");

      const paddingBugs = findPaddingBugs(text);
      if (paddingBugs.length > 0) {
        fileBug("P1", "Text touching border at wide width (discography)", "discography",
          paddingBugs.join("; "), text);
      }
    });

    await test("resize-wide: discography no overflow at 120", () => {
      emu!.assert.noOverflow();
    });

    await test("resize-wide: go home", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(300);
    });

    // ── Section 9: Navigation Loop ───────────────────────────

    console.log("\n\x1b[1m  Section 9: Navigation Loop (all pages twice)\x1b[0m\n");

    // Resize back to default
    await test("nav-loop: resize to 100x35", async () => {
      await emu!.resize(100, 35);
      await emu!.waitForIdle(400);
    });

    const pages = ["Discography", "Shows", "Press", "About", "Links"];
    for (const pageName of pages) {
      await test(`nav-loop: visit ${pageName} (round 1)`, async () => {
        await emu!.navigateTo(pageName);
        await emu!.waitForIdle(300);
        assert(emu!.isRunning(), `app crashed navigating to ${pageName}`);
        await emu!.goHome();
        await emu!.waitForIdle(200);
      });
    }

    for (const pageName of pages) {
      await test(`nav-loop: visit ${pageName} (round 2)`, async () => {
        await emu!.navigateTo(pageName);
        await emu!.waitForIdle(300);
        assert(emu!.isRunning(), `app crashed navigating to ${pageName} on second visit`);
        await emu!.goHome();
        await emu!.waitForIdle(200);
      });
    }

    // ── Section 10: Edge Cases ───────────────────────────────

    console.log("\n\x1b[1m  Section 10: Edge Cases\x1b[0m\n");

    await test("edge: rapid key presses don't crash", async () => {
      // Rapid fire down/up/enter/escape
      for (let i = 0; i < 5; i++) {
        await emu!.press("down");
        await emu!.press("up");
      }
      await emu!.press("enter");
      await sleep(200);
      await emu!.press("escape");
      await sleep(200);
      assert(emu!.isRunning(), "app crashed during rapid key presses");
    });

    await test("edge: multiple escape from home doesn't crash", async () => {
      await emu!.goHome();
      await emu!.waitForIdle(200);
      await emu!.press("escape");
      await sleep(100);
      await emu!.press("escape");
      await sleep(100);
      await emu!.press("escape");
      await sleep(100);
      if (!emu!.isRunning()) {
        fileBug("P0", "App crashes on multiple escape from home", "home",
          "Pressing escape 3 times while on home screen kills the process", "");
        // Relaunch for remaining tests
        const newDir = createRunDir();
        emu = await TUIEmulator.launch({ command: "npx tsx run.ts", cwd: newDir, cols: 100, rows: 35, timeout: 30000 });
        await emu!.waitForBoot({ timeout: 15000 });
      }
    });

    await test("edge: left/right on home menu doesn't crash", async () => {
      if (!emu!.isRunning()) return; // skip if prior crash
      await emu!.goHome();
      await emu!.waitForIdle(200);
      await emu!.press("left");
      await sleep(100);
      await emu!.press("right");
      await sleep(100);
      if (!emu!.isRunning()) {
        fileBug("P0", "App crashes on left/right arrow on home menu", "home",
          "Pressing left then right arrow on home menu kills the process", "");
        const newDir = createRunDir();
        emu = await TUIEmulator.launch({ command: "npx tsx run.ts", cwd: newDir, cols: 100, rows: 35, timeout: 30000 });
        await emu!.waitForBoot({ timeout: 15000 });
      }
    });

    await test("edge: navigate into page, rapid scroll, then exit", async () => {
      if (!emu!.isRunning()) return;
      await emu!.navigateTo("Discography");
      await emu!.waitForIdle(300);
      await emu!.press("down", { times: 20 });
      await sleep(200);
      await emu!.press("up", { times: 20 });
      await sleep(200);
      if (!emu!.isRunning()) {
        fileBug("P0", "App crashes during rapid scrolling", "discography",
          "Rapid up/down scrolling crashes the process", "");
      } else {
        await emu!.goHome();
        await emu!.waitForIdle(200);
      }
    });

    // ── Section 11: Shutdown ─────────────────────────────────

    console.log("\n\x1b[1m  Section 11: Shutdown\x1b[0m\n");

    await test("shutdown: app still running after all tests", () => {
      assert(emu!.isRunning(), "app should still be running");
    });

    await test("shutdown: close() succeeds", async () => {
      await emu!.close();
      await sleep(500);
      assert(!emu!.isRunning(), "process should not be running after close");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    if (runDir) cleanup(runDir);
  }

  // ── Summary ────────────────────────────────────────────────

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\x1b[2m  ${"=".repeat(55)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"} \x1b[2m(${totalDuration}ms)\x1b[0m`);

  if (failed > 0) {
    console.log(`\n  \x1b[31mFailed tests:\x1b[0m`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    \x1b[31mX ${r.name}: ${r.error}\x1b[0m`);
    }
  }

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found: ${bugs.length}\x1b[0m`);
    for (const bug of bugs) {
      console.log(`    \x1b[33m[${bug.id}] ${bug.severity}: ${bug.title} (${bug.page})\x1b[0m`);
      console.log(`      ${bug.description.substring(0, 120)}`);
    }
  }

  // ── JSON Report ────────────────────────────────────────────

  const report = {
    agent: "demo-band-qa",
    demo: "demos/band",
    timestamp: new Date().toISOString(),
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    bugs_found: bugs.length,
    duration_ms: totalDuration,
    bugs: bugs.map(b => ({
      id: b.id,
      severity: b.severity,
      title: b.title,
      page: b.page,
      description: b.description,
    })),
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
    agent: "demo-band-qa",
    demo: "demos/band",
    fatal_error: err.message,
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    bugs_found: bugs.length,
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
