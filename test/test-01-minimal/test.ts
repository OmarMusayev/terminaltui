/**
 * Test 01 — Minimal Portfolio
 * 3 pages: about (short markdown), projects (2 cards), links (3 links).
 * Theme: nord. No animations.
 *
 * Tests every component and feature used, edge cases, overflow, and banner rendering.
 */
import {
  defineSite,
  page,
  card,
  link,
  markdown,
  divider,
  spacer,
  themes,
  testSiteConfig,
  formatReport,
  createTestContext,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  renderBlock,
  type TestReport,
  type TestResult,
  type BugReport,
} from "../harness.js";

import { renderText } from "../../src/components/Text.js";
import { renderCard } from "../../src/components/Card.js";
import { renderLink } from "../../src/components/Link.js";
import { renderMenu, type MenuItem } from "../../src/components/Menu.js";
import { stripAnsi, type RenderContext } from "../../src/components/base.js";
import { renderBanner, centerBanner, getBannerWidth } from "../../src/ascii/banner.js";
import { gradientLines } from "../../src/style/gradient.js";
import type { SiteConfig, ContentBlock, CardBlock } from "../../src/config/types.js";
import type { Theme } from "../../src/style/theme.js";

// ─── Site Config ───────────────────────────────────────────

const nordTheme = themes.nord;

