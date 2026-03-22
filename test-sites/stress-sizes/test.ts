/**
 * Stress Test: Extreme Terminal Sizes
 *
 * Tests 3 site configs at 5 extreme terminal sizes.
 * Verifies rendering, resizing, and absence of error strings.
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
import { stripAnsi, wrapText, type RenderContext } from "../../src/components/base.js";
import { themes, defaultTheme } from "../../src/style/theme.js";
import type { Theme } from "../../src/style/theme.js";
import { fgColor, bold, dim, italic, reset, setColorMode } from "../../src/style/colors.js";
import { writeFileSync } from "node:fs";

setColorMode("256");

// ── Types ──
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

// ── VTerm Writer ──
function writeToVterm(vt: VirtualTerminal, lines: string[]): void {
  let output = "\x1b[H";
  for (let i = 0; i < vt.rows; i++) {
    output += `\x1b[${i + 1};1H\x1b[2K`;
    if (i < lines.length) output += lines[i];
  }
  vt.write(output);
}

// ── Render Helpers ──
function renderHomePage(
  config: { name: string; tagline?: string; pages: { title: string; icon?: string; id: string }[] },
  theme: Theme, focusIndex: number, cols: number
): string[] {
  const contentWidth = Math.min(cols, 100);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);
  const ctx: RenderContext = { width: contentWidth, theme, borderStyle: "rounded" };
  const lines: string[] = [];
  lines.push("");
  lines.push(padStr + fgColor(theme.accent) + bold + config.name + reset);
  lines.push("");
  if (config.tagline) {
    lines.push(padStr + fgColor(theme.muted) + italic + config.tagline + reset);
    lines.push("");
  }
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");
  const menuItems: MenuItem[] = config.pages.map(p => ({ label: p.title, icon: p.icon, id: p.id }));
  const menuLines = renderMenu(menuItems, focusIndex, ctx);
  for (const ml of menuLines) lines.push(padStr + ml);
  lines.push("");
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  return lines;
}

function renderContentPage(
  config: { name: string; pages: { title: string; icon?: string; id: string; content: any[] }[] },
  pg: { title: string; icon?: string; content: any[] },
  theme: Theme, cols: number
): string[] {
  const contentWidth = Math.min(cols, 100);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);
  const ctx: RenderContext = { width: contentWidth, theme, borderStyle: "rounded" };
  const lines: string[] = [];
  lines.push("");
  lines.push(padStr + fgColor(theme.accent) + bold + (pg.icon ? pg.icon + " " : "") + pg.title + reset);
  lines.push(padStr + fgColor(theme.border) + "\u2500".repeat(contentWidth) + reset);
  lines.push("");
  for (const block of pg.content) {
    const blockLines = renderBlock(block, ctx);
    for (const bl of blockLines) lines.push(padStr + bl);
    lines.push("");
  }
  return lines;
}

function renderBlock(block: any, ctx: RenderContext): string[] {
  switch (block.type) {
    case "text": return renderText(block.content, ctx, block.style);
    case "card": return renderCard(block, ctx);
    case "timeline": return renderTimeline(block.items, ctx, block.style);
    case "table": return renderTable(block.headers, block.rows, ctx);
    case "list": return renderList(block.items, ctx, block.style);
    case "quote": return renderQuote(block.text, ctx, { attribution: block.attribution });
    case "link": return renderLink(block.label, block.url, ctx, { icon: block.icon });
    case "hero": return renderHero(block, ctx);
    case "divider": return renderDivider(ctx, { style: block.style, label: block.label });
    default: return [];
  }
}

// ── 3 Inline Site Configs ──
const portfolioConfig = {
  name: "Alex Chen",
  tagline: "Full-stack developer",
  pages: [
    { title: "About", icon: "\ud83d\udc64", id: "about", content: [
      { type: "text" as const, content: "I am a developer with experience in TypeScript, React, and Node.js.", style: "markdown" as const },
    ]},
    { title: "Projects", icon: "\ud83d\ude80", id: "projects", content: [
      { type: "card" as const, title: "TaskFlow", body: "Project management tool", tags: ["React", "GraphQL"] },
      { type: "card" as const, title: "DataPipe", body: "Real-time data pipeline", tags: ["Node.js", "Redis"], subtitle: "v2.1" },
    ]},
    { title: "Links", icon: "\ud83d\udd17", id: "links", content: [
      { type: "link" as const, label: "GitHub", url: "https://github.com/alexchen" },
      { type: "link" as const, label: "LinkedIn", url: "https://linkedin.com/in/alexchen" },
    ]},
  ],
};

const restaurantConfig = {
  name: "Bella Cucina",
  tagline: "Authentic Italian dining since 1985",
  pages: [
    { title: "Menu", icon: "\ud83c\udf5d", id: "menu", content: [
      { type: "card" as const, title: "Antipasti", body: "Bruschetta, Caprese, Carpaccio", tags: ["Starters"] },
      { type: "card" as const, title: "Primi", body: "Risotto, Pappardelle, Gnocchi", tags: ["Pasta"] },
      { type: "card" as const, title: "Secondi", body: "Osso Buco, Saltimbocca, Branzino", tags: ["Mains"] },
    ]},
    { title: "Hours", icon: "\u23f0", id: "hours", content: [
      { type: "table" as const, headers: ["Day", "Lunch", "Dinner"], rows: [
        ["Mon-Thu", "11:30-14:30", "17:30-22:00"],
        ["Fri-Sat", "11:30-14:30", "17:30-23:00"],
        ["Sunday", "12:00-15:00", "17:00-21:00"],
      ]},
    ]},
    { title: "About", icon: "\ud83c\udfe0", id: "about", content: [
      { type: "text" as const, content: "Family-owned restaurant with a passion for authentic Italian cuisine.", style: "plain" as const },
      { type: "quote" as const, text: "The best Italian food outside of Rome", attribution: "Food Magazine" },
    ]},
    { title: "Contact", icon: "\ud83d\udcde", id: "contact", content: [
      { type: "link" as const, label: "Call Us", url: "tel:+1234567890" },
      { type: "link" as const, label: "Directions", url: "https://maps.google.com" },
    ]},
  ],
};

const cafeConfig = {
  name: "The Roasted Bean",
  tagline: "Craft coffee and artisan pastries",
  pages: [
    { title: "Drinks", icon: "\u2615", id: "drinks", content: [
      { type: "card" as const, title: "Espresso", body: "Single or double shot", tags: ["Hot", "Classic"] },
      { type: "card" as const, title: "Latte", body: "Steamed milk with espresso", tags: ["Hot", "Milk"] },
      { type: "card" as const, title: "Cold Brew", body: "24-hour cold steeped", tags: ["Cold", "Strong"] },
      { type: "card" as const, title: "Matcha Latte", body: "Ceremonial grade matcha", tags: ["Hot", "Cold", "Specialty"] },
      { type: "card" as const, title: "Chai Latte", body: "House-made spiced chai", tags: ["Hot", "Spiced"] },
      { type: "card" as const, title: "Mocha", body: "Chocolate meets espresso", tags: ["Hot", "Sweet"] },
    ]},
    { title: "Food", icon: "\ud83e\udd50", id: "food", content: [
      { type: "card" as const, title: "Croissant", body: "Butter or almond", tags: ["Pastry"] },
      { type: "card" as const, title: "Avocado Toast", body: "Sourdough, pickled onion", tags: ["Savory"] },
    ]},
    { title: "Events", icon: "\ud83c\udfb5", id: "events", content: [
      { type: "timeline" as const, items: [
        { title: "Jazz Night", subtitle: "Every Friday", period: "8PM-11PM", description: "Live jazz trio" },
        { title: "Open Mic", subtitle: "First Saturday", period: "7PM-10PM", description: "Sign up at the bar" },
      ]},
    ]},
    { title: "Location", icon: "\ud83d\udccd", id: "location", content: [
      { type: "list" as const, items: ["123 Main Street", "Open 7am-9pm daily", "Free WiFi", "Dog friendly patio"] },
    ]},
  ],
};

const siteConfigs = [
  { label: "portfolio", config: portfolioConfig },
  { label: "restaurant", config: restaurantConfig },
  { label: "cafe", config: cafeConfig },
];

const sizes: [number, number][] = [
  [20, 10],
  [40, 15],
  [80, 24],
  [120, 35],
  [200, 50],
];

const theme = defaultTheme;
const BAD_STRINGS = ["undefined", "[object Object]", "NaN", "TypeError", "ReferenceError"];

// ══════════════════════════════════════════════════════════════
// TESTS: Render each site at each size
// ══════════════════════════════════════════════════════════════

for (const { label, config } of siteConfigs) {
  for (const [cols, rows] of sizes) {
    const vtRows = Math.max(rows, 300);

    // Home page render
    step(`[${label}] Home ${cols}x${rows} — renders`, () => {
      const lines = renderHomePage(config, theme, 0, cols);
      assert(lines.length > 0, "Home page produced 0 lines");
    });

    step(`[${label}] Home ${cols}x${rows} — vterm no crash`, () => {
      const lines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, lines);
      const text = vt.text();
      for (const bad of BAD_STRINGS) {
        if (text.includes(bad)) {
          addBug("P1", `"${bad}" on ${label} home at ${cols}x${rows}`, "render", `Home ${cols}x${rows}`, "No bad strings", `Found "${bad}"`);
        }
        assert(!text.includes(bad), `"${bad}" found on home`);
      }
    });

    step(`[${label}] Home ${cols}x${rows} — noOverflow`, () => {
      const lines = renderHomePage(config, theme, 0, cols);
      const vt = new VirtualTerminal(cols, vtRows);
      vt.write("\x1b[2J\x1b[H");
      writeToVterm(vt, lines);
      const asserts = new Assertions(vt, new ScreenReader(vt));
      asserts.noOverflow();
    });

    // Content pages
    for (const pg of config.pages) {
      step(`[${label}] Page "${pg.title}" ${cols}x${rows} — renders`, () => {
        const lines = renderContentPage(config, pg, theme, cols);
        assert(lines.length > 0, "Page produced 0 lines");
      });

      step(`[${label}] Page "${pg.title}" ${cols}x${rows} — no bad strings`, () => {
        const lines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, lines);
        const text = vt.text();
        for (const bad of BAD_STRINGS) {
          if (text.includes(bad)) {
            addBug("P1", `"${bad}" on ${label}/${pg.title} at ${cols}x${rows}`, pg.content[0]?.type ?? "unknown",
              `Page ${pg.title} at ${cols}x${rows}`, "No bad strings", `Found "${bad}"`);
          }
          assert(!text.includes(bad), `"${bad}" found on page "${pg.title}"`);
        }
      });

      step(`[${label}] Page "${pg.title}" ${cols}x${rows} — noOverflow`, () => {
        const lines = renderContentPage(config, pg, theme, cols);
        const vt = new VirtualTerminal(cols, vtRows);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, lines);
        const asserts = new Assertions(vt, new ScreenReader(vt));
        asserts.noOverflow();
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════
// TESTS: Resize sequences
// ══════════════════════════════════════════════════════════════

for (const { label, config } of siteConfigs) {
  step(`[${label}] Resize 80x24 -> 40x15 -> 120x35`, () => {
    // Render at 80x24
    const vt = new VirtualTerminal(80, 200);
    vt.write("\x1b[2J\x1b[H");
    const lines80 = renderHomePage(config, theme, 0, 80);
    writeToVterm(vt, lines80);
    const text80 = vt.text();
    assert(!text80.includes("undefined"), "undefined at 80x24");

    // Resize to 40x15
    vt.resize(40, 200);
    const lines40 = renderHomePage(config, theme, 0, 40);
    writeToVterm(vt, lines40);
    const text40 = vt.text();
    assert(!text40.includes("undefined"), "undefined after resize to 40x15");

    // Resize to 120x35
    vt.resize(120, 200);
    const lines120 = renderHomePage(config, theme, 0, 120);
    writeToVterm(vt, lines120);
    const text120 = vt.text();
    assert(!text120.includes("undefined"), "undefined after resize to 120x35");
  });

  step(`[${label}] Resize content page 80 -> 20 -> 200`, () => {
    const pg = config.pages[0];
    const vt = new VirtualTerminal(80, 300);
    vt.write("\x1b[2J\x1b[H");
    const l1 = renderContentPage(config, pg, theme, 80);
    writeToVterm(vt, l1);
    assert(!vt.text().includes("undefined"), "undefined at 80");

    vt.resize(20, 300);
    const l2 = renderContentPage(config, pg, theme, 20);
    writeToVterm(vt, l2);
    assert(!vt.text().includes("undefined"), "undefined at 20");

    vt.resize(200, 300);
    const l3 = renderContentPage(config, pg, theme, 200);
    writeToVterm(vt, l3);
    assert(!vt.text().includes("undefined"), "undefined at 200");
  });
}

// ══════════════════════════════════════════════════════════════
// TESTS: Menu selection at all sizes
// ══════════════════════════════════════════════════════════════

for (const { label, config } of siteConfigs) {
  for (const [cols, rows] of sizes) {
    step(`[${label}] Menu selection cycle at ${cols}x${rows}`, () => {
      for (let i = 0; i < config.pages.length; i++) {
        const lines = renderHomePage(config, theme, i, cols);
        const vt = new VirtualTerminal(cols, 200);
        vt.write("\x1b[2J\x1b[H");
        writeToVterm(vt, lines);
        // Just verify no crash
        assert(lines.length > 0, `Menu with selection ${i} produced 0 lines`);
      }
    });
  }
}

// ══════════════════════════════════════════════════════════════
// TESTS: Individual blocks at extreme widths
// ══════════════════════════════════════════════════════════════

const extremeWidths = [1, 5, 10, 20, 40, 80, 120, 200, 500];
for (const w of extremeWidths) {
  const ctx: RenderContext = { width: w, theme, borderStyle: "rounded" };

  step(`Card at width=${w}`, () => {
    const lines = renderCard({ type: "card", title: "Test Card", body: "Some body text here.", tags: ["Tag1", "Tag2"] }, ctx);
    assert(lines.length > 0, "Card produced 0 lines");
  });

  step(`Table at width=${w}`, () => {
    const lines = renderTable(["A", "B", "C"], [["1", "2", "3"], ["4", "5", "6"]], ctx);
    assert(lines.length > 0, "Table produced 0 lines");
  });

  step(`Timeline at width=${w}`, () => {
    const lines = renderTimeline([
      { title: "Event 1", subtitle: "Sub1", period: "2024", description: "Description here" },
      { title: "Event 2", period: "2025" },
    ], ctx);
    assert(lines.length > 0, "Timeline produced 0 lines");
  });

  step(`List at width=${w}`, () => {
    const lines = renderList(["Item one", "Item two", "Item three"], ctx);
    assert(lines.length > 0, "List produced 0 lines");
  });

  step(`Quote at width=${w}`, () => {
    const lines = renderQuote("To be or not to be", ctx, { attribution: "Shakespeare" });
    assert(lines.length > 0, "Quote produced 0 lines");
  });

  step(`Link at width=${w}`, () => {
    const lines = renderLink("GitHub", "https://github.com", ctx);
    assert(lines.length > 0, "Link produced 0 lines");
  });

  step(`Hero at width=${w}`, () => {
    const lines = renderHero({ title: "Welcome", subtitle: "To the show" }, ctx);
    assert(lines.length > 0, "Hero produced 0 lines");
  });

  step(`Text at width=${w}`, () => {
    const lines = renderText("Hello world this is a paragraph of text.", ctx, "plain");
    assert(lines.length > 0, "Text produced 0 lines");
  });

  step(`Menu at width=${w}`, () => {
    const items: MenuItem[] = [
      { label: "Home", icon: "\ud83c\udfe0", id: "home" },
      { label: "About", icon: "\u2139\ufe0f", id: "about" },
    ];
    const lines = renderMenu(items, 0, ctx);
    assert(lines.length > 0, "Menu produced 0 lines");
  });

  step(`Divider at width=${w}`, () => {
    const lines = renderDivider(ctx, { style: "solid" });
    assert(lines.length > 0, "Divider produced 0 lines");
  });
}

// ══════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════

const passed = steps.filter(s => s.passed).length;
const failed = steps.filter(s => !s.passed).length;
const failedNames = steps.filter(s => !s.passed).map(s => `${s.name}: ${s.error}`);

const report = {
  agent: "stress-sizes",
  tests_run: steps.length,
  tests_passed: passed,
  tests_failed: failed,
  bugs,
  notes: failed > 0
    ? `${failed} tests failed. Failures: ${failedNames.join("; ")}`
    : "All tests passed. Rendered 3 sites at 5 sizes, tested resize sequences, and individual blocks at 9 extreme widths.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
