/**
 * Test 04 — SaaS Landing Page
 * Tests: hero, features, pricing table, quick start, CTA
 * Theme: tokyoNight
 */
import {
  defineSite,
  page,
  card,
  table,
  list,
  hero,
  link,
  badge,
  markdown,
  ascii,
  divider,
  spacer,
  section,
  gallery,
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

import { renderHero } from "../../src/components/Hero.js";
import { renderLink } from "../../src/components/Link.js";
import { renderBadge } from "../../src/components/Badge.js";
import { renderList } from "../../src/components/List.js";
import { renderTable } from "../../src/components/Table.js";
import { stripAnsi } from "../../src/components/base.js";

// ─── SaaS Site Config ──────────────────────────────────────

const saasConfig = defineSite({
  name: "WarpSpeed",
  handle: "@warpspeed",
  tagline: "Ship Code 10x Faster",
  theme: "tokyoNight" as any,
  banner: ascii("WARPSPEED", { font: "ANSI Shadow", gradient: ["#7c3aed", "#06b6d4"] }),
  pages: [
    // ── Home Page ─────────────────────────────────────────
    page("home", {
      title: "Home",
      icon: "\u2302",
      content: [
        hero({
          title: "Ship Code 10x Faster",
          subtitle: "The developer platform that automates your CI/CD, testing, and deployments so you can focus on building.",
          cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
        }),
        divider("label", "Trusted by 10,000+ teams worldwide"),
        spacer(1),
        link("Read the Documentation", "https://docs.warpspeed.dev", { icon: "\uD83D\uDCDA" }),
        link("View on GitHub", "https://github.com/warpspeed", { icon: "\uD83D\uDCBB" }),
        spacer(1),
      ],
    }),

    // ── Features Page ─────────────────────────────────────
    page("features", {
      title: "Features",
      icon: "\u2B50",
      content: [
        section("Core Platform", [
          gallery([
            { title: "Lightning Deploys", subtitle: "Sub-second deployments", body: "Push to deploy with zero downtime. Our edge network ensures your code is live globally in milliseconds.", tags: ["deploy", "edge"] },
            { title: "Smart Testing", subtitle: "AI-powered test generation", body: "Automatically generate and run tests. Catch bugs before they reach production.", tags: ["testing", "ai"] },
            { title: "Auto Scaling", subtitle: "Scale to millions", body: "Infrastructure that grows with you. No configuration needed — we handle the load.", tags: ["scale", "infra"] },
          ]),
        ]),
        spacer(1),
        section("Developer Experience", [
          gallery([
            { title: "Live Preview", subtitle: "Instant preview URLs", body: "Every PR gets a live preview. Share with your team for fast feedback loops.", tags: ["preview", "collaboration"] },
            { title: "Edge Functions", subtitle: "Run code at the edge", body: "Deploy serverless functions to 200+ locations. Ultra-low latency for your users.", tags: ["serverless", "edge"] },
            { title: "Observability", subtitle: "Built-in monitoring", body: "Logs, metrics, and traces in one place. Debug issues in seconds, not hours.", tags: ["monitoring", "debug"] },
          ]),
        ]),
        spacer(1),
        badge("New", "#06b6d4"),
        badge("Pro", "#7c3aed"),
        badge("Enterprise", "#f59e0b"),
      ],
    }),

    // ── Pricing Page ──────────────────────────────────────
    page("pricing", {
      title: "Pricing",
      icon: "\uD83D\uDCB0",
      content: [
        hero({
          title: "Simple, Transparent Pricing",
          subtitle: "Start free. Scale as you grow. No hidden fees.",
        }),
        table(
          ["Plan", "Price", "Deploys", "Storage"],
          [
            ["Free", "$0/mo", "100/mo", "1 GB"],
            ["Pro", "$29/mo", "Unlimited", "100 GB"],
            ["Enterprise", "Custom", "Unlimited", "Unlimited"],
          ]
        ),
        spacer(1),
        link("Compare all features", "https://warpspeed.dev/pricing#compare", { icon: "\u2194" }),
        spacer(1),
      ],
    }),

    // ── Quick Start Page ──────────────────────────────────
    page("quickstart", {
      title: "Quick Start",
      icon: "\uD83D\uDE80",
      content: [
        hero({
          title: "Get Started in Minutes",
          subtitle: "Four simple steps to your first deployment.",
        }),
        list([
          "Install the CLI: npm install -g @warpspeed/cli",
          "Initialize your project: warp init",
          "Connect your repository: warp connect",
          "Deploy to production: warp deploy --prod",
        ], "number"),
        spacer(1),
        divider("solid"),
        spacer(1),
        link("Full Documentation", "https://docs.warpspeed.dev/getting-started", { icon: "\uD83D\uDCD6" }),
        link("API Reference", "https://docs.warpspeed.dev/api", { icon: "\u2699\uFE0F" }),
        spacer(1),
      ],
    }),

    // ── About Page ────────────────────────────────────────
    page("about", {
      title: "About",
      icon: "\u2139",
      content: [
        markdown(`
# About WarpSpeed

WarpSpeed was founded in 2023 with a simple mission: **make deploying software as easy as pushing code**.

We believe developers should spend their time building, not wrestling with infrastructure.
Our platform handles the complexity so you can focus on what matters — shipping great products.

## Our Values

- **Speed**: Every millisecond counts
- **Simplicity**: Complexity is the enemy of execution
- **Reliability**: Your uptime is our reputation
        `),
        spacer(1),
        divider("label", "Meet the Team"),
        spacer(1),
        gallery([
          { title: "Alex Chen", subtitle: "CEO & Co-founder", body: "Previously engineering lead at CloudScale. Passionate about developer tooling.", tags: ["leadership"] },
          { title: "Sam Rivera", subtitle: "CTO & Co-founder", body: "Former principal engineer at NetEdge. Open source contributor and systems architect.", tags: ["engineering"] },
          { title: "Jordan Park", subtitle: "VP of Product", body: "10 years building developer tools. Focused on making complex things simple.", tags: ["product"] },
        ]),
        spacer(1),
      ],
    }),
  ],
});

// ─── Run the standard site test suite ──────────────────────

const report = testSiteConfig(saasConfig.config, "SaaS Landing Page (WarpSpeed)");

// ─── Extra Tests ───────────────────────────────────────────

const extraResults: TestResult[] = [];
const extraBugs: BugReport[] = [];
const theme = (themes as any).tokyoNight ?? (themes as any).default;

// ── Test 1: Hero rendering at widths 40, 60, 80, 100 — check centering ──

const heroBlock = hero({
  title: "Ship Code 10x Faster",
  subtitle: "The developer platform that automates your CI/CD.",
  cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
});

for (const width of [40, 60, 80, 100]) {
  const ctx = createTestContext(width, theme);
  extraResults.push(assertNoThrow(() => {
    const lines = renderHero(heroBlock, ctx);
    assertLines(lines, `Hero renders at width ${width}`);

    // Check centering: title line should have leading spaces
    const titleLine = lines.find(l => stripAnsi(l).includes("Ship Code 10x Faster"));
    if (!titleLine) throw new Error("Title line not found in hero output");

    const stripped = stripAnsi(titleLine);
    const trimmed = stripped.trim();
    if (width > trimmed.length + 2) {
      // Should have some leading whitespace for centering
      const leadingSpaces = stripped.length - stripped.trimStart().length;
      if (leadingSpaces === 0) {
        throw new Error(`Hero title not centered at width ${width}: no leading whitespace`);
      }
    }
  }, `Hero centering at width ${width}`));
}

// ── Test 2: Pricing table with 4 columns at width 40 (cramped) ──

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(40, theme);
  const headers = ["Plan", "Price", "Deploys", "Storage"];
  const rows = [
    ["Free", "$0/mo", "100/mo", "1 GB"],
    ["Pro", "$29/mo", "Unlimited", "100 GB"],
    ["Enterprise", "Custom", "Unlimited", "Unlimited"],
  ];
  const lines = renderTable(headers, rows, ctx);
  if (lines.length === 0) {
    throw new Error("Pricing table rendered 0 lines at width 40");
  }

  // Check if any line overflows
  let overflows = 0;
  for (let i = 0; i < lines.length; i++) {
    const plainLen = stripAnsi(lines[i]).length;
    if (plainLen > 42) { // +2 tolerance
      overflows++;
    }
  }

  if (overflows > 0) {
    extraBugs.push({
      severity: "P2",
      category: "Layout",
      description: `Pricing table (4 cols) overflows at width 40: ${overflows} lines exceed boundary`,
      reproduction: "renderTable with 4 columns at width=40",
      component: "table",
    });
  }
}, "Pricing table at cramped width 40"));

