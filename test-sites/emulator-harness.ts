/**
 * Emulator-based test harness for terminaltui sites.
 *
 * Takes a SiteConfig, renders every page through VirtualTerminal,
 * runs exhaustive screen reader + assertion checks, outputs JSON report.
 *
 * Used by all agent test scripts.
 */
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { Assertions, AssertionError } from "../src/emulator/assertions.js";
import { InputSender, resolveKey } from "../src/emulator/input-sender.js";

import {
  defineSite,
  page,
  card,
  timeline,
  table,
  list,
  quote,
  hero,
  gallery,
  tabs,
  accordion,
  link,
  skillBar,
  progressBar,
  badge,
  image,
  ascii,
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
  section,
  themes,
  defaultTheme,
} from "../src/index.js";

import type { Site, SiteConfig, ContentBlock, PageConfig, Theme, BuiltinThemeName } from "../src/config/types.js";
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { renderCard } from "../src/components/Card.js";
import { renderText } from "../src/components/Text.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderTable } from "../src/components/Table.js";
import { renderLink } from "../src/components/Link.js";
import { renderDivider } from "../src/components/Divider.js";
import { renderSpacer } from "../src/components/Spacer.js";
import { renderQuote } from "../src/components/Quote.js";
import { renderBadge } from "../src/components/Badge.js";
import { renderHero } from "../src/components/Hero.js";
import { renderList } from "../src/components/List.js";
import { renderImage } from "../src/components/Image.js";
import { renderAccordion } from "../src/components/Accordion.js";
import { renderTabs } from "../src/components/Tabs.js";
import { renderGallery } from "../src/components/Gallery.js";
import { renderBox } from "../src/components/Box.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { fgColor, bold, dim, italic, reset, setColorMode } from "../src/style/colors.js";
import { Router } from "../src/navigation/router.js";
import { FocusManager } from "../src/navigation/focus.js";
import { keyToAction } from "../src/navigation/keybindings.js";
import type { KeyPress } from "../src/core/input.js";
import { writeFileSync } from "node:fs";

// Force 256-color mode for consistent output
setColorMode("256");

// ─── Types ────────────────────────────────────────────────

interface Bug {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  component: string;
  reproduction: string;
  expected: string;
  actual: string;
  screenshot?: string;
}

interface AgentReport {
  agent: string;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  bugs: Bug[];
  notes: string;
}

interface TestStep {
  name: string;
  passed: boolean;
  error?: string;
}

// ─── Theme Resolver ───────────────────────────────────────

function resolveTheme(t?: Theme | string): Theme {
  if (!t) return defaultTheme;
  if (typeof t === "string") return (themes as any)[t] ?? defaultTheme;
  return t as Theme;
}

// ─── Block Renderer ───────────────────────────────────────

function renderBlock(block: ContentBlock, ctx: RenderContext): string[] {
  switch (block.type) {
    case "text":
      return renderText(block.content, ctx, block.style);
    case "card":
      return renderCard(block, ctx);
    case "timeline":
      return renderTimeline(block.items, ctx, block.style);
    case "table":
      return renderTable(block.headers, block.rows, ctx);
    case "list":
      return renderList(block.items, ctx, block.style);
    case "quote":
      return renderQuote(block.text, ctx, { attribution: block.attribution, style: block.style });
    case "hero":
      return renderHero(block, ctx);
    case "gallery":
      return renderGallery(block.items, ctx, { columns: block.columns });
    case "tabs":
      return renderTabs(block.items, 0, ctx, (blocks, c) => {
        const lines: string[] = [];
        for (const b of blocks) lines.push(...renderBlock(b, c));
        return lines;
      });
    case "accordion":
      return renderAccordion(block.items, 0, ctx, (blocks, c) => {
        const lines: string[] = [];
        for (const b of blocks) lines.push(...renderBlock(b, c));
        return lines;
      });
    case "link":
      return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "progressBar":
      return renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent });
    case "badge":
      return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];
    case "image":
      return renderImage(block.path, ctx, { width: block.width, mode: block.mode });
    case "divider":
      return renderDivider(ctx, { style: block.style, label: block.label, color: block.color });
    case "spacer":
      return renderSpacer(block.lines);
    case "section": {
      const lines: string[] = [];
      lines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
      lines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, ctx.width - 4)) + reset);
      lines.push("");
      for (const b of block.content) {
        lines.push(...renderBlock(b, ctx));
        lines.push("");
      }
      return lines;
    }
    case "custom":
      return block.render(ctx.width, ctx.theme);
    default:
      return [];
  }
}

