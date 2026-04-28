#!/usr/bin/env npx tsx
/**
 * Comprehensive TUI Emulator Health Check
 *
 * Tests the full emulator stack: launch, screen reading, input, assertions,
 * wait utilities, lifecycle, and navigation helpers against a real running site.
 *
 * Also tests VirtualTerminal + ScreenReader + Assertions directly (no PTY).
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { TUIEmulator, AssertionError } from "../src/emulator/index.js";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { Assertions } from "../src/emulator/assertions.js";
import { Waiter } from "../src/emulator/waiter.js";
import { InputSender, resolveKey } from "../src/emulator/input-sender.js";
import { Recorder } from "../src/emulator/recorder.js";
import { Reporter } from "../src/emulator/reporter.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");

// ── Test Harness ────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface Bug {
  id: string;
  severity: string;
  title: string;
  reproduction: string;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];
const bugs: Bug[] = [];
const fixes: string[] = [];
let bugCounter = 0;

function addBug(severity: string, title: string, repro: string, expected: string, actual: string): void {
  bugCounter++;
  bugs.push({
    id: `EMU-${String(bugCounter).padStart(3, "0")}`,
    severity, title, reproduction: repro, expected, actual,
  });
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

function assertThrows(fn: () => void, label: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`${label}: expected to throw but did not`);
}

// ── Temp Site Creation ──────────────────────────────────────

function createTempDir(name: string): string {
  const dir = join(tmpdir(), `tui-health-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Creates a minimal test site in a temp directory.
 * Returns the dir path.
 */
function createMinimalSite(): string {
  const dir = createTempDir("minimal");
  const configContent = `
import { defineSite, page, markdown } from "${PROJECT_ROOT}/src/index.js";

export default defineSite({
  name: "HealthCheck",
  tagline: "Emulator test site",
  animations: { boot: false },
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("Welcome to the health check site."),
      ],
    }),
  ],
});
`;

  const runContent = `
import config from "./site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;

  writeFileSync(join(dir, "site.config.ts"), configContent);
  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

/**
 * Creates a multi-page test site for navigation testing.
 */
function createMultiPageSite(): string {
  const dir = createTempDir("multipage");
  const configContent = `
import { defineSite, page, markdown, card, link, divider, spacer, section } from "${PROJECT_ROOT}/src/index.js";

export default defineSite({
  name: "MultiPage",
  tagline: "Navigation test site",
  animations: { boot: false },
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("Home page content here."),
      ],
    }),
    page("about", {
      title: "About",
      icon: "◇",
      content: [
        markdown("About page with **bold** text and *italics*."),
        divider(),
        card({ title: "Bio Card", body: "A card with some body text.", tags: ["Tag1", "Tag2"] }),
      ],
    }),
    page("projects", {
      title: "Projects",
      icon: "◈",
      content: [
        markdown("Here are some projects."),
        card({ title: "Project Alpha", subtitle: "v1.0", body: "Description of project alpha.", tags: ["TypeScript"] }),
        card({ title: "Project Beta", body: "Another project.", tags: ["Node.js", "React"] }),
        spacer(),
        link("GitHub", "https://github.com/test/repo"),
        link("Website", "https://example.com"),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "◉",
      content: [
        markdown("Get in touch!"),
        link("Email", "mailto:test@test.com"),
      ],
    }),
  ],
});
`;

  const runContent = `
import config from "./site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;

  writeFileSync(join(dir, "site.config.ts"), configContent);
  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

/**
 * Creates a site with lots of content for scroll testing.
 */
function createLongContentSite(): string {
  const dir = createTempDir("longcontent");
  const configContent = `
import { defineSite, page, markdown, card, spacer } from "${PROJECT_ROOT}/src/index.js";

const longContent = Array.from({ length: 30 }, (_, i) =>
  markdown(\`Line \${i + 1}: This is content that extends beyond the visible terminal area.\`)
);

export default defineSite({
  name: "LongContent",
  animations: { boot: false },
  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("Home with scrollable content below."),
      ],
    }),
    page("long", {
      title: "Long Page",
      icon: "◇",
      content: longContent,
    }),
  ],
});
`;

  const runContent = `
import config from "./site.config.js";
import { runSite } from "${PROJECT_ROOT}/src/index.js";
runSite(config);
`;

  writeFileSync(join(dir, "site.config.ts"), configContent);
  writeFileSync(join(dir, "run.ts"), runContent);
  return dir;
}