// ── Test 3: Numbered list — all 5 styles ──

const listStyles: Array<"bullet" | "number" | "dash" | "check" | "arrow"> = ["bullet", "number", "dash", "check", "arrow"];

for (const style of listStyles) {
  extraResults.push(assertNoThrow(() => {
    const ctx = createTestContext(80, theme);
    const items = ["Step one", "Step two", "Step three", "Step four"];
    const lines = renderList(items, ctx, style);
    if (lines.length !== 4) {
      throw new Error(`List style "${style}" rendered ${lines.length} lines, expected 4`);
    }

    // Verify correct bullet character
    const firstLine = stripAnsi(lines[0]);
    switch (style) {
      case "bullet":
        if (!firstLine.includes("\u2022")) throw new Error(`Bullet style missing \u2022 character`);
        break;
      case "number":
        if (!firstLine.includes("1.")) throw new Error(`Number style missing "1." prefix`);
        break;
      case "dash":
        if (!firstLine.includes("\u2500")) throw new Error(`Dash style missing \u2500 character`);
        break;
      case "check":
        if (!firstLine.includes("\u2713")) throw new Error(`Check style missing \u2713 character`);
        break;
      case "arrow":
        if (!firstLine.includes("\u2192")) throw new Error(`Arrow style missing \u2192 character`);
        break;
    }
  }, `List style: ${style}`));
}