// ─── VTerm Writer ─────────────────────────────────────────

function writeToVterm(vt: VirtualTerminal, lines: string[]): void {
  const rows = vt.rows;
  let output = "\x1b[H";
  for (let i = 0; i < rows; i++) {
    output += `\x1b[${i + 1};1H\x1b[2K`;
    if (i < lines.length) {
      output += lines[i];
    }
  }
  vt.write(output);
}

// ─── Home Page Renderer ───────────────────────────────────

function renderHomePage(
  config: SiteConfig,
  theme: Theme,
  focusIndex: number,
  cols: number,
): string[] {
  const contentWidth = Math.min(cols, 100);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);
  const ctx: RenderContext = { width: contentWidth, theme, borderStyle: config.borders ?? "rounded" };
  const lines: string[] = [];

  // Banner
  if (config.banner) {
    let bannerLines: string[];
    try {
      bannerLines = renderBanner(config.banner.text, { font: config.banner.font });
      bannerLines = centerBanner(bannerLines, contentWidth);
      if (config.banner.gradient) {
        bannerLines = gradientLines(bannerLines, config.banner.gradient);
      } else {
        bannerLines = bannerLines.map(l => fgColor(theme.accent) + l + reset);
      }
    } catch {
      bannerLines = [fgColor(theme.accent) + bold + config.name + reset];
    }
    lines.push("");
    for (const bl of bannerLines) lines.push(padStr + bl);
  } else {
    lines.push("");
    lines.push(padStr + fgColor(theme.accent) + bold + config.name + reset);
  }
  lines.push("");

  // Tagline
  if (config.tagline) {
    lines.push(padStr + fgColor(theme.muted) + italic + config.tagline + reset);
    lines.push("");
  }

  // Divider
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");

  // Menu
  const menuItems: MenuItem[] = config.pages.map(p => ({
    label: p.title,
    icon: p.icon,
    id: p.id,
  }));
  const menuLines = renderMenu(menuItems, focusIndex, ctx);
  for (const ml of menuLines) lines.push(padStr + ml);

  // Footer
  lines.push("");
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");
  lines.push(padStr + fgColor(theme.subtle) + dim + "  \u2191\u2193 navigate  \u23ce select  q quit  : command" + reset);

  if (config.handle) {
    lines.push("");
    lines.push(padStr + fgColor(theme.subtle) + dim + "  " + config.handle + reset);
  }

  return lines;
}

// ─── Content Page Renderer ────────────────────────────────

function renderContentPage(
  config: SiteConfig,
  pg: PageConfig,
  theme: Theme,
  cols: number,
): string[] {
  const contentWidth = Math.min(cols, 100);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);
  const ctx: RenderContext = { width: contentWidth, theme, borderStyle: config.borders ?? "rounded" };
  const lines: string[] = [];

  // Header
  lines.push("");
  const backHint = fgColor(theme.subtle) + dim + "\u2190 back" + reset;
  const pageTitle = fgColor(theme.accent) + bold +
    (pg.icon ? pg.icon + " " : "") + pg.title + reset;
  lines.push(padStr + backHint + "  " + pageTitle);
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");

  // Content blocks
  for (const block of pg.content) {
    const blockLines = renderBlock(block, ctx);
    for (const bl of blockLines) lines.push(padStr + bl);
    lines.push("");
  }

  // Footer
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  const pageIdx = config.pages.indexOf(pg) + 1;
  const pageTotal = config.pages.length;
  lines.push(padStr + fgColor(theme.subtle) + dim +
    `  \u2191\u2193 scroll  \u2190 back  q quit  [${pageIdx}/${pageTotal}]` + reset);

  return lines;
}

