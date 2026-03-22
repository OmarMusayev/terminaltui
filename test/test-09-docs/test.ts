/**
 * Test 09 — Documentation/Reference Site
 *
 * Tests: Getting Started page, API Reference accordion, FAQ accordion,
 * Changelog timeline, Examples tabs. Theme: monokai.
 */
import {
  defineSite,
  page,
  accordion,
  tabs,
  timeline,
  list,
  markdown,
  divider,
  spacer,
  section,
  themes,
  testSiteConfig,
  formatReport,
  createTestContext,
  renderBlock,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  type TestResult,
  type TestReport,
  type BugReport,
} from "../harness.js";

import { renderAccordion } from "../../src/components/Accordion.js";
import { renderTabs } from "../../src/components/Tabs.js";
import { renderTimeline } from "../../src/components/Timeline.js";
import { renderList } from "../../src/components/List.js";
import { renderText } from "../../src/components/Text.js";
import { stripAnsi } from "../../src/components/base.js";
import type { ContentBlock } from "../../src/config/types.js";

// ─── Monokai Theme ─────────────────────────────────────────
const monokaiTheme = themes.monokai;

// ─── Helper: render nested content blocks ──────────────────
function renderNestedContent(blocks: ContentBlock[], ctx: any): string[] {
  const lines: string[] = [];
  for (const b of blocks) lines.push(...renderBlock(b, ctx));
  return lines;
}

// ─── Site Configuration ────────────────────────────────────

