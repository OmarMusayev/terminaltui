/**
 * Test 05 — Band/Musician Site: Glass Cathedral
 * Discography, tour dates, press quotes, videos, links.
 * Theme: rosePine, borders: double
 */
import {
  defineSite,
  page,
  card,
  quote,
  link,
  divider,
  spacer,
  ascii,
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
} from "../harness.js";

import { renderBanner } from "../../src/ascii/banner.js";
import { gradientLines } from "../../src/style/gradient.js";
import { renderCard } from "../../src/components/Card.js";
import { renderQuote } from "../../src/components/Quote.js";
import { stripAnsi } from "../../src/components/base.js";
import { getBorderChars } from "../../src/style/borders.js";

// ─── Site Configuration ────────────────────────────────────

const bandConfig = defineSite({
  name: "Glass Cathedral",
  handle: "@glasscathedral",
  tagline: "Shoegaze / Post-rock / Dream Pop",
  theme: "rosePine" as const,
  borders: "double",
  banner: ascii("GLASS CATHEDRAL", { font: "Slant", gradient: ["#c084fc", "#fb7185"] }),
  pages: [
    page("music", {
      title: "Music",
      icon: "♫",
      content: [
        divider("label", "Discography"),
        spacer(),
        card({
          title: "Luminous Drift",
          subtitle: "2025 · LP",
          body: "Third full-length. Twelve tracks of shimmering guitars, layered synths, and whispered vocals recorded at Sunset Sound. Features the singles 'Halcyon' and 'Dissolve.'",
          tags: ["shoegaze", "dream-pop", "ambient"],
          url: "https://glasscathedral.bandcamp.com/album/luminous-drift",
        }),
        card({
          title: "Cathedral Tapes Vol. 2",
          subtitle: "2024 · EP",
          body: "Four-track companion piece exploring drone and tape manipulation. Limited edition cassette with hand-printed risograph sleeve.",
          tags: ["drone", "experimental", "tape-music"],
          url: "https://glasscathedral.bandcamp.com/album/cathedral-tapes-vol-2",
        }),
        card({
          title: "Reverie Engine",
          subtitle: "2023 · LP",
          body: "Sophomore album weaving post-rock dynamics with electronic textures. Produced by Robin Guthrie. NME called it 'a masterclass in atmosphere.'",
          tags: ["post-rock", "electronic", "shoegaze"],
          url: "https://glasscathedral.bandcamp.com/album/reverie-engine",
        }),
        card({
          title: "Cathedral Tapes Vol. 1",
          subtitle: "2022 · EP",
          body: "Debut EP of field recordings and guitar loops captured in abandoned chapels across the English countryside.",
          tags: ["ambient", "field-recordings", "lo-fi"],
          url: "https://glasscathedral.bandcamp.com/album/cathedral-tapes-vol-1",
        }),
        card({
          title: "Pale Meridian",
          subtitle: "2021 · LP",
          body: "The album that started it all. Nine songs of swirling reverb and distortion recorded in a converted boathouse over two rainy weeks.",
          tags: ["shoegaze", "noise-pop", "indie"],
          url: "https://glasscathedral.bandcamp.com/album/pale-meridian",
        }),
      ],
    }),

    page("shows", {
      title: "Shows",
      icon: "🎤",
      content: [
        divider("label", "Upcoming Tour Dates"),
        spacer(),
        card({
          title: "The Roxy Theatre",
          subtitle: "Apr 12, 2026",
          body: "Los Angeles, CA — with Slow Crush and Soft Blue Shimmer. Doors 7pm. All ages.",
        }),
        card({
          title: "Great American Music Hall",
          subtitle: "Apr 14, 2026",
          body: "San Francisco, CA — headlining. Special extended set with live visuals by Lux Aeterna Collective.",
        }),
        card({
          title: "Doug Fir Lounge",
          subtitle: "Apr 16, 2026",
          body: "Portland, OR — with Cloakroom. Limited capacity, advance tickets recommended.",
        }),
        card({
          title: "Neumos",
          subtitle: "Apr 17, 2026",
          body: "Seattle, WA — co-headlining with Deafheaven. Two sets, doors at 8pm.",
        }),
        card({
          title: "The Crocodile",
          subtitle: "Apr 18, 2026",
          body: "Seattle, WA — intimate afternoon show. Acoustic and ambient set. 21+.",
        }),
        card({
          title: "Kilby Court",
          subtitle: "Apr 21, 2026",
          body: "Salt Lake City, UT — with Narrow Head. All ages venue, 6pm doors.",
        }),
        card({
          title: "Bluebird Theater",
          subtitle: "Apr 23, 2026",
          body: "Denver, CO — album release show for Luminous Drift. Vinyl pre-orders available at merch table.",
        }),
        card({
          title: "Thalia Hall",
          subtitle: "Apr 26, 2026",
          body: "Chicago, IL — tour finale with full string quartet. Recording for live album.",
        }),
      ],
    }),

    page("press", {
      title: "Press",
      icon: "✦",
      content: [
        divider("label", "Press & Reviews"),
        spacer(),
        quote(
          "Glass Cathedral have perfected the art of making guitars sound like weather systems. Luminous Drift is their most fully realized work yet — an album that rewards patience and deep listening.",
          "Pitchfork — 8.4/10"
        ),
        spacer(),
        quote(
          "Reverie Engine is a masterclass in atmosphere. Every track feels like watching the sun set through stained glass. Post-rock has rarely sounded this vital.",
          "NME — ★★★★★"
        ),
        spacer(),
        quote(
          "If My Bloody Valentine and Sigur Rós had a love child raised in a crumbling English chapel, it would sound exactly like this. Mesmerizing and relentless.",
          "The Line of Best Fit — 9/10"
        ),
        spacer(),
        quote(
          "Pale Meridian announced the arrival of a band with an uncommon gift for texture and space. The distortion doesn't obscure — it reveals.",
          "Stereogum"
        ),
        spacer(),
        quote(
          "The Cathedral Tapes series proves that Glass Cathedral are not merely a shoegaze band — they're sound artists in the truest sense, sculpting beauty from noise and silence alike.",
          "FACT Magazine"
        ),
      ],
    }),

    page("videos", {
      title: "Videos",
      icon: "▶",
      content: [
        divider("label", "Music Videos"),
        spacer(),
        link("Halcyon (Official Video)", "https://youtube.com/watch?v=halcyon-gc", { icon: "▶" }),
        spacer(),
        link("Dissolve (Live at The Roxy)", "https://youtube.com/watch?v=dissolve-live", { icon: "▶" }),
        spacer(),
        link("Reverie Engine (Full Album Stream)", "https://youtube.com/watch?v=reverie-full", { icon: "▶" }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "⊙",
      content: [
        divider("label", "Find Us"),
        spacer(),
        link("Bandcamp", "https://glasscathedral.bandcamp.com", { icon: "♫" }),
        link("Spotify", "https://open.spotify.com/artist/glasscathedral", { icon: "♪" }),
        link("Apple Music", "https://music.apple.com/artist/glasscathedral", { icon: "♪" }),
        link("Instagram", "https://instagram.com/glasscathedral", { icon: "📷" }),
        link("Merch Store", "https://glasscathedral.bigcartel.com", { icon: "🛒" }),
        link("Booking Inquiries", "mailto:booking@glasscathedral.com", { icon: "✉" }),
      ],
    }),
  ],
});

// ─── Run Standard Site Tests ───────────────────────────────

const report = testSiteConfig(bandConfig.config, "Band Site — Glass Cathedral");

// ─── Extra Tests ───────────────────────────────────────────

const extraResults: TestResult[] = [];
const theme = themes.rosePine;

// --- Test: Card rendering with all fields at various widths ---
const fullCard = card({
  title: "Luminous Drift",
  subtitle: "2025 · LP",
  body: "Twelve tracks of shimmering guitars, layered synths, and whispered vocals.",
  tags: ["shoegaze", "dream-pop", "ambient"],
  url: "https://glasscathedral.bandcamp.com/album/luminous-drift",
});

for (const w of [30, 40, 60, 80]) {
  const ctx = createTestContext(w, theme);
  ctx.borderStyle = "double";
  extraResults.push(assertNoThrow(() => {
    const lines = renderCard(fullCard, ctx);
    if (lines.length === 0) throw new Error("Card produced 0 lines");
    // Verify content is present
    const joined = lines.map(l => stripAnsi(l)).join("\n");
    if (!joined.includes("Luminous Drift")) throw new Error("Card missing title");
    if (!joined.includes("2025")) throw new Error("Card missing subtitle year");
    if (!joined.includes("shoegaze")) throw new Error("Card missing tag");
  }, `Card with all fields renders at width ${w}`));

  // Overflow check
  extraResults.push(assertNoThrow(() => {
    const lines = renderCard(fullCard, ctx);
    for (let i = 0; i < lines.length; i++) {
      const plainLen = stripAnsi(lines[i]).length;
      if (plainLen > w + 2) {
        throw new Error(`Line ${i} overflows: ${plainLen} chars (max ${w})`);
      }
    }
  }, `Card overflow check at width ${w}`));
}

// --- Test: Quote rendering with long attribution ---
const longAttribution = "The Quietus — Interview by John Doran, March 2026 Issue, Online Extended Edition";
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(60, theme);
  const lines = renderQuote(
    "Glass Cathedral sound like the inside of a kaleidoscope feels. It is genuinely transcendent music for genuinely difficult times.",
    ctx,
    { attribution: longAttribution, style: "border" }
  );
  if (lines.length === 0) throw new Error("Quote produced 0 lines");
  const joined = lines.map(l => stripAnsi(l)).join("\n");
  if (!joined.includes("Doran")) throw new Error("Quote missing attribution text");
}, "Quote with long attribution renders correctly"));

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(40, theme);
  const lines = renderQuote(
    "Short but punchy.",
    ctx,
    { attribution: longAttribution, style: "fancy" }
  );
  if (lines.length === 0) throw new Error("Fancy quote produced 0 lines");
}, "Quote with long attribution in fancy style at narrow width"));

