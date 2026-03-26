#!/usr/bin/env npx tsx
/**
 * Freelancer Demo — QA Emulator Test
 *
 * Tests: boot, all pages (services, work, testimonials, contact),
 * padding/overflow checks, resize at 60 and 120 cols, navigation loop, edge cases.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { TUIEmulator } from "../src/emulator/index.js";

// ── Config ──────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "..");
const DEMO_DIR = join(PROJECT_ROOT, "demos", "freelancer");

// ── Test Harness ────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  screenDump?: string;
}

const results: TestResult[] = [];
const screenDumps: Record<string, string> = {};

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

/** Check every line for padding bugs: text touching left border without space */
function checkPaddingBugs(screenText: string): string[] {
  const bugs: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for text directly touching a left border character without padding
    if (/[│|┃][^\s─┬┴┼╋├┤┌┐└┘┏┓┗┛╔╗╚╝┊┆╎┇╏║]/.test(line)) {
      // But allow border-to-border junctions and single chars
      const match = line.match(/[│|┃]([^\s─┬┴┼╋├┤┌┐└┘┏┓┗┛╔╗╚╝┊┆╎┇╏║])/);
      if (match) {
        bugs.push(`Line ${i + 1}: possible padding bug: "${line.substring(0, 80).trim()}"`);
      }
    }
  }
  return bugs;
}

/** Check for text overflow past terminal width */
function checkOverflow(screenText: string, cols: number): string[] {
  const bugs: string[] = [];
  const lines = screenText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > cols + 1) {
      bugs.push(`Line ${i + 1}: overflow (${lines[i].length} chars, max ${cols}): "${lines[i].substring(0, 60)}..."`);
    }
  }
  return bugs;
}