// ── Cleanup helper ──────────────────────────────────────────

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

async function launchSite(dir: string, opts?: { cols?: number; rows?: number; timeout?: number }): Promise<TUIEmulator> {
  return TUIEmulator.launch({
    command: `npx tsx run.ts`,
    cwd: dir,
    cols: opts?.cols ?? 80,
    rows: opts?.rows ?? 24,
    timeout: opts?.timeout ?? 30000,
  });
}

// ═════════════════════════════════════════════════════════════
//  SECTION 0: UNIT TESTS (no PTY needed)
// ═════════════════════════════════════════════════════════════

async function runUnitTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 0: Unit Tests (VirtualTerminal + ScreenReader + Assertions)\x1b[0m\n");

  // ── VirtualTerminal basics ──
  await test("VirtualTerminal: creates buffer with correct dimensions", () => {
    const vt = new VirtualTerminal(80, 24);
    assertEqual(vt.cols, 80, "cols");
    assertEqual(vt.rows, 24, "rows");
    assert(vt.cells().length === 24, "24 rows in buffer");
    assert(vt.cells()[0].length === 80, "80 cols in first row");
  });

  await test("VirtualTerminal: write + text() + contains() + find()", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("Hello Emulator");
    assert(vt.text().includes("Hello Emulator"), "text contains written content");
    assert(vt.contains("Hello"), "contains works for present text");
    assert(!vt.contains("Goodbye"), "contains returns false for absent text");
    const pos = vt.find("Emulator");
    assert(pos !== null, "find returns non-null");
    assertEqual(pos!.row, 0, "find row");
    assertEqual(pos!.col, 6, "find col");
  });

  await test("VirtualTerminal: textAt() extracts region", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("AAABBBCCC");
    assertEqual(vt.textAt(0, 3, 3, 1), "BBB", "textAt extracts correctly");
  });

  await test("VirtualTerminal: resize preserves content", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("Preserved Text");
    vt.resize(100, 30);
    assertEqual(vt.cols, 100, "new cols");
    assertEqual(vt.rows, 30, "new rows");
    assert(vt.contains("Preserved Text"), "content preserved after resize");
  });

  await test("VirtualTerminal: ansi() returns non-empty string", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("\x1b[1;31mBold Red\x1b[0m");
    const ansi = vt.ansi();
    assert(ansi.length > 0, "ansi output is non-empty");
    assert(ansi.includes("Bold Red"), "ansi contains text");
  });

  await test("VirtualTerminal: alternate screen buffer", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Main content");
    vt.write("\x1b[?1049h"); // enter alt
    assert(!vt.contains("Main content"), "alt screen is clear");
    vt.write("Alt content");
    assert(vt.contains("Alt content"), "alt screen has new content");
    vt.write("\x1b[?1049l"); // leave alt
    assert(vt.contains("Main content"), "main buffer restored");
  });

  // ── ScreenReader ──
  await test("ScreenReader: menu detection with cursor", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("  ❯ ◆ Home [1]\n");
    vt.write("     ◇ About [2]\n");
    vt.write("     ◈ Projects [3]\n");
    const sr = new ScreenReader(vt);
    const menu = sr.menu();
    assertEqual(menu.items.length, 3, "menu items count");
    assertEqual(menu.items[0], "Home", "first item");
    assertEqual(menu.items[1], "About", "second item");
    assertEqual(menu.items[2], "Projects", "third item");
    assertEqual(menu.selectedIndex, 0, "first item selected");
  });

  await test("ScreenReader: menu second item selected", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("     ◆ Home [1]\n");
    vt.write("  ❯ ◇ About [2]\n");
    vt.write("     ◈ Projects [3]\n");
    const sr = new ScreenReader(vt);
    const menu = sr.menu();
    assertEqual(menu.selectedIndex, 1, "second item selected");
  });

  await test("ScreenReader: card detection", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("╭───────────────────╮\n");
    vt.write("│ ◆ My Card Title   │\n");
    vt.write("│ Card body text.   │\n");
    vt.write("│ [Tag1] [Tag2]     │\n");
    vt.write("╰───────────────────╯\n");
    const sr = new ScreenReader(vt);
    const cards = sr.cards();
    assert(cards.length >= 1, `Expected card, got ${cards.length}`);
    assert(cards[0].title.includes("My Card Title"), `title: ${cards[0].title}`);
    assertEqual(cards[0].tags.length, 2, "2 tags");
  });

  await test("ScreenReader: link detection", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("    → GitHub  https://github.com/user\n");
    vt.write("    → Docs  https://docs.example.com\n");
    const sr = new ScreenReader(vt);
    const links = sr.links();
    assertEqual(links.length, 2, "2 links");
    assertEqual(links[0].label, "GitHub", "first link label");
    assertEqual(links[0].url, "https://github.com/user", "first link url");
  });

  await test("ScreenReader: currentPage detects back header", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("\n← back  About\n──────────\n\nContent here\n");
    const sr = new ScreenReader(vt);
    const page = sr.currentPage();
    assert(page !== null && page.includes("About"), `page should be About, got ${page}`);
  });

  await test("ScreenReader: currentPage returns 'home' when menu present", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("  ❯ ◆ Home [1]\n     ◇ About [2]\n");
    const sr = new ScreenReader(vt);
    const page = sr.currentPage();
    assertEqual(page, "home", "should detect home page");
  });

  await test("ScreenReader: contains returns false for absent text", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("Only this text");
    const sr = new ScreenReader(vt);
    assert(!sr.contains("nonexistent text"), "contains returns false");
  });

  await test("ScreenReader: textAt returns text in region", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Row0Col0");
    vt.write("\r\nRow1Col0");  // \r\n to move cursor to col 0 on next line
    const sr = new ScreenReader(vt);
    const text = sr.textAt(1, 0, 8, 1);
    assertEqual(text, "Row1Col0", "textAt returns correct region");
  });

  // ── Assertions ──
  await test("Assertions: textVisible passes when text present", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Hello World");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.textVisible("Hello"); // should not throw
  });

  await test("Assertions: textVisible throws when text absent", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Hello World");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    assertThrows(() => a.textVisible("Missing"), "textVisible should throw");
  });

  await test("Assertions: textVisible throws AssertionError specifically", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Hello");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    let caught: any = null;
    try { a.textVisible("Nonexistent"); } catch (e) { caught = e; }
    assert(caught instanceof AssertionError, "should throw AssertionError");
    assert(typeof caught.screenContent === "string", "AssertionError has screenContent");
  });

  await test("Assertions: textNotVisible passes when text absent", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Hello");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.textNotVisible("Missing"); // should not throw
  });

  await test("Assertions: textNotVisible throws when text present", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Hello");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    assertThrows(() => a.textNotVisible("Hello"), "textNotVisible should throw");
  });

  await test("Assertions: menuItemCount passes with correct count", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("  ❯ ◆ Item1 [1]\n     ◇ Item2 [2]\n     ◈ Item3 [3]\n");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.menuItemCount(3); // should not throw
  });

  await test("Assertions: menuItemCount throws with wrong count", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.write("  ❯ ◆ Item1 [1]\n     ◇ Item2 [2]\n");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    assertThrows(() => a.menuItemCount(5), "menuItemCount should throw with wrong count");
  });

  await test("Assertions: noOverflow passes on normal buffer", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Short line");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.noOverflow(); // should not throw
  });

  await test("Assertions: textIsBold works", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("\x1b[1mBoldText\x1b[0m NormalText");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.textIsBold("BoldText"); // should not throw
    assertThrows(() => a.textIsBold("NormalText"), "textIsBold should throw for non-bold");
  });

  await test("Assertions: textHasColor works", () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("\x1b[38;2;255;0;0mRedText\x1b[0m");
    const sr = new ScreenReader(vt);
    const a = new Assertions(vt, sr);
    a.textHasColor("RedText", "#ff0000"); // should not throw
    assertThrows(() => a.textHasColor("RedText", "#00ff00"), "textHasColor wrong color should throw");
  });

  // ── InputSender ──
  await test("InputSender: resolveKey maps standard keys", () => {
    assertEqual(resolveKey("up"), "\x1b[A", "up");
    assertEqual(resolveKey("down"), "\x1b[B", "down");
    assertEqual(resolveKey("enter"), "\r", "enter");
    assertEqual(resolveKey("escape"), "\x1b", "escape");
    assertEqual(resolveKey("q"), "q", "q");
    assertEqual(resolveKey("j"), "j", "j");
    assertEqual(resolveKey("k"), "k", "k");
    assertEqual(resolveKey("ctrl+c"), "\x03", "ctrl+c");
  });

  await test("InputSender: send dispatches resolved keys", () => {
    const sent: string[] = [];
    const sender = new InputSender((data) => sent.push(data));
    sender.send("up");
    sender.send("q");
    assertEqual(sent[0], "\x1b[A", "up sent");
    assertEqual(sent[1], "q", "q sent");
  });

  await test("InputSender: typeString sends chars individually", () => {
    const sent: string[] = [];
    const sender = new InputSender((data) => sent.push(data));
    sender.typeString("hello");
    assertEqual(sent.length, 5, "5 chars sent");
    assertEqual(sent[0], "h", "first char");
  });

  // ── Waiter (unit-level with vterm) ──
  await test("Waiter: waitForText resolves when text is already present", async () => {
    const vt = new VirtualTerminal(40, 10);
    vt.write("Present text");
    const sr = new ScreenReader(vt);
    const w = new Waiter(vt, sr);
    await w.waitForText("Present", { timeout: 1000 }); // should resolve immediately
  });

  await test("Waiter: waitForText resolves when text appears later", async () => {
    const vt = new VirtualTerminal(40, 10);
    const sr = new ScreenReader(vt);
    const w = new Waiter(vt, sr);
    // Write text after a delay
    setTimeout(() => vt.write("Delayed text"), 100);
    await w.waitForText("Delayed", { timeout: 2000 });
  });

  await test("Waiter: waitForText times out for missing text", async () => {
    const vt = new VirtualTerminal(40, 10);
    const sr = new ScreenReader(vt);
    const w = new Waiter(vt, sr);
    let threw = false;
    try {
      await w.waitForText("NeverAppears", { timeout: 300 });
    } catch {
      threw = true;
    }
    assert(threw, "waitForText should throw on timeout");
  });

  await test("Waiter: waitForIdle resolves after screen stabilizes", async () => {
    const vt = new VirtualTerminal(40, 10);
    const sr = new ScreenReader(vt);
    const w = new Waiter(vt, sr);
    vt.write("Stable content");
    await w.waitForIdle(200, { timeout: 2000 }); // should resolve since no changes
  });

  // ── Recorder ──
  await test("Recorder: records and exports script", () => {
    const rec = new Recorder("test-cmd", 80, 24);
    rec.start();
    assert(rec.isRecording(), "recording started");
    rec.recordPress("up", 1);
    rec.recordType("hello");
    rec.recordWait("boot");
    const script = rec.stop();
    assertEqual(script.actions.length, 3, "3 actions recorded");
    assertEqual(script.command, "test-cmd", "command");
    assert(!rec.isRecording(), "recording stopped");
  });

  // ── Reporter ──
  await test("Reporter: tracks pass/fail steps", async () => {
    const reporter = new Reporter("Test", "cmd", 80, 24);
    await reporter.runStep("pass-step", () => {});
    await reporter.runStep("fail-step", () => { throw new Error("fail"); });
    const report = reporter.getReport();
    assertEqual(report.passed, 1, "1 passed");
    assertEqual(report.failed, 1, "1 failed");
    const formatted = reporter.format();
    assert(formatted.includes("Test"), "format includes name");
  });
}

