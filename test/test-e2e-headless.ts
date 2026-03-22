#!/usr/bin/env npx tsx
/**
 * Headless end-to-end test: loads a site config, creates the runtime,
 * and renders one frame to a string. Validates the full pipeline works
 * without needing an interactive terminal.
 */
import {
  defineSite, page, card, timeline, link, section, quote,
  hero, table, list, divider, spacer, badge, markdown,
} from "../src/index.js";
import { TUIRuntime } from "../src/core/runtime.js";
import { setColorMode, fgColor, reset, bold } from "../src/style/colors.js";
import { themes } from "../src/style/theme.js";
import { renderCard } from "../src/components/Card.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderTable } from "../src/components/Table.js";
import { renderList } from "../src/components/List.js";
import { renderQuote } from "../src/components/Quote.js";
import { renderHero } from "../src/components/Hero.js";
import { renderLink } from "../src/components/Link.js";
import { renderDivider } from "../src/components/Divider.js";
import { renderBadge } from "../src/components/Badge.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderText } from "../src/components/Text.js";
import { renderMenu } from "../src/components/Menu.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import type { RenderContext } from "../src/components/base.js";

// Force 256 color mode for consistent test output
setColorMode("256");

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertNoThrow(fn: () => void, msg: string): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${msg}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${msg} — ${err}`);
  }
}

const theme = themes.cyberpunk;
const ctx: RenderContext = { width: 80, theme, borderStyle: "rounded" };

console.log("End-to-End Headless Tests\n");

// ── Test 1: defineSite + page helpers ──────────────────
console.log("1. Config parsing (defineSite + helpers)");
let site: ReturnType<typeof defineSite> | null = null;
assertNoThrow(() => {
  site = defineSite({
    name: "Test Site",
    tagline: "A test tagline",
    theme: "cyberpunk",
    pages: [
      page("about", {
        title: "About",
        icon: "◆",
        content: [
          markdown("Hello **world**"),
          spacer(),
          divider(),
        ],
      }),
      page("projects", {
        title: "Projects",
        icon: "◈",
        content: [
          card({ title: "Project A", body: "Description here", tags: ["TS", "Node"] }),
          card({ title: "Project B", subtitle: "★ 100", body: "Another one", url: "https://example.com" }),
        ],
      }),
      page("experience", {
        title: "Experience",
        content: [
          timeline([
            { title: "Job A", subtitle: "Company", period: "2024", description: "Did things" },
            { title: "Job B", subtitle: "Startup", period: "2022", description: "More things" },
          ]),
        ],
      }),
      page("contact", {
        title: "Contact",
        content: [
          link("GitHub", "https://github.com"),
          link("Email", "mailto:test@test.com"),
          quote("Great software is made by great teams", { attribution: "Someone" }),
          badge("New"),
          table(["Language", "Level"], [["TypeScript", "Expert"], ["Rust", "Advanced"]]),
          list(["Item 1", "Item 2", "Item 3"]),
        ],
      }),
    ],
  });
}, "defineSite() creates a valid config");

assert(site !== null, "Site config is not null");
assert(site!.config.pages.length === 4, `Has 4 pages, got ${site!.config.pages.length}`);

// ── Test 2: Component rendering ────────────────────────
console.log("\n2. Component rendering");

assertNoThrow(() => {
  const lines = renderCard({ type: "card", title: "Test", body: "Body text", tags: ["a", "b"] }, ctx);
  assert(lines.length > 0, `Card renders ${lines.length} lines`);
}, "renderCard works");

assertNoThrow(() => {
  const lines = renderTimeline([
    { title: "A", subtitle: "B", period: "2024", description: "desc" }
  ], ctx);
  assert(lines.length > 0, `Timeline renders ${lines.length} lines`);
}, "renderTimeline works");

assertNoThrow(() => {
  const lines = renderTable(["H1", "H2"], [["a", "b"], ["c", "d"]], ctx);
  assert(lines.length > 0, `Table renders ${lines.length} lines`);
}, "renderTable works");

assertNoThrow(() => {
  const lines = renderList(["one", "two", "three"], ctx);
  assert(lines.length > 0, `List renders ${lines.length} lines`);
}, "renderList works");

assertNoThrow(() => {
  const lines = renderQuote("To be or not to be", ctx);
  assert(lines.length > 0, `Quote renders ${lines.length} lines`);
}, "renderQuote works");

assertNoThrow(() => {
  const lines = renderHero({ type: "hero", title: "Welcome", subtitle: "Hello" }, ctx);
  assert(lines.length > 0, `Hero renders ${lines.length} lines`);
}, "renderHero works");

assertNoThrow(() => {
  const lines = renderLink("GitHub", "https://github.com", ctx);
  assert(lines.length > 0, `Link renders ${lines.length} lines`);
}, "renderLink works");

assertNoThrow(() => {
  const lines = renderDivider(ctx);
  assert(lines.length > 0, `Divider renders ${lines.length} lines`);
}, "renderDivider works");

assertNoThrow(() => {
  const result = renderBadge("Test", ctx);
  assert(result.length > 0, "Badge renders non-empty string");
}, "renderBadge works");

assertNoThrow(() => {
  const lines = renderProgressBar("TypeScript", 85, ctx);
  assert(lines.length > 0, `ProgressBar renders ${lines.length} lines`);
}, "renderProgressBar works");

assertNoThrow(() => {
  const lines = renderText("Hello *world* and **bold**", ctx, "markdown");
  assert(lines.length > 0, `Text renders ${lines.length} lines`);
}, "renderText markdown works");

assertNoThrow(() => {
  const lines = renderMenu(
    [{ label: "Home", id: "home" }, { label: "About", id: "about", icon: "◆" }],
    0, ctx
  );
  assert(lines.length > 0, `Menu renders ${lines.length} lines`);
}, "renderMenu works");

// ── Test 3: ASCII Banner ───────────────────────────────
console.log("\n3. ASCII banner rendering");
assertNoThrow(() => {
  const lines = renderBanner("TEST");
  assert(lines.length > 0, `Banner renders ${lines.length} lines`);
  const centered = centerBanner(lines, 80);
  assert(centered.length === lines.length, "centerBanner preserves line count");
}, "ASCII banner renders correctly");

// ── Test 4: TUIRuntime construction ────────────────────
console.log("\n4. TUIRuntime construction");
assertNoThrow(() => {
  const runtime = new TUIRuntime(site!);
  assert(runtime !== null, "TUIRuntime created successfully");

  // Test content block rendering through the runtime
  const contentLines = runtime.renderContentBlocks(site!.config.pages[1].content, ctx);
  assert(contentLines.length > 0, `Content blocks render ${contentLines.length} lines`);
}, "TUIRuntime constructs from config");

// ── Test 5: Theme system ───────────────────────────────
console.log("\n5. Theme system");
const themeNames = [
  "cyberpunk", "dracula", "nord", "monokai", "solarized",
  "gruvbox", "catppuccin", "tokyoNight", "rosePine", "hacker",
] as const;

for (const name of themeNames) {
  const t = themes[name];
  assert(!!t, `Theme "${name}" exists`);
  assert(!!t.accent && !!t.text && !!t.border, `Theme "${name}" has required fields`);
}

// ── Summary ────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All end-to-end headless tests passed!");
}