// ── Test 4: Badge rendering ──

const badgeTests = [
  { text: "Free", color: "#06b6d4" },
  { text: "Pro", color: "#7c3aed" },
  { text: "Enterprise", color: "#f59e0b" },
];

for (const bt of badgeTests) {
  extraResults.push(assertNoThrow(() => {
    const ctx = createTestContext(80, theme);

    // Outline style (default)
    const outlineBadge = renderBadge(bt.text, ctx, { color: bt.color, style: "outline" });
    const outlineStripped = stripAnsi(outlineBadge);
    if (!outlineStripped.includes(bt.text)) {
      throw new Error(`Outline badge missing text "${bt.text}"`);
    }
    if (!outlineStripped.includes("[") || !outlineStripped.includes("]")) {
      throw new Error(`Outline badge missing brackets for "${bt.text}"`);
    }

    // Filled style
    const filledBadge = renderBadge(bt.text, ctx, { color: bt.color, style: "filled" });
    const filledStripped = stripAnsi(filledBadge);
    if (!filledStripped.includes(bt.text)) {
      throw new Error(`Filled badge missing text "${bt.text}"`);
    }
  }, `Badge rendering: "${bt.text}"`));
}

// ── Test 5: Link rendering — focused vs unfocused ──

extraResults.push(assertNoThrow(() => {
  const ctxUnfocused = createTestContext(80, theme);
  const ctxFocused = { ...createTestContext(80, theme), focused: true };

  const unfocusedLines = renderLink("Get Started", "https://warpspeed.dev", ctxUnfocused, { focused: false });
  const focusedLines = renderLink("Get Started", "https://warpspeed.dev", ctxFocused, { focused: true });

  if (unfocusedLines.length === 0) throw new Error("Unfocused link rendered 0 lines");
  if (focusedLines.length === 0) throw new Error("Focused link rendered 0 lines");

  const unfocusedText = stripAnsi(unfocusedLines[0]);
  const focusedText = stripAnsi(focusedLines[0]);

  // Both should contain the label
  if (!unfocusedText.includes("Get Started")) throw new Error("Unfocused link missing label");
  if (!focusedText.includes("Get Started")) throw new Error("Focused link missing label");

  // Focused should have the chevron indicator
  if (!focusedText.includes("\u276F")) throw new Error("Focused link missing chevron indicator");

  // Unfocused should NOT have the chevron
  if (unfocusedText.includes("\u276F")) throw new Error("Unfocused link should not have chevron");

  // Both should contain the URL
  if (!unfocusedText.includes("warpspeed.dev")) throw new Error("Unfocused link missing URL");
  if (!focusedText.includes("warpspeed.dev")) throw new Error("Focused link missing URL");
}, "Link rendering: focused vs unfocused"));