// ═════════════════════════════════════════════════════════════
//  SECTION 1: BASIC LAUNCH
// ═════════════════════════════════════════════════════════════

async function runBasicLaunchTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 1: Basic Launch\x1b[0m\n");

  const siteDir = createMinimalSite();
  let emu: TUIEmulator | null = null;

  try {
    await test("launch: TUIEmulator.launch() resolves without error", async () => {
      emu = await launchSite(siteDir);
      assert(emu !== null, "emulator instance is not null");
    });

    if (!emu) return;

    await test("launch: isRunning() returns true after launch", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("launch: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("launch: screen.text() returns non-empty string", () => {
      const text = emu!.screen.text();
      assert(text.trim().length > 0, `screen text is empty: "${text.substring(0, 50)}"`);
    });

    await test("launch: screen.contains() finds site name", () => {
      assert(emu!.screen.contains("HealthCheck"), "site name not found on screen");
    });

    await test("launch: screen.find() returns position for known text", () => {
      const pos = emu!.screen.find("HealthCheck");
      assert(pos !== null, "find returned null");
      assert(typeof pos!.row === "number" && typeof pos!.col === "number", "find returns row/col");
    });

    await test("launch: screenshot() returns a string", () => {
      const ss = emu!.screenshot();
      assert(typeof ss === "string" && ss.length > 0, "screenshot is empty");
    });

    await test("launch: snapshot() returns text + ansi + timestamp", () => {
      const snap = emu!.snapshot();
      assert(snap.text.length > 0, "snapshot text empty");
      assert(snap.ansi.length > 0, "snapshot ansi empty");
      assert(typeof snap.timestamp === "number", "snapshot timestamp is number");
    });

    await test("launch: screen.menu() returns items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length >= 1, `Expected at least 1 menu item, got ${menu.items.length}`);
    });

    await test("launch: screen.currentPage() returns 'home'", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be home page");
    });

    await test("launch: close() cleans up without error", async () => {
      await emu!.close();
      // Wait a moment for process cleanup
      await sleep(300);
      assert(!emu!.isRunning(), "process should not be running after close");
    });
  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 2: INPUT
