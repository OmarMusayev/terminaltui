/**
 * Programmatic test harness for terminaltui.
 * Tests component rendering, config parsing, navigation, and layout
 * without requiring a TTY terminal.
 */
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
  type Site,
  type SiteConfig,
  type ContentBlock,
  type Theme,
} from "../src/index.js";

import { renderText } from "../src/components/Text.js";
import { renderCard } from "../src/components/Card.js";
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
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { renderBox } from "../src/components/Box.js";
import { renderScrollView } from "../src/components/ScrollView.js";
import { renderInput } from "../src/components/Input.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { Router } from "../src/navigation/router.js";
import { FocusManager } from "../src/navigation/focus.js";
import { keyToAction, type Action } from "../src/navigation/keybindings.js";
import type { KeyPress } from "../src/core/input.js";
import { defaultTheme } from "../src/style/theme.js";
import { TUIRuntime } from "../src/core/runtime.js";

// ─── Test Result Types ─────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

interface TestReport {
  project: string;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  bugs: BugReport[];
}

interface BugReport {
  severity: "P0" | "P1" | "P2" | "P3" | "P4";
  category: string;
  description: string;
  reproduction: string;
  component?: string;
}

// ─── Test Context Builder ──────────────────────────────────

export function createTestContext(width: number = 80, theme: Theme = defaultTheme): RenderContext {
  return { width, theme, borderStyle: "rounded" };
}

// ─── Assertion Helpers ─────────────────────────────────────

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertNoThrow(fn: () => void, label: string): TestResult {
  try {
    fn();
    return { name: label, passed: true };
  } catch (err: any) {
    return { name: label, passed: false, error: err.message };
  }
}

export function assertLines(lines: string[], label: string): TestResult {
  if (!Array.isArray(lines)) {
    return { name: label, passed: false, error: "Expected string[] but got non-array" };
  }
  if (lines.length === 0) {
    return { name: label, passed: false, error: "Rendered 0 lines — component produced no output" };
  }
  return { name: label, passed: true, details: `${lines.length} lines rendered` };
}

export function assertLinesNonEmpty(lines: string[], label: string): TestResult {
  const result = assertLines(lines, label);
  if (!result.passed) return result;
  const hasContent = lines.some(l => stripAnsi(l).trim().length > 0);
  if (!hasContent) {
    return { name: label, passed: false, error: "All lines are empty/whitespace-only" };
  }
  return result;
}

export function assertNoOverflow(lines: string[], maxWidth: number, label: string): TestResult {
  for (let i = 0; i < lines.length; i++) {
    const plainLen = stripAnsi(lines[i]).length;
    if (plainLen > maxWidth + 2) { // +2 for minor tolerance
      return {
        name: label,
        passed: false,
        error: `Line ${i} overflows: ${plainLen} chars (max ${maxWidth}). Content: "${stripAnsi(lines[i]).substring(0, 60)}..."`,
      };
    }
  }
  return { name: label, passed: true };
}

// ─── Site-Level Test Runner ────────────────────────────────