const config: SiteConfig = {
  name: "Minimal Portfolio",
  handle: "@minimal",
  tagline: "A simple portfolio site",
  banner: {
    text: "MINIMAL",
    font: "ANSI Shadow",
  },
  theme: "nord",
  animations: undefined,  // No animations
  pages: [
    page("about", {
      title: "About",
      icon: "👤",
      content: [
        markdown(`
# About Me

I'm a **software developer** who loves building things.
I work with *TypeScript*, *Rust*, and *Go*.

Check out my \`projects\` below.
        `),
      ],
    }),
    page("projects", {
      title: "Projects",
      icon: "🚀",
      content: [
        card({
          title: "Project Alpha",
          subtitle: "2024",
          body: "A CLI tool for managing infrastructure deployments across multiple cloud providers.",
          tags: ["TypeScript", "Node.js"],
          url: "https://github.com/user/alpha",
        }),
        spacer(1),
        card({
          title: "Project Beta",
          subtitle: "2023",
          body: "Real-time data pipeline for processing streaming events at scale.",
          tags: ["Rust", "Kafka"],
          url: "https://github.com/user/beta",
        }),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "🔗",
      content: [
        link("GitHub", "https://github.com/user", { icon: "⊙" }),
        link("Twitter", "https://twitter.com/user", { icon: "𝕏" }),
        link("Website", "https://example.com", { icon: "◈" }),
      ],
    }),
  ],
};

// ─── Extended Test Runner ──────────────────────────────────

const allResults: TestResult[] = [];
const allBugs: BugReport[] = [];
const testWidths = [30, 40, 60, 80, 100, 120];

function addResult(r: TestResult): void {
  allResults.push(r);
}

function addBug(bug: BugReport): void {
  allBugs.push(bug);
}

function runTest(name: string, fn: () => void): void {
  addResult(assertNoThrow(fn, name));
}

// ─── 1. Site Config Test ───────────────────────────────────

console.log("=== Running testSiteConfig... ===\n");
const siteReport = testSiteConfig(config, "01-Minimal Portfolio");
console.log(formatReport(siteReport));

// Merge site report results into our extended results
for (const r of siteReport.results) addResult(r);
for (const b of siteReport.bugs) addBug(b);

// ─── 2. Direct Component Tests ─────────────────────────────

console.log("\n=== Running direct component tests... ===\n");

// ── 2a. renderText ─────────────────────────────────────────

for (const width of testWidths) {
  const ctx = createTestContext(width, nordTheme);

  // Plain text
  runTest(`renderText(plain) at width=${width}`, () => {
    const lines = renderText("Hello, world!", ctx, "plain");
    const r = assertLinesNonEmpty(lines, `renderText(plain) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderText(plain) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderText("Hello, world!", ctx, "plain") at width=${width}`, component: "Text" });
    }
  });

  // Markdown text
  runTest(`renderText(markdown) at width=${width}`, () => {
    const lines = renderText("This is **bold** and *italic* and `code`.", ctx, "markdown");
    const r = assertLinesNonEmpty(lines, `renderText(markdown) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderText(markdown) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderText markdown at width=${width}`, component: "Text" });
    }
  });

  // Edge: empty markdown
  runTest(`renderText(empty markdown) at width=${width}`, () => {
    const lines = renderText("", ctx, "markdown");
    // Empty input might return empty array — that's acceptable
    if (lines.length > 0) {
      const allEmpty = lines.every(l => stripAnsi(l).trim() === "");
      // Not a failure if all lines are blank for empty input
    }
  });

  // Edge: very long text (single long word)
  runTest(`renderText(long word) at width=${width}`, () => {
    const longWord = "A".repeat(200);
    const lines = renderText(longWord, ctx, "plain");
    const r = assertLines(lines, `renderText(long word) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    // Check overflow
    for (let i = 0; i < lines.length; i++) {
      const plainLen = stripAnsi(lines[i]).length;
      if (plainLen > width + 2) {
        addBug({
          severity: "P2",
          category: "Layout",
          description: `Long single word overflows at width=${width}: line ${i} is ${plainLen} chars (max ${width})`,
          reproduction: `renderText("A".repeat(200), ctx, "plain") at width=${width}`,
          component: "Text",
        });
        break;
      }
    }
  });

  // Edge: single character
  runTest(`renderText(single char) at width=${width}`, () => {
    const lines = renderText("X", ctx, "plain");
    const r = assertLinesNonEmpty(lines, `renderText(single char) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });

  // Edge: unicode emoji in text
  runTest(`renderText(emoji) at width=${width}`, () => {
    const lines = renderText("Hello 🌍 World 🚀 Coding 💻", ctx, "plain");
    const r = assertLinesNonEmpty(lines, `renderText(emoji) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });
}

// ── 2b. renderCard ─────────────────────────────────────────

for (const width of testWidths) {
  const ctx = createTestContext(width, nordTheme);

  // Normal card
  runTest(`renderCard(normal) at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "Test Card",
      subtitle: "2024",
      body: "A short description of the card content.",
      tags: ["tag1", "tag2"],
    };
    const lines = renderCard(c, ctx);
    const r = assertLinesNonEmpty(lines, `renderCard w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderCard overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderCard at width=${width}`, component: "Card" });
    }
  });

  // Card with very long title
  runTest(`renderCard(long title) at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "This Is An Extremely Long Project Title That Should Be Handled Gracefully",
      subtitle: "Some Longer Subtitle Text Here",
      body: "Body text.",
      tags: ["tag"],
    };
    const lines = renderCard(c, ctx);
    const r = assertLinesNonEmpty(lines, `renderCard(long title) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderCard(long title) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderCard(long title) at width=${width}`, component: "Card" });
    }
  });

  // Card with emoji title
  runTest(`renderCard(emoji title) at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "🚀 Rocket Project 🌟",
      body: "A project with emoji in the title.",
      tags: ["emoji", "test"],
    };
    const lines = renderCard(c, ctx);
    const r = assertLinesNonEmpty(lines, `renderCard(emoji title) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });

  // Card with no body or tags (minimal)
  runTest(`renderCard(minimal) at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "Bare Card",
    };
    const lines = renderCard(c, ctx);
    const r = assertLinesNonEmpty(lines, `renderCard(minimal) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });

  // Card with empty body
  runTest(`renderCard(empty body) at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "Empty Body Card",
      body: "",
      tags: [],
    };
    const lines = renderCard(c, ctx);
    const r = assertLinesNonEmpty(lines, `renderCard(empty body) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });
}

// ── 2c. renderLink ─────────────────────────────────────────

for (const width of testWidths) {
  const ctx = createTestContext(width, nordTheme);

  // Normal link
  runTest(`renderLink(normal) at width=${width}`, () => {
    const lines = renderLink("GitHub", "https://github.com", ctx, { icon: "⊙" });
    const r = assertLinesNonEmpty(lines, `renderLink w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderLink overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderLink at width=${width}`, component: "Link" });
    }
  });

  // Link with very long URL
  runTest(`renderLink(long URL) at width=${width}`, () => {
    const lines = renderLink("Link", "https://very-long-domain.example.com/path/to/something/very/deeply/nested/resource?query=param&other=value", ctx);
    const r = assertLinesNonEmpty(lines, `renderLink(long URL) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderLink(long URL) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderLink(long URL) at width=${width}`, component: "Link" });
    }
  });

  // Link focused
  runTest(`renderLink(focused) at width=${width}`, () => {
    const focusedCtx: RenderContext = { ...ctx, focused: true };
    const lines = renderLink("Focused Link", "https://example.com", focusedCtx, { focused: true });
    const r = assertLinesNonEmpty(lines, `renderLink(focused) w=${width}`);
    if (!r.passed) throw new Error(r.error);
    const overflow = assertNoOverflow(lines, width, `renderLink(focused) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderLink(focused) at width=${width}`, component: "Link" });
    }
  });

  // Link with unicode emoji icon
  runTest(`renderLink(emoji icon) at width=${width}`, () => {
    const lines = renderLink("My Site", "https://example.com", ctx, { icon: "🌐" });
    const r = assertLinesNonEmpty(lines, `renderLink(emoji icon) w=${width}`);
    if (!r.passed) throw new Error(r.error);
  });
}

// ── 2d. renderMenu ─────────────────────────────────────────

const menuItems: MenuItem[] = [
  { label: "About", icon: "👤", id: "about" },
  { label: "Projects", icon: "🚀", id: "projects" },
  { label: "Links", icon: "🔗", id: "links" },
];

for (const width of testWidths) {
  const ctx = createTestContext(width, nordTheme);

  for (let selIdx = 0; selIdx < menuItems.length; selIdx++) {
    runTest(`renderMenu(sel=${selIdx}) at width=${width}`, () => {
      const lines = renderMenu(menuItems, selIdx, ctx);
      if (lines.length !== menuItems.length) {
        throw new Error(`Expected ${menuItems.length} lines, got ${lines.length}`);
      }
      const overflow = assertNoOverflow(lines, width, `renderMenu overflow w=${width} sel=${selIdx}`);
      if (!overflow.passed) {
        addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderMenu sel=${selIdx} at width=${width}`, component: "Menu" });
      }
    });
  }

  // Menu with very long labels
  runTest(`renderMenu(long labels) at width=${width}`, () => {
    const longItems: MenuItem[] = [
      { label: "This Is A Very Long Menu Item That Might Overflow The Terminal Width", icon: "⊙", id: "long1" },
      { label: "Another Extremely Long Label For Testing Purposes To Check Layout", icon: "◈", id: "long2" },
    ];
    const lines = renderMenu(longItems, 0, ctx);
    if (lines.length !== longItems.length) {
      throw new Error(`Expected ${longItems.length} lines, got ${lines.length}`);
    }
    const overflow = assertNoOverflow(lines, width, `renderMenu(long labels) overflow w=${width}`);
    if (!overflow.passed) {
      addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderMenu(long labels) at width=${width}`, component: "Menu" });
    }
  });

  // Menu with single item
  runTest(`renderMenu(single item) at width=${width}`, () => {
    const singleItem: MenuItem[] = [{ label: "Only", icon: "•", id: "only" }];
    const lines = renderMenu(singleItem, 0, ctx);
    if (lines.length !== 1) throw new Error(`Expected 1 line, got ${lines.length}`);
  });

  // Edge: menu with emoji-only labels
  runTest(`renderMenu(emoji labels) at width=${width}`, () => {
    const emojiItems: MenuItem[] = [
      { label: "🏠 Home", icon: "🏠", id: "home" },
      { label: "📁 Files", icon: "📁", id: "files" },
      { label: "⚙️ Settings", icon: "⚙️", id: "settings" },
    ];
    const lines = renderMenu(emojiItems, 1, ctx);
    if (lines.length !== emojiItems.length) throw new Error(`Expected ${emojiItems.length} lines, got ${lines.length}`);
  });
}

// ── 3. Banner Rendering ────────────────────────────────────

console.log("\n=== Testing banner rendering... ===\n");

runTest("renderBanner('MINIMAL', ANSI Shadow)", () => {
  const lines = renderBanner("MINIMAL", { font: "ANSI Shadow" });
  const r = assertLinesNonEmpty(lines, "banner MINIMAL");
  if (!r.passed) throw new Error(r.error);

  // Check that the banner has exactly 6 lines (ANSI Shadow height)
  if (lines.length !== 6) {
    addBug({
      severity: "P1",
      category: "Banner",
      description: `ANSI Shadow banner expected 6 lines, got ${lines.length}`,
      reproduction: `renderBanner("MINIMAL", { font: "ANSI Shadow" })`,
      component: "Banner",
    });
  }

  console.log("  Banner output:");
  for (const line of lines) {
    console.log("  " + line);
  }
  console.log(`  Banner width: ${getBannerWidth("MINIMAL", "ANSI Shadow")} chars`);
});

// Banner centering at different widths
for (const width of testWidths) {
  runTest(`centerBanner at width=${width}`, () => {
    const lines = renderBanner("MINIMAL", { font: "ANSI Shadow" });
    const centered = centerBanner(lines, width);
    if (centered.length !== lines.length) {
      throw new Error(`centerBanner changed line count: ${lines.length} -> ${centered.length}`);
    }
    // Check that centered lines don't have negative padding (banner wider than width)
    const bannerWidth = getBannerWidth("MINIMAL", "ANSI Shadow");
    if (bannerWidth > width) {
      // Banner is wider than terminal: check if it still overflows
      for (let i = 0; i < centered.length; i++) {
        if (centered[i].length > width + 2) {
          addBug({
            severity: "P2",
            category: "Layout",
            description: `Banner overflows at width=${width}: line ${i} is ${centered[i].length} chars (banner width=${bannerWidth})`,
            reproduction: `centerBanner(renderBanner("MINIMAL"), ${width})`,
            component: "Banner",
          });
          break;
        }
      }
    }
  });
}

// Banner with gradient
runTest("renderBanner with gradient", () => {
  const lines = renderBanner("MINIMAL", { font: "ANSI Shadow" });
  const gradientResult = gradientLines(lines, ["#88c0d0", "#5e81ac"]);
  if (gradientResult.length !== lines.length) {
    throw new Error(`Gradient changed line count: ${lines.length} -> ${gradientResult.length}`);
  }
  // Verify gradient added ANSI codes
  const hasAnsi = gradientResult.some(l => l !== stripAnsi(l));
  if (!hasAnsi) {
    addBug({
      severity: "P2",
      category: "Banner",
      description: "Gradient applied but no ANSI color codes found in output",
      reproduction: `gradientLines(renderBanner("MINIMAL"), ["#88c0d0", "#5e81ac"])`,
      component: "Banner",
    });
  }
});

// Banner edge: single character
runTest("renderBanner single char", () => {
  const lines = renderBanner("A", { font: "ANSI Shadow" });
  const r = assertLinesNonEmpty(lines, "banner single char");
  if (!r.passed) throw new Error(r.error);
});

// Banner edge: empty string
runTest("renderBanner empty string", () => {
  const lines = renderBanner("", { font: "ANSI Shadow" });
  // Should produce lines (even if blank)
  if (lines.length === 0) {
    addBug({
      severity: "P3",
      category: "Banner",
      description: "Empty string produces 0 banner lines instead of blank lines at font height",
      reproduction: `renderBanner("", { font: "ANSI Shadow" })`,
      component: "Banner",
    });
  }
});

// Banner edge: unknown font fallback
runTest("renderBanner unknown font fallback", () => {
  const lines = renderBanner("TEST", { font: "nonexistent-font-xyz" });
  const r = assertLines(lines, "banner unknown font");
  if (!r.passed) throw new Error(r.error);
});

// ── 4. Alignment Checks ───────────────────────────────────

console.log("\n=== Testing visual alignment (stripped ANSI)... ===\n");

for (const width of [40, 80, 120]) {
  const ctx = createTestContext(width, nordTheme);

  // Card alignment: all box lines should be same visual length
  runTest(`Card box alignment at width=${width}`, () => {
    const c: CardBlock = {
      type: "card",
      title: "Align Test",
      subtitle: "2024",
      body: "Some body text that should be wrapped properly.",
      tags: ["tag1", "tag2", "tag3"],
    };
    const lines = renderCard(c, ctx);
    const strippedLengths = lines.map(l => stripAnsi(l).length);
    const firstLen = strippedLengths[0];
    let misaligned = false;
    for (let i = 1; i < strippedLengths.length; i++) {
      if (strippedLengths[i] !== firstLen) {
        misaligned = true;
        addBug({
          severity: "P2",
          category: "Alignment",
          description: `Card box lines have inconsistent widths at width=${width}: line 0 is ${firstLen}, line ${i} is ${strippedLengths[i]}`,
          reproduction: `renderCard({title: "Align Test", ...}) at width=${width}`,
          component: "Card",
        });
        break;
      }
    }
    if (!misaligned) {
      console.log(`  Card box alignment OK at width=${width} (all lines ${firstLen} chars)`);
    }
  });

  // Menu alignment: check that all menu items have similar visual structure
  runTest(`Menu alignment at width=${width}`, () => {
    const lines = renderMenu(menuItems, 0, ctx);
    const strippedLines = lines.map(l => stripAnsi(l));
    console.log(`  Menu at width=${width}:`);
    for (const sl of strippedLines) {
      console.log(`    [${sl.length.toString().padStart(3)}] "${sl}"`);
    }
  });
}

// ── 5. Edge Case Stress Tests ──────────────────────────────

console.log("\n=== Stress / edge case tests... ===\n");

// Very narrow width (width=10)
runTest("renderText at width=10", () => {
  const ctx = createTestContext(10, nordTheme);
  const lines = renderText("Hello world, this is narrow!", ctx, "plain");
  const r = assertLinesNonEmpty(lines, "renderText w=10");
  if (!r.passed) throw new Error(r.error);
});

runTest("renderCard at width=10", () => {
  const ctx = createTestContext(10, nordTheme);
  const c: CardBlock = { type: "card", title: "X", body: "Y" };
  const lines = renderCard(c, ctx);
  const r = assertLinesNonEmpty(lines, "renderCard w=10");
  if (!r.passed) throw new Error(r.error);
  // Check overflow
  const overflow = assertNoOverflow(lines, 10, "renderCard overflow w=10");
  if (!overflow.passed) {
    addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderCard at width=10`, component: "Card" });
  }
});

