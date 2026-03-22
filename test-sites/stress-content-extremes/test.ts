/**
 * Stress Test: Content Extremes
 *
 * Tests rendering of extreme content: very long strings, empty fields,
 * many items, Unicode characters, and edge-case data at multiple widths.
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
import { renderDivider } from "../../src/components/Divider.js";
import { renderQuote } from "../../src/components/Quote.js";
import { renderList } from "../../src/components/List.js";
import { renderHero } from "../../src/components/Hero.js";
import { renderBadge } from "../../src/components/Badge.js";
import { stripAnsi, wrapText, type RenderContext } from "../../src/components/base.js";
import { themes, defaultTheme } from "../../src/style/theme.js";
import type { Theme } from "../../src/style/theme.js";
import { setColorMode, fgColor, reset } from "../../src/style/colors.js";
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

const theme = defaultTheme;
const testWidths = [40, 80];
const BAD_STRINGS = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"];

function checkBadStrings(text: string, testName: string, component: string): void {
  for (const bad of BAD_STRINGS) {
    if (text.includes(bad)) {
      addBug("P1", `"${bad}" found in ${testName}`, component, testName, "No bad strings", `Found "${bad}"`);
      assert(false, `"${bad}" found`);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// TEST: Card with 200-character title
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card 200-char title at width=${w}`, () => {
    const longTitle = "A".repeat(200);
    const lines = renderCard({ type: "card", title: longTitle, body: "Body text" }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `200-char title at w=${w}`, "Card");
    // Title should be truncated, not overflow
    for (const line of lines) {
      const plain = stripAnsi(line);
      if (plain.length > w + 2) {
        addBug("P2", `Card overflow with 200-char title at w=${w}`, "Card",
          `200-char title at width=${w}`, `<= ${w} chars per line`, `${plain.length} chars`);
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Card with empty title, empty body, no tags
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card empty title/body/tags at width=${w}`, () => {
    const lines = renderCard({ type: "card", title: "", body: "", tags: [] }, ctx);
    assert(lines.length > 0, "Should produce lines even with empty content");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Empty card at w=${w}`, "Card");
  });

  step(`Card undefined-like fields at width=${w}`, () => {
    // title is required by type but test with empty string
    const lines = renderCard({ type: "card", title: "" }, ctx);
    assert(lines.length > 0, "Should produce lines with minimal card");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Minimal card at w=${w}`, "Card");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Card with 50 tags
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card 50 tags at width=${w}`, () => {
    const tags = Array.from({ length: 50 }, (_, i) => `Tag${i + 1}`);
    const lines = renderCard({ type: "card", title: "Many Tags", body: "Testing tag wrapping", tags }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `50-tag card at w=${w}`, "Card");
    // Verify some tags appear
    assert(text.includes("Tag1"), "First tag should appear");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Markdown with 2000 words
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Text/markdown 2000 words at width=${w}`, () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const content = words.join(" ");
    const lines = renderText(content, ctx, "markdown");
    assert(lines.length > 0, "Should produce lines");
    // At width 40, 2000 words of ~6 chars each means ~300 lines minimum
    assert(lines.length > 50, `Expected many lines for 2000 words, got ${lines.length}`);
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `2000-word text at w=${w}`, "Text");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Table with 10 columns
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Table 10 columns at width=${w}`, () => {
    const headers = Array.from({ length: 10 }, (_, i) => `Col${i + 1}`);
    const rows = [
      Array.from({ length: 10 }, (_, i) => `R1C${i + 1}`),
      Array.from({ length: 10 }, (_, i) => `R2C${i + 1}`),
      Array.from({ length: 10 }, (_, i) => `R3C${i + 1}`),
    ];
    const lines = renderTable(headers, rows, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `10-col table at w=${w}`, "Table");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Timeline with 30 items
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Timeline 30 items at width=${w}`, () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      title: `Event ${i + 1}`,
      subtitle: `Subtitle ${i + 1}`,
      period: `202${i % 10}`,
      description: `Description for event ${i + 1}, with some extra text to test wrapping behavior.`,
    }));
    const lines = renderTimeline(items, ctx);
    assert(lines.length > 0, "Should produce lines");
    assert(lines.length > 60, `Expected many lines for 30 timeline items, got ${lines.length}`);
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `30-item timeline at w=${w}`, "Timeline");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Menu with 20 items
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Menu 20 items at width=${w}`, () => {
    const items: MenuItem[] = Array.from({ length: 20 }, (_, i) => ({
      label: `Menu Item ${i + 1}`,
      icon: "\u25c6",
      id: `item-${i + 1}`,
    }));
    // Test with selection at various positions
    for (const sel of [0, 9, 19]) {
      const lines = renderMenu(items, sel, ctx);
      assert(lines.length === 20, `Menu should have 20 lines, got ${lines.length}`);
      const text = lines.map(l => stripAnsi(l)).join("\n");
      checkBadStrings(text, `20-item menu sel=${sel} at w=${w}`, "Menu");
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Empty strings everywhere
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Empty text at width=${w}`, () => {
    const lines = renderText("", ctx, "plain");
    assert(lines.length >= 0, "Should not crash on empty text");
  });

  step(`Empty quote at width=${w}`, () => {
    const lines = renderQuote("", ctx);
    assert(lines.length >= 0, "Should not crash on empty quote");
  });

  step(`Empty list at width=${w}`, () => {
    const lines = renderList([], ctx);
    assert(lines.length === 0, "Empty list should produce 0 lines");
  });

  step(`Link empty label/url at width=${w}`, () => {
    const lines = renderLink("", "", ctx);
    assert(lines.length > 0, "Should produce lines even with empty link");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Empty link at w=${w}`, "Link");
  });

  step(`Table empty rows at width=${w}`, () => {
    const lines = renderTable(["A", "B"], [], ctx);
    assert(lines.length > 0, "Table with 0 rows should still show header");
  });

  step(`Timeline empty items at width=${w}`, () => {
    const lines = renderTimeline([], ctx);
    assert(lines.length === 0, "Empty timeline should produce 0 lines");
  });

  step(`Hero empty fields at width=${w}`, () => {
    const lines = renderHero({ title: "" }, ctx);
    assert(lines.length > 0, "Hero with empty title should still produce lines");
  });

  step(`Divider at width=${w}`, () => {
    const lines = renderDivider(ctx, { label: "" });
    assert(lines.length > 0, "Divider should produce lines");
  });

  step(`Badge empty text at width=${w}`, () => {
    const result = renderBadge("", ctx);
    assert(typeof result === "string", "Badge should return a string");
  });

  step(`Menu 0 items at width=${w}`, () => {
    const lines = renderMenu([], 0, ctx);
    assert(lines.length === 0, "Empty menu should produce 0 lines");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Unicode content
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card with emoji title at width=${w}`, () => {
    const lines = renderCard({
      type: "card",
      title: "\ud83d\ude80\ud83d\udd25\ud83d\udc8e Rocket Fire Diamond",
      body: "This card has emoji in the title",
      tags: ["\ud83c\udf1f Star", "\ud83c\udf08 Rainbow"],
    }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Emoji card at w=${w}`, "Card");
  });

  step(`Card with CJK characters at width=${w}`, () => {
    const lines = renderCard({
      type: "card",
      title: "\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8",
      body: "\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u6f22\u5b57\u3068\u3072\u3089\u304c\u306a\u3068\u30ab\u30bf\u30ab\u30ca\u304c\u542b\u307e\u308c\u3066\u3044\u307e\u3059\u3002",
      tags: ["\u6280\u8853", "\u30c6\u30b9\u30c8"],
    }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `CJK card at w=${w}`, "Card");
  });

  step(`Card with accented chars at width=${w}`, () => {
    const lines = renderCard({
      type: "card",
      title: "caf\u00e9 r\u00e9sum\u00e9 na\u00efve",
      body: "\u00c0 la carte, cr\u00e8me br\u00fbl\u00e9e, fa\u00e7ade, \u00fcber cool, pi\u00f1ata party",
      tags: ["fran\u00e7ais", "espa\u00f1ol", "Deutsch"],
    }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Accented card at w=${w}`, "Card");
  });

  step(`List with Unicode items at width=${w}`, () => {
    const lines = renderList([
      "\ud83d\ude80 Launch the rocket",
      "\u65e5\u672c\u8a9e\u306e\u30ea\u30b9\u30c8\u30a2\u30a4\u30c6\u30e0",
      "caf\u00e9 r\u00e9sum\u00e9 na\u00efve",
      "\ud83c\udf1f\ud83c\udf1f\ud83c\udf1f\ud83c\udf1f\ud83c\udf1f Five stars",
    ], ctx);
    assert(lines.length > 0, "Should produce lines");
  });

  step(`Quote with Unicode at width=${w}`, () => {
    const lines = renderQuote(
      "\u300c\u4eba\u751f\u306f\u7f8e\u3057\u3044\u300d \u2014 \u65e5\u672c\u306e\u8aed",
      ctx,
      { attribution: "Anonymous \ud83c\udf38" }
    );
    assert(lines.length > 0, "Should produce lines");
  });

  step(`Timeline with Unicode at width=${w}`, () => {
    const lines = renderTimeline([
      { title: "\ud83c\udf89 Grand Opening", subtitle: "caf\u00e9", period: "2024", description: "\u00c0 la carte menu launch" },
      { title: "\u65e5\u672c\u4e8b\u696d\u958b\u59cb", period: "2025", description: "\u6771\u4eac\u306b\u65b0\u5e97\u8217\u3092\u30aa\u30fc\u30d7\u30f3" },
    ], ctx);
    assert(lines.length > 0, "Should produce lines");
  });

  step(`Table with Unicode at width=${w}`, () => {
    const lines = renderTable(
      ["Name", "City", "Rating"],
      [
        ["\ud83c\udf5d Pasta", "\u6771\u4eac", "\u2b50\u2b50\u2b50"],
        ["Cr\u00e8me", "Paris", "\u2b50\u2b50\u2b50\u2b50"],
      ],
      ctx
    );
    assert(lines.length > 0, "Should produce lines");
  });

  step(`Menu with Unicode items at width=${w}`, () => {
    const items: MenuItem[] = [
      { label: "\ud83d\ude80 Launches", icon: "\u25c6", id: "launches" },
      { label: "\u65e5\u672c\u8a9e\u30e1\u30cb\u30e5\u30fc", icon: "\u25c6", id: "jp" },
      { label: "caf\u00e9 r\u00e9sum\u00e9", icon: "\u25c6", id: "cafe" },
    ];
    const lines = renderMenu(items, 0, ctx);
    assert(lines.length === 3, `Expected 3 menu items, got ${lines.length}`);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Very long single word (200 chars, no spaces)
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card with 200-char single word body at width=${w}`, () => {
    const longWord = "superlongword".repeat(16); // ~208 chars
    const lines = renderCard({
      type: "card",
      title: "Long Word Test",
      body: longWord,
      tags: ["test"],
    }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Long word card at w=${w}`, "Card");
  });

  step(`wrapText with 200-char no-space word at width=${w}`, () => {
    const longWord = "x".repeat(200);
    const wrapped = wrapText(longWord, w);
    assert(wrapped.length > 0, "Should produce lines");
    // Each line should be at most width chars
    for (const line of wrapped) {
      assert(line.length <= w, `Wrapped line exceeds width: ${line.length} > ${w}`);
    }
  });

  step(`Text with 200-char word at width=${w}`, () => {
    const longWord = "y".repeat(200);
    const lines = renderText(`Before ${longWord} after`, ctx, "plain");
    assert(lines.length > 0, "Should produce lines");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Card with very long subtitle
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card 100-char subtitle at width=${w}`, () => {
    const lines = renderCard({
      type: "card",
      title: "Title",
      subtitle: "S".repeat(100),
      body: "Body",
    }, ctx);
    assert(lines.length > 0, "Should produce lines");
    const text = lines.map(l => stripAnsi(l)).join("\n");
    checkBadStrings(text, `Long subtitle at w=${w}`, "Card");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Render extreme content into VirtualTerminal
// ══════════════════════════════════════════════════════════════

step("VirtualTerminal — render 50-tag card at 80 cols", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const tags = Array.from({ length: 50 }, (_, i) => `Tag${i + 1}`);
  const lines = renderCard({ type: "card", title: "Many Tags Card", body: "Tags stress test", tags }, ctx);
  const vt = new VirtualTerminal(80, 200);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, lines);
  const sr = new ScreenReader(vt);
  const text = sr.text();
  assert(text.includes("Many Tags Card") || text.includes("Many Tags"), "Card title should appear");
  checkBadStrings(text, "50-tag card in vterm", "Card");
});

step("VirtualTerminal — render 30-item timeline at 80 cols", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const items = Array.from({ length: 30 }, (_, i) => ({
    title: `Event ${i + 1}`,
    period: `Year ${2000 + i}`,
    description: `Description ${i + 1}`,
  }));
  const lines = renderTimeline(items, ctx);
  const vt = new VirtualTerminal(80, 300);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, lines);
  const text = vt.text();
  assert(text.includes("Event 1"), "First event should appear");
  checkBadStrings(text, "30-item timeline in vterm", "Timeline");
});

step("VirtualTerminal — render 10-column table at 80 cols", () => {
  const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };
  const headers = Array.from({ length: 10 }, (_, i) => `C${i}`);
  const rows = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => `${r}${c}`)
  );
  const lines = renderTable(headers, rows, ctx);
  const vt = new VirtualTerminal(80, 50);
  vt.write("\x1b[2J\x1b[H");
  writeToVterm(vt, lines);
  const text = vt.text();
  checkBadStrings(text, "10-col table in vterm", "Table");
});

// ══════════════════════════════════════════════════════════════
// TEST: Multiple markdown styles
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Markdown with bold/italic/code at width=${w}`, () => {
    const content = "This is **bold text** and *italic text* and `inline code` in a paragraph.\n\nSecond paragraph with more **bold** stuff.";
    const lines = renderText(content, ctx, "markdown");
    assert(lines.length > 0, "Should produce lines");
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: List styles
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };
  const listStyles: Array<"bullet" | "number" | "dash" | "check" | "arrow"> = ["bullet", "number", "dash", "check", "arrow"];

  for (const style of listStyles) {
    step(`List style "${style}" at width=${w}`, () => {
      const lines = renderList(["Item A", "Item B", "Item C with some longer text that might wrap"], ctx, style);
      assert(lines.length > 0, `List style ${style} should produce lines`);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// TEST: Quote styles
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };
  const quoteStyles: Array<"border" | "indent" | "fancy"> = ["border", "indent", "fancy"];

  for (const style of quoteStyles) {
    step(`Quote style "${style}" at width=${w}`, () => {
      const lines = renderQuote("To be or not to be, that is the question.", ctx, { attribution: "Shakespeare", style });
      assert(lines.length > 0, `Quote style ${style} should produce lines`);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// TEST: Divider styles
// ══════════════════════════════════════════════════════════════

for (const w of testWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };
  const dividerStyles = ["solid", "dashed", "dotted", "double", "label"];

  for (const style of dividerStyles) {
    step(`Divider style "${style}" at width=${w}`, () => {
      const lines = renderDivider(ctx, { style, label: style === "label" ? "Section Title" : undefined });
      assert(lines.length > 0, `Divider style ${style} should produce lines`);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════

const passed = steps.filter(s => s.passed).length;
const failed = steps.filter(s => !s.passed).length;
const failedNames = steps.filter(s => !s.passed).map(s => `${s.name}: ${s.error}`);

const report = {
  agent: "stress-content-extremes",
  tests_run: steps.length,
  tests_passed: passed,
  tests_failed: failed,
  bugs,
  notes: failed > 0
    ? `${failed} tests failed. Failures: ${failedNames.join("; ")}`
    : "All tests passed. Tested extreme content: 200-char titles, 50 tags, 2000-word text, 10-col tables, 30-item timelines, 20-item menus, empty fields, Unicode (emoji/CJK/accented), long words, all component styles.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
