/**
 * Visual consistency stress test for terminaltui.
 * Renders a complete representative site through ALL 10 built-in themes
 * and checks visual properties: ANSI codes, box-drawing alignment,
 * menu states, banner gradients, progress bar colors, and cross-theme
 * consistency.
 *
 * Run with: npx tsx test/stress-visual.ts
 */

import {
  createTestContext,
  assert,
  assertNoThrow,
  assertLines,
  renderBlock,
  defineSite,
  page,
  card,
  timeline,
  table,
  quote,
  link,
  progressBar,
  ascii,
  themes,
  type TestResult,
} from "./harness.js";

import { renderCard } from "../src/components/Card.js";
import { renderTable } from "../src/components/Table.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderQuote } from "../src/components/Quote.js";
import { renderLink } from "../src/components/Link.js";
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { fgColor } from "../src/style/colors.js";
import { hexToRgb } from "../src/style/colors.js";
import { getBorderChars } from "../src/style/borders.js";
import type { Theme, BuiltinThemeName } from "../src/style/theme.js";
import type { ContentBlock, SiteConfig } from "../src/config/types.js";

// ─── Test Infrastructure ──────────────────────────────────

interface ThemeTestReport {
  themeName: string;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

const allThemeReports: ThemeTestReport[] = [];
const crossThemeResults: TestResult[] = [];

function test(results: TestResult[], name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
  }
}

// ─── Site Config ──────────────────────────────────────────