// --- Test: Double border style — verify chars are double-line ---
extraResults.push(assertNoThrow(() => {
  const chars = getBorderChars("double");
  // Double-line box drawing: ═ ║ ╔ ╗ ╚ ╝
  if (chars.horizontal !== "\u2550") throw new Error(`Expected ═ (U+2550) but got ${chars.horizontal}`);
  if (chars.vertical !== "\u2551") throw new Error(`Expected ║ (U+2551) but got ${chars.vertical}`);
  if (chars.topLeft !== "\u2554") throw new Error(`Expected ╔ (U+2554) but got ${chars.topLeft}`);
  if (chars.topRight !== "\u2557") throw new Error(`Expected ╗ (U+2557) but got ${chars.topRight}`);
  if (chars.bottomLeft !== "\u255a") throw new Error(`Expected ╚ (U+255A) but got ${chars.bottomLeft}`);
  if (chars.bottomRight !== "\u255d") throw new Error(`Expected ╝ (U+255D) but got ${chars.bottomRight}`);
}, "Double border chars are correct Unicode double-line glyphs"));

extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(60, theme);
  ctx.borderStyle = "double";
  const lines = renderCard(fullCard, ctx);
  // The rendered card should use double borders from context
  const firstLine = stripAnsi(lines[0]);
  const lastLine = stripAnsi(lines[lines.length - 1]);
  if (!firstLine.includes("\u2550")) throw new Error(`Top border missing ═: "${firstLine}"`);
  if (!lastLine.includes("\u2550")) throw new Error(`Bottom border missing ═: "${lastLine}"`);
  if (!firstLine.startsWith("\u2554")) throw new Error(`Top-left missing ╔: "${firstLine}"`);
  if (!lastLine.startsWith("\u255a")) throw new Error(`Bottom-left missing ╚: "${lastLine}"`);
}, "Card renders with double border chars when borderStyle=double"));