runTest("renderCard at width=1", () => {
  const ctx = createTestContext(1, nordTheme);
  const c: CardBlock = { type: "card", title: "X" };
  try {
    const lines = renderCard(c, ctx);
    // If it doesn't crash, check for reasonable output
    const overflow = assertNoOverflow(lines, 1, "renderCard overflow w=1");
    if (!overflow.passed) {
      addBug({ severity: "P3", category: "Layout", description: overflow.error!, reproduction: `renderCard at width=1`, component: "Card" });
    }
  } catch (err: any) {
    addBug({
      severity: "P1",
      category: "Crash",
      description: `renderCard crashes at width=1: ${err.message}`,
      reproduction: `renderCard({title: "X"}, createTestContext(1))`,
      component: "Card",
    });
    throw err;
  }
});

// Width=0
runTest("renderText at width=0", () => {
  const ctx = createTestContext(0, nordTheme);
  try {
    const lines = renderText("test", ctx, "plain");
    // Should not crash
  } catch (err: any) {
    addBug({
      severity: "P1",
      category: "Crash",
      description: `renderText crashes at width=0: ${err.message}`,
      reproduction: `renderText("test", createTestContext(0))`,
      component: "Text",
    });
    throw err;
  }
});

// Unicode stress: mixed scripts
runTest("renderText with mixed unicode", () => {
  const ctx = createTestContext(80, nordTheme);
  const lines = renderText("Hello 世界 مرحبا 🌍 Γειά", ctx, "plain");
  const r = assertLinesNonEmpty(lines, "renderText mixed unicode");
  if (!r.passed) throw new Error(r.error);
});