const docsConfig = {
  name: "TerminalTUI Docs",
  handle: "@terminaltui",
  tagline: "Build beautiful terminal experiences",
  banner: {
    text: "TUI Docs",
    font: "Small",
  },
  theme: "monokai" as const,
  pages: [
    // ── Page 1: Getting Started ─────────────────────────────
    page("getting-started", {
      title: "Getting Started",
      icon: "rocket",
      content: [
        markdown(`## Quick Start Guide

Follow these steps to get up and running with TerminalTUI.`),
        spacer(),
        list([
          "Install the package: \`npm install terminaltui\`",
          "Create a config file: \`touch tui.config.ts\`",
          "Define your site using \`defineSite()\` with pages and content blocks",
          "Run the dev server: \`npx terminaltui dev\`",
          "Build for production: \`npx terminaltui build\`",
        ], "number"),
        spacer(),
        markdown(`### Configuration

The main entry point is the \`defineSite()\` function. Pass it a **SiteConfig** object with your pages, theme, and optional banner.

\`\`\`typescript
import { defineSite, page } from 'terminaltui';
\`\`\`

You can customize the **theme** using built-in presets like *monokai*, *dracula*, or *nord*.`),
      ],
    }),

    // ── Page 2: API Reference ───────────────────────────────
    page("api-reference", {
      title: "API Reference",
      icon: "book",
      content: [
        markdown(`## API Reference

Explore the full API surface of TerminalTUI.`),
        spacer(),
        accordion([
          {
            label: "defineSite(config: SiteConfig): Site",
            content: [
              markdown(`Creates and validates a site configuration. Requires a **name** and at least one **page**.

Returns a \`Site\` object that can be passed to \`runSite()\`.

**Parameters:**
- \`config\` — The full site configuration object
- \`config.name\` — Display name for your site
- \`config.pages\` — Array of page configurations`),
            ],
          },
          {
            label: "page(id: string, config: PageConfig): PageConfig",
            content: [
              markdown(`Creates a page configuration with the given **id** and settings.

The \`id\` must be unique across all pages. Use kebab-case for best results.

**Parameters:**
- \`id\` — Unique page identifier
- \`config.title\` — Display title
- \`config.icon\` — Optional icon name
- \`config.content\` — Array of content blocks`),
            ],
          },
          {
            label: "accordion(items: AccordionItem[]): AccordionBlock",
            content: [
              markdown(`Creates a collapsible accordion component. Each item has a **label** and nested **content** blocks.

Only one item can be open at a time. The \`openIndex\` controls which item is expanded.`),
            ],
          },
          {
            label: "tabs(items: TabItem[]): TabsBlock",
            content: [
              markdown(`Creates a tabbed interface. Each tab has a **label** and **content** blocks.

The \`activeIndex\` determines which tab is currently visible. Tab labels appear in a horizontal bar.`),
            ],
          },
          {
            label: "timeline(items: TimelineItem[]): TimelineBlock",
            content: [
              markdown(`Creates a vertical timeline with connected nodes. Each item has a **title**, optional **period**, and **description**.

Great for changelogs, roadmaps, and historical data.`),
            ],
          },
          {
            label: "markdown(text: string): TextBlock",
            content: [
              markdown(`Parses a markdown string into a styled text block. Supports:
- **Bold** text with \`**double asterisks**\`
- *Italic* text with \`*single asterisks*\`
- \`Inline code\` with backticks
- Paragraph separation with blank lines`),
            ],
          },
        ]),
      ],
    }),

    // ── Page 3: FAQ ─────────────────────────────────────────
    page("faq", {
      title: "FAQ",
      icon: "question",
      content: [
        markdown(`## Frequently Asked Questions`),
        spacer(),
        accordion([
          {
            label: "What is TerminalTUI?",
            content: [
              markdown(`TerminalTUI is a **framework** for building beautiful terminal-based user interfaces. It turns your content into an interactive TUI application with themes, navigation, and animations.`),
            ],
          },
          {
            label: "How do I install it?",
            content: [
              markdown(`Install via npm:

\`npm install terminaltui\`

Or use yarn: \`yarn add terminaltui\``),
            ],
          },
          {
            label: "Can I use custom themes?",
            content: [
              markdown(`Yes! You can pass a custom **Theme** object to the \`theme\` property of your site config. The theme object includes colors for \`accent\`, \`text\`, \`muted\`, \`border\`, and more.`),
            ],
          },
          {
            label: "Does it support images?",
            content: [
              markdown(`TerminalTUI supports image rendering in three modes:
- **ASCII** — converts images to ASCII characters
- **Braille** — uses braille unicode characters for higher resolution
- **Blocks** — uses block characters for color display`),
            ],
          },
          {
            label: "How do I add navigation?",
            content: [
              markdown(`Navigation is built-in. Use \`page()\` to define pages and they automatically appear in the sidebar menu. Users can navigate with arrow keys, vim bindings (\`j\`/\`k\`), or number keys.`),
            ],
          },
          {
            label: "Is it accessible?",
            content: [
              markdown(`Yes. TerminalTUI supports keyboard-only navigation, screen reader friendly output, and high-contrast themes. The *hacker* theme provides maximum contrast.`),
            ],
          },
          {
            label: "Can I embed it in a web page?",
            content: [
              markdown(`TerminalTUI is designed for **native terminal** environments. For web embedding, consider using an \`xterm.js\` wrapper to display TUI output in a browser.`),
            ],
          },
          {
            label: "How do I contribute?",
            content: [
              markdown(`Contributions are welcome! Fork the repository, create a feature branch, and submit a pull request. See the **CONTRIBUTING.md** file for details.`),
            ],
          },
        ]),
      ],
    }),

    // ── Page 4: Changelog ───────────────────────────────────
    page("changelog", {
      title: "Changelog",
      icon: "clock",
      content: [
        markdown(`## Changelog`),
        spacer(),
        timeline([
          {
            title: "v2.0.0",
            period: "March 2026",
            description: "Major release: New plugin system, custom themes API, and performance improvements. Breaking changes to config format.",
          },
          {
            title: "v1.9.0",
            period: "February 2026",
            description: "Added sparkline component, gradient text support, and image rendering in braille mode.",
          },
          {
            title: "v1.8.0",
            period: "January 2026",
            description: "Introduced accordion and tabs components. Added gallery layout with configurable columns.",
          },
          {
            title: "v1.7.0",
            period: "December 2025",
            description: "Added animation system with boot sequences, transitions, and exit messages.",
          },
          {
            title: "v1.6.0",
            period: "November 2025",
            description: "Timeline component added. Improved table rendering with border style options.",
          },
          {
            title: "v1.5.0",
            period: "October 2025",
            description: "Hero component with ASCII art support. Badge and progress bar components.",
          },
          {
            title: "v1.4.0",
            period: "September 2025",
            description: "Vim-style keybindings. Number jump navigation. Command mode with slash commands.",
          },
          {
            title: "v1.3.0",
            period: "August 2025",
            description: "Easter egg support with konami code. Custom commands system.",
          },
          {
            title: "v1.2.0",
            period: "July 2025",
            description: "Multi-theme support with 10 built-in themes. Custom theme API.",
          },
          {
            title: "v1.0.0",
            period: "June 2025",
            description: "Initial release with core components: text, card, list, table, quote, link, divider.",
          },
        ]),
      ],
    }),

    // ── Page 5: Examples ────────────────────────────────────
    page("examples", {
      title: "Examples",
      icon: "code",
      content: [
        markdown(`## Code Examples`),
        spacer(),
        tabs([
          {
            label: "Basic",
            content: [
              markdown(`### Basic Site Setup

Create a minimal site with a single page:

\`\`\`
const site = defineSite({
  name: "My Site",
  pages: [
    page("home", {
      title: "Home",
      content: [
        markdown("Welcome to my site!"),
      ],
    }),
  ],
});
\`\`\`

Then run it with \`runSite(site)\`.`),
            ],
          },
          {
            label: "Advanced",
            content: [
              markdown(`### Advanced Configuration

Use themes, banners, and animations:

\`\`\`
const site = defineSite({
  name: "Pro Site",
  banner: { text: "HELLO", font: "Small" },
  theme: "monokai",
  animations: { boot: true, transitions: "slide" },
  pages: [ /* ... */ ],
});
\`\`\`

Add **accordion** and **tabs** for interactive content. Use \`timeline()\` for chronological data.`),
            ],
          },
          {
            label: "Custom",
            content: [
              markdown(`### Custom Components

Build your own render functions:

\`\`\`
const custom = {
  type: "custom",
  render: (width, theme) => {
    return ["Custom output here"];
  },
};
\`\`\`

Custom blocks receive the current \`width\` and \`theme\` for responsive rendering. Return an array of **string lines**.`),
            ],
          },
        ]),
      ],
    }),
  ],
};