// --- Test: Banner with Slant font ---
extraResults.push(assertNoThrow(() => {
  const bannerLines = renderBanner("GLASS CATHEDRAL", { font: "Slant" });
  if (bannerLines.length === 0) throw new Error("Slant banner rendered 0 lines");
  // Slant font should produce 6-line output
  if (bannerLines.length !== 6) throw new Error(`Expected 6 lines for Slant font, got ${bannerLines.length}`);
  // Should have non-trivial width
  const maxWidth = Math.max(...bannerLines.map(l => l.length));
  if (maxWidth < 20) throw new Error(`Banner suspiciously narrow: ${maxWidth} chars`);
}, "Banner with Slant font renders correctly"));

extraResults.push(assertNoThrow(() => {
  const bannerLines = renderBanner("GLASS CATHEDRAL", { font: "Slant" });
  const colored = gradientLines(bannerLines, ["#c084fc", "#fb7185"]);
  if (colored.length !== bannerLines.length) throw new Error("Gradient changed line count");
  // Gradient lines should contain ANSI escape codes
  const hasAnsi = colored.some(l => l.includes("\x1b["));
  if (!hasAnsi) throw new Error("Gradient lines have no ANSI color codes");
}, "Banner gradient #c084fc -> #fb7185 applies correctly"));