// Markdown edge: only formatting markers
runTest("renderText markdown-only markers", () => {
  const ctx = createTestContext(80, nordTheme);
  const lines = renderText("**", ctx, "markdown");
  // Should not crash
});

runTest("renderText markdown unclosed bold", () => {
  const ctx = createTestContext(80, nordTheme);
  const lines = renderText("**unclosed bold", ctx, "markdown");
  // Should not crash
});

runTest("renderText markdown nested formatting", () => {
  const ctx = createTestContext(80, nordTheme);
  const lines = renderText("**bold *and italic* text**", ctx, "markdown");
  const r = assertLinesNonEmpty(lines, "renderText nested formatting");
  if (!r.passed) throw new Error(r.error);
});

// Card with extremely long tag list
runTest("renderCard with many tags at width=40", () => {
  const ctx = createTestContext(40, nordTheme);
  const c: CardBlock = {
    type: "card",
    title: "Tags Stress",
    tags: ["JavaScript", "TypeScript", "Rust", "Go", "Python", "Ruby", "Elixir", "Haskell", "C++", "Kotlin"],
  };
  const lines = renderCard(c, ctx);
  const overflow = assertNoOverflow(lines, 40, "renderCard many tags overflow w=40");
  if (!overflow.passed) {
    addBug({ severity: "P2", category: "Layout", description: overflow.error!, reproduction: `renderCard with 10 tags at width=40`, component: "Card" });
  }
});