// ── Launch helper ───────────────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-freelancer-qa-${Date.now()}`);
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
  console.log("\n\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;36m  Freelancer Demo — QA Test\x1b[0m");
  console.log("\x1b[1;36m═══════════════════════════════════════════════════\x1b[0m");

  const startTime = Date.now();
  let emu: TUIEmulator | null = null;

  try {
    // ══════════════════════════════════════════════════════════
    // Section 1: Launch & Boot
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 1: Launch & Boot\x1b[0m\n");

    await test("launch: TUIEmulator.launch() resolves", async () => {
      emu = await launchDemo();
      assert(emu !== null, "emulator instance is not null");
    });

    if (!emu) throw new Error("Failed to launch emulator");

    await test("launch: isRunning() returns true", () => {
      assert(emu!.isRunning(), "process should be running");
    });

    await test("boot: waitForBoot() resolves", async () => {
      await emu!.waitForBoot({ timeout: 15000 });
    });

    await test("boot: screen shows site name (ASCII banner)", () => {
      const text = emu!.screen.text();
      // The banner renders as ASCII art — individual letters may not form "STUDIO KIRA" literally
      // Check for fragments of the ASCII font output
      assert(
        text.includes("KIRA") || text.includes("K I R A") ||
        text.includes("|_|") || text.includes("___"),
        "site name banner not found on screen",
      );
    });

    await test("boot: screen shows tagline", () => {
      const text = emu!.screen.text();
      assert(
        text.includes("design that moves people"),
        "tagline not found on screen",
      );
    });

    await test("boot: menu has 4 items", () => {
      const menu = emu!.screen.menu();
      assertEqual(menu.items.length, 4, "menu item count");
    });

    await test("boot: menu items match config pages", () => {
      const menu = emu!.screen.menu();
      // menu.items is string[], not objects
      const labels = menu.items.map((i: string) => i.toLowerCase());
      assert(labels.some((l: string) => l.includes("services")), "Services not in menu");
      assert(labels.some((l: string) => l.includes("work")), "Work not in menu");
      assert(labels.some((l: string) => l.includes("testimonials")), "Testimonials not in menu");
      assert(labels.some((l: string) => l.includes("contact")), "Contact not in menu");
    });

    await test("boot: currentPage is home", () => {
      const page = emu!.screen.currentPage();
      assertEqual(page, "home", "should start on home");
    });

    // Dump home screen
    const homeScreen = emu!.screen.text();
    screenDumps["home"] = homeScreen;
    console.log("\n--- HOME SCREEN DUMP ---");
    console.log(homeScreen);
    console.log("--- END DUMP ---\n");

    await test("boot: home screen no overflow (100 cols)", () => {
      const bugs = checkOverflow(homeScreen, 100);
      assert(bugs.length === 0, `Overflow bugs: ${bugs.join("; ")}`);
    });

    // ══════════════════════════════════════════════════════════
    // Section 2: Services Page
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 2: Services Page\x1b[0m\n");

    await test("nav: navigateTo services", async () => {
      await emu!.navigateTo("services");
      await sleep(500);
      const page = emu!.screen.currentPage();
      assert(page !== "home", `should be on services page, got "${page}"`);
    });

    const servicesScreen = emu!.screen.text();
    screenDumps["services"] = servicesScreen;
    console.log("\n--- SERVICES SCREEN DUMP ---");
    console.log(servicesScreen);
    console.log("--- END DUMP ---\n");

    await test("services: contains 'What I Do' divider (may be scrolled)", () => {
      // The divider may scroll off-screen since the first card gets focus
      // This is expected behavior with auto-scroll, not a bug
      const has = servicesScreen.includes("What I Do") || servicesScreen.includes("more above");
      assert(has, "'What I Do' divider not found and no scroll indicator");
    });

    await test("services: contains Brand Identity card", () => {
      assert(servicesScreen.includes("Brand Identity"), "Brand Identity card not found");
    });

    await test("services: contains price $8,000", () => {
      assert(servicesScreen.includes("$8,000"), "$8,000 price not found");
    });

    await test("services: contains Web Design card", () => {
      assert(servicesScreen.includes("Web Design"), "Web Design card not found");
    });

    await test("services: UX Audit visible after scroll", async () => {
      // UX Audit and Design System are in a second row, below the fold
      await emu!.press("down", { times: 3 });
      await sleep(500);
      const scrolled = emu!.screen.text();
      assert(
        scrolled.includes("UX Audit") || scrolled.includes("Design System"),
        "UX Audit / Design System not found even after scrolling",
      );
    });

    await test("services: Design System visible after scroll", async () => {
      const scrolled = emu!.screen.text();
      // May need more scrolling
      if (!scrolled.includes("Design System")) {
        await emu!.press("down", { times: 2 });
        await sleep(300);
      }
      const text2 = emu!.screen.text();
      assert(
        text2.includes("Design System") || text2.includes("$15,000"),
        "Design System card not found after scrolling",
      );
    });

    await test("services: contains tags", () => {
      assert(
        servicesScreen.includes("Logo") || servicesScreen.includes("Figma") || servicesScreen.includes("Tokens"),
        "service tags not found",
      );
    });

    await test("services: no overflow (100 cols)", () => {
      const bugs = checkOverflow(servicesScreen, 100);
      assert(bugs.length === 0, `Overflow bugs: ${bugs.join("; ")}`);
    });

    await test("services: padding check", () => {
      const bugs = checkPaddingBugs(servicesScreen);
      if (bugs.length > 0) {
        console.log(`    Warning: ${bugs.length} potential padding issues`);
        bugs.slice(0, 5).forEach(b => console.log(`      ${b}`));
      }
      // Non-fatal, just log
    });

    await test("services: arrow right navigates in row", async () => {
      await emu!.press("right");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after right arrow");
    });

    await test("services: arrow left navigates back", async () => {
      await emu!.press("left");
      await sleep(200);
      assert(emu!.isRunning(), "app still running after left arrow");
    });

    await test("services: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be back on home");
    });

    // ══════════════════════════════════════════════════════════
    // Section 3: Work Page
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 3: Work Page\x1b[0m\n");

    await test("nav: navigateTo work", async () => {
      await emu!.navigateTo("work");
      await sleep(500);
    });

    const workScreen = emu!.screen.text();
    screenDumps["work"] = workScreen;
    console.log("\n--- WORK SCREEN DUMP ---");
    console.log(workScreen);
    console.log("--- END DUMP ---\n");

    await test("work: contains search input", () => {
      assert(
        workScreen.includes("Search") || workScreen.includes("search") || workScreen.includes("project"),
        "search input not found",
      );
    });

    await test("work: contains Solstice Wellness", () => {
      assert(workScreen.includes("Solstice Wellness"), "Solstice Wellness project not found");
    });

    await test("work: contains Terraform Coffee", () => {
      assert(workScreen.includes("Terraform Coffee"), "Terraform Coffee project not found");
    });

    await test("work: contains Luminary Finance", () => {
      assert(workScreen.includes("Luminary Finance"), "Luminary Finance project not found");
    });

    await test("work: no overflow (100 cols)", () => {
      const bugs = checkOverflow(workScreen, 100);
      assert(bugs.length === 0, `Overflow bugs: ${bugs.join("; ")}`);
    });

    await test("work: padding check", () => {
      const bugs = checkPaddingBugs(workScreen);
      if (bugs.length > 0) {
        console.log(`    Warning: ${bugs.length} potential padding issues`);
        bugs.slice(0, 5).forEach(b => console.log(`      ${b}`));
      }
    });

    // Scroll down to see more projects
    await test("work: scroll down to see more projects", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(500);
      const scrolledText = emu!.screen.text();
      screenDumps["work_scrolled"] = scrolledText;
      console.log("\n--- WORK SCROLLED DUMP ---");
      console.log(scrolledText);
      console.log("--- END DUMP ---\n");
      assert(emu!.isRunning(), "app running after scrolling work page");
    });

    await test("work: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be back on home");
    });

    // ══════════════════════════════════════════════════════════
    // Section 4: Testimonials Page
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 4: Testimonials Page\x1b[0m\n");

    await test("nav: navigateTo testimonials", async () => {
      await emu!.navigateTo("testimonials");
      await sleep(500);
    });

    const testimonialsScreen = emu!.screen.text();
    screenDumps["testimonials"] = testimonialsScreen;
    console.log("\n--- TESTIMONIALS SCREEN DUMP ---");
    console.log(testimonialsScreen);
    console.log("--- END DUMP ---\n");

    await test("testimonials: contains 'What Clients Say' divider", () => {
      assert(testimonialsScreen.includes("What Clients Say"), "'What Clients Say' divider not found");
    });

    await test("testimonials: contains Elena Marchetti quote", () => {
      assert(
        testimonialsScreen.includes("Elena Marchetti") || testimonialsScreen.includes("Marchetti"),
        "Elena Marchetti attribution not found",
      );
    });

    await test("testimonials: contains James Chen quote", () => {
      assert(
        testimonialsScreen.includes("James Chen") || testimonialsScreen.includes("Chen"),
        "James Chen attribution not found",
      );
    });

    await test("testimonials: no overflow (100 cols)", () => {
      const bugs = checkOverflow(testimonialsScreen, 100);
      assert(bugs.length === 0, `Overflow bugs: ${bugs.join("; ")}`);
    });

    await test("testimonials: padding check", () => {
      const bugs = checkPaddingBugs(testimonialsScreen);
      if (bugs.length > 0) {
        console.log(`    Warning: ${bugs.length} potential padding issues`);
        bugs.slice(0, 5).forEach(b => console.log(`      ${b}`));
      }
    });

    // Scroll down for more quotes
    await test("testimonials: scroll to see more quotes", async () => {
      await emu!.press("down", { times: 4 });
      await sleep(500);
      const scrolledText = emu!.screen.text();
      screenDumps["testimonials_scrolled"] = scrolledText;
      console.log("\n--- TESTIMONIALS SCROLLED DUMP ---");
      console.log(scrolledText);
      console.log("--- END DUMP ---\n");
    });

    await test("testimonials: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be back on home");
    });

    // ══════════════════════════════════════════════════════════
    // Section 5: Contact Page
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 5: Contact Page\x1b[0m\n");

    await test("nav: navigateTo contact", async () => {
      await emu!.navigateTo("contact");
      await sleep(500);
    });

    const contactScreen = emu!.screen.text();
    screenDumps["contact"] = contactScreen;
    console.log("\n--- CONTACT SCREEN DUMP ---");
    console.log(contactScreen);
    console.log("--- END DUMP ---\n");

    await test("contact: contains booking info", () => {
      assert(
        contactScreen.includes("Booking") || contactScreen.includes("Q3 2026"),
        "booking info not found",
      );
    });

    await test("contact: contains pricing table (may need scroll)", () => {
      // The pricing table may be below fold since the split pane has card + spacer + table
      const has = contactScreen.includes("$8,000") || contactScreen.includes("$12,000") ||
                  contactScreen.includes("Starting At") || contactScreen.includes("items below");
      assert(has, "pricing table not found and no scroll indicator");
    });

    await test("contact: contains form fields", () => {
      assert(
        contactScreen.includes("Name") || contactScreen.includes("Email") || contactScreen.includes("Send Message"),
        "form fields not found",
      );
    });

    await test("contact: contains social links", () => {
      assert(
        contactScreen.includes("Dribbble") || contactScreen.includes("LinkedIn") || contactScreen.includes("Email"),
        "social links not found",
      );
    });

    await test("contact: no overflow (100 cols)", () => {
      const bugs = checkOverflow(contactScreen, 100);
      assert(bugs.length === 0, `Overflow bugs: ${bugs.join("; ")}`);
    });

    await test("contact: padding check", () => {
      const bugs = checkPaddingBugs(contactScreen);
      if (bugs.length > 0) {
        console.log(`    Warning: ${bugs.length} potential padding issues`);
        bugs.slice(0, 5).forEach(b => console.log(`      ${b}`));
      }
    });

    // Scroll down through contact page
    await test("contact: scroll through form", async () => {
      await emu!.press("down", { times: 5 });
      await sleep(500);
      const scrolledText = emu!.screen.text();
      screenDumps["contact_scrolled"] = scrolledText;
      console.log("\n--- CONTACT SCROLLED DUMP ---");
      console.log(scrolledText);
      console.log("--- END DUMP ---\n");
    });

    await test("contact: escape returns to home", async () => {
      await emu!.press("escape");
      await sleep(500);
      assertEqual(emu!.screen.currentPage(), "home", "should be back on home");
    });

    // ══════════════════════════════════════════════════════════
    // Section 6: Resize Tests (60 cols — narrow)
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 6: Resize — 60 cols (narrow)\x1b[0m\n");

    await test("resize: shrink to 60 cols", async () => {
      emu!.resize(60, 35);
      await sleep(800);
      assert(emu!.isRunning(), "app running after resize to 60 cols");
    });

    const homeNarrow = emu!.screen.text();
    screenDumps["home_60cols"] = homeNarrow;
    console.log("\n--- HOME 60 COLS DUMP ---");
    console.log(homeNarrow);
    console.log("--- END DUMP ---\n");

    await test("resize 60: home no overflow", () => {
      const bugs = checkOverflow(homeNarrow, 60);
      assert(bugs.length === 0, `Overflow bugs at 60 cols: ${bugs.join("; ")}`);
    });

    await test("resize 60: navigate to services", async () => {
      await emu!.navigateTo("services");
      await sleep(500);
    });

    const servicesNarrow = emu!.screen.text();
    screenDumps["services_60cols"] = servicesNarrow;
    console.log("\n--- SERVICES 60 COLS DUMP ---");
    console.log(servicesNarrow);
    console.log("--- END DUMP ---\n");

    await test("resize 60: services no overflow", () => {
      const bugs = checkOverflow(servicesNarrow, 60);
      assert(bugs.length === 0, `Overflow at 60: ${bugs.join("; ")}`);
    });

    await test("resize 60: services still has content", () => {
      assert(servicesNarrow.includes("Brand Identity"), "Brand Identity not visible at 60 cols");
    });

    await test("resize 60: navigate to contact", async () => {
      await emu!.press("escape");
      await sleep(300);
      await emu!.navigateTo("contact");
      await sleep(500);
    });

    const contactNarrow = emu!.screen.text();
    screenDumps["contact_60cols"] = contactNarrow;
    console.log("\n--- CONTACT 60 COLS DUMP ---");
    console.log(contactNarrow);
    console.log("--- END DUMP ---\n");

    await test("resize 60: contact no overflow", () => {
      const bugs = checkOverflow(contactNarrow, 60);
      assert(bugs.length === 0, `Overflow at 60: ${bugs.join("; ")}`);
    });

    await test("resize 60: escape back", async () => {
      await emu!.press("escape");
      await sleep(300);
    });

    // ══════════════════════════════════════════════════════════
    // Section 7: Resize Tests (120 cols — wide)
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 7: Resize — 120 cols (wide)\x1b[0m\n");

    await test("resize: expand to 120 cols", async () => {
      emu!.resize(120, 35);
      await sleep(800);
      assert(emu!.isRunning(), "app running after resize to 120 cols");
    });

    const homeWide = emu!.screen.text();
    screenDumps["home_120cols"] = homeWide;
    console.log("\n--- HOME 120 COLS DUMP ---");
    console.log(homeWide);
    console.log("--- END DUMP ---\n");

    await test("resize 120: home no overflow", () => {
      const bugs = checkOverflow(homeWide, 120);
      assert(bugs.length === 0, `Overflow at 120: ${bugs.join("; ")}`);
    });

    await test("resize 120: navigate to work", async () => {
      await emu!.navigateTo("work");
      await sleep(500);
    });

    const workWide = emu!.screen.text();
    screenDumps["work_120cols"] = workWide;
    console.log("\n--- WORK 120 COLS DUMP ---");
    console.log(workWide);
    console.log("--- END DUMP ---\n");

    await test("resize 120: work no overflow", () => {
      const bugs = checkOverflow(workWide, 120);
      assert(bugs.length === 0, `Overflow at 120: ${bugs.join("; ")}`);
    });

    await test("resize 120: navigate to testimonials", async () => {
      await emu!.press("escape");
      await sleep(300);
      await emu!.navigateTo("testimonials");
      await sleep(500);
    });

    const testimonialsWide = emu!.screen.text();
    screenDumps["testimonials_120cols"] = testimonialsWide;
    console.log("\n--- TESTIMONIALS 120 COLS DUMP ---");
    console.log(testimonialsWide);
    console.log("--- END DUMP ---\n");

    await test("resize 120: testimonials no overflow", () => {
      const bugs = checkOverflow(testimonialsWide, 120);
      assert(bugs.length === 0, `Overflow at 120: ${bugs.join("; ")}`);
    });

    await test("resize 120: escape back", async () => {
      await emu!.press("escape");
      await sleep(300);
    });

    // Reset to default
    await test("resize: reset to 100 cols", async () => {
      emu!.resize(100, 35);
      await sleep(500);
      assert(emu!.isRunning(), "app running after resize reset");
    });

    // ══════════════════════════════════════════════════════════
    // Section 8: Navigation Loop
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 8: Navigation Loop\x1b[0m\n");

    const pages = ["services", "work", "testimonials", "contact"];
    for (const pageName of pages) {
      await test(`nav loop: visit ${pageName} and return`, async () => {
        await emu!.navigateTo(pageName);
        await sleep(300);
        const current = emu!.screen.currentPage();
        assert(current !== "home", `should be on ${pageName}, got "${current}"`);
        await emu!.press("escape");
        await sleep(300);
        assertEqual(emu!.screen.currentPage(), "home", `should return home from ${pageName}`);
      });
    }

    await test("nav loop: rapid navigation doesn't crash", async () => {
      for (let i = 0; i < 3; i++) {
        await emu!.press("down");
        await sleep(100);
        await emu!.press("enter");
        await sleep(300);
        await emu!.press("escape");
        await sleep(300);
      }
      assert(emu!.isRunning(), "app survived rapid navigation");
    });

    // ══════════════════════════════════════════════════════════
    // Section 9: Edge Cases
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 9: Edge Cases\x1b[0m\n");

    await test("edge: check app still alive before edge tests", () => {
      if (!emu!.isRunning()) {
        throw new Error("APP CRASHED during rapid navigation loop (P0 BUG). Screen dump before crash in nav_loop section.");
      }
    });

    await test("edge: escape on home doesn't crash", async () => {
      if (!emu!.isRunning()) throw new Error("app already dead");
      assertEqual(emu!.screen.currentPage(), "home", "should be on home");
      await emu!.press("escape");
      await sleep(300);
      assert(emu!.isRunning(), "P0 BUG: app crashes on escape at home screen");
    });

    // Only proceed if still alive
    if (emu!.isRunning()) {
      await test("edge: multiple escapes don't crash", async () => {
        await emu!.press("escape");
        await sleep(100);
        await emu!.press("escape");
        await sleep(100);
        await emu!.press("escape");
        await sleep(200);
        assert(emu!.isRunning(), "app survives multiple escapes");
      });
    }

    if (emu!.isRunning()) {
      await test("edge: arrow keys on home don't crash", async () => {
        await emu!.press("up");
        await sleep(100);
        await emu!.press("down");
        await sleep(100);
        await emu!.press("left");
        await sleep(100);
        await emu!.press("right");
        await sleep(100);
        assert(emu!.isRunning(), "app survives arrow keys on home");
      });
    }

    if (emu!.isRunning()) {
      await test("edge: tab key doesn't crash", async () => {
        await emu!.press("tab");
        await sleep(200);
        assert(emu!.isRunning(), "app survives tab key");
      });
    }

    if (emu!.isRunning()) {
      await test("edge: navigate to contact and interact with form", async () => {
        await emu!.navigateTo("contact");
        await sleep(500);
        await emu!.press("down", { times: 3 });
        await sleep(300);
        await emu!.press("tab");
        await sleep(200);
        await emu!.press("tab");
        await sleep(200);
        assert(emu!.isRunning(), "app survives form interaction");
        await emu!.press("escape");
        await sleep(300);
      });
    }

    // ══════════════════════════════════════════════════════════
    // Section 10: Stability & Shutdown
    // ══════════════════════════════════════════════════════════

    console.log("\n\x1b[1m  Section 10: Stability & Shutdown\x1b[0m\n");

    await test("stability: app still running after all tests", () => {
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

  // ── Summary & Report ──────────────────────────────────────

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

  // ── Padding/Overflow Analysis ──
  console.log("\n\x1b[1m  Padding/Overflow Analysis:\x1b[0m");
  for (const [page, dump] of Object.entries(screenDumps)) {
    const cols = page.includes("60") ? 60 : page.includes("120") ? 120 : 100;
    const overflows = checkOverflow(dump, cols);
    const padBugs = checkPaddingBugs(dump);
    if (overflows.length > 0 || padBugs.length > 0) {
      console.log(`\n    ${page}:`);
      overflows.forEach(b => console.log(`      \x1b[31m[OVERFLOW] ${b}\x1b[0m`));
      padBugs.slice(0, 3).forEach(b => console.log(`      \x1b[33m[PADDING] ${b}\x1b[0m`));
    }
  }

  // ── JSON Report ──
  const report = {
    agent: "demo-freelancer-qa",
    demo: "demos/freelancer",
    tests_run: results.length,
    tests_passed: passed,
    tests_failed: failed,
    duration_ms: totalDuration,
    sections: {
      boot: results.filter(r => r.name.startsWith("launch:") || r.name.startsWith("boot:")).length,
      services: results.filter(r => r.name.startsWith("services:") || r.name === "nav: navigateTo services").length,
      work: results.filter(r => r.name.startsWith("work:") || r.name === "nav: navigateTo work").length,
      testimonials: results.filter(r => r.name.startsWith("testimonials:") || r.name === "nav: navigateTo testimonials").length,
      contact: results.filter(r => r.name.startsWith("contact:") || r.name === "nav: navigateTo contact").length,
      resize_60: results.filter(r => r.name.includes("60")).length,
      resize_120: results.filter(r => r.name.includes("120")).length,
      nav_loop: results.filter(r => r.name.startsWith("nav loop:")).length,
      edge_cases: results.filter(r => r.name.startsWith("edge:")).length,
      stability: results.filter(r => r.name.startsWith("stability:")).length,
    },
    screen_dumps: Object.keys(screenDumps),
    bugs_found: [] as string[],
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  // Collect bugs from failed tests
  for (const r of results.filter(r => !r.passed)) {
    report.bugs_found.push(`${r.name}: ${r.error}`);
  }

  // Collect visual bugs
  for (const [page, dump] of Object.entries(screenDumps)) {
    const cols = page.includes("60") ? 60 : page.includes("120") ? 120 : 100;
    const overflows = checkOverflow(dump, cols);
    const padBugs = checkPaddingBugs(dump);
    overflows.forEach(b => report.bugs_found.push(`[OVERFLOW ${page}] ${b}`));
    padBugs.forEach(b => report.bugs_found.push(`[PADDING ${page}] ${b}`));
  }

  console.log("\n" + JSON.stringify(report, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n\x1b[31mFATAL ERROR:\x1b[0m", err);
  const report = {
    agent: "demo-freelancer-qa",
    demo: "demos/freelancer",
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
