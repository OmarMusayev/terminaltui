/**
 * Test 07 — Corporate / Company Site
 *
 * Pages: Home (hero), Team (gallery of 8 cards), Services (6 cards w/ badges),
 *        Clients (table), Contact (links).
 * Theme: catppuccin | Banner font: Calvin S
 */
import {
  defineSite,
  page,
  card,
  table,
  hero,
  gallery,
  link,
  badge,
  divider,
  spacer,
  section,
  themes,
  testSiteConfig,
  formatReport,
  createTestContext,
  assertNoThrow,
  assertLines,
  assertLinesNonEmpty,
  assertNoOverflow,
  renderBlock,
  type TestResult,
  type TestReport,
  type BugReport,
  type SiteConfig,
} from "../harness.js";

import { renderBanner } from "../../src/ascii/banner.js";
import { renderHero } from "../../src/components/Hero.js";
import { renderGallery } from "../../src/components/Gallery.js";
import { renderTable } from "../../src/components/Table.js";
import { renderCard } from "../../src/components/Card.js";
import { renderBadge } from "../../src/components/Badge.js";
import { stripAnsi } from "../../src/components/base.js";

// ─── Theme ──────────────────────────────────────────────────
const theme = (themes as any)["catppuccin"];

// ─── Team Members ───────────────────────────────────────────
const teamMembers = [
  { name: "Alex Chen", role: "CEO", bio: "Visionary leader with 20 years in enterprise tech. Scaled three startups to IPO." },
  { name: "Maria Santos", role: "CTO", bio: "Former Google engineer. PhD in distributed systems. Open-source advocate." },
  { name: "James Wright", role: "CFO", bio: "Ex-Goldman Sachs VP. Led $500M+ fundraising rounds across fintech." },
  { name: "Priya Patel", role: "VP Engineering", bio: "Built engineering teams from 5 to 200. Believer in servant leadership." },
  { name: "Omar Khalil", role: "VP Design", bio: "Award-winning designer. Previously led design at Stripe and Figma." },
  { name: "Lisa Tanaka", role: "VP Sales", bio: "Enterprise sales expert. Closed deals with 80% of Fortune 100 companies." },
  { name: "David Kim", role: "VP Marketing", bio: "Growth hacker turned brand strategist. Drove 10x ARR at previous role." },
  { name: "Sophie Andersen", role: "Head of People", bio: "Championed remote-first culture. Built world-class talent pipelines." },
];

const teamCards = teamMembers.map(m =>
  card({ title: m.name, subtitle: m.role, body: m.bio })
);

// ─── Services ───────────────────────────────────────────────
const services = [
  { name: "Cloud Migration", desc: "Seamless transition to modern cloud infrastructure with zero downtime.", badges: ["AWS", "Azure", "GCP"] },
  { name: "Data Analytics", desc: "Unlock insights from your data with real-time dashboards and predictive models.", badges: ["AI/ML", "BigQuery"] },
  { name: "Cybersecurity", desc: "End-to-end security audits, penetration testing, and SOC-2 compliance.", badges: ["SOC-2", "ISO 27001"] },
  { name: "DevOps", desc: "CI/CD pipelines, infrastructure as code, and container orchestration.", badges: ["Kubernetes", "Terraform"] },
  { name: "Custom Software", desc: "Bespoke applications tailored to your unique business workflows.", badges: ["Agile", "Full-Stack"] },
  { name: "Consulting", desc: "Strategic technology advisory for digital transformation initiatives.", badges: ["Strategy", "Roadmap"] },
];

const serviceCards = services.map(s =>
  card({ title: s.name, body: s.desc, tags: s.badges })
);

// ─── Clients Table ──────────────────────────────────────────
const clientHeaders = ["Company", "Industry", "Since"];
const clientRows = [
  ["Nexus Corp", "Financial Services", "2019"],
  ["HealthFirst", "Healthcare", "2020"],
  ["GreenLeaf Energy", "Renewable Energy", "2018"],
  ["TechNova Inc", "SaaS / Cloud", "2021"],
  ["Pinnacle Retail", "E-Commerce", "2020"],
  ["Atlas Logistics", "Supply Chain", "2017"],
];