// Link with no icon (default arrow)
runTest("renderLink default icon", () => {
  const ctx = createTestContext(80, nordTheme);
  const lines = renderLink("Default", "https://example.com", ctx);
  const r = assertLinesNonEmpty(lines, "renderLink default icon");
  if (!r.passed) throw new Error(r.error);
  // Verify the default icon (→) is present
  const stripped = stripAnsi(lines[0]);
  if (!stripped.includes("→")) {
    addBug({
      severity: "P3",
      category: "Component",
      description: `renderLink default icon "→" not found in output: "${stripped}"`,
      reproduction: `renderLink("Default", "https://example.com", ctx)`,
      component: "Link",
    });
  }
});

// ── 6. Full Page Render at Each Width ──────────────────────

console.log("\n=== Full page render tests... ===\n");

for (const pg of config.pages) {
  for (const width of testWidths) {
    const ctx = createTestContext(width, nordTheme);
    runTest(`Full page "${pg.id}" render at width=${width}`, () => {
      const allLines: string[] = [];
      for (const block of pg.content) {
        const blockLines = renderBlock(block, ctx);
        allLines.push(...blockLines);
      }
      if (allLines.length === 0) {
        throw new Error(`Page "${pg.id}" produced 0 lines at width=${width}`);
      }
      // Check overflow on every line
      let overflowCount = 0;
      for (let i = 0; i < allLines.length; i++) {
        const plainLen = stripAnsi(allLines[i]).length;
        if (plainLen > width + 2) {
          overflowCount++;
          if (overflowCount === 1) {
            addBug({
              severity: "P2",
              category: "Layout",
              description: `Page "${pg.id}" line ${i} overflows at width=${width}: ${plainLen} chars. Content: "${stripAnsi(allLines[i]).substring(0, 80)}..."`,
              reproduction: `Render page "${pg.id}" at width=${width}`,
              component: "Page",
            });
          }
        }
      }
      if (overflowCount > 0) {
        console.log(`  Page "${pg.id}" at width=${width}: ${overflowCount} lines overflow`);
      }
    });
  }
}