// ─── Run Site Config Tests ─────────────────────────────────

const report = testSiteConfig(docsConfig, "Documentation/Reference Site");

// ─── Extra Tests ───────────────────────────────────────────

const extraResults: TestResult[] = [];
const extraBugs: BugReport[] = [];

// ── Accordion: open each index (0-5) and all closed (-1) ──

const accordionItems = [
  { label: "Section A", content: [markdown("Content for section A with **bold** text.")] },
  { label: "Section B", content: [markdown("Content for section B with `inline code`.")] },
  { label: "Section C", content: [markdown("Content for section C with *italic* text.")] },
  { label: "Section D", content: [markdown("Content for section D.")] },
  { label: "Section E", content: [markdown("Content for section E.")] },
  { label: "Section F", content: [markdown("Content for section F.")] },
];

for (let openIdx = -1; openIdx <= 5; openIdx++) {
  const ctx = createTestContext(80, monokaiTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderAccordion(accordionItems, openIdx, ctx, renderNestedContent);
    if (openIdx === -1) {
      // All closed: should have exactly 6 lines (one per item, no content)
      const stripped = lines.filter(l => stripAnsi(l).trim().length > 0);
      if (stripped.length < 6) {
        throw new Error(`All-closed accordion rendered ${stripped.length} non-empty lines, expected at least 6`);
      }
      // None should have expanded content indicator
      for (const line of lines) {
        const plain = stripAnsi(line).trim();
        // Closed items use right-pointing triangle
        if (plain.startsWith("\u25be")) {
          throw new Error("Found open indicator in all-closed accordion");
        }
      }
    } else {
      // Exactly one should be open
      const openIndicators = lines.filter(l => stripAnsi(l).trim().startsWith("\u25be"));
      if (openIndicators.length !== 1) {
        throw new Error(`Expected 1 open item, found ${openIndicators.length} at openIndex=${openIdx}`);
      }
    }
  }, `Accordion openIndex=${openIdx}`));
}

// ── Accordion content rendering: verify nested blocks render when open ──

for (let openIdx = 0; openIdx < 3; openIdx++) {
  const ctx = createTestContext(80, monokaiTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderAccordion(accordionItems, openIdx, ctx, renderNestedContent);
    // When open, there should be indented content lines beyond just the labels
    const contentLines = lines.filter(l => l.startsWith("    ") && stripAnsi(l).trim().length > 0);
    if (contentLines.length === 0) {
      throw new Error(`No nested content rendered for accordion openIndex=${openIdx}`);
    }
  }, `Accordion content renders at openIndex=${openIdx}`));
}

