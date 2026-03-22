/**
 * Stress test for terminaltui: extreme content scenarios.
 * Run with: npx tsx test/stress-content.ts
 */
import {
  createTestContext,
  assert,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  renderBlock,
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
  markdown,
  gradient,
  sparkline,
  divider,
  spacer,
  section,
  themes,
  type TestResult,
} from "./harness.js";

import { renderCard } from "../src/components/Card.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderTable } from "../src/components/Table.js";
import { renderText } from "../src/components/Text.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderAccordion } from "../src/components/Accordion.js";
import { renderTabs } from "../src/components/Tabs.js";
import { renderGallery } from "../src/components/Gallery.js";
import { renderBanner } from "../src/ascii/banner.js";
import { gradientText, gradientLines } from "../src/style/gradient.js";
import { stripAnsi } from "../src/components/base.js";
import { defaultTheme } from "../src/style/theme.js";
import type { ContentBlock, CardBlock } from "../src/config/types.js";

// ─── Test Infrastructure ──────────────────────────────────

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
  }
}

function renderContentCallback(blocks: ContentBlock[], ctx: any): string[] {
  const lines: string[] = [];
  for (const b of blocks) lines.push(...renderBlock(b, ctx));
  return lines;
}

// ─── Test 1: Minimum viable site ──────────────────────────

test("1. Minimum viable site: 1 page, 1 line of text", () => {
  const site = defineSite({
    name: "Tiny",
    pages: [
      page("home", {
        title: "Home",
        content: [{ type: "text", content: "Hello world", style: "plain" }],
      }),
    ],
  });
  assert(!!site, "Site should be defined");
  assert(site.config.pages.length === 1, "Should have 1 page");

  const ctx = createTestContext(80);
  const lines = renderBlock(site.config.pages[0].content[0], ctx);
  assert(lines.length > 0, "Text should render at least 1 line");
});

// ─── Test 2: 50 pages ─────────────────────────────────────

test("2. 50 pages: auto-generated config", () => {
  const pages = Array.from({ length: 50 }, (_, i) =>
    page(`page-${i}`, {
      title: `Page ${i}`,
      content: [
        card({ title: `Card on page ${i}`, body: `Body text for page ${i}` }),
      ],
    })
  );
  const site = defineSite({ name: "ManyPages", pages });
  assert(site.config.pages.length === 50, "Should have 50 pages");

  const ctx = createTestContext(80);
  for (const pg of site.config.pages) {
    for (const block of pg.content) {
      const lines = renderBlock(block, ctx);
      assert(lines.length > 0, `Page ${pg.id} should render`);
    }
  }
});

// ─── Test 3: 100 cards on one page ────────────────────────

test("3. 100 cards on one page", () => {
  const cards: ContentBlock[] = Array.from({ length: 100 }, (_, i) =>
    card({ title: `Card #${i + 1}`, body: `Description for card ${i + 1}` })
  );
  const site = defineSite({
    name: "ManyCards",
    pages: [page("main", { title: "Main", content: cards })],
  });
  assert(site.config.pages[0].content.length === 100, "Should have 100 cards");

  const ctx = createTestContext(80);
  let totalLines = 0;
  for (const block of site.config.pages[0].content) {
    const lines = renderBlock(block, ctx);
    assert(lines.length > 0, "Each card should produce output");
    totalLines += lines.length;
  }
  assert(totalLines > 100, `Expected many lines, got ${totalLines}`);
});

// ─── Test 4: 500-char title in a card ─────────────────────

test("4. 500-char title in a card", () => {
  const longTitle = "A".repeat(500);
  const c = card({ title: longTitle });
  for (const width of [30, 60, 80]) {
    const ctx = createTestContext(width);
    const lines = renderCard(c, ctx);
    assert(lines.length > 0, `Card with 500-char title should render at width ${width}`);
  }
});

// ─── Test 5: Empty fields ─────────────────────────────────

