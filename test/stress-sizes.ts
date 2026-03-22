/**
 * Terminal Size Stress Test
 *
 * Renders a complete site config at various terminal widths to verify
 * the framework never crashes and content stays within bounds.
 *
 * Run: npx tsx test/stress-sizes.ts
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
  link,
  skillBar,
  section,
  markdown,
  divider,
  ascii,
} from "../src/config/parser.js";
import { themes } from "../src/style/theme.js";

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
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { TUIRuntime } from "../src/core/runtime.js";
import type { ContentBlock } from "../src/config/types.js";

// ─── Test Site Config ──────────────────────────────────────

const testSiteConfig = {
  name: "Stress Test Portfolio",
  handle: "@stresstest",
  tagline: "Testing every width from tiny to ultra-wide",
  banner: ascii("STRESS", { font: "ANSI Shadow", gradient: ["#ff79c6", "#bd93f9"] }),
  theme: "dracula" as const,
  borders: "rounded" as const,
  pages: [
    page("about", {
      title: "About Me",
      icon: "\u{1F464}",
      content: [
        markdown(`
This is a **stress test** for the terminaltui framework.

It verifies that components render correctly at *various terminal widths*,
from extremely narrow (10 columns) to ultra-wide (200 columns).

Each component should gracefully handle truncation, wrapping, and edge
cases without crashing or producing lines that exceed the target width.
        `),
        divider("solid"),
        quote("The best way to find bugs is to push the boundaries.", "QA Engineer"),
        list(["Narrow terminals", "Standard terminals", "Wide terminals", "Ultra-wide monitors"], "check"),
        table(["Metric", "Value", "Status"], [
          ["Min Width", "10", "Tested"],
          ["Max Width", "200", "Tested"],
          ["Components", "12+", "All"],
        ]),
        skillBar("Resilience", 95),
        skillBar("Flexibility", 88),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: "\u{1F4BB}",
      content: [
        card({
          title: "Project Alpha",
          subtitle: "v2.0",
          body: "A comprehensive project that tests card rendering with long body text that should wrap properly at narrow widths and fill gracefully at wider widths.",
          tags: ["typescript", "terminal", "tui", "stress-test"],
        }),
        card({
          title: "Project Beta with a Particularly Long Title That Might Overflow",
          subtitle: "Released 2025",
          body: "Short body.",
          tags: ["rust", "systems"],
        }),
        card({
          title: "Tiny",
          body: "Minimal card to test small content in big containers.",
          tags: ["minimal"],
        }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "\u{1F4BC}",
      content: [
        section("Work History", [
          timeline([
            {
              title: "Senior Software Engineer",
              subtitle: "MegaCorp International Technologies Ltd.",
              period: "2023 - Present",
              description: "Leading the development of terminal-based user interfaces with a focus on responsive rendering across all terminal sizes and configurations.",
            },
            {
              title: "Full Stack Developer",
              subtitle: "StartupCo",
              period: "2020 - 2023",
              description: "Built web and CLI tools.",
            },
            {
              title: "Junior Developer with an Extremely Long Job Title That Tests Truncation",
              subtitle: "Another Company With a Very Long Name Indeed",
              period: "2018 - 2020",
              description: "Learned the ropes of software development while working on various internal tools and customer-facing applications.",
            },
          ]),
        ]),
        divider("label", "Skills"),
        skillBar("TypeScript", 92),
        skillBar("Rust", 78),
        skillBar("Go", 65),
        hero({
          title: "Building the Future of TUI",
          subtitle: "One pixel character at a time",
        }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "\u{1F517}",
      content: [
        link("GitHub", "https://github.com/username/very-long-repository-name-for-testing", { icon: "\u{1F4E6}" }),
        link("LinkedIn", "https://linkedin.com/in/username"),
        link("Personal Website with a Really Long Label", "https://example.com"),
        divider(),
        quote("Connect with me anywhere!", "Social"),
      ],
    }),
  ],
};

// ─── Block Renderer (standalone, mirrors harness.ts) ───────

function renderBlock(block: ContentBlock, ctx: RenderContext): string[] {
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
    case "link":
      return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "progressBar":
      return renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent });
    case "badge":
      return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];
    case "divider":
      return renderDivider(ctx, { style: block.style, label: block.label, color: block.color });
    case "spacer":
      return renderSpacer(block.lines);
    case "section": {
      const lines: string[] = [];
      lines.push(`  ${block.title}`);
      lines.push("  " + "\u2500".repeat(Math.max(0, ctx.width - 4)));
      for (const b of block.content) lines.push(...renderBlock(b, ctx));
      return lines;
    }
    default:
      return [];
  }
}

// ─── Main Stress Test ──────────────────────────────────────

const WIDTHS = [10, 15, 20, 25, 30, 35, 40, 50, 60, 80, 100, 120, 160, 200];
const TOLERANCE = 2; // allowed overflow in characters

interface WidthReport {
  width: number;
  componentsRendered: number;
  overflowLines: number;
  overflowDetails: string[];
  crashes: string[];
  runtimeCrashes: string[];
}

function run(): void {
  console.log("=".repeat(70));
  console.log("  TERMINAL SIZE STRESS TEST");
  console.log("  Framework: terminaltui");
  console.log("  Widths tested: " + WIDTHS.join(", "));
  console.log("=".repeat(70));
  console.log();

  // Step 1: Parse site config
  let site;
  try {
    site = defineSite(testSiteConfig);
    console.log("[OK] Site config parsed successfully");
  } catch (err: any) {
    console.log("[CRASH] Site config failed to parse: " + err.message);
    process.exit(1);
  }

  const theme = themes.dracula;
  const reports: WidthReport[] = [];

  for (const width of WIDTHS) {
    const report: WidthReport = {
      width,
      componentsRendered: 0,
      overflowLines: 0,
      overflowDetails: [],
      crashes: [],
      runtimeCrashes: [],
    };

    const ctx: RenderContext = {
      width,
      theme,
      borderStyle: "rounded",
    };

    console.log(`\n${"─".repeat(70)}`);
    console.log(`  WIDTH = ${width}`);
    console.log(`${"─".repeat(70)}`);

    // ── 1. Banner ──────────────────────────────────────────

    try {
      const bannerLines = renderBanner(testSiteConfig.banner.text, {
        font: testSiteConfig.banner.font,
      });
      const centered = centerBanner(bannerLines, width);
      const withGradient = testSiteConfig.banner.gradient
        ? gradientLines(centered, testSiteConfig.banner.gradient)
        : centered;

      report.componentsRendered++;

      for (let i = 0; i < withGradient.length; i++) {
        const plainLen = stripAnsi(withGradient[i]).length;
        if (plainLen > width + TOLERANCE) {
          report.overflowLines++;
          report.overflowDetails.push(
            `Banner line ${i}: ${plainLen} chars (max ${width + TOLERANCE})`
          );
        }
      }
      console.log(`  [OK] Banner: ${withGradient.length} lines`);
    } catch (err: any) {
      report.crashes.push(`Banner: ${err.message}`);
      console.log(`  [CRASH] Banner: ${err.message}`);
    }

    // ── 2. Menu ────────────────────────────────────────────

    try {
      const menuItems: MenuItem[] = testSiteConfig.pages.map(p => ({
        label: p.title,
        icon: p.icon,
        id: p.id,
      }));

      for (let selIdx = 0; selIdx < menuItems.length; selIdx++) {
        const menuLines = renderMenu(menuItems, selIdx, ctx);
        report.componentsRendered++;

        for (let i = 0; i < menuLines.length; i++) {
          const plainLen = stripAnsi(menuLines[i]).length;
          if (plainLen > width + TOLERANCE) {
            report.overflowLines++;
            report.overflowDetails.push(
              `Menu (sel=${selIdx}) line ${i}: ${plainLen} chars (max ${width + TOLERANCE})`
            );
          }
        }
      }
      console.log(`  [OK] Menu: ${menuItems.length} selection states tested`);
    } catch (err: any) {
      report.crashes.push(`Menu: ${err.message}`);
      console.log(`  [CRASH] Menu: ${err.message}`);
    }

    // ── 3. Every content block on every page ───────────────

    for (const pg of testSiteConfig.pages) {
      for (const block of pg.content) {
        const blockLabel = `${block.type} on "${pg.id}"`;
        try {
          const lines = renderBlock(block, ctx);
          report.componentsRendered++;

          for (let i = 0; i < lines.length; i++) {
            const plainLen = stripAnsi(lines[i]).length;
            if (plainLen > width + TOLERANCE) {
              report.overflowLines++;
              report.overflowDetails.push(
                `${blockLabel} line ${i}: ${plainLen} chars (max ${width + TOLERANCE}), text: "${stripAnsi(lines[i]).substring(0, 50)}..."`
              );
            }
          }

          console.log(`  [OK] ${blockLabel}: ${lines.length} lines`);
        } catch (err: any) {
          report.crashes.push(`${blockLabel}: ${err.message}`);
          console.log(`  [CRASH] ${blockLabel}: ${err.message}`);
        }
      }
    }

    // ── 4. Full rendering pipeline via TUIRuntime ──────────

    try {
      const runtime = new TUIRuntime(site);

      for (const pg of testSiteConfig.pages) {
        try {
          const lines = runtime.renderContentBlocks(pg.content, ctx);
          report.componentsRendered++;

          for (let i = 0; i < lines.length; i++) {
            const plainLen = stripAnsi(lines[i]).length;
            if (plainLen > width + TOLERANCE) {
              report.overflowLines++;
              report.overflowDetails.push(
                `Runtime "${pg.id}" line ${i}: ${plainLen} chars (max ${width + TOLERANCE})`
              );
            }
          }

          console.log(`  [OK] Runtime renderContentBlocks("${pg.id}"): ${lines.length} lines`);
        } catch (err: any) {
          report.runtimeCrashes.push(`Runtime "${pg.id}": ${err.message}`);
          console.log(`  [CRASH] Runtime renderContentBlocks("${pg.id}"): ${err.message}`);
        }
      }
    } catch (err: any) {
      report.runtimeCrashes.push(`TUIRuntime constructor: ${err.message}`);
      console.log(`  [CRASH] TUIRuntime constructor: ${err.message}`);
    }

    // ── Width summary ──────────────────────────────────────

    const totalCrashes = report.crashes.length + report.runtimeCrashes.length;
    const status = totalCrashes > 0
      ? "CRASHES"
      : report.overflowLines > 0
        ? "OVERFLOWS"
        : "CLEAN";

    console.log();
    console.log(`  Summary: ${report.componentsRendered} components, ${report.overflowLines} overflow lines, ${totalCrashes} crashes => ${status}`);

    if (report.overflowDetails.length > 0) {
      console.log(`  Overflow details (first 10):`);
      for (const detail of report.overflowDetails.slice(0, 10)) {
        console.log(`    - ${detail}`);
      }
      if (report.overflowDetails.length > 10) {
        console.log(`    ... and ${report.overflowDetails.length - 10} more`);
      }
    }

    reports.push(report);
  }

  // ─── Final Summary ────────────────────────────────────────

  console.log();
  console.log("=".repeat(70));
  console.log("  FINAL SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const cleanWidths: number[] = [];
  const overflowWidths: { width: number; count: number }[] = [];
  const crashWidths: { width: number; crashes: string[] }[] = [];

  for (const r of reports) {
    const totalCrashes = r.crashes.length + r.runtimeCrashes.length;
    if (totalCrashes > 0) {
      crashWidths.push({ width: r.width, crashes: [...r.crashes, ...r.runtimeCrashes] });
    } else if (r.overflowLines > 0) {
      overflowWidths.push({ width: r.width, count: r.overflowLines });
    } else {
      cleanWidths.push(r.width);
    }
  }

  // Table of results
  console.log("  Width  | Components | Overflows | Crashes | Status");
  console.log("  " + "-".repeat(56));
  for (const r of reports) {
    const totalCrashes = r.crashes.length + r.runtimeCrashes.length;
    const status = totalCrashes > 0 ? "CRASH" : r.overflowLines > 0 ? "OVERFLOW" : "CLEAN";
    const widthStr = String(r.width).padStart(5);
    const compStr = String(r.componentsRendered).padStart(10);
    const overStr = String(r.overflowLines).padStart(9);
    const crashStr = String(totalCrashes).padStart(7);
    console.log(`  ${widthStr}  |${compStr} |${overStr} |${crashStr} | ${status}`);
  }

  console.log();

  if (cleanWidths.length > 0) {
    console.log(`  CLEAN widths (${cleanWidths.length}): ${cleanWidths.join(", ")}`);
  }
  if (overflowWidths.length > 0) {
    console.log(`  OVERFLOW widths (${overflowWidths.length}):`);
    for (const ow of overflowWidths) {
      console.log(`    width=${ow.width}: ${ow.count} overflow lines`);
    }
  }
  if (crashWidths.length > 0) {
    console.log(`  CRASH widths (${crashWidths.length}):`);
    for (const cw of crashWidths) {
      console.log(`    width=${cw.width}:`);
      for (const crash of cw.crashes) {
        console.log(`      - ${crash}`);
      }
    }
  }

  console.log();

  const totalComponents = reports.reduce((s, r) => s + r.componentsRendered, 0);
  const totalOverflows = reports.reduce((s, r) => s + r.overflowLines, 0);
  const totalCrashCount = reports.reduce((s, r) => s + r.crashes.length + r.runtimeCrashes.length, 0);

  console.log(`  Total: ${totalComponents} component renders across ${WIDTHS.length} widths`);
  console.log(`  Total overflows: ${totalOverflows}`);
  console.log(`  Total crashes: ${totalCrashCount}`);
  console.log();

  if (totalCrashCount > 0) {
    console.log("  RESULT: FAIL (crashes detected)");
    process.exit(1);
  } else if (totalOverflows > 0) {
    console.log("  RESULT: WARN (overflows detected but no crashes)");
    process.exit(0);
  } else {
    console.log("  RESULT: PASS (all clean)");
    process.exit(0);
  }
}

run();