// ── Tabs: active index 0, 1, 2 ──────────────────────────

const tabItems = [
  { label: "Basic", content: [markdown("Basic tab content with `code` examples.")] },
  { label: "Advanced", content: [markdown("Advanced tab content with **bold** features.")] },
  { label: "Custom", content: [markdown("Custom tab content with *italic* notes.")] },
];

for (let activeIdx = 0; activeIdx < 3; activeIdx++) {
  const ctx = createTestContext(80, monokaiTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderTabs(tabItems, activeIdx, ctx, renderNestedContent);
    if (lines.length < 3) {
      throw new Error(`Tabs with activeIndex=${activeIdx} rendered only ${lines.length} lines`);
    }
    // The tab bar (first line) should contain all tab labels
    const tabBarPlain = stripAnsi(lines[0]);
    for (const item of tabItems) {
      if (!tabBarPlain.includes(item.label)) {
        throw new Error(`Tab bar missing label "${item.label}"`);
      }
    }
  }, `Tabs activeIndex=${activeIdx}`));
}

// ── Tabs content rendering: verify active tab content renders ──

for (let activeIdx = 0; activeIdx < 3; activeIdx++) {
  const ctx = createTestContext(80, monokaiTheme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderTabs(tabItems, activeIdx, ctx, renderNestedContent);
    // Lines after the tab bar and separator should have content
    const contentLines = lines.slice(2).filter(l => stripAnsi(l).trim().length > 0);
    if (contentLines.length === 0) {
      throw new Error(`No content rendered for active tab index=${activeIdx}`);
    }
  }, `Tabs content renders at activeIndex=${activeIdx}`));
}

// ── Timeline: 10 items, verify connectors ───────────────

const timelineItems = [
  { title: "v2.0.0", period: "March 2026", description: "Major release." },
  { title: "v1.9.0", period: "February 2026", description: "Sparklines added." },
  { title: "v1.8.0", period: "January 2026", description: "Accordion and tabs." },
  { title: "v1.7.0", period: "December 2025", description: "Animation system." },
  { title: "v1.6.0", period: "November 2025", description: "Timeline component." },
  { title: "v1.5.0", period: "October 2025", description: "Hero component." },
  { title: "v1.4.0", period: "September 2025", description: "Vim keybindings." },
  { title: "v1.3.0", period: "August 2025", description: "Easter eggs." },
  { title: "v1.2.0", period: "July 2025", description: "Multi-theme support." },
  { title: "v1.0.0", period: "June 2025", description: "Initial release." },
];

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, monokaiTheme);
  const lines = renderTimeline(timelineItems, ctx);
  if (lines.length === 0) {
    throw new Error("Timeline rendered 0 lines");
  }

  // Verify connector lines exist between items (pipe character)
  const connectorLines = lines.filter(l => {
    const plain = stripAnsi(l).trim();
    return plain === "\u2502";
  });
  // There should be 9 connectors (between 10 items)
  if (connectorLines.length !== 9) {
    throw new Error(`Expected 9 connector lines between 10 items, found ${connectorLines.length}`);
  }

  // Verify all 10 titles appear
  for (const item of timelineItems) {
    const found = lines.some(l => stripAnsi(l).includes(item.title));
    if (!found) {
      throw new Error(`Timeline missing title "${item.title}"`);
    }
  }
}, "Timeline with 10 items and connectors"));

// ── Numbered list at widths 30, 40, 60 ─────────────────

for (const width of [30, 40, 60]) {
  const ctx = createTestContext(width, monokaiTheme);
  extraResults.push(assertNoThrow(() => {
    const items = [
      "Install the package",
      "Create config file",
      "Define your site",
      "Run dev server",
      "Build for production",
    ];
    const lines = renderList(items, ctx, "number");
    if (lines.length !== 5) {
      throw new Error(`Numbered list rendered ${lines.length} lines, expected 5`);
    }
    // Verify numbering
    for (let i = 0; i < lines.length; i++) {
      const plain = stripAnsi(lines[i]);
      if (!plain.includes(`${i + 1}.`)) {
        throw new Error(`Line ${i} missing number prefix "${i + 1}.": "${plain}"`);
      }
    }
  }, `Numbered list at width=${width}`));
}