// ── Test 6: CTA in hero ──

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, theme);
  const heroWithCTA = hero({
    title: "Ship Code 10x Faster",
    subtitle: "Automate everything.",
    cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
  });

  const lines = renderHero(heroWithCTA, ctx);

  // CTA text should be present
  const allText = lines.map(l => stripAnsi(l)).join("\n");
  if (!allText.includes("Get Started Free")) {
    throw new Error("CTA label not found in hero output");
  }

  // Hero without CTA should not contain the CTA text
  const heroNoCTA = hero({ title: "Simple Title" });
  const linesNoCTA = renderHero(heroNoCTA, ctx);
  const allTextNoCTA = linesNoCTA.map(l => stripAnsi(l)).join("\n");
  if (allTextNoCTA.includes("Get Started Free")) {
    throw new Error("CTA text appeared in hero without CTA config");
  }
}, "CTA in hero block"));

// ── Merge extra results into the report ──

const allResults = [...report.results, ...extraResults];
const allBugs = [...report.bugs, ...extraBugs];
const totalPassed = allResults.filter(r => r.passed).length;
const totalFailed = allResults.length - totalPassed;

const fullReport: TestReport = {
  project: report.project,
  total: allResults.length,
  passed: totalPassed,
  failed: totalFailed,
  results: allResults,
  bugs: allBugs,
};

// ─── Print Report ──────────────────────────────────────────

console.log(formatReport(fullReport));

// Summary
console.log(`\n${"=".repeat(60)}`);
console.log(`EXTRA TESTS SUMMARY`);
console.log(`${"=".repeat(60)}`);
console.log(`  Hero centering tests (4 widths): ${extraResults.filter(r => r.name.startsWith("Hero centering")).every(r => r.passed) ? "ALL PASSED" : "SOME FAILED"}`);
console.log(`  Pricing table cramped:           ${extraResults.find(r => r.name.includes("cramped"))?.passed ? "PASSED" : "FAILED"}`);
console.log(`  List styles (5 styles):          ${extraResults.filter(r => r.name.startsWith("List style")).every(r => r.passed) ? "ALL PASSED" : "SOME FAILED"}`);
console.log(`  Badge rendering (3 badges):      ${extraResults.filter(r => r.name.startsWith("Badge rendering")).every(r => r.passed) ? "ALL PASSED" : "SOME FAILED"}`);
console.log(`  Link focused vs unfocused:       ${extraResults.find(r => r.name.includes("focused"))?.passed ? "PASSED" : "FAILED"}`);
console.log(`  CTA in hero:                     ${extraResults.find(r => r.name.includes("CTA"))?.passed ? "PASSED" : "FAILED"}`);
console.log(`${"=".repeat(60)}`);

if (extraBugs.length > 0) {
  console.log(`\nEXTRA BUGS FOUND: ${extraBugs.length}`);
  for (const bug of extraBugs) {
    console.log(`  [${bug.severity}] ${bug.category}: ${bug.description}`);
  }
}

// Exit with non-zero if any tests failed
if (totalFailed > 0) {
  console.log(`\n>>> ${totalFailed} test(s) FAILED <<<`);
  process.exit(1);
}

console.log(`\n>>> ALL ${totalPassed} tests PASSED <<<`);