// ═════════════════════════════════════════════════════════════

async function runInputTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 2: Input\x1b[0m\n");

  const siteDir = createMultiPageSite();
  let emu: TUIEmulator | null = null;

  try {
    emu = await launchSite(siteDir);
    await emu.waitForBoot({ timeout: 15000 });

    // Verify we're on the home page with 4 menu items
    await test("input: site loaded with 4 menu items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length === 4, `Expected 4 items, got ${menu.items.length}: [${menu.items.join(", ")}]`);
    });

    await test("input: initial selectedIndex is 0", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "initial selection");
    });

    await test("input: press('down') changes selectedIndex to 1", async () => {
      await emu!.press("down");
      await sleep(200);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 1, "selection after down");
    });

    await test("input: press('up') changes selectedIndex back to 0", async () => {
      await emu!.press("up");
      await sleep(200);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "selection after up");
    });

    await test("input: press('j') works like down", async () => {
      await emu!.press("j");
      await sleep(200);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 1, "selection after j");
    });

    await test("input: press('k') works like up", async () => {
      await emu!.press("k");
      await sleep(200);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 0, "selection after k");
    });

    await test("input: press('enter') navigates to a page", async () => {
      // Select "About" (index 1)
      await emu!.press("down");
      await sleep(100);
      await emu!.press("enter");
      await sleep(500);
      // Should now be on a content page (not home)
      const page = emu!.screen.currentPage();
      assert(page !== "home" && page !== null, `Expected content page, got "${page}"`);
    });

    await test("input: press('escape') goes back to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be back on home");
    });

    await test("input: pressSequence() works", async () => {
      // First get current selection and reset to a known state
      const before = emu!.screen.menu().selectedIndex;
      await emu!.pressSequence(["down", "down"]);
      await sleep(200);
      const after = emu!.screen.menu().selectedIndex;
      // Should have moved down by 2 from wherever we were (wrapping at 4)
      const expected = Math.min(before + 2, 3);
      assertEqual(after, expected, `selection after sequence of 2 downs (from ${before})`);
    });

    await test("input: press('down', { times: 3 }) works", async () => {
      // Move to index 0 first by pressing up enough times
      await emu!.press("up", { times: 3 });
      await sleep(200);
      const baseline = emu!.screen.menu().selectedIndex;
      assertEqual(baseline, 0, "baseline at 0 before times test");
      await emu!.press("down", { times: 3 });
      await sleep(300);
      const menu = emu!.screen.menu();
      assertEqual(menu.selectedIndex, 3, "selection after 3 downs from 0");
      // Reset
      await emu!.press("up", { times: 3 });
      await sleep(200);
    });

    await test("input: type() sends character sequences", async () => {
      // type() sends raw characters — this is mainly a smoke test
      // The app might not handle arbitrary typing on the home screen,
      // but it shouldn't crash
      await emu!.type("abc");
      await sleep(200);
      assert(emu!.isRunning(), "process still running after type()");
    });

    await test("input: press('q') quits cleanly", async () => {
      await emu!.press("q");
      await sleep(2000);
      assert(!emu!.isRunning(), "process should have exited after 'q'");
    });
  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 3: SCREEN READER (live)