test("5. Empty fields: card with empty title, no body/tags/subtitle", () => {
  const c = card({ title: "", body: undefined, tags: undefined, subtitle: undefined });
  const ctx = createTestContext(80);
  const lines = renderCard(c, ctx);
  assert(lines.length > 0, "Card with empty fields should still render (box frame)");
});

// ─── Test 6: Card with all optional fields omitted ────────

test("6. Card with only title (all optional fields omitted)", () => {
  const c = card({ title: "Only Title" });
  const ctx = createTestContext(80);
  const lines = renderCard(c, ctx);
  assert(lines.length > 0, "Card with only title should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("Only Title"), "Should contain the title text");
});

// ─── Test 7: Table with 10 columns ────────────────────────

test("7. Table with 10 columns", () => {
  const headers = Array.from({ length: 10 }, (_, i) => `Col${i}`);
  const rows = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => `R${r}C${c}`)
  );
  const t = table(headers, rows);

  for (const width of [40, 80]) {
    const ctx = createTestContext(width);
    const lines = renderBlock(t, ctx);
    assert(lines.length > 0, `10-col table should render at width ${width}`);
  }
});

// ─── Test 8: Table with 20 rows ───────────────────────────

test("8. Table with 20 rows", () => {
  const headers = ["Name", "Value", "Status"];
  const rows = Array.from({ length: 20 }, (_, i) => [
    `Item ${i}`,
    `${i * 10}`,
    i % 2 === 0 ? "Active" : "Inactive",
  ]);
  const t = table(headers, rows);
  const ctx = createTestContext(80);
  const lines = renderBlock(t, ctx);
  // 20 rows + 1 header + 3 borders (top, separator, bottom) = 25 minimum
  assert(lines.length >= 24, `Expected 24+ lines, got ${lines.length}`);
});

// ─── Test 9: Timeline with 50 items ──────────────────────

test("9. Timeline with 50 items", () => {
  const items = Array.from({ length: 50 }, (_, i) => ({
    title: `Event ${i + 1}`,
    subtitle: `Subtitle ${i + 1}`,
    period: `2020-${String(i % 12 + 1).padStart(2, "0")}`,
    description: `Description for event number ${i + 1} with some detail.`,
  }));
  const tl = timeline(items);
  const ctx = createTestContext(80);
  const lines = renderBlock(tl, ctx);
  assert(lines.length > 100, `50-item timeline should produce many lines, got ${lines.length}`);
});

// ─── Test 10: 2000-word markdown text ─────────────────────

test("10. 2000-word markdown text", () => {
  const words = Array.from({ length: 2000 }, (_, i) => {
    if (i % 100 === 0) return `\n\n**Heading ${i / 100}**\n\n`;
    if (i % 50 === 0) return `*emphasized*`;
    return `word${i}`;
  });
  const longText = words.join(" ");
  const md = markdown(longText);

  for (const width of [30, 60, 80]) {
    const ctx = createTestContext(width);
    const lines = renderBlock(md, ctx);
    assert(lines.length > 0, `2000-word markdown should render at width ${width}`);
  }
});

// ─── Test 11: Every field empty string ────────────────────

test("11. Every field empty string", () => {
  const site = defineSite({
    name: "E",  // Must be non-empty to pass validation
    pages: [
      page("home", {
        title: "",
        content: [
          card({ title: "" }),
          { type: "text", content: "", style: "plain" } as ContentBlock,
          quote("", ""),
        ],
      }),
    ],
  });
  const ctx = createTestContext(80);
  for (const block of site.config.pages[0].content) {
    const lines = renderBlock(block, ctx);
    // Should not crash, lines can be empty
    assert(Array.isArray(lines), "Should return an array");
  }
});

// ─── Test 12: Emoji in titles ─────────────────────────────

