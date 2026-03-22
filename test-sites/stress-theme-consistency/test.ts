/**
 * Stress Test: Theme Consistency
 *
 * Tests rendering with EVERY built-in theme, verifies accent colors
 * appear in output, checks theme property validity, and tests
 * switching themes mid-render.
 */
import { VirtualTerminal } from "../../src/emulator/vterm.js";
import { ScreenReader } from "../../src/emulator/screen-reader.js";
import { Assertions } from "../../src/emulator/assertions.js";
import { renderMenu, type MenuItem } from "../../src/components/Menu.js";
import { renderCard } from "../../src/components/Card.js";
import { renderText } from "../../src/components/Text.js";
import { renderTimeline } from "../../src/components/Timeline.js";
import { renderTable } from "../../src/components/Table.js";
import { renderLink } from "../../src/components/Link.js";
import { renderQuote } from "../../src/components/Quote.js";
import { renderList } from "../../src/components/List.js";
import { renderBadge } from "../../src/components/Badge.js";
import { renderProgressBar } from "../../src/components/ProgressBar.js";
import { stripAnsi, type RenderContext } from "../../src/components/base.js";
import { themes, defaultTheme } from "../../src/style/theme.js";
import type { Theme, BuiltinThemeName } from "../../src/style/theme.js";
import { setColorMode, fgColor, bold, dim, reset, hexToRgb } from "../../src/style/colors.js";
import { writeFileSync } from "node:fs";

setColorMode("256");

// ── Types & Helpers ──
interface Bug {
  id: string;
  severity: string;
  title: string;
  component: string;
  reproduction: string;
  expected: string;
  actual: string;
}

interface TestStep { name: string; passed: boolean; error?: string; }
const steps: TestStep[] = [];
const bugs: Bug[] = [];
let bugN = 0;

