/**
 * Quick render test for all 10 showcase sites.
 * Imports each site config, renders home page + every content page through VirtualTerminal.
 * Reports pass/fail for each.
 */
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { stripAnsi, stringWidth, type RenderContext } from "../src/components/base.js";
import { fgColor, bold, dim, italic, reset, setColorMode } from "../src/style/colors.js";
import { themes, defaultTheme } from "../src/style/theme.js";
import type { SiteConfig, PageConfig, Theme, ContentBlock } from "../src/config/types.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";

// Component renderers
import { renderText } from "../src/components/Text.js";
import { renderCard } from "../src/components/Card.js";
import { renderTimeline } from "../src/components/Timeline.js";
import { renderTable } from "../src/components/Table.js";
import { renderLink } from "../src/components/Link.js";
import { renderDivider } from "../src/components/Divider.js";
import { renderSpacer } from "../src/components/Spacer.js";
import { renderQuote } from "../src/components/Quote.js";
import { renderBadge } from "../src/components/Badge.js";
import { renderHero } from "../src/components/Hero.js";
import { renderList } from "../src/components/List.js";
import { renderProgressBar } from "../src/components/ProgressBar.js";
import { renderAccordion } from "../src/components/Accordion.js";
import { renderTabs } from "../src/components/Tabs.js";
import { renderGallery } from "../src/components/Gallery.js";
import { renderImage } from "../src/components/Image.js";
import { renderBox } from "../src/components/Box.js";

setColorMode("256");

function resolveTheme(t?: any): Theme {
  if (!t) return defaultTheme;
  if (typeof t === "string") return (themes as any)[t] ?? defaultTheme;
  return t as Theme;
}

function renderBlock(block: ContentBlock, ctx: RenderContext): string[] {
  switch (block.type) {
    case "text": return renderText(block.content, ctx, block.style);
    case "card": return renderCard(block, ctx);
    case "timeline": return renderTimeline(block.items, ctx, block.style);
    case "table": return renderTable(block.headers, block.rows, ctx);
    case "list": return renderList(block.items, ctx, block.style);
    case "quote": return renderQuote(block.text, ctx, { attribution: block.attribution, style: block.style });
    case "hero": return renderHero(block, ctx);
    case "link": return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "progressBar": return renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent });
    case "badge": return [renderBadge(block.text, ctx, { color: block.color, style: block.style })];
    case "divider": return renderDivider(ctx, { style: block.style, label: block.label, color: block.color });
    case "spacer": return renderSpacer(block.lines);
    case "accordion": return renderAccordion(block.items, 0, ctx, (blocks, c) => {
      const lines: string[] = [];
      for (const b of blocks) lines.push(...renderBlock(b, c));
      return lines;
    });
    case "tabs": return renderTabs(block.items, 0, ctx, (blocks, c) => {
      const lines: string[] = [];
      for (const b of blocks) lines.push(...renderBlock(b, c));
      return lines;
    });
    case "section": {
      const lines: string[] = [];
      lines.push(fgColor(ctx.theme.accent) + bold + "  " + block.title + reset);
      lines.push(fgColor(ctx.theme.border) + "  " + "\u2500".repeat(Math.max(0, ctx.width - 4)) + reset);
      lines.push("");
      for (const b of block.content) { lines.push(...renderBlock(b, ctx)); lines.push(""); }
      return lines;
    }
    case "custom": return block.render(ctx.width, ctx.theme);
    default: return [];
  }
}

async function testSite(name: string, configPath: string): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function check(label: string, fn: () => void) {
    try { fn(); passed++; } catch (e: any) { failed++; errors.push(`${label}: ${e.message}`); }
  }

  let config: SiteConfig;
  try {
    const mod = await import(configPath);
    config = mod.default?.config ?? mod.default;
    if (!config || !config.pages) throw new Error("No valid config");
  } catch (e: any) {
    return { passed: 0, failed: 1, errors: [`Import failed: ${e.message}`] };
  }

  const theme = resolveTheme(config.theme);
  const cols = 80;

  // Test home page render
  check(`${name}: home renders`, () => {
    const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
    const menuItems: MenuItem[] = config.pages.map(p => ({ label: p.title, icon: p.icon, id: p.id }));
    const lines = renderMenu(menuItems, 0, ctx);
    if (lines.length === 0) throw new Error("Menu rendered 0 lines");
  });

  // Test banner
  if (config.banner) {
    check(`${name}: banner renders`, () => {
      const lines = renderBanner(config.banner!.text, { font: config.banner!.font, width: cols - 4 });
      if (lines.length === 0) throw new Error("Banner rendered 0 lines");
    });
  }

  // Test each page
  for (const pg of config.pages) {
    check(`${name}: page "${pg.title}" renders`, () => {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      for (const block of pg.content) {
        const lines = renderBlock(block, ctx);
        // Custom blocks can return empty for valid reasons
      }
    });

    // Check for error strings
    check(`${name}: page "${pg.title}" no errors`, () => {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      const vt = new VirtualTerminal(cols, 200);
      vt.write("\x1b[2J\x1b[H");
      let row = 0;
      for (const block of pg.content) {
        const lines = renderBlock(block, ctx);
        for (const l of lines) {
          vt.write(`\x1b[${++row};1H\x1b[2K${l}`);
        }
      }
      const text = vt.text();
      for (const bad of ["undefined", "[object Object]", "NaN", "TypeError"]) {
        if (text.includes(bad)) throw new Error(`"${bad}" found on page "${pg.title}"`);
      }
    });
  }

  return { passed, failed, errors };
}

async function main() {
  const sites = [
    ["Developer Portfolio", "./developer-portfolio/site.config.ts"],
    ["Restaurant", "./restaurant/site.config.ts"],
    ["Startup Landing", "./startup-landing/site.config.ts"],
    ["Band", "./band/site.config.ts"],
    ["Coffee Shop", "./coffee-shop/site.config.ts"],
    ["Conference", "./conference/site.config.ts"],
    ["Freelancer", "./freelancer/site.config.ts"],
    ["Podcast", "./podcast/site.config.ts"],
    ["Docs Site", "./docs-site/site.config.ts"],
    ["Art Gallery", "./art-gallery/site.config.ts"],
  ];

  console.log("\n  Showcase Site Tests\n  " + "─".repeat(40) + "\n");

  let totalP = 0, totalF = 0;

  for (const [name, path] of sites) {
    const result = await testSite(name, path);
    totalP += result.passed;
    totalF += result.failed;
    const icon = result.failed === 0 ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${icon} ${name}: ${result.passed} passed, ${result.failed} failed`);
    for (const e of result.errors) {
      console.log(`      \x1b[31m${e}\x1b[0m`);
    }
  }

  console.log(`\n  ${"─".repeat(40)}`);
  console.log(`  Total: ${totalP} passed, ${totalF} failed\n`);

  if (totalF > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