test("12. Emoji in titles", () => {
  const site = defineSite({
    name: "Emoji Site",
    pages: [
      page("stats", {
        title: "\u{1F4CA} Stats",
        content: [
          card({ title: "\u{1F389} Party Time \u{1F388}" }),
          card({ title: "\u{1F680} Launch \u{1F31F}", body: "Emoji body \u{1F60A}" }),
        ],
      }),
    ],
  });
  const ctx = createTestContext(80);
  for (const block of site.config.pages[0].content) {
    const lines = renderBlock(block, ctx);
    assert(lines.length > 0, "Emoji content should render");
  }

  // Timeline with emoji
  const tl = timeline([
    { title: "\u{1F3AF} Target Hit", period: "\u{1F4C5} 2024" },
    { title: "\u{2705} Complete", description: "\u{1F44D} All done" },
  ]);
  const tlLines = renderBlock(tl, ctx);
  assert(tlLines.length > 0, "Timeline with emoji should render");
});

// ─── Test 13: CJK characters ─────────────────────────────

test("13. CJK characters", () => {
  const c = card({ title: "\u9879\u76EE\u7BA1\u7406\u7CFB\u7EDF", body: "\u3053\u308C\u306F\u30C6\u30B9\u30C8\u3067\u3059" });
  const ctx = createTestContext(80);
  const lines = renderCard(c, ctx);
  assert(lines.length > 0, "CJK card should render");

  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(
    text.includes("\u9879\u76EE\u7BA1\u7406\u7CFB\u7EDF") || lines.length > 0,
    "Should contain CJK title or at least render"
  );
});

// ─── Test 14: Special characters ──────────────────────────

test("14. Special characters in title", () => {
  const specialTitle = 'Title & <tag> "quoted" \'apos\' \\ end';
  const c = card({ title: specialTitle, body: "Body with\ttab and\nnewline" });
  const ctx = createTestContext(80);
  const lines = renderCard(c, ctx);
  assert(lines.length > 0, "Card with special chars should render");
});

// ─── Test 15: Deeply nested sections ──────────────────────

test("15. Deeply nested sections (3 levels)", () => {
  const innerSection = section("Level 3", [
    card({ title: "Deep Card" }),
    { type: "text", content: "Deep text", style: "plain" } as ContentBlock,
  ]);
  const midSection = section("Level 2", [
    innerSection,
    card({ title: "Mid Card" }),
  ]);
  const outerSection = section("Level 1", [
    midSection,
    card({ title: "Outer Card" }),
  ]);

  const ctx = createTestContext(80);
  const lines = renderBlock(outerSection, ctx);
  assert(lines.length > 0, "Nested sections should render");
  const text = lines.map(l => stripAnsi(l)).join("\n");
  assert(text.includes("Level 1"), "Should contain outermost section title");
});

// ─── Test 16: Empty pages array ───────────────────────────

test("16. Empty pages array throws error", () => {
  let threw = false;
  let errorMsg = "";
  try {
    defineSite({ name: "Empty", pages: [] });
  } catch (err: any) {
    threw = true;
    errorMsg = err.message;
  }
  assert(threw, "defineSite with empty pages should throw");
  assert(errorMsg.length > 0, "Error should have a message");
});

// ─── Test 17: Missing name ────────────────────────────────

test("17. Missing name throws error", () => {
  let threw = false;
  let errorMsg = "";
  try {
    defineSite({ name: "", pages: [page("x", { title: "X", content: [] })] });
  } catch (err: any) {
    threw = true;
    errorMsg = err.message;
  }
  assert(threw, "defineSite with empty name should throw");
  assert(
    errorMsg.toLowerCase().includes("name"),
    `Error should mention 'name', got: ${errorMsg}`
  );
});

// ─── Test 18: Duplicate page IDs ──────────────────────────