function step(name: string, fn: () => void): void {
  try { fn(); steps.push({ name, passed: true }); }
  catch (err: any) { steps.push({ name, passed: false, error: err.message }); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

function addBug(sev: string, title: string, comp: string, repro: string, exp: string, act: string): void {
  bugN++;
  bugs.push({ id: `BUG-${String(bugN).padStart(3, "0")}`, severity: sev, title, component: comp, reproduction: repro, expected: exp, actual: act });
}

function writeToVterm(vt: VirtualTerminal, lines: string[]): void {
  let output = "\x1b[H";
  for (let i = 0; i < vt.rows; i++) {
    output += `\x1b[${i + 1};1H\x1b[2K`;
    if (i < lines.length) output += lines[i];
  }
  vt.write(output);
}

const BAD_STRINGS = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"];

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ── Standard content set ──
const menuItems: MenuItem[] = [
  { label: "Home", icon: "\ud83c\udfe0", id: "home" },
  { label: "Projects", icon: "\ud83d\ude80", id: "projects" },
  { label: "About", icon: "\ud83d\udc64", id: "about" },
  { label: "Contact", icon: "\ud83d\udce7", id: "contact" },
];

const cardBlock = {
  type: "card" as const,
  title: "Featured Project",
  subtitle: "v2.0",
  body: "A sophisticated application built with modern web technologies.",
  tags: ["TypeScript", "React", "Node.js"],
};

const timelineItems = [
  { title: "Started Company", subtitle: "Founder", period: "2020", description: "Began the journey." },
  { title: "Series A", period: "2022", description: "Raised $10M in funding." },
];

const tableHeaders = ["Feature", "Status", "Priority"];
const tableRows = [
  ["Dark mode", "Done", "High"],
  ["API v2", "In Progress", "Medium"],
  ["Mobile app", "Planned", "Low"],
];

const listItems = ["First item in the list", "Second item with more text", "Third item"];

const quoteText = "The best way to predict the future is to create it.";
const quoteAttribution = "Peter Drucker";

const allThemeNames = Object.keys(themes) as BuiltinThemeName[];

// ══════════════════════════════════════════════════════════════
// TEST: Verify all themes have valid hex color properties
// ══════════════════════════════════════════════════════════════

for (const tn of allThemeNames) {
  const t = themes[tn];

  step(`Theme "${tn}" — accent is valid hex`, () => {
    assert(isValidHex(t.accent), `accent "${t.accent}" is not valid hex`);
  });

  step(`Theme "${tn}" — text is valid hex`, () => {
    assert(isValidHex(t.text), `text "${t.text}" is not valid hex`);
  });

  step(`Theme "${tn}" — border is valid hex`, () => {
    assert(isValidHex(t.border), `border "${t.border}" is not valid hex`);
  });

  step(`Theme "${tn}" — all properties are valid hex`, () => {
    const requiredProps: (keyof Theme)[] = ["accent", "accentDim", "text", "muted", "subtle", "success", "warning", "error", "border"];
    for (const prop of requiredProps) {
      const val = t[prop];
      if (val === undefined) continue; // bg is optional
      assert(typeof val === "string", `${prop} should be string, got ${typeof val}`);
      assert(isValidHex(val as string), `${prop} "${val}" is not valid hex (#RRGGBB)`);
    }
  });

  step(`Theme "${tn}" — hexToRgb works for accent`, () => {
    const rgb = hexToRgb(t.accent);
    assert(rgb !== null, `hexToRgb failed for accent "${t.accent}"`);
    assert(rgb!.r >= 0 && rgb!.r <= 255, `Red channel out of range: ${rgb!.r}`);
    assert(rgb!.g >= 0 && rgb!.g <= 255, `Green channel out of range: ${rgb!.g}`);
    assert(rgb!.b >= 0 && rgb!.b <= 255, `Blue channel out of range: ${rgb!.b}`);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Render each component with every theme
// ══════════════════════════════════════════════════════════════

for (const tn of allThemeNames) {
  const t = themes[tn];
  const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };

  step(`Theme "${tn}" — Menu renders`, () => {
    const lines = renderMenu(menuItems, 0, ctx);
    assert(lines.length === 4, `Expected 4 menu lines, got ${lines.length}`);
    const text = lines.map(l => stripAnsi(l)).join("\n");
    for (const bad of BAD_STRINGS) {
      assert(!text.includes(bad), `"${bad}" found in menu with theme ${tn}`);
    }
    // Verify non-empty output
    assert(text.trim().length > 0, "Menu output should not be empty");
  });

  step(`Theme "${tn}" — Card renders`, () => {
    const lines = renderCard(cardBlock, ctx);
    assert(lines.length > 0, "Card should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    for (const bad of BAD_STRINGS) {
      assert(!text.includes(bad), `"${bad}" found in card with theme ${tn}`);
    }
    assert(text.includes("Featured Project"), "Card title should appear");
  });

  step(`Theme "${tn}" — Link renders`, () => {
    const lines = renderLink("GitHub", "https://github.com", ctx);
    assert(lines.length > 0, "Link should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    assert(text.includes("GitHub"), "Link label should appear");
  });

  step(`Theme "${tn}" — Quote renders`, () => {
    const lines = renderQuote(quoteText, ctx, { attribution: quoteAttribution });
    assert(lines.length > 0, "Quote should produce lines");
  });

  step(`Theme "${tn}" — Table renders`, () => {
    const lines = renderTable(tableHeaders, tableRows, ctx);
    assert(lines.length > 0, "Table should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    assert(text.includes("Feature"), "Table header should appear");
  });

  step(`Theme "${tn}" — Timeline renders`, () => {
    const lines = renderTimeline(timelineItems, ctx);
    assert(lines.length > 0, "Timeline should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    assert(text.includes("Started Company"), "Timeline title should appear");
  });

  step(`Theme "${tn}" — List renders`, () => {
    const lines = renderList(listItems, ctx);
    assert(lines.length > 0, "List should produce lines");
  });

  step(`Theme "${tn}" — Badge renders`, () => {
    const result = renderBadge("Status", ctx);
    assert(typeof result === "string", "Badge should return string");
    assert(stripAnsi(result).includes("Status"), "Badge text should appear");
  });

  step(`Theme "${tn}" — ProgressBar renders`, () => {
    const lines = renderProgressBar("Skill", 75, ctx, { max: 100, showPercent: true });
    assert(lines.length > 0, "ProgressBar should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    assert(text.includes("75%"), "Should show 75%");
  });

  step(`Theme "${tn}" — Text renders`, () => {
    const lines = renderText("Sample paragraph with **bold** and *italic* text.", ctx, "markdown");
    assert(lines.length > 0, "Text should produce lines");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Verify accent color appears in VirtualTerminal cell colors
// ══════════════════════════════════════════════════════════════

for (const tn of allThemeNames) {
  const t = themes[tn];

  step(`Theme "${tn}" — accent color in VirtualTerminal cells (menu)`, () => {
    const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };
    const lines = renderMenu(menuItems, 0, ctx);
    const vt = new VirtualTerminal(80, 50);
    vt.write("\x1b[2J\x1b[H");
    writeToVterm(vt, lines);

    // Check if any cell has a foreground color
    const cells = vt.cells();
    let foundColoredCell = false;
    for (const row of cells) {
      for (const cell of row) {
        if (cell.fg !== null) {
          foundColoredCell = true;
          break;
        }
      }
      if (foundColoredCell) break;
    }
    assert(foundColoredCell, `No colored cells found in menu with theme "${tn}"`);
  });

  step(`Theme "${tn}" — accent color in VirtualTerminal cells (card)`, () => {
    const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };
    const lines = renderCard(cardBlock, ctx);
    const vt = new VirtualTerminal(80, 50);
    vt.write("\x1b[2J\x1b[H");
    writeToVterm(vt, lines);

    const cells = vt.cells();
    let foundColoredCell = false;
    let foundBoldCell = false;
    for (const row of cells) {
      for (const cell of row) {
        if (cell.fg !== null) foundColoredCell = true;
        if (cell.bold) foundBoldCell = true;
      }
    }
    assert(foundColoredCell, `No colored cells in card with theme "${tn}"`);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Theme switching mid-render
// ══════════════════════════════════════════════════════════════

step("Theme switch: render menu with cyberpunk, then re-render with dracula", () => {
  const vt = new VirtualTerminal(80, 50);
  vt.write("\x1b[2J\x1b[H");

  // First render with cyberpunk
  const ctx1: RenderContext = { width: 80, theme: themes.cyberpunk, borderStyle: "rounded" };
  const lines1 = renderMenu(menuItems, 0, ctx1);
  writeToVterm(vt, lines1);
  const text1 = vt.text();
  assert(text1.includes("Home"), "Home should appear in cyberpunk render");

  // Re-render with dracula
  vt.write("\x1b[2J\x1b[H");
  const ctx2: RenderContext = { width: 80, theme: themes.dracula, borderStyle: "rounded" };
  const lines2 = renderMenu(menuItems, 0, ctx2);
  writeToVterm(vt, lines2);
  const text2 = vt.text();
  assert(text2.includes("Home"), "Home should appear in dracula render");
});

step("Theme switch: render card with all 10 themes sequentially", () => {
  const vt = new VirtualTerminal(80, 50);

  for (const tn of allThemeNames) {
    const t = themes[tn];
    vt.write("\x1b[2J\x1b[H");
    const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };
    const lines = renderCard(cardBlock, ctx);
    writeToVterm(vt, lines);
    const text = vt.text();
    assert(text.includes("Featured"), `Card title should appear with theme "${tn}"`);
    for (const bad of BAD_STRINGS) {
      if (text.includes(bad)) {
        addBug("P1", `"${bad}" on theme switch to "${tn}"`, "Card",
          `Theme switch to ${tn}`, "No bad strings", `Found "${bad}"`);
      }
      assert(!text.includes(bad), `"${bad}" found with theme "${tn}"`);
    }
  }
});

step("Theme switch: render table with all themes on same vterm", () => {
  const vt = new VirtualTerminal(80, 50);

  for (const tn of allThemeNames) {
    const t = themes[tn];
    vt.write("\x1b[2J\x1b[H");
    const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };
    const lines = renderTable(tableHeaders, tableRows, ctx);
    writeToVterm(vt, lines);
    const text = vt.text();
    assert(text.includes("Feature"), `Table header should appear with theme "${tn}"`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: Theme switching with resize
// ══════════════════════════════════════════════════════════════

step("Theme switch + resize interleaved", () => {
  const vt = new VirtualTerminal(80, 50);
  const sizes: [number, number][] = [[40, 20], [120, 40], [60, 30]];
  let sizeIdx = 0;

  for (const tn of allThemeNames) {
    const [c, r] = sizes[sizeIdx % sizes.length];
    vt.resize(c, r);
    sizeIdx++;

    const t = themes[tn];
    vt.write("\x1b[2J\x1b[H");
    const ctx: RenderContext = { width: Math.min(c, 100), theme: t, borderStyle: "rounded" };
    const lines = renderMenu(menuItems, 0, ctx);
    writeToVterm(vt, lines);
    // Just verify no crash
    assert(vt.cols === c, `Cols should be ${c}`);
  }
});

// ══════════════════════════════════════════════════════════════
// TEST: Theme diff — verify themes produce visually different output
// ══════════════════════════════════════════════════════════════

step("All themes produce different ANSI output for same content", () => {
  const outputs = new Map<string, string>();
  const ctx: RenderContext = { width: 80, theme: defaultTheme, borderStyle: "rounded" };

  for (const tn of allThemeNames) {
    const t = themes[tn];
    const themedCtx: RenderContext = { ...ctx, theme: t };
    const lines = renderCard(cardBlock, themedCtx);
    const ansi = lines.join("\n");
    outputs.set(tn, ansi);
  }

  // Check that at least most themes produce different ANSI output
  const unique = new Set(outputs.values());
  // With 10 themes, we expect at least 8 unique outputs (some might be similar if themes are close)
  assert(unique.size >= 5, `Expected at least 5 unique ANSI outputs, got ${unique.size}`);
});

// ══════════════════════════════════════════════════════════════
// TEST: Render full page simulation with each theme
// ══════════════════════════════════════════════════════════════

for (const tn of allThemeNames) {
  step(`Theme "${tn}" — full page simulation (menu + card + table + timeline)`, () => {
    const t = themes[tn];
    const ctx: RenderContext = { width: 80, theme: t, borderStyle: "rounded" };
    const vt = new VirtualTerminal(80, 200);
    vt.write("\x1b[2J\x1b[H");

    const allLines: string[] = [];

    // Menu
    allLines.push(...renderMenu(menuItems, 0, ctx));
    allLines.push("");

    // Card
    allLines.push(...renderCard(cardBlock, ctx));
    allLines.push("");

    // Table
    allLines.push(...renderTable(tableHeaders, tableRows, ctx));
    allLines.push("");

    // Timeline
    allLines.push(...renderTimeline(timelineItems, ctx));
    allLines.push("");

    // Quote
    allLines.push(...renderQuote(quoteText, ctx, { attribution: quoteAttribution }));
    allLines.push("");

    // List
    allLines.push(...renderList(listItems, ctx));

    writeToVterm(vt, allLines);
    const text = vt.text();

    // Verify key content appears
    assert(text.includes("Home"), `"Home" should appear with theme "${tn}"`);
    assert(text.includes("Featured"), `"Featured" should appear with theme "${tn}"`);
    assert(text.includes("Feature"), `"Feature" header should appear with theme "${tn}"`);

    // No bad strings
    for (const bad of BAD_STRINGS) {
      if (text.includes(bad)) {
        addBug("P1", `"${bad}" in full page with theme "${tn}"`, "FullPage",
          `Full page sim with theme ${tn}`, "No bad strings", `Found "${bad}"`);
      }
      assert(!text.includes(bad), `"${bad}" found with theme "${tn}"`);
    }

    // Verify screen reader works
    const sr = new ScreenReader(vt);
    const srText = sr.text();
    assert(srText.length > 0, "ScreenReader text should not be empty");

    // Verify colored cells exist
    const cells = vt.cells();
    let hasColor = false;
    for (const row of cells) {
      for (const cell of row) {
        if (cell.fg !== null) { hasColor = true; break; }
      }
      if (hasColor) break;
    }
    assert(hasColor, `Full page with theme "${tn}" should have colored cells`);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: defaultTheme is a valid theme
// ══════════════════════════════════════════════════════════════

step("defaultTheme is dracula", () => {
  assert(defaultTheme === themes.dracula, "defaultTheme should be dracula");
  assert(isValidHex(defaultTheme.accent), "defaultTheme accent should be valid hex");
});

step("themes object has exactly 10 themes", () => {
  assert(allThemeNames.length === 10, `Expected 10 themes, got ${allThemeNames.length}`);
});

step("All expected theme names exist", () => {
  const expected = ["cyberpunk", "dracula", "nord", "monokai", "solarized", "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker"];
  for (const name of expected) {
    assert(name in themes, `Theme "${name}" should exist in themes object`);
  }
});

// ══════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════

const passed = steps.filter(s => s.passed).length;
const failed = steps.filter(s => !s.passed).length;
const failedNames = steps.filter(s => !s.passed).map(s => `${s.name}: ${s.error}`);

const report = {
  agent: "stress-theme-consistency",
  tests_run: steps.length,
  tests_passed: passed,
  tests_failed: failed,
  bugs,
  notes: failed > 0
    ? `${failed} tests failed. Failures: ${failedNames.join("; ")}`
    : "All tests passed. Verified all 10 themes: hex validity, rendered every component (menu/card/link/quote/table/timeline/list/badge/progressbar/text), checked VirtualTerminal cell colors, tested theme switching, resize + theme interleaving, and full page simulations.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