// ── Markdown inline formatting ─────────────────────────

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, monokaiTheme);

  // Test inline code (backtick)
  const codeText = "Use `npm install` to install.";
  const codeLines = renderText(codeText, ctx, "markdown");
  if (codeLines.length === 0) throw new Error("Inline code markdown rendered 0 lines");
  const codeRaw = codeLines[0];
  const codePlain = stripAnsi(codeRaw);
  // Should not contain literal backticks (they get stripped in rendering)
  if (codePlain.includes("`")) {
    throw new Error("Backtick character not processed in inline code rendering");
  }
  // Should contain the text without backticks
  if (!codePlain.includes("npm install")) {
    throw new Error("Inline code text missing from rendered output");
  }
}, "Markdown inline code (backtick) rendering"));

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, monokaiTheme);

  // Test bold (**text**)
  const boldText = "This is **important** information.";
  const boldLines = renderText(boldText, ctx, "markdown");
  if (boldLines.length === 0) throw new Error("Bold markdown rendered 0 lines");
  const boldRaw = boldLines[0];
  const boldPlain = stripAnsi(boldRaw);
  // Should not contain literal ** markers
  if (boldPlain.includes("**")) {
    throw new Error("Bold markers ** not stripped from rendered output");
  }
  if (!boldPlain.includes("important")) {
    throw new Error("Bold text missing from rendered output");
  }
}, "Markdown bold (**) rendering"));

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, monokaiTheme);

  // Test italic (*text*)
  const italicText = "This is *emphasized* text.";
  const italicLines = renderText(italicText, ctx, "markdown");
  if (italicLines.length === 0) throw new Error("Italic markdown rendered 0 lines");
  const italicPlain = stripAnsi(italicLines[0]);
  if (!italicPlain.includes("emphasized")) {
    throw new Error("Italic text missing from rendered output");
  }
}, "Markdown italic (*) rendering"));

// ── Verify correct ANSI escape sequences ────────────────

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, monokaiTheme);

  // Inline code should use warning color (monokai warning = #e6db74)
  const codeLines = renderText("Try `hello` now.", ctx, "markdown");
  const rawOutput = codeLines[0];
  // The warning color for monokai is #e6db74 = rgb(230, 219, 116)
  // ANSI escape: \x1b[38;2;230;219;116m
  if (!rawOutput.includes("\x1b[38;2;230;219;116m")) {
    throw new Error("Inline code missing monokai warning color ANSI sequence (expected \\x1b[38;2;230;219;116m)");
  }

  // Bold should use bold escape + accent color
  const boldLines = renderText("This is **bold** text.", ctx, "markdown");
  const boldRaw = boldLines[0];
  // Bold ANSI: \x1b[1m
  if (!boldRaw.includes("\x1b[1m")) {
    throw new Error("Bold text missing ANSI bold sequence (\\x1b[1m)");
  }
  // Accent color for monokai is #f92672 = rgb(249, 38, 114)
  if (!boldRaw.includes("\x1b[38;2;249;38;114m")) {
    throw new Error("Bold text missing monokai accent color ANSI sequence (expected \\x1b[38;2;249;38;114m)");
  }

  // Italic should use italic escape
  const italicLines = renderText("This is *italic* text.", ctx, "markdown");
  const italicRaw = italicLines[0];
  // Italic ANSI: \x1b[3m
  if (!italicRaw.includes("\x1b[3m")) {
    throw new Error("Italic text missing ANSI italic sequence (\\x1b[3m)");
  }

  // Reset should appear
  if (!rawOutput.includes("\x1b[0m")) {
    throw new Error("Missing ANSI reset sequence (\\x1b[0m)");
  }
}, "ANSI escape sequences for markdown formatting"));

// ─── Merge Extra Results into Report ───────────────────────

report.results.push(...extraResults);
report.bugs.push(...extraBugs);
report.total = report.results.length;
report.passed = report.results.filter(r => r.passed).length;
report.failed = report.total - report.passed;

// ─── Print Report ──────────────────────────────────────────

console.log(formatReport(report));

// Exit with code based on failures
process.exit(report.failed > 0 ? 1 : 0);