const siteConfig: SiteConfig = {
  name: "TESTSITE",
  banner: ascii("TESTSITE", { font: "ANSI Shadow", gradient: ["#ff0000", "#ffff00", "#00ff00", "#0000ff"] }),
  theme: "dracula",
  pages: [
    page("features", {
      title: "Features",
      icon: "\u2726",
      content: [
        card({
          title: "Fast Rendering",
          subtitle: "v2.0",
          body: "Blazing fast terminal rendering with zero flicker and optimized diff updates.",
          tags: ["performance", "rendering", "terminal"],
        }),
        card({
          title: "Theme Engine",
          subtitle: "10 themes",
          body: "Beautiful color schemes with full truecolor support and custom theme creation.",
          tags: ["themes", "colors"],
        }),
        card({
          title: "Responsive Layout",
          subtitle: "adaptive",
          body: "Components automatically adapt to any terminal width without overflow.",
          tags: ["layout", "responsive", "adaptive"],
        }),
      ],
    }),
    page("data", {
      title: "Data",
      icon: "\u2630",
      content: [
        table(
          ["Metric", "Value", "Status"],
          [
            ["Render time", "< 16ms", "OK"],
            ["Memory", "12 MB", "Good"],
            ["Startup", "0.3s", "Fast"],
          ]
        ),
        progressBar("CPU Usage", 75),
        progressBar("Memory", 45),
        progressBar("Disk", 20),
        timeline([
          {
            title: "v1.0 Release",
            subtitle: "Initial launch",
            period: "2025-01",
            description: "First stable release with core components and basic theming.",
          },
          {
            title: "v2.0 Release",
            subtitle: "Major update",
            period: "2025-06",
            description: "Added 10 built-in themes, gradient support, and responsive layout engine.",
          },
        ]),
        quote("The terminal is the most powerful interface.", "Anonymous"),
        quote("Simplicity is the ultimate sophistication.", "Leonardo da Vinci"),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "\u2192",
      content: [
        link("GitHub Repository", "https://github.com/example/tui"),
        link("Documentation", "https://docs.example.com"),
        link("Discord Community", "https://discord.gg/example"),
        link("NPM Package", "https://npmjs.com/package/terminaltui"),
      ],
    }),
  ],
};

// ─── Helper: Extract ANSI color codes from rendered output ─

function extractTruecolorCodes(text: string): string[] {
  const matches = text.match(/\x1b\[(?:[0-9;]*;)?38;2;(\d+;\d+;\d+)m/g);
  if (!matches) return [];
  return matches.map(m => {
    const inner = m.match(/38;2;(\d+;\d+;\d+)/);
    return inner ? inner[1] : "";
  }).filter(Boolean);
}

function hexToRgbString(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  return `${rgb.r};${rgb.g};${rgb.b}`;
}

function extractUniqueFgCodes(text: string): Set<string> {
  const codes = extractTruecolorCodes(text);
  return new Set(codes);
}

// ─── Helper: Check box-drawing alignment ──────────────────

function checkBoxAlignment(lines: string[], borderStyle: string = "rounded"): { aligned: boolean; error?: string } {
  if (lines.length < 2) return { aligned: false, error: "Too few lines for a box" };

  const strippedLengths = lines.map(l => stripAnsi(l).length);
  const firstLen = strippedLengths[0];

  // All border lines should have the same visual length
  for (let i = 0; i < strippedLengths.length; i++) {
    if (strippedLengths[i] !== firstLen) {
      return {
        aligned: false,
        error: `Line ${i} length ${strippedLengths[i]} differs from line 0 length ${firstLen}`,
      };
    }
  }

  const chars = getBorderChars(borderStyle as any);
  const firstLine = stripAnsi(lines[0]);
  const lastLine = stripAnsi(lines[lines.length - 1]);

  // Check top-left corner
  if (firstLine[0] !== chars.topLeft) {
    return { aligned: false, error: `Top-left char "${firstLine[0]}" != expected "${chars.topLeft}"` };
  }

  // Check bottom-right corner
  if (lastLine[lastLine.length - 1] !== chars.bottomRight) {
    return { aligned: false, error: `Bottom-right char "${lastLine[lastLine.length - 1]}" != expected "${chars.bottomRight}"` };
  }

  return { aligned: true };
}

// ─── Per-Theme Tests ──────────────────────────────────────

const themeNames: BuiltinThemeName[] = [
  "cyberpunk", "dracula", "nord", "monokai", "solarized",
  "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker",
];

const WIDTH = 80;

for (const themeName of themeNames) {
  const theme = themes[themeName];
  const results: TestResult[] = [];
  const ctx: RenderContext = createTestContext(WIDTH, theme);

  // ── Test 1: Render all components — verify no crashes ───

  test(results, `[${themeName}] 1. Render all components at width ${WIDTH}`, () => {
    // Banner
    const bannerLines = renderBanner(siteConfig.banner!.text, { font: siteConfig.banner!.font });
    assert(bannerLines.length > 0, "Banner renders");

    // All pages' content blocks
    for (const pg of siteConfig.pages) {
      for (const block of pg.content) {
        const lines = renderBlock(block, ctx);
        assert(lines.length > 0 || block.type === "spacer", `${block.type} on "${pg.id}" should render lines`);
      }
    }

    // Menu
    const menuItems: MenuItem[] = siteConfig.pages.map(p => ({
      label: p.title, icon: p.icon, id: p.id,
    }));
    const menuLines = renderMenu(menuItems, 0, ctx);
    assert(menuLines.length === menuItems.length, "Menu renders correct number of items");
  });

  // ── Test 2: Check ANSI truecolor codes match theme ──────

  test(results, `[${themeName}] 2. ANSI truecolor codes present for accent/text/border`, () => {
    const allOutput: string[] = [];

    // Render cards (uses accent, text, border)
    for (const block of siteConfig.pages[0].content) {
      allOutput.push(...renderBlock(block, ctx));
    }
    // Render table (uses accent, text, border)
    allOutput.push(...renderBlock(siteConfig.pages[1].content[0], ctx));

    const combined = allOutput.join("\n");

    // Verify truecolor escape sequences exist
    assert(combined.includes("\x1b["), "Output contains ANSI escape sequences");
    assert(/\x1b\[[\d;]*38;2;\d+;\d+;\d+m/.test(combined), "Output contains truecolor (38;2;r;g;b) sequences");

    // Check that accent color is used
    const accentRgb = hexToRgbString(theme.accent);
    assert(accentRgb !== "", "Accent color converts to RGB");
    assert(combined.includes(`38;2;${accentRgb}`), `Accent color ${theme.accent} (${accentRgb}) found in output`);

    // Check that text color is used
    const textRgb = hexToRgbString(theme.text);
    assert(combined.includes(`38;2;${textRgb}`), `Text color ${theme.text} (${textRgb}) found in output`);

    // Check that border color is used
    const borderRgb = hexToRgbString(theme.border);
    assert(combined.includes(`38;2;${borderRgb}`), `Border color ${theme.border} (${borderRgb}) found in output`);
  });

  // ── Test 3: Box-drawing alignment for cards and tables ──

  test(results, `[${themeName}] 3a. Card box-drawing alignment`, () => {
    const cardBlock = siteConfig.pages[0].content[0]; // first card
    const lines = renderBlock(cardBlock, ctx);
    const result = checkBoxAlignment(lines, "rounded");
    assert(result.aligned, `Card alignment: ${result.error ?? "OK"}`);
  });

  test(results, `[${themeName}] 3b. Table box-drawing alignment`, () => {
    const tableBlock = siteConfig.pages[1].content[0]; // table
    const lines = renderBlock(tableBlock, ctx);

    // Table renderer reads ctx.borderStyle (which is "rounded" from createTestContext)
    const strippedLengths = lines.map(l => stripAnsi(l).length);
    const firstLen = strippedLengths[0];

    // All lines should have the same visual length
    for (let i = 0; i < strippedLengths.length; i++) {
      assert(
        strippedLengths[i] === firstLen,
        `Table line ${i} length ${strippedLengths[i]} should equal line 0 length ${firstLen}`
      );
    }

    // The table renderer uses ctx.borderStyle ?? "single", but createTestContext
    // sets borderStyle to "rounded", so the table uses rounded borders
    const borderStyle = (ctx.borderStyle as string) ?? "single";
    const chars = getBorderChars(borderStyle as any);
    const firstLine = stripAnsi(lines[0]);
    assert(firstLine[0] === chars.topLeft, `Table top-left char is "${firstLine[0]}", expected "${chars.topLeft}" (border: ${borderStyle})`);

    // Check bottom-right corner present
    const lastLine = stripAnsi(lines[lines.length - 1]);
    assert(
      lastLine[lastLine.length - 1] === chars.bottomRight,
      `Table bottom-right char is "${lastLine[lastLine.length - 1]}", expected "${chars.bottomRight}" (border: ${borderStyle})`
    );
  });

  // ── Test 4: Active vs inactive menu states ─────────────

  test(results, `[${themeName}] 4. Menu active vs inactive states have different ANSI codes`, () => {
    const menuItems: MenuItem[] = siteConfig.pages.map(p => ({
      label: p.title, icon: p.icon, id: p.id,
    }));

    // Render with selection at index 0
    const menuSel0 = renderMenu(menuItems, 0, ctx);
    // Render with selection at index 1
    const menuSel1 = renderMenu(menuItems, 1, ctx);

    // The first item should be different between the two renders
    // (selected in sel0, unselected in sel1)
    assert(menuSel0[0] !== menuSel1[0], "First menu item differs when selected vs unselected");
    assert(menuSel0[1] !== menuSel1[1], "Second menu item differs when selected vs unselected");

    // Selected item should use accent color
    const accentRgb = hexToRgbString(theme.accent);
    assert(menuSel0[0].includes(`38;2;${accentRgb}`), "Selected item (index 0) uses accent color");
    assert(menuSel1[1].includes(`38;2;${accentRgb}`), "Selected item (index 1) uses accent color");

    // Unselected items should use text color (not accent)
    const textRgb = hexToRgbString(theme.text);
    // In "hacker" theme, accent and text are both #00ff41, so skip this sub-check for hacker
    if (accentRgb !== textRgb) {
      assert(menuSel0[1].includes(`38;2;${textRgb}`), "Unselected item uses text color");
    }
  });

  // ── Test 5: Banner gradient has multiple colors ─────────

  test(results, `[${themeName}] 5. Banner gradient produces multiple distinct color codes`, () => {
    const bannerLines = renderBanner(siteConfig.banner!.text, { font: siteConfig.banner!.font });
    assert(bannerLines.length > 0, "Banner renders lines");

    const gradientBanner = gradientLines(bannerLines, siteConfig.banner!.gradient!);
    assert(gradientBanner.length === bannerLines.length, "Gradient preserves line count");

    // Collect all unique color codes across the gradient banner
    const allCodes = new Set<string>();
    for (const line of gradientBanner) {
      for (const code of extractTruecolorCodes(line)) {
        allCodes.add(code);
      }
    }

    assert(allCodes.size >= 3, `Gradient banner should have >= 3 distinct colors, found ${allCodes.size}`);
  });

  // ── Test 6: Progress bar filled vs empty colors differ ──

  test(results, `[${themeName}] 6. Progress bar filled portion uses different color than empty`, () => {
    // CPU Usage at 75% -> success color for filled, subtle for empty
    const lines = renderProgressBar("CPU Usage", 75, ctx, { max: 100, showPercent: true });
    assert(lines.length > 0, "Progress bar renders");

    const output = lines[0];

    // The filled portion uses one of success/warning/error colors
    // The empty portion uses subtle color
    const subtleRgb = hexToRgbString(theme.subtle);
    const successRgb = hexToRgbString(theme.success);

    // At 75%, bar color should be success
    assert(output.includes(`38;2;${successRgb}`), `Filled portion uses success color (${theme.success})`);
    assert(output.includes(`38;2;${subtleRgb}`), `Empty portion uses subtle color (${theme.subtle})`);
    assert(successRgb !== subtleRgb, "Filled and empty colors are different");
  });

  // ── Collect report ──────────────────────────────────────

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  allThemeReports.push({
    themeName,
    total: results.length,
    passed,
    failed,
    results,
  });
}

// ─── Cross-Theme Checks ──────────────────────────────────

test(crossThemeResults, "Cross-theme: All 10 themes have unique accent colors", () => {
  const accentColors = new Set<string>();
  for (const name of themeNames) {
    const accent = themes[name].accent;
    assert(!accentColors.has(accent), `Duplicate accent color ${accent} found in theme "${name}"`);
    accentColors.add(accent);
  }
  assert(accentColors.size === 10, `Expected 10 unique accent colors, got ${accentColors.size}`);
});

test(crossThemeResults, "Cross-theme: No theme has identical accent and text colors (except hacker)", () => {
  for (const name of themeNames) {
    const t = themes[name];
    // hacker intentionally uses #00ff41 for both accent and text
    if (name === "hacker") continue;
    assert(
      t.accent !== t.text,
      `Theme "${name}" has identical accent (${t.accent}) and text (${t.text}) colors`
    );
  }
});

test(crossThemeResults, "Cross-theme: Every theme has all required fields", () => {
  const requiredFields: (keyof Theme)[] = [
    "accent", "accentDim", "text", "muted", "subtle",
    "success", "warning", "error", "border",
  ];

  for (const name of themeNames) {
    const t = themes[name];
    for (const field of requiredFields) {
      assert(
        typeof t[field] === "string" && t[field].length > 0,
        `Theme "${name}" missing or empty field "${field}"`
      );
    }
  }
});

// ─── Print Reports ───────────────────────────────────────

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;

console.log("\n" + "=".repeat(70));
console.log("  VISUAL CONSISTENCY STRESS TEST");
console.log("  10 themes x 7 checks per theme + 3 cross-theme checks");
console.log("=".repeat(70));

for (const report of allThemeReports) {
  totalTests += report.total;
  totalPassed += report.passed;
  totalFailed += report.failed;

  const status = report.failed === 0 ? "PASS" : "FAIL";
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  Theme: ${report.themeName.toUpperCase()}  [${status}]  ${report.passed}/${report.total} passed`);
  console.log(`${"─".repeat(70)}`);

  for (const r of report.results) {
    const icon = r.passed ? "\u2713" : "\u2717";
    let line = `    ${icon} ${r.name}`;
    if (r.error) line += `\n        ERROR: ${r.error}`;
    console.log(line);
  }
}

// Cross-theme summary
const crossPassed = crossThemeResults.filter(r => r.passed).length;
const crossFailed = crossThemeResults.length - crossPassed;
totalTests += crossThemeResults.length;
totalPassed += crossPassed;
totalFailed += crossFailed;

console.log(`\n${"─".repeat(70)}`);
console.log(`  CROSS-THEME CHECKS  [${crossFailed === 0 ? "PASS" : "FAIL"}]  ${crossPassed}/${crossThemeResults.length} passed`);
console.log(`${"─".repeat(70)}`);

for (const r of crossThemeResults) {
  const icon = r.passed ? "\u2713" : "\u2717";
  let line = `    ${icon} ${r.name}`;
  if (r.error) line += `\n        ERROR: ${r.error}`;
  console.log(line);
}

// Overall summary
console.log("\n" + "=".repeat(70));
console.log(`  OVERALL: ${totalPassed}/${totalTests} passed, ${totalFailed} failed`);
if (totalFailed === 0) {
  console.log("  ALL VISUAL CONSISTENCY CHECKS PASSED");
} else {
  console.log(`  ${totalFailed} FAILURE(S) DETECTED`);
}
console.log("=".repeat(70) + "\n");

process.exit(totalFailed > 0 ? 1 : 0);