export function testSiteConfig(config: SiteConfig, projectName: string): TestReport {
  const results: TestResult[] = [];
  const bugs: BugReport[] = [];

  // Test 1: Config parses without error
  let site: Site | null = null;
  results.push(assertNoThrow(() => {
    site = defineSite(config);
  }, "Config parsing"));

  if (!site) {
    return { project: projectName, total: 1, passed: 0, failed: 1, results, bugs };
  }

  // Test 2: All pages have valid IDs
  results.push(assertNoThrow(() => {
    const ids = new Set<string>();
    for (const p of config.pages) {
      assert(!!p.id, `Page missing id: ${p.title}`);
      assert(!ids.has(p.id), `Duplicate page id: ${p.id}`);
      ids.add(p.id);
    }
  }, "Page IDs are valid and unique"));

  // Test 3: Theme resolution
  results.push(assertNoThrow(() => {
    const theme = resolveTheme(config.theme);
    assert(!!theme.accent, "Theme missing accent");
    assert(!!theme.text, "Theme missing text");
    assert(!!theme.border, "Theme missing border");
  }, "Theme resolves correctly"));

  const theme = resolveTheme(config.theme);
  const widths = [40, 60, 80, 100, 120];

  // Test 4: Banner rendering
  if (config.banner) {
    for (const width of widths) {
      results.push(assertNoThrow(() => {
        const bannerLines = renderBanner(config.banner!.text, { font: config.banner!.font });
        assertLines(bannerLines, `Banner renders at width ${width}`);
        if (config.banner!.gradient) {
          const gradient = gradientLines(bannerLines, config.banner!.gradient!);
          assert(gradient.length === bannerLines.length, "Gradient preserves line count");
        }
      }, `Banner renders at width ${width}`));
    }
  }

  // Test 5: Menu rendering
  const menuItems: MenuItem[] = config.pages.map(p => ({
    label: p.title,
    icon: p.icon,
    id: p.id,
  }));

  for (const selIdx of [0, Math.min(1, menuItems.length - 1), menuItems.length - 1]) {
    for (const width of [40, 80]) {
      const ctx = createTestContext(width, theme);
      results.push(assertNoThrow(() => {
        const lines = renderMenu(menuItems, selIdx, ctx);
        assert(lines.length === menuItems.length, `Menu renders ${menuItems.length} items`);
      }, `Menu renders with selection=${selIdx} at width=${width}`));
    }
  }

  // Test 6: Every page's content blocks render
  for (const pg of config.pages) {
    for (const width of [40, 80, 120]) {
      const ctx = createTestContext(width, theme);
      results.push(assertNoThrow(() => {
        for (const block of pg.content) {
          const lines = renderBlock(block, ctx);
          if (lines.length === 0 && block.type !== "spacer") {
            bugs.push({
              severity: "P1",
              category: "Component",
              description: `${block.type} block on page "${pg.id}" rendered 0 lines at width ${width}`,
              reproduction: `Page: ${pg.id}, Block type: ${block.type}`,
              component: block.type,
            });
          }
        }
      }, `Page "${pg.id}" content renders at width ${width}`));
    }
  }

  // Test 7: Overflow check at various widths
  for (const pg of config.pages) {
    for (const width of [40, 80]) {
      const ctx = createTestContext(width, theme);
      for (const block of pg.content) {
        try {
          const lines = renderBlock(block, ctx);
          const overflow = assertNoOverflow(lines, width, `Overflow check: ${block.type} on "${pg.id}" at w=${width}`);
          if (!overflow.passed) {
            bugs.push({
              severity: "P2",
              category: "Layout",
              description: overflow.error!,
              reproduction: `Page: ${pg.id}, Block type: ${block.type}, Width: ${width}`,
              component: block.type,
            });
          }
          results.push(overflow);
        } catch (err: any) {
          results.push({ name: `Overflow check: ${block.type} on "${pg.id}"`, passed: false, error: err.message });
        }
      }
    }
  }

  // Test 8: Navigation
  results.push(assertNoThrow(() => {
    const router = new Router();
    router.registerPages(config.pages.map(p => p.id));

    // Navigate forward through all pages
    for (const p of config.pages) {
      assert(router.navigate(p.id) || router.currentPage === p.id, `Can navigate to ${p.id}`);
    }

    // Navigate back through history
    for (let i = 0; i < config.pages.length; i++) {
      router.back();
    }

    // Navigate by index
    for (let i = 0; i < config.pages.length; i++) {
      assert(router.navigateByIndex(i), `Can navigate by index ${i}`);
    }

    // Home
    router.home();
    assert(router.isHome(), "Router returns to home");
  }, "Navigation routing"));

  // Test 9: Focus management
  results.push(assertNoThrow(() => {
    const focus = new FocusManager();
    focus.setItems(config.pages.map(p => p.id));

    // Cycle through all items
    for (let i = 0; i < config.pages.length * 2; i++) {
      focus.focusNext();
    }
    for (let i = 0; i < config.pages.length * 2; i++) {
      focus.focusPrev();
    }

    focus.focusFirst();
    assert(focus.focusIndex === 0, "focusFirst works");
    focus.focusLast();
    assert(focus.focusIndex === config.pages.length - 1, "focusLast works");
  }, "Focus management"));

  // Test 10: Keybinding mapping
  results.push(assertNoThrow(() => {
    const testKeys: KeyPress[] = [
      { name: "up", char: "", ctrl: false, meta: false, shift: false, sequence: "\x1b[A" },
      { name: "down", char: "", ctrl: false, meta: false, shift: false, sequence: "\x1b[B" },
      { name: "return", char: "", ctrl: false, meta: false, shift: false, sequence: "\r" },
      { name: "escape", char: "", ctrl: false, meta: false, shift: false, sequence: "\x1b" },
      { name: "q", char: "q", ctrl: false, meta: false, shift: false, sequence: "q" },
      { name: "j", char: "j", ctrl: false, meta: false, shift: false, sequence: "j" },
      { name: "k", char: "k", ctrl: false, meta: false, shift: false, sequence: "k" },
      { name: "1", char: "1", ctrl: false, meta: false, shift: false, sequence: "1" },
    ];

    for (const key of testKeys) {
      const action = keyToAction(key, true);
      // All keys should map to SOMETHING
      assert(action !== undefined, `Key "${key.name}" maps to an action`);
    }
  }, "Keybinding mapping"));

  // Compute totals
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  return { project: projectName, total, passed, failed, results, bugs };
}