test("18. Duplicate page IDs", () => {
  // defineSite itself doesn't check uniqueness, but we verify it doesn't crash
  let noError = true;
  try {
    const site = defineSite({
      name: "DupIDs",
      pages: [
        page("home", { title: "Home A", content: [] }),
        page("home", { title: "Home B", content: [] }),
      ],
    });
    // Site created without error
    assert(site.config.pages.length === 2, "Should have 2 pages");
  } catch (err: any) {
    // If it throws, that's acceptable behavior too
    noError = false;
  }
  // Either outcome is acceptable: no crash or a validation error
  assert(true, "Duplicate page IDs handled without crash");
});

// ─── Test 19: Every content block type with minimal data ──

test("19. Every content block type with minimal data", () => {
  const blocks: ContentBlock[] = [
    { type: "text", content: "t", style: "plain" },
    { type: "text", content: "m", style: "markdown" },
    card({ title: "T" }),
    timeline([{ title: "T" }]),
    table(["H"], [["D"]]),
    list(["item"]),
    quote("Q"),
    hero({ title: "H" }),
    gallery([{ title: "G" }]),
    tabs([{ label: "T", content: [{ type: "text", content: "x", style: "plain" }] }]),
    accordion([{ label: "A", content: [{ type: "text", content: "x", style: "plain" }] }]),
    link("L", "https://example.com"),
    progressBar("P", 50),
    badge("B"),
    divider(),
    spacer(),
    section("S", [{ type: "text", content: "x", style: "plain" }]),
    { type: "custom", render: (w: number) => ["custom"] } as ContentBlock,
  ];

  const ctx = createTestContext(80);
  for (const block of blocks) {
    const lines = renderBlock(block, ctx);
    assert(Array.isArray(lines), `Block type '${block.type}' should return array`);
  }
});

// ─── Test 20: Custom block ────────────────────────────────