// ── 7. Compile Final Report ────────────────────────────────

// Deduplicate bugs
const seenBugs = new Set<string>();
const uniqueBugs: BugReport[] = [];
for (const bug of allBugs) {
  const key = `${bug.category}:${bug.description}`;
  if (!seenBugs.has(key)) {
    seenBugs.add(key);
    uniqueBugs.push(bug);
  }
}

const total = allResults.length;
const passed = allResults.filter(r => r.passed).length;
const failed = total - passed;

const finalReport: TestReport = {
  project: "01-Minimal Portfolio (Extended)",
  total,
  passed,
  failed,
  results: allResults,
  bugs: uniqueBugs,
};

console.log(formatReport(finalReport));

// Print summary
console.log(`\n${"═".repeat(60)}`);
console.log(`FINAL SUMMARY`);
console.log(`${"═".repeat(60)}`);
console.log(`Total tests: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Unique bugs: ${uniqueBugs.length}`);
if (uniqueBugs.length > 0) {
  console.log(`\nBug breakdown by severity:`);
  const bySeverity: Record<string, number> = {};
  for (const bug of uniqueBugs) {
    bySeverity[bug.severity] = (bySeverity[bug.severity] || 0) + 1;
  }
  for (const [sev, count] of Object.entries(bySeverity).sort()) {
    console.log(`  ${sev}: ${count}`);
  }
  console.log(`\nBug breakdown by category:`);
  const byCat: Record<string, number> = {};
  for (const bug of uniqueBugs) {
    byCat[bug.category] = (byCat[bug.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCat).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}
console.log(`${"═".repeat(60)}\n`);

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
