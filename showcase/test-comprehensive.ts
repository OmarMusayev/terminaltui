/**
 * Comprehensive test of all 10 showcase sites.
 * Tests: banner, every page, keyboard nav, resize, edge cases.
 */
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { ScreenReader } from "../src/emulator/screen-reader.js";
import { Assertions } from "../src/emulator/assertions.js";
import { renderMenu, type MenuItem } from "../src/components/Menu.js";
import { renderBanner, centerBanner } from "../src/ascii/banner.js";
import { gradientLines } from "../src/style/gradient.js";
import { stripAnsi, stringWidth, type RenderContext } from "../src/components/base.js";
import { fgColor, bold, dim, italic, reset, setColorMode } from "../src/style/colors.js";
import { themes, defaultTheme } from "../src/style/theme.js";
import type { SiteConfig, PageConfig, Theme, ContentBlock } from "../src/config/types.js";
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
import { Router } from "../src/navigation/router.js";
import { FocusManager } from "../src/navigation/focus.js";
import { keyToAction } from "../src/navigation/keybindings.js";
import type { KeyPress } from "../src/core/input.js";

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
    case "accordion": return renderAccordion(block.items, 0, ctx, (blocks, c) => { const r: string[] = []; for (const b of blocks) r.push(...renderBlock(b, c)); return r; });
    case "tabs": return renderTabs(block.items, 0, ctx, (blocks, c) => { const r: string[] = []; for (const b of blocks) r.push(...renderBlock(b, c)); return r; });
    case "section": { const r: string[] = [fgColor(ctx.theme.accent)+bold+"  "+block.title+reset, "  "+"─".repeat(Math.max(0,ctx.width-4)), ""]; for (const b of block.content) { r.push(...renderBlock(b, ctx)); r.push(""); } return r; }
    case "custom": return block.render(ctx.width, ctx.theme);
    default: return [];
  }
}

function writeToVterm(vt: VirtualTerminal, lines: string[]): void {
  for (let i = 0; i < Math.min(lines.length, vt.rows); i++) {
    vt.write(`\x1b[${i+1};1H\x1b[2K${lines[i]}`);
  }
}

interface SiteResult {
  name: string;
  pages: number;
  tests: number;
  passed: number;
  failed: number;
  bannerAligned: boolean;
  errors: string[];
}