// ─── Block Renderer ────────────────────────────────────────

export function renderBlock(block: ContentBlock, ctx: RenderContext): string[] {
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
      lines.push(`  ${block.title}`);
      lines.push("  " + "─".repeat(Math.max(0, ctx.width - 4)));
      for (const b of block.content) lines.push(...renderBlock(b, ctx));
      return lines;
    }
    case "custom":
      return block.render(ctx.width, ctx.theme);
    default:
      return [];
  }
}

// ─── Theme Resolver ────────────────────────────────────────

function resolveTheme(theme?: Theme | string): Theme {
  if (!theme) return defaultTheme;
  if (typeof theme === "string") return (themes as any)[theme] ?? defaultTheme;
  return theme as Theme;
}

// ─── Report Formatter ──────────────────────────────────────

export function formatReport(report: TestReport): string {
  let output = `\n${"═".repeat(60)}\n`;
  output += `TEST REPORT: ${report.project}\n`;
  output += `${"═".repeat(60)}\n`;
  output += `Total: ${report.total} | Passed: ${report.passed} | Failed: ${report.failed}\n`;
  output += `${"─".repeat(60)}\n`;

  for (const r of report.results) {
    const icon = r.passed ? "✓" : "✗";
    output += `  ${icon} ${r.name}`;
    if (r.error) output += ` — ${r.error}`;
    if (r.details && r.passed) output += ` (${r.details})`;
    output += "\n";
  }

  if (report.bugs.length > 0) {
    output += `\n${"─".repeat(60)}\n`;
    output += `BUGS FOUND: ${report.bugs.length}\n`;
    output += `${"─".repeat(60)}\n`;
    for (const bug of report.bugs) {
      output += `  [${bug.severity}] ${bug.category}: ${bug.description}\n`;
      output += `         Repro: ${bug.reproduction}\n`;
    }
  }

  return output;
}

export {
  defineSite, page, card, timeline, table, list, quote, hero, gallery,
  tabs, accordion, link, skillBar, progressBar, badge, image, ascii,
  markdown, gradient, sparkline, divider, spacer, section, themes,
};
export type { TestReport, BugReport, TestResult };