// ─── Site Config ────────────────────────────────────────────
const config: SiteConfig = {
  name: "Apex Solutions",
  tagline: "Enterprise solutions for modern teams",
  banner: {
    text: "APEX",
    font: "Calvin S",
  },
  theme: "catppuccin" as any,
  pages: [
    page("home", {
      title: "Home",
      icon: "\u2302",
      content: [
        hero({
          title: "Apex Solutions",
          subtitle: "Enterprise solutions for modern teams",
          cta: { label: "Get Started", url: "https://apex.example.com/start" },
        }),
        divider("solid"),
        spacer(1),
      ],
    }),
    page("team", {
      title: "Team",
      icon: "\u263A",
      content: [
        section("Leadership Team", [
          gallery(teamMembers.map(m => ({ title: m.name, subtitle: m.role, body: m.bio }))),
        ]),
      ],
    }),
    page("services", {
      title: "Services",
      icon: "\u2699",
      content: [
        section("Our Services", [
          ...serviceCards,
          spacer(1),
          badge("Enterprise Ready", "green"),
          badge("24/7 Support", "blue"),
          badge("99.9% SLA", "yellow"),
        ]),
      ],
    }),
    page("clients", {
      title: "Clients",
      icon: "\u2605",
      content: [
        section("Our Clients", [
          table(clientHeaders, clientRows),
        ]),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "\u2709",
      content: [
        link("Website", "https://apex.example.com", { icon: "\u{1F310}" }),
        link("Email", "mailto:hello@apex.example.com", { icon: "\u2709" }),
        link("LinkedIn", "https://linkedin.com/company/apex", { icon: "\u{1F517}" }),
        link("GitHub", "https://github.com/apex-solutions", { icon: "\u{1F4BB}" }),
        link("Phone", "tel:+1-555-0100", { icon: "\u260E" }),
      ],
    }),
  ],
};

// ─── Run Standard Site Tests ────────────────────────────────
const report = testSiteConfig(config, "Corporate Site (test-07)");
const extraResults: TestResult[] = [];
const extraBugs: BugReport[] = [];

// ─── Helper ─────────────────────────────────────────────────
function runExtra(name: string, fn: () => void): void {
  const r = assertNoThrow(fn, name);
  extraResults.push(r);
}

// ═══════════════════════════════════════════════════════════
// EXTRA TESTS
// ═══════════════════════════════════════════════════════════

// --- 1. Gallery with 8 cards at various widths ---------------
const galleryItems = teamMembers.map(m => ({
  type: "card" as const,
  title: m.name,
  subtitle: m.role,
  body: m.bio,
}));

for (const w of [40, 60, 80, 100, 120]) {
  runExtra(`Gallery (8 cards) at width ${w}`, () => {
    const ctx = createTestContext(w, theme);
    const lines = renderGallery(galleryItems, ctx);
    assertLines(lines, `gallery w=${w}`);
    const overflowResult = assertNoOverflow(lines, w, `gallery overflow w=${w}`);
    if (!overflowResult.passed) {
      extraBugs.push({
        severity: "P2",
        category: "Layout",
        description: overflowResult.error!,
        reproduction: `renderGallery with 8 cards, width=${w}`,
        component: "Gallery",
      });
    }
  });
}

// --- 2. Gallery columns = 1, 2, 3, 4 -------------------------
for (const cols of [1, 2, 3, 4]) {
  runExtra(`Gallery columns=${cols}`, () => {
    const ctx = createTestContext(100, theme);
    const lines = renderGallery(galleryItems, ctx, { columns: cols });
    assertLines(lines, `gallery cols=${cols}`);
    // Verify the scroll indicator shows the right total
    const lastLine = stripAnsi(lines[lines.length - 1]);
    if (galleryItems.length > cols) {
      if (!lastLine.includes(`of ${galleryItems.length}`)) {
        throw new Error(`Scroll indicator missing or wrong: "${lastLine.trim()}"`);
      }
    }
  });
}

// --- 3. Table at cramped (40) and spacious (100) widths ------
runExtra("Table 3-col at width 40 (cramped)", () => {
  const ctx = createTestContext(40, theme);
  const lines = renderTable(clientHeaders, clientRows, ctx);
  assertLinesNonEmpty(lines, "table w=40");
  // Should have header + 6 data rows + borders = at least 10 lines
  if (lines.length < 10) {
    throw new Error(`Expected >=10 lines, got ${lines.length}`);
  }
  const overflowResult = assertNoOverflow(lines, 40, "table overflow w=40");
  if (!overflowResult.passed) {
    extraBugs.push({
      severity: "P2",
      category: "Layout",
      description: overflowResult.error!,
      reproduction: "renderTable with 3 cols at width 40",
      component: "Table",
    });
  }
});

runExtra("Table 3-col at width 100 (spacious)", () => {
  const ctx = createTestContext(100, theme);
  const lines = renderTable(clientHeaders, clientRows, ctx);
  assertLinesNonEmpty(lines, "table w=100");
  if (lines.length < 10) {
    throw new Error(`Expected >=10 lines, got ${lines.length}`);
  }
});

// --- 4. Hero centering at odd and even widths ----------------
for (const w of [39, 40, 79, 80]) {
  runExtra(`Hero centering at width ${w}`, () => {
    const ctx = createTestContext(w, theme);
    const heroBlock = {
      title: "Apex Solutions",
      subtitle: "Enterprise solutions for modern teams",
      cta: { label: "Get Started", url: "#" },
    };
    const lines = renderHero(heroBlock, ctx);
    assertLinesNonEmpty(lines, `hero w=${w}`);

    // Check title centering: leading whitespace should be roughly (w - textLen) / 2
    for (const line of lines) {
      const plain = stripAnsi(line);
      const trimmed = plain.trim();
      if (trimmed.length === 0) continue;
      const leftPad = plain.length - plain.trimStart().length;
      const rightPad = plain.length - plain.trimEnd().length;
      // Centering: leftPad and rightPad should differ by at most 1
      const diff = Math.abs(leftPad - rightPad);
      if (diff > 1 && leftPad > 0 && rightPad > 0) {
        throw new Error(
          `Centering off at width ${w}: leftPad=${leftPad}, rightPad=${rightPad}, diff=${diff}, text="${trimmed.substring(0, 30)}"`
        );
      }
    }
  });
}

// --- 5. Card with very long body text at width 40 ------------
runExtra("Card with 200+ char body at width 40", () => {
  const longBody =
    "This is an extremely long body text that is designed to test how the card component handles text wrapping " +
    "when the available width is severely constrained. It should wrap gracefully without any overflow or truncation " +
    "issues, preserving readability and maintaining consistent visual structure within the card borders.";
  // longBody is ~300 chars
  if (longBody.length < 200) throw new Error("Body text not long enough for test");

  const ctx = createTestContext(40, theme);
  const lines = renderCard(
    { type: "card", title: "Long Card", body: longBody },
    ctx
  );
  assertLinesNonEmpty(lines, "long-card w=40");

  const overflowResult = assertNoOverflow(lines, 40, "long-card overflow w=40");
  if (!overflowResult.passed) {
    extraBugs.push({
      severity: "P2",
      category: "Layout",
      description: overflowResult.error!,
      reproduction: "renderCard with 300-char body at width 40",
      component: "Card",
    });
  }

  // Body text must have wrapped into multiple lines (at least 5 for ~300 chars in 36-char inner)
  if (lines.length < 7) {
    throw new Error(`Expected heavy wrapping (>=7 lines) but got ${lines.length}`);
  }
});

// --- 6. Calvin S font banner — verify A-Z ---------------------
runExtra("Calvin S banner renders A-Z", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of alphabet) {
    const lines = renderBanner(ch, { font: "Calvin S" });
    if (lines.length === 0) {
      throw new Error(`Calvin S font missing character: ${ch}`);
    }
    const hasContent = lines.some(l => l.trim().length > 0);
    if (!hasContent) {
      throw new Error(`Calvin S character '${ch}' rendered as all-blank`);
    }
  }

  // Full word test
  const fullBanner = renderBanner("APEX", { font: "Calvin S" });
  if (fullBanner.length === 0) {
    throw new Error("Calvin S banner for 'APEX' rendered 0 lines");
  }
  const fullContent = fullBanner.some(l => l.trim().length > 0);
  if (!fullContent) {
    throw new Error("Calvin S banner for 'APEX' is all-blank");
  }
});