// --- Test: 5 album cards in narrow terminal (width 35) ---
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(35, theme);
  ctx.borderStyle = "double";
  const musicPage = bandConfig.config.pages.find(p => p.id === "music")!;
  const albumCards = musicPage.content.filter(b => b.type === "card");
  if (albumCards.length !== 5) throw new Error(`Expected 5 album cards, found ${albumCards.length}`);

  let totalLines = 0;
  for (const albumCard of albumCards) {
    const lines = renderBlock(albumCard, ctx);
    if (lines.length === 0) throw new Error(`Album card rendered 0 lines at width 35`);
    totalLines += lines.length;
    // Overflow check
    for (let i = 0; i < lines.length; i++) {
      const plainLen = stripAnsi(lines[i]).length;
      if (plainLen > 37) { // 35 + 2 tolerance
        throw new Error(`Card line ${i} overflows at width 35: ${plainLen} chars. Content: "${stripAnsi(lines[i]).substring(0, 50)}"`);
      }
    }
  }
  if (totalLines < 25) throw new Error(`5 album cards only produced ${totalLines} lines — seems too few`);
}, "5 album cards render at narrow width 35 without overflow"));

// --- Test: All 8 show cards render ---
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, theme);
  ctx.borderStyle = "double";
  const showsPage = bandConfig.config.pages.find(p => p.id === "shows")!;
  const showCards = showsPage.content.filter(b => b.type === "card");
  if (showCards.length !== 8) throw new Error(`Expected 8 show cards, found ${showCards.length}`);

  for (const showCard of showCards) {
    const lines = renderBlock(showCard, ctx);
    if (lines.length === 0) throw new Error("Show card rendered 0 lines");
  }
}, "All 8 show cards render at width 80"));

// --- Test: Press quotes all render ---
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, theme);
  const pressPage = bandConfig.config.pages.find(p => p.id === "press")!;
  const quotes = pressPage.content.filter(b => b.type === "quote");
  if (quotes.length !== 5) throw new Error(`Expected 5 press quotes, found ${quotes.length}`);

  for (const q of quotes) {
    const lines = renderBlock(q, ctx);
    if (lines.length === 0) throw new Error("Press quote rendered 0 lines");
  }
}, "All 5 press quotes render at width 80"));

// --- Test: Links page renders all 6 links ---
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, theme);
  const linksPage = bandConfig.config.pages.find(p => p.id === "links")!;
  const links = linksPage.content.filter(b => b.type === "link");
  if (links.length !== 6) throw new Error(`Expected 6 links, found ${links.length}`);

  for (const lnk of links) {
    const lines = renderBlock(lnk, ctx);
    if (lines.length === 0) throw new Error("Link rendered 0 lines");
    const joined = lines.map(l => stripAnsi(l)).join("");
    if (!joined.includes("http") && !joined.includes("mailto")) {
      throw new Error(`Link missing URL in output: "${joined}"`);
    }
  }
}, "All 6 links render with URLs visible"));

// ─── Merge and Print Report ───────────────────────────────

report.results.push(...extraResults);
report.total += extraResults.length;
const extraPassed = extraResults.filter(r => r.passed).length;
report.passed += extraPassed;
report.failed += extraResults.length - extraPassed;

console.log(formatReport(report));

// Summary
console.log(`\n${"═".repeat(60)}`);
console.log("EXTRA TEST SUMMARY");
console.log(`${"═".repeat(60)}`);
for (const r of extraResults) {
  const icon = r.passed ? "✓" : "✗";
  console.log(`  ${icon} ${r.name}${r.error ? ` — ${r.error}` : ""}`);
}
console.log(`\nExtra: ${extraPassed}/${extraResults.length} passed`);
console.log(`Overall: ${report.passed}/${report.total} passed`);
if (report.bugs.length > 0) {
  console.log(`Bugs found: ${report.bugs.length}`);
}