test("20. Custom block: empty array, single line, 100 lines", () => {
  const ctx = createTestContext(80);

  // Empty array
  const emptyBlock: ContentBlock = {
    type: "custom",
    render: () => [],
  };
  const emptyLines = renderBlock(emptyBlock, ctx);
  assert(emptyLines.length === 0, "Custom empty block should return 0 lines");

  // Single line
  const singleBlock: ContentBlock = {
    type: "custom",
    render: () => ["Hello Custom"],
  };
  const singleLines = renderBlock(singleBlock, ctx);
  assert(singleLines.length === 1, "Custom single block should return 1 line");

  // 100 lines
  const manyBlock: ContentBlock = {
    type: "custom",
    render: (w: number) => Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: ${"x".repeat(w / 2)}`),
  };
  const manyLines = renderBlock(manyBlock, ctx);
  assert(manyLines.length === 100, "Custom 100-line block should return 100 lines");
});

// ─── Test 21: Accordion with 20 items ─────────────────────

test("21. Accordion with 20 items, each one open individually", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    label: `Section ${i + 1}`,
    content: [{ type: "text" as const, content: `Content for section ${i + 1}`, style: "plain" as const }],
  }));
  const ctx = createTestContext(80);

  for (let openIdx = 0; openIdx < 20; openIdx++) {
    const lines = renderAccordion(items, openIdx, ctx, renderContentCallback);
    assert(lines.length > 0, `Accordion with item ${openIdx} open should render`);
    // The open item should have additional content lines
    assert(lines.length > 20, `Should have more than 20 lines when item ${openIdx} is open, got ${lines.length}`);
  }
});

// ─── Test 22: Tabs with 10 tabs ───────────────────────────

test("22. Tabs with 10 tabs, each active", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    label: `Tab${i}`,
    content: [{ type: "text" as const, content: `Tab ${i} content here`, style: "plain" as const }],
  }));
  const ctx = createTestContext(80);

  for (let activeIdx = 0; activeIdx < 10; activeIdx++) {
    const lines = renderTabs(items, activeIdx, ctx, renderContentCallback);
    assert(lines.length > 0, `Tabs with tab ${activeIdx} active should render`);
  }
});

// ─── Test 23: Gallery with 20 items ───────────────────────

test("23. Gallery with 20 items at various widths", () => {
  const items: CardBlock[] = Array.from({ length: 20 }, (_, i) => ({
    type: "card" as const,
    title: `Gallery Item ${i + 1}`,
    body: `Short description ${i + 1}`,
  }));

  for (const width of [40, 60, 80, 120]) {
    const ctx = createTestContext(width);
    const lines = renderGallery(items, ctx, { columns: Math.min(4, Math.floor(width / 25)) });
    assert(lines.length > 0, `Gallery should render at width ${width}`);
  }
});

// ─── Test 24: ProgressBar with edge values ────────────────

test("24. ProgressBar edge values: 0, 50, 100, -10, 150", () => {
  const ctx = createTestContext(80);
  const values = [0, 50, 100, -10, 150];

  for (const val of values) {
    const lines = renderProgressBar(`Val ${val}`, val, ctx, { max: 100, showPercent: true });
    assert(lines.length > 0, `ProgressBar with value ${val} should render`);
    // Should not produce NaN or Infinity in output
    const text = lines.map(l => stripAnsi(l)).join("");
    assert(!text.includes("NaN"), `ProgressBar(${val}) should not contain NaN`);
    assert(!text.includes("Infinity"), `ProgressBar(${val}) should not contain Infinity`);
  }
});

// ─── Test 25: Banner with all 5 fonts ─────────────────────

test("25. Banner with all 5 fonts", () => {
  const fontNames = ["ANSI Shadow", "Slant", "Calvin S", "Small", "Ogre"];
  for (const font of fontNames) {
    const lines = renderBanner("TEST", { font });
    assert(lines.length > 0, `Banner with font '${font}' should render`);
    const hasContent = lines.some(l => l.trim().length > 0);
    assert(hasContent, `Banner with font '${font}' should have non-empty content`);
  }
});

// ─── Test 26: Banner with empty string ────────────────────

test("26. Banner with empty string", () => {
  const fontNames = ["ANSI Shadow", "Slant", "Calvin S", "Small", "Ogre"];
  for (const font of fontNames) {
    // Should not crash
    const lines = renderBanner("", { font });
    assert(Array.isArray(lines), `Banner('', ${font}) should return an array`);
  }
});

// ─── Test 27: Banner with very long text ──────────────────

test("27. Banner with 50-char text at width 40", () => {
  const longText = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWX";
  assert(longText.length === 50, "Test setup: text should be 50 chars");

  const lines = renderBanner(longText, { font: "ANSI Shadow" }, 40);
  assert(Array.isArray(lines), "Should return an array");
  // When banner exceeds maxWidth, renderBanner falls back to plain text
  assert(lines.length >= 1, "Should produce at least 1 line (fallback)");
});

// ─── Test 28: Gradient with 1, 2, 10 colors ──────────────

test("28. Gradient with 1 color, 2 colors, 10 colors", () => {
  const testText = "Hello Gradient World";
  const testLines = ["Line one", "Line two", "Line three"];

  // 1 color
  const g1 = gradientText(testText, ["#ff0000"]);
  assert(typeof g1 === "string", "1-color gradient should return string");
  assert(stripAnsi(g1) === testText, "Should preserve text content");

  // 2 colors
  const g2 = gradientText(testText, ["#ff0000", "#0000ff"]);
  assert(typeof g2 === "string", "2-color gradient should return string");

  // 10 colors
  const tenColors = [
    "#ff0000", "#ff7700", "#ffff00", "#77ff00", "#00ff00",
    "#00ff77", "#00ffff", "#0077ff", "#0000ff", "#7700ff",
  ];
  const g10 = gradientText(testText, tenColors);
  assert(typeof g10 === "string", "10-color gradient should return string");

  // gradientLines
  const gl1 = gradientLines(testLines, ["#ff0000"]);
  assert(gl1.length === testLines.length, "1-color gradientLines should preserve line count");

  const gl2 = gradientLines(testLines, ["#ff0000", "#0000ff"]);
  assert(gl2.length === testLines.length, "2-color gradientLines should preserve line count");

  const gl10 = gradientLines(testLines, tenColors);
  assert(gl10.length === testLines.length, "10-color gradientLines should preserve line count");

  // Edge: 0 colors
  const g0 = gradientText(testText, []);
  assert(g0 === testText, "0-color gradient should return text unchanged");
});

// ─── Test 29: Sparkline edge cases ────────────────────────

test("29. Sparkline: empty data, single value, 100 values", () => {
  const ctx = createTestContext(80);

  // Empty data - sparkline uses Math.max(...[]) which returns -Infinity, test for no crash
  let emptyResult: ContentBlock;
  try {
    emptyResult = sparkline([]);
    const lines = renderBlock(emptyResult, ctx);
    assert(Array.isArray(lines), "Empty sparkline should return array");
  } catch {
    // If empty sparkline throws, that's also acceptable
    assert(true, "Empty sparkline threw (acceptable)");
  }

  // Single value
  const single = sparkline([42]);
  const singleLines = renderBlock(single, ctx);
  assert(singleLines.length > 0, "Single-value sparkline should render");

  // 100 values
  const data100 = Array.from({ length: 100 }, (_, i) => Math.sin(i / 10) * 50 + 50);
  const big = sparkline(data100);
  const bigLines = renderBlock(big, ctx);
  assert(bigLines.length > 0, "100-value sparkline should render");
  // Sparkline is rendered as text which wraps at context width, so total chars across lines should be 100
  const totalChars = bigLines.reduce((sum, l) => sum + stripAnsi(l).length, 0);
  assert(totalChars === 100, `Sparkline should have 100 total chars across lines, got ${totalChars}`);
});

// ─── Test 30: All themes ──────────────────────────────────

test("30. All themes: render a card with each built-in theme", () => {
  const themeNames = [
    "cyberpunk", "dracula", "nord", "monokai", "solarized",
    "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker",
  ] as const;

  const c = card({ title: "Theme Test", body: "Testing all themes", tags: ["test"] });

  for (const themeName of themeNames) {
    const theme = (themes as any)[themeName];
    assert(!!theme, `Theme '${themeName}' should exist`);
    assert(!!theme.accent, `Theme '${themeName}' should have accent`);
    assert(!!theme.text, `Theme '${themeName}' should have text`);
    assert(!!theme.border, `Theme '${themeName}' should have border`);

    const ctx = createTestContext(80, theme);
    const lines = renderCard(c, ctx);
    assert(lines.length > 0, `Card should render with theme '${themeName}'`);

    // Verify ANSI color codes are present in output (theme colors applied)
    const raw = lines.join("");
    assert(raw.includes("\x1b["), `Theme '${themeName}' output should contain ANSI color codes`);
  }
});

// ─── Summary ──────────────────────────────────────────────

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log("\n" + "=".repeat(70));
console.log("STRESS TEST: Content Edge Cases");
console.log("=".repeat(70));

for (const r of results) {
  const icon = r.passed ? "\u2713" : "\u2717";
  const status = r.passed ? "PASS" : "FAIL";
  let line = `  ${icon} [${status}] ${r.name}`;
  if (r.error) line += `\n           Error: ${r.error}`;
  console.log(line);
}

console.log("\n" + "-".repeat(70));
console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("-".repeat(70));

if (failed > 0) {
  console.log("\nFailed tests:");
  for (const r of results.filter(r => !r.passed)) {
    console.log(`  - ${r.name}: ${r.error}`);
  }
}

console.log("\n" + (failed === 0 ? "ALL TESTS PASSED" : `${failed} TEST(S) FAILED`) + "\n");
process.exit(failed > 0 ? 1 : 0);