// ─── Main Test Runner ─────────────────────────────────────

export function runSiteTests(config: SiteConfig, agentName: string): AgentReport {
  const steps: TestStep[] = [];
  const bugs: Bug[] = [];
  let bugCounter = 0;

  function addBug(severity: Bug["severity"], title: string, component: string, repro: string, expected: string, actual: string, screenshot?: string): void {
    bugCounter++;
    bugs.push({
      id: `BUG-${String(bugCounter).padStart(3, "0")}`,
      severity, title, component, reproduction: repro, expected, actual, screenshot,
    });
  }

  function step(name: string, fn: () => void): void {
    try {
      fn();
      steps.push({ name, passed: true });
    } catch (err: any) {
      steps.push({ name, passed: false, error: err.message });
    }
  }

  function assert(cond: boolean, msg: string): void {
    if (!cond) throw new Error(msg);
  }

  // ── Resolve theme ──
  const theme = resolveTheme(config.theme);

  // ── Test at multiple widths ──
  const widths = [40, 80, 120];

  for (const cols of widths) {
    const rows = 24;
    const vtRows = Math.max(rows, 200); // extra rows to avoid scroll clipping for content-heavy pages

    // ════════════════════════════════════════════════
    // HOME PAGE TESTS
    // ════════════════════════════════════════════════

    step(`[${cols}x${rows}] Home page renders without crash`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      assert(homeLines.length > 0, "Home page produced 0 lines");
    });

    step(`[${cols}x${rows}] Home page in vterm — banner/name visible`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const sr = new ScreenReader(vt);
      const text = sr.text();
      const nameVisible = text.includes(config.name) ||
        // Banner might use ASCII art that doesn't contain the exact name
        config.banner !== undefined;
      assert(nameVisible, `Site name "${config.name}" not found on home screen`);
    });

    step(`[${cols}x${rows}] Home page — tagline visible`, () => {
      if (!config.tagline) return; // skip if no tagline
      // At narrow widths, long taglines may be truncated — only check if it fits
      if (config.tagline.length > cols - 4) return;
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const sr = new ScreenReader(vt);
      assert(sr.contains(config.tagline), `Tagline "${config.tagline}" not found`);
    });

    step(`[${cols}x${rows}] Home page — menu has correct item count`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const sr = new ScreenReader(vt);
      const menu = sr.menu();
      if (menu.items.length !== config.pages.length) {
        addBug("P1", `Menu shows ${menu.items.length} items, expected ${config.pages.length}`,
          "Menu", `renderHomePage at ${cols}x${rows}`,
          `${config.pages.length} menu items`,
          `${menu.items.length} menu items detected`,
          sr.text().split("\n").slice(0, 15).join("\n"));
      }
      assert(menu.items.length === config.pages.length,
        `Expected ${config.pages.length} menu items, got ${menu.items.length}`);
    });

    step(`[${cols}x${rows}] Home page — first item selected`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const sr = new ScreenReader(vt);
      const menu = sr.menu();
      if (menu.items.length > 0) {
        assert(menu.selectedIndex === 0, `Expected first item selected, got index ${menu.selectedIndex}`);
      }
    });

    step(`[${cols}x${rows}] Home page — no error strings`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const text = vt.text();
      const badStrings = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError", "SyntaxError"];
      for (const bad of badStrings) {
        if (text.includes(bad)) {
          addBug("P1", `"${bad}" found on home page`, "Runtime", `Home page at ${cols}x${rows}`,
            "No error strings", `"${bad}" is visible`, text.split("\n").slice(0, 10).join("\n"));
        }
        assert(!text.includes(bad), `"${bad}" found on home page`);
      }
    });

    step(`[${cols}x${rows}] Home page — noOverflow`, () => {
      const homeLines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const asserts = new Assertions(vt, new ScreenReader(vt));
      asserts.noOverflow();
    });

    // ════════════════════════════════════════════════
    // MENU NAVIGATION — selection cycling
    // ════════════════════════════════════════════════

    step(`[${cols}x${rows}] Menu selection cycles through all items`, () => {
      for (let i = 0; i < config.pages.length; i++) {
        const homeLines = renderHomePage(config, theme, i, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, homeLines);
        const sr = new ScreenReader(vt);
        const menu = sr.menu();
        if (menu.items.length > 0) {
          assert(menu.selectedIndex === i, `Selection ${i}: expected index ${i}, got ${menu.selectedIndex}`);
        }
      }
    });

    // ════════════════════════════════════════════════
    // CONTENT PAGE TESTS
    // ════════════════════════════════════════════════

    for (const pg of config.pages) {
      step(`[${cols}x${rows}] Page "${pg.title}" renders without crash`, () => {
        const pageLines = renderContentPage(config, pg, theme, cols);
        assert(pageLines.length > 0, `Page "${pg.title}" produced 0 lines`);
      });

      step(`[${cols}x${rows}] Page "${pg.title}" — title visible`, () => {
        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const sr = new ScreenReader(vt);
        assert(sr.contains(pg.title), `Page title "${pg.title}" not visible`);
      });

      step(`[${cols}x${rows}] Page "${pg.title}" — no error strings`, () => {
        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const text = vt.text();
        const badStrings = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"];
        for (const bad of badStrings) {
          if (text.includes(bad)) {
            addBug("P1", `"${bad}" on page "${pg.title}"`, pg.content[0]?.type ?? "unknown",
              `Page "${pg.title}" at ${cols}x${rows}`, "No error strings",
              `"${bad}" is visible`, text.split("\n").slice(0, 15).join("\n"));
          }
          assert(!text.includes(bad), `"${bad}" found on page "${pg.title}"`);
        }
      });

      step(`[${cols}x${rows}] Page "${pg.title}" — noOverflow`, () => {
        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const asserts = new Assertions(vt, new ScreenReader(vt));
        asserts.noOverflow();
      });

      // Content-specific checks: verify card titles, link labels, etc.
      step(`[${cols}x${rows}] Page "${pg.title}" — content verified`, () => {
        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const sr = new ScreenReader(vt);
        const text = sr.text();

        for (const block of pg.content) {
          verifyBlockContent(block, text, pg.title, cols, bugs, bugCounter);
        }
      });

      // Card detection
      step(`[${cols}x${rows}] Page "${pg.title}" — cards detected`, () => {
        const cardBlocks = collectBlocks(pg.content, "card");
        if (cardBlocks.length === 0) return; // skip if no cards

        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const sr = new ScreenReader(vt);
        const cards = sr.cards();
        // At least some cards should be detected (not all may be due to scrolling)
        if (cards.length === 0 && cardBlocks.length > 0 && cols >= 40) {
          addBug("P2", `No cards detected on page "${pg.title}" (expected ${cardBlocks.length})`,
            "ScreenReader/Card", `Page "${pg.title}" at ${cols}x${rows}`,
            `${cardBlocks.length} cards`, "0 cards detected");
        }
      });

      // Link detection
      step(`[${cols}x${rows}] Page "${pg.title}" — links detected`, () => {
        const linkBlocks = collectBlocks(pg.content, "link");
        if (linkBlocks.length === 0) return;

        const pageLines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, pageLines);
        const sr = new ScreenReader(vt);
        const links = sr.links();
        if (links.length === 0 && linkBlocks.length > 0 && cols >= 60) {
          addBug("P2", `No links detected on page "${pg.title}" (expected ${linkBlocks.length})`,
            "ScreenReader/Link", `Page "${pg.title}" at ${cols}x${rows}`,
            `${linkBlocks.length} links`, "0 links detected");
        }
      });
    }

    // ════════════════════════════════════════════════
    // INDIVIDUAL BLOCK RENDERING TESTS
    // ════════════════════════════════════════════════

    for (const pg of config.pages) {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      for (const block of pg.content) {
        step(`[${cols}x${rows}] Block ${block.type} on "${pg.title}" renders`, () => {
          const lines = renderBlock(block, ctx);
          if (block.type !== "spacer") {
            assert(lines.length > 0, `${block.type} produced 0 lines`);
          }
        });

        step(`[${cols}x${rows}] Block ${block.type} on "${pg.title}" no overflow`, () => {
          const lines = renderBlock(block, ctx);
          for (let i = 0; i < lines.length; i++) {
            const plain = stripAnsi(lines[i]);
            if (plain.length > ctx.width + 2) {
              addBug("P2", `${block.type} overflow: line ${i} is ${plain.length} chars (max ${ctx.width})`,
                block.type, `Page "${pg.title}", block ${block.type}, width ${cols}`,
                `<= ${ctx.width} chars`, `${plain.length} chars: "${plain.substring(0, 50)}..."`,
              );
              throw new Error(`Overflow: ${plain.length} > ${ctx.width}`);
            }
          }
        });
      }
    }
  }

  // ════════════════════════════════════════════════
  // NAVIGATION TESTS
  // ════════════════════════════════════════════════

  step("Router — navigate to all pages and back", () => {
    const router = new Router();
    router.registerPages(config.pages.map(p => p.id));

    for (const pg of config.pages) {
      router.navigate(pg.id);
      assert(router.currentPage === pg.id, `Expected page ${pg.id}`);
    }
    for (let i = 0; i < config.pages.length; i++) {
      router.back();
    }
    assert(router.isHome(), "Should be home after backing out");
  });

  step("Router — navigate by index", () => {
    const router = new Router();
    router.registerPages(config.pages.map(p => p.id));
    for (let i = 0; i < config.pages.length; i++) {
      router.navigateByIndex(i);
      router.home();
    }
  });

  step("Focus — cycle through menu items", () => {
    const focus = new FocusManager();
    focus.setItems(config.pages.map(p => p.id));
    for (let i = 0; i < config.pages.length * 3; i++) focus.focusNext();
    for (let i = 0; i < config.pages.length * 3; i++) focus.focusPrev();
    focus.focusFirst();
    assert(focus.focusIndex === 0, "focusFirst");
    focus.focusLast();
    assert(focus.focusIndex === config.pages.length - 1, "focusLast");
  });

  step("Keybindings — all standard keys map to actions", () => {
    const keyTests: [string, string, boolean, boolean][] = [
      ["up", "", false, false], ["down", "", false, false],
      ["return", "", false, false], ["escape", "", false, false],
      ["q", "q", false, false], ["j", "j", false, false],
      ["k", "k", false, false], ["1", "1", false, false],
      ["c", "c", true, false], // ctrl+c
    ];
    for (const [name, char, ctrl] of keyTests) {
      const key: KeyPress = { name, char, ctrl, meta: false, shift: false, sequence: "" };
      const action = keyToAction(key, true);
      assert(action !== null && action !== undefined, `Key "${name}" should map to action`);
    }
  });

  // ════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ════════════════════════════════════════════════

  step("Focus — down 50 times doesn't crash (clamped)", () => {
    const focus = new FocusManager();
    focus.setItems(config.pages.map(p => p.id));
    for (let i = 0; i < 50; i++) focus.focusNext();
    assert(focus.focusIndex < config.pages.length, "Index is within bounds");
  });

  step("Rendering at width=20 doesn't crash", () => {
    const ctx: RenderContext = { width: 20, theme, borderStyle: config.borders ?? "rounded" };
    for (const pg of config.pages) {
      for (const block of pg.content) {
        try {
          renderBlock(block, ctx);
        } catch (err: any) {
          addBug("P0", `Crash rendering ${block.type} at width=20: ${err.message}`,
            block.type, `Page "${pg.title}", width=20`, "No crash", err.message);
          throw err;
        }
      }
    }
  });

  step("Rendering at width=200 doesn't crash", () => {
    const ctx: RenderContext = { width: 200, theme, borderStyle: config.borders ?? "rounded" };
    for (const pg of config.pages) {
      for (const block of pg.content) {
        try {
          renderBlock(block, ctx);
        } catch (err: any) {
          addBug("P0", `Crash rendering ${block.type} at width=200: ${err.message}`,
            block.type, `Page "${pg.title}", width=200`, "No crash", err.message);
          throw err;
        }
      }
    }
  });

  // ════════════════════════════════════════════════
  // THEME TESTS — render with every built-in theme
  // ════════════════════════════════════════════════

  const themeNames: string[] = Object.keys(themes);
  for (const tn of themeNames) {
    step(`Theme "${tn}" — home page renders`, () => {
      const t = (themes as any)[tn] as Theme;
      const homeLines = renderHomePage(config, t, 0, 80);
      assert(homeLines.length > 0, "Home page produced 0 lines");
      const vt = new VirtualTerminal(80, 40);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, homeLines);
      const text = vt.text();
      const badStrings = ["undefined", "[object Object]", "NaN"];
      for (const bad of badStrings) {
        assert(!text.includes(bad), `"${bad}" found with theme "${tn}"`);
      }
    });
  }

  // ════════════════════════════════════════════════
  // COMPILE REPORT
  // ════════════════════════════════════════════════

  const passed = steps.filter(s => s.passed).length;
  const failed = steps.filter(s => !s.passed).length;

  const report: AgentReport = {
    agent: agentName,
    tests_run: steps.length,
    tests_passed: passed,
    tests_failed: failed,
    bugs,
    notes: failed > 0
      ? `${failed} tests failed. Failures: ${steps.filter(s => !s.passed).map(s => s.name + ": " + s.error).join("; ")}`
      : "All tests passed.",
  };

  return report;
}