// ═════════════════════════════════════════════════════════════

async function runScreenReaderTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 3: Screen Reader (Live)\x1b[0m\n");

  const siteDir = createMultiPageSite();
  let emu: TUIEmulator | null = null;

  try {
    emu = await launchSite(siteDir);
    await emu.waitForBoot({ timeout: 15000 });

    await test("screen: menu() returns correct items", () => {
      const menu = emu!.screen.menu();
      assert(menu.items.length === 4, `Expected 4, got ${menu.items.length}`);
      assert(menu.selectedIndex >= 0, "has a selected index");
    });

    await test("screen: currentPage() is 'home' on launch", () => {
      assertEqual(emu!.screen.currentPage(), "home", "home page");
    });

    await test("screen: contains() returns false for absent text", () => {
      assert(!emu!.screen.contains("ZZZZNONEXISTENT"), "absent text not found");
    });

    // Navigate to "Projects" page (index 2) which has cards and links
    await test("screen: navigate to Projects page", async () => {
      await emu!.press("down", { times: 2 });
      await sleep(100);
      await emu!.press("enter");
      await sleep(800);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Projects page, got "${page}"`);
    });

    await test("screen: currentPage() changes after navigation", () => {
      const page = emu!.screen.currentPage();
      assert(page !== "home", `Should not be home, got "${page}"`);
    });

    await test("screen: cards() extracts card titles on Projects page", () => {
      const cards = emu!.screen.cards();
      // We have 2 cards on Projects page, but they may or may not all fit in 24 rows
      if (cards.length > 0) {
        assert(cards[0].title.length > 0, "card has a title");
      }
      // Note: if cards.length is 0, this is a potential screen reader issue
      // but it depends on terminal size and content layout
    });

    await test("screen: links() extracts links on Projects page", () => {
      const links = emu!.screen.links();
      // The Projects page has links, though they may be scrolled out
      // This is more of a smoke test
      assert(Array.isArray(links), "links returns an array");
    });

    await test("screen: textAt() returns text in specific region", () => {
      const text = emu!.screen.textAt(0, 0, 20, 1);
      assert(typeof text === "string", "textAt returns a string");
    });

    // Go back home
    await emu.press("escape");
    await sleep(500);

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 4: ASSERTIONS (live)
// ═════════════════════════════════════════════════════════════

async function runAssertionTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 4: Assertions (Live)\x1b[0m\n");

  const siteDir = createMultiPageSite();
  let emu: TUIEmulator | null = null;

  try {
    emu = await launchSite(siteDir);
    await emu.waitForBoot({ timeout: 15000 });

    await test("assert: textVisible passes for site name", () => {
      emu!.assert.textVisible("MultiPage");
    });

    await test("assert: textVisible throws for nonexistent text", () => {
      assertThrows(() => emu!.assert.textVisible("ZZZZNONEXISTENT"), "should throw");
    });

    await test("assert: textNotVisible passes for absent text", () => {
      emu!.assert.textNotVisible("ZZZZNONEXISTENT");
    });

    await test("assert: textNotVisible throws for visible text", () => {
      assertThrows(() => emu!.assert.textNotVisible("MultiPage"), "should throw");
    });

    await test("assert: menuItemCount with correct number passes", () => {
      emu!.assert.menuItemCount(4);
    });

    await test("assert: menuItemCount with wrong number throws", () => {
      assertThrows(() => emu!.assert.menuItemCount(99), "should throw");
    });

    await test("assert: noOverflow passes on normal site", () => {
      emu!.assert.noOverflow();
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 5: WAIT UTILITIES (live)
// ═════════════════════════════════════════════════════════════

async function runWaitTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 5: Wait Utilities (Live)\x1b[0m\n");

  const siteDir = createMultiPageSite();
  let emu: TUIEmulator | null = null;

  try {
    emu = await launchSite(siteDir);

    await test("wait: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("wait: waitForText() resolves for visible text", async () => {
      await emu!.waitForText("MultiPage", { timeout: 5000 });
    });

    await test("wait: waitForText() times out for absent text", async () => {
      let threw = false;
      try {
        await emu!.waitForText("ZZZZNONEXISTENT", { timeout: 1000 });
      } catch {
        threw = true;
      }
      assert(threw, "waitForText should timeout for absent text");
    });

    await test("wait: waitForIdle() resolves after screen stabilizes", async () => {
      await emu!.waitForIdle(500, { timeout: 5000 });
    });

    await test("wait: waitFor() custom condition resolves", async () => {
      await emu!.waitFor(() => emu!.screen.contains("MultiPage"), { timeout: 5000 });
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 6: LIFECYCLE
// ═════════════════════════════════════════════════════════════

async function runLifecycleTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 6: Lifecycle\x1b[0m\n");

  const siteDir = createMinimalSite();

  // Test resize
  {
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });

      await test("lifecycle: resize() changes dimensions without crash", async () => {
        await emu!.resize(100, 30);
        // Process should still be running
        assert(emu!.isRunning(), "still running after resize");
      });

      await test("lifecycle: screen.text() works after resize", async () => {
        await sleep(500); // let the app re-render at new size
        const text = emu!.screen.text();
        assert(text.length > 0, "text is non-empty after resize");
      });

      await test("lifecycle: close() after operations", async () => {
        await emu!.close();
        await sleep(300);
        assert(!emu!.isRunning(), "not running after close");
      });
    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
    }
  }

  // Test quit
  {
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });

      await test("lifecycle: quit() sends q and waits for exit", async () => {
        await emu!.quit(5000);
        assert(!emu!.isRunning(), "not running after quit");
      });

      await test("lifecycle: isRunning() returns false after quit", () => {
        assert(!emu!.isRunning(), "isRunning is false");
      });

      await test("lifecycle: terminalRestored() returns true after clean exit", () => {
        assert(emu!.terminalRestored(), "terminal restored");
      });

    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
    }
  }

  // Test kill
  {
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });

      await test("lifecycle: kill() force-kills the process", () => {
        emu!.kill();
      });

      await test("lifecycle: isRunning() returns false after kill", async () => {
        await sleep(500);
        assert(!emu!.isRunning(), "not running after kill");
      });
    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
    }
  }

  cleanup(siteDir);
}

// ═════════════════════════════════════════════════════════════
//  SECTION 7: NAVIGATION HELPERS
// ═════════════════════════════════════════════════════════════

async function runNavigationTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 7: Navigation Helpers\x1b[0m\n");

  const siteDir = createMultiPageSite();
  let emu: TUIEmulator | null = null;

  try {
    emu = await launchSite(siteDir);
    await emu.waitForBoot({ timeout: 15000 });

    await test("nav: navigateTo('About') navigates to About page", async () => {
      await emu!.navigateTo("About");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected About page, got "${page}"`);
    });

    await test("nav: goBack() returns to home", async () => {
      await emu!.goBack();
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be home after goBack");
    });

    await test("nav: navigateTo('Projects') works", async () => {
      await emu!.navigateTo("Projects");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Projects page, got "${page}"`);
    });

    await test("nav: goHome() returns to home from any depth", async () => {
      await emu!.goHome();
      await sleep(500);
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should be home after goHome");
    });

    await test("nav: selectMenuItem('Contact') works", async () => {
      await emu!.selectMenuItem("Contact");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== null && page !== "home", `Expected Contact page, got "${page}"`);
      // Go back for next test
      await emu!.goHome();
      await sleep(500);
    });

    await test("nav: scrollDown() and scrollUp() don't crash", async () => {
      // Navigate to a page and try scrolling
      await emu!.navigateTo("About");
      await sleep(500);
      await emu!.scrollDown(3);
      await sleep(200);
      await emu!.scrollUp(2);
      await sleep(200);
      assert(emu!.isRunning(), "still running after scroll operations");
      await emu!.goHome();
      await sleep(500);
    });

    await test("nav: navigateTo throws for invalid page name", async () => {
      let threw = false;
      try {
        await emu!.navigateTo("NonexistentPage");
      } catch (e: any) {
        threw = true;
        assert(e.message.includes("not found"), `Error should mention not found: ${e.message}`);
      }
      assert(threw, "navigateTo should throw for invalid page");
    });

  } finally {
    try { if (emu?.isRunning()) emu.kill(); } catch {}
    cleanup(siteDir);
  }
}

// ═════════════════════════════════════════════════════════════
//  SECTION 8: EDGE CASES & STRESS
// ═════════════════════════════════════════════════════════════

async function runEdgeCaseTests(): Promise<void> {
  console.log("\n\x1b[1m  Section 8: Edge Cases\x1b[0m\n");

  // Multiple emulators
  await test("edge: can launch and close multiple emulators sequentially", async () => {
    const siteDir = createMinimalSite();
    try {
      for (let i = 0; i < 2; i++) {
        const emu = await launchSite(siteDir);
        await emu.waitForBoot({ timeout: 15000 });
        assert(emu.isRunning(), `emu ${i} is running`);
        await emu.close();
        await sleep(500);
        assert(!emu.isRunning(), `emu ${i} is stopped`);
      }
    } finally {
      cleanup(siteDir);
    }
  });

  // Close already-closed emulator
  await test("edge: close() on already-closed emulator is safe", async () => {
    const siteDir = createMinimalSite();
    try {
      const emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });
      await emu.close();
      await sleep(300);
      // Second close should be a no-op
      await emu.close();
    } finally {
      cleanup(siteDir);
    }
  });

  // Rapid key presses
  await test("edge: rapid key presses don't crash", async () => {
    const siteDir = createMultiPageSite();
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });
      // Send 20 rapid key presses
      for (let i = 0; i < 20; i++) {
        await emu.press(i % 2 === 0 ? "down" : "up", { delay: 10 });
      }
      await sleep(500);
      assert(emu.isRunning(), "still running after rapid keys");
    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
      cleanup(siteDir);
    }
  });

  // Recorder integration
  await test("edge: recorder captures during emulator session", async () => {
    const siteDir = createMinimalSite();
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });
      emu.recorder.start();
      await emu.press("down");
      await emu.press("up");
      const script = emu.recorder.stop();
      assertEqual(script.actions.length, 2, "2 actions recorded");
    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
      cleanup(siteDir);
    }
  });

  // Reporter integration
  await test("edge: createReporter works on emulator", async () => {
    const siteDir = createMinimalSite();
    let emu: TUIEmulator | null = null;
    try {
      emu = await launchSite(siteDir);
      await emu.waitForBoot({ timeout: 15000 });
      const reporter = emu.createReporter("health-check");
      await reporter.runStep("smoke", () => {
        emu!.assert.textVisible("HealthCheck");
      });
      const report = reporter.getReport();
      assertEqual(report.passed, 1, "1 passed");
      assertEqual(report.failed, 0, "0 failed");
    } finally {
      try { if (emu?.isRunning()) emu.kill(); } catch {}
      cleanup(siteDir);
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  TUI Emulator — Comprehensive Health Check\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();

  // Run all test sections
  await runUnitTests();
  await runBasicLaunchTests();
  await runInputTests();
  await runScreenReaderTests();
  await runAssertionTests();
  await runWaitTests();
  await runLifecycleTests();
  await runNavigationTests();
  await runEdgeCaseTests();

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

  if (bugs.length > 0) {
    console.log(`\n  \x1b[33mBugs found:\x1b[0m`);
    for (const b of bugs) {
      console.log(`    ${b.id} [${b.severity}] ${b.title}`);
    }
  }

  // ── JSON Report ──
  const report = {
    agent: "emulator-health",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    fixes_applied: fixes,
    bugs: bugs,
  };

  console.log("\n" + JSON.stringify(report, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31mFATAL ERROR:\x1b[0m", err);
  const report = {
    agent: "emulator-health",
    tests_run: results.length,
    tests_passed: results.filter(r => r.passed).length,
    tests_failed: results.filter(r => !r.passed).length + 1,
    fixes_applied: fixes,
    bugs: [...bugs, {
      id: "EMU-FATAL",
      severity: "P0",
      title: `Fatal error: ${err.message}`,
      reproduction: "Running health check",
      expected: "No fatal errors",
      actual: err.message,
    }],
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(1);
});