runExtra("Calvin S banner full alphabet coherence", () => {
  const lines = renderBanner("ABCDEFGHIJKLMNOPQRSTUVWXYZ", { font: "Calvin S" });
  // Calvin S height is 5, so we expect exactly 5 lines
  if (lines.length !== 5) {
    throw new Error(`Expected 5 lines from Calvin S, got ${lines.length}`);
  }
  // Each line should have some content
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === undefined) {
      throw new Error(`Calvin S line ${i} is undefined`);
    }
  }
});

// --- 7. Badge component with 5 different colors ---------------
const badgeColors = ["red", "green", "blue", "yellow", "magenta"];
for (const color of badgeColors) {
  runExtra(`Badge color=${color}`, () => {
    const ctx = createTestContext(80, theme);
    const result = renderBadge("TestBadge", ctx, { color });
    if (!result || result.length === 0) {
      throw new Error(`Badge with color ${color} returned empty`);
    }
    const plain = stripAnsi(result);
    if (!plain.includes("TestBadge")) {
      throw new Error(`Badge text not found in output: "${plain}"`);
    }
  });
}

// Badge filled vs outline
runExtra("Badge filled style", () => {
  const ctx = createTestContext(80, theme);
  const filled = renderBadge("Premium", ctx, { color: "gold", style: "filled" });
  const outline = renderBadge("Premium", ctx, { color: "gold", style: "outline" });
  if (filled === outline) {
    throw new Error("Filled and outline badges should differ");
  }
  const filledPlain = stripAnsi(filled);
  const outlinePlain = stripAnsi(outline);
  if (!filledPlain.includes("Premium")) throw new Error("Filled badge missing text");
  if (!outlinePlain.includes("Premium")) throw new Error("Outline badge missing text");
});

// ═══════════════════════════════════════════════════════════
// MERGE AND PRINT REPORT
// ═══════════════════════════════════════════════════════════
const merged: TestReport = {
  project: report.project,
  total: report.total + extraResults.length,
  passed: report.passed + extraResults.filter(r => r.passed).length,
  failed: report.failed + extraResults.filter(r => !r.passed).length,
  results: [...report.results, ...extraResults],
  bugs: [...report.bugs, ...extraBugs],
};

console.log(formatReport(merged));
console.log(`\n${"═".repeat(60)}`);
console.log(`SUMMARY: ${merged.passed}/${merged.total} passed, ${merged.failed} failed, ${merged.bugs.length} bugs`);
console.log(`${"═".repeat(60)}`);