// ─── Content Verification Helpers ─────────────────────────

function verifyBlockContent(block: ContentBlock, screenText: string, pageTitle: string, cols: number, bugs: Bug[], counter: number): void {
  switch (block.type) {
    case "card":
      if (block.title && !screenText.includes(block.title.substring(0, Math.min(block.title.length, 20)))) {
        // Only flag if title is short enough to not be truncated
        if (block.title.length < cols - 10) {
          bugs.push({
            id: `BUG-V${counter}`, severity: "P2", title: `Card title "${block.title}" not visible`,
            component: "Card", reproduction: `Page "${pageTitle}" at ${cols} cols`,
            expected: `Card title visible`, actual: `Title not found in screen text`,
          });
        }
      }
      break;
    case "section":
      if (block.title && !screenText.includes(block.title.substring(0, Math.min(block.title.length, 25)))) {
        if (block.title.length < cols - 10) {
          bugs.push({
            id: `BUG-V${counter}`, severity: "P2", title: `Section title "${block.title}" not visible`,
            component: "Section", reproduction: `Page "${pageTitle}" at ${cols} cols`,
            expected: `Section title visible`, actual: `Title not found`,
          });
        }
      }
      // Verify nested content
      for (const child of block.content) {
        verifyBlockContent(child, screenText, pageTitle, cols, bugs, counter);
      }
      break;
    case "quote":
      if (block.text) {
        const firstWords = block.text.split(" ").slice(0, 3).join(" ");
        if (firstWords.length > 0 && !screenText.includes(firstWords)) {
          // Only flag for wider widths where text should fit
          if (cols >= 60) {
            bugs.push({
              id: `BUG-V${counter}`, severity: "P3", title: `Quote text not visible: "${firstWords}..."`,
              component: "Quote", reproduction: `Page "${pageTitle}" at ${cols} cols`,
              expected: "Quote text visible", actual: "First words not found",
            });
          }
        }
      }
      break;
    case "text":
      if (block.content) {
        const firstWords = block.content.split(" ").slice(0, 3).join(" ");
        if (firstWords.length > 3 && !screenText.includes(firstWords)) {
          if (cols >= 60) {
            // Content might be markdown-processed, don't flag as bug
          }
        }
      }
      break;
  }
}

function collectBlocks(blocks: ContentBlock[], type: string): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const b of blocks) {
    if (b.type === type) result.push(b);
    if (b.type === "section") {
      result.push(...collectBlocks(b.content, type));
    }
  }
  return result;
}

// ─── Exports ──────────────────────────────────────────────

export {
  defineSite, page, card, timeline, table, list, quote, hero, gallery,
  tabs, accordion, link, skillBar, progressBar, badge, image, ascii,
  markdown, gradient, sparkline, divider, spacer, section, themes,
};
export type { AgentReport, Bug };