async function testSite(name: string, path: string): Promise<SiteResult> {
  const result: SiteResult = { name, pages: 0, tests: 0, passed: 0, failed: 0, bannerAligned: true, errors: [] };
  
  function check(label: string, fn: () => void) {
    result.tests++;
    try { fn(); result.passed++; } catch (e: any) { result.failed++; result.errors.push(`${label}: ${e.message}`); }
  }

  let config: SiteConfig;
  try {
    const mod = await import(path);
    config = mod.default?.config ?? mod.default;
    if (!config?.pages) throw new Error("No valid config");
  } catch (e: any) {
    return { ...result, tests: 1, failed: 1, errors: [`Import: ${e.message}`] };
  }

  const theme = resolveTheme(config.theme);
  result.pages = config.pages.length;

  // ── BANNER TESTS ──
  if (config.banner) {
    check(`${name}: banner renders`, () => {
      const lines = renderBanner(config.banner!.text, { font: config.banner!.font });
      if (lines.length === 0) throw new Error("No output");
    });

    check(`${name}: banner aligned`, () => {
      const lines = renderBanner(config.banner!.text, { font: config.banner!.font });
      // Check column alignment: render first char alone, verify it matches as prefix of first two chars
      const text = config.banner!.text.toUpperCase();
      if (text.length >= 2) {
        const a = renderBanner(text[0], { font: config.banner!.font });
        const ab = renderBanner(text.slice(0,2), { font: config.banner!.font });
        const maxW = Math.max(0, ...a.map(l => l.length));
        for (let r = 0; r < Math.min(a.length, ab.length); r++) {
          const aRow = a[r] + " ".repeat(Math.max(0, maxW - a[r].length));
          const abPre = ab[r].substring(0, maxW);
          if (aRow !== abPre) { result.bannerAligned = false; throw new Error(`Row ${r} misaligned`); }
        }
      }
    });

    check(`${name}: banner fits 80 cols`, () => {
      const lines = renderBanner(config.banner!.text, { font: config.banner!.font });
      const centered = centerBanner(lines, 80);
      const maxW = Math.max(0, ...centered.map(l => stringWidth(l)));
      if (maxW > 80) throw new Error(`Banner ${maxW} cols, exceeds 80`);
    });
  }

  // ── MENU TESTS ──
  for (const cols of [40, 80, 120]) {
    check(`${name}: menu renders at ${cols}`, () => {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      const items: MenuItem[] = config.pages.map(p => ({ label: p.title, icon: p.icon, id: p.id }));
      const lines = renderMenu(items, 0, ctx);
      if (lines.length !== config.pages.length) throw new Error(`Expected ${config.pages.length} items, got ${lines.length}`);
    });

    // ── MENU DETECTION ──
    check(`${name}: menu detection at ${cols}`, () => {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      const items: MenuItem[] = config.pages.map(p => ({ label: p.title, icon: p.icon, id: p.id }));
      const lines = renderMenu(items, 0, ctx);
      const vt = new VirtualTerminal(cols, 30);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, lines);
      const sr = new ScreenReader(vt);
      const menu = sr.menu();
      if (menu.items.length !== config.pages.length) throw new Error(`Detected ${menu.items.length}, expected ${config.pages.length}`);
    });
  }

  // ── PAGE TESTS ──
  for (const pg of config.pages) {
    for (const cols of [40, 80]) {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };

      check(`${name}: page "${pg.title}" renders at ${cols}`, () => {
        for (const block of pg.content) renderBlock(block, ctx);
      });

      check(`${name}: page "${pg.title}" no errors at ${cols}`, () => {
        const vt = new VirtualTerminal(cols, 200);
        vt.write("\x1b[2J\x1b[H");
        let row = 0;
        for (const block of pg.content) {
          for (const l of renderBlock(block, ctx)) vt.write(`\x1b[${++row};1H\x1b[2K${l}`);
        }
        const text = vt.text();
        for (const bad of ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"]) {
          if (text.includes(bad)) throw new Error(`"${bad}" found`);
        }
      });
    }
  }

  // ── NAVIGATION TESTS ──
  check(`${name}: router navigates all pages`, () => {
    const router = new Router();
    router.registerPages(config.pages.map(p => p.id));
    for (const p of config.pages) {
      router.navigate(p.id);
      if (router.currentPage !== p.id) throw new Error(`Failed to navigate to ${p.id}`);
    }
    for (let i = 0; i < config.pages.length; i++) router.back();
    if (!router.isHome()) throw new Error("Not home after backing out");
  });

  check(`${name}: focus cycles correctly`, () => {
    const focus = new FocusManager();
    focus.setItems(config.pages.map(p => p.id));
    for (let i = 0; i < config.pages.length * 3; i++) focus.focusNext();
    for (let i = 0; i < config.pages.length * 3; i++) focus.focusPrev();
    focus.focusFirst();
    if (focus.focusIndex !== 0) throw new Error("Focus not at 0");
  });

  check(`${name}: focus survives 50 down presses`, () => {
    const focus = new FocusManager();
    focus.setItems(config.pages.map(p => p.id));
    for (let i = 0; i < 50; i++) focus.focusNext();
    if (focus.focusIndex >= config.pages.length) throw new Error("Out of bounds");
  });

  check(`${name}: keybindings map correctly`, () => {
    const keys: KeyPress[] = [
      { name: "up", char: "", ctrl: false, meta: false, shift: false, sequence: "" },
      { name: "down", char: "", ctrl: false, meta: false, shift: false, sequence: "" },
      { name: "return", char: "", ctrl: false, meta: false, shift: false, sequence: "" },
      { name: "q", char: "q", ctrl: false, meta: false, shift: false, sequence: "" },
      { name: "j", char: "j", ctrl: false, meta: false, shift: false, sequence: "" },
      { name: "k", char: "k", ctrl: false, meta: false, shift: false, sequence: "" },
    ];
    for (const k of keys) {
      const action = keyToAction(k, true);
      if (!action) throw new Error(`Key "${k.name}" unmapped`);
    }
  });

  // ── RESIZE TESTS ──
  for (const cols of [40, 80, 120]) {
    check(`${name}: all blocks render at ${cols} cols`, () => {
      const ctx: RenderContext = { width: Math.min(cols, 100), theme, borderStyle: config.borders ?? "rounded" };
      for (const pg of config.pages) {
        for (const block of pg.content) renderBlock(block, ctx);
      }
    });
  }

  // ── EDGE CASES ──
  check(`${name}: width=20 doesn't crash`, () => {
    const ctx: RenderContext = { width: 20, theme, borderStyle: config.borders ?? "rounded" };
    for (const pg of config.pages) {
      for (const block of pg.content) {
        try { renderBlock(block, ctx); } catch (e: any) { throw new Error(`${block.type} crashed: ${e.message}`); }
      }
    }
  });

  check(`${name}: width=200 doesn't crash`, () => {
    const ctx: RenderContext = { width: 200, theme, borderStyle: config.borders ?? "rounded" };
    for (const pg of config.pages) {
      for (const block of pg.content) {
        try { renderBlock(block, ctx); } catch (e: any) { throw new Error(`${block.type} crashed: ${e.message}`); }
      }
    }
  });

  return result;
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

  console.log();
  console.log("  SHOWCASE COMPREHENSIVE TESTS");
  console.log("  " + "═".repeat(60));
  console.log();

  let grandTotal = 0, grandPassed = 0, grandFailed = 0;
  const results: SiteResult[] = [];

  for (const [name, path] of sites) {
    const r = await testSite(name, path);
    results.push(r);
    grandTotal += r.tests;
    grandPassed += r.passed;
    grandFailed += r.failed;

    const icon = r.failed === 0 ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const banner = r.bannerAligned ? "✓" : "✗";
    console.log(`  ${icon} ${r.name.padEnd(22)} ${String(r.pages).padStart(2)} pages  ${String(r.passed).padStart(3)}/${String(r.tests).padStart(3)} passed  Banner: ${banner}`);
    for (const e of r.errors.slice(0, 3)) {
      console.log(`      \x1b[31m${e}\x1b[0m`);
    }
    if (r.errors.length > 3) console.log(`      ... and ${r.errors.length - 3} more`);
  }

  console.log();
  console.log("  " + "═".repeat(60));
  console.log(`  Total: ${grandPassed}/${grandTotal} passed, ${grandFailed} failed`);
  console.log(`  All banners aligned: ${results.every(r => r.bannerAligned) ? "✓" : "✗"}`);
  console.log();

  if (grandFailed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
