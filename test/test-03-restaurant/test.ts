/**
 * Test 03 — Restaurant Site: "The Rusty Fork"
 * Full restaurant with 20+ menu items across sections, hours table,
 * press quotes, links. Theme: gruvbox.
 */
import {
  defineSite,
  page,
  card,
  table,
  quote,
  link,
  ascii,
  markdown,
  divider,
  spacer,
  section,
  testSiteConfig,
  formatReport,
  createTestContext,
  renderBlock,
  assertNoOverflow,
  assertLines,
  assertLinesNonEmpty,
  assertNoThrow,
  themes,
  type TestResult,
  type TestReport,
} from "../harness.js";

import { stripAnsi } from "../../src/components/base.js";

// ─── Site Config ───────────────────────────────────────────

const config = {
  name: "The Rusty Fork",
  handle: "@theRustyFork",
  tagline: "Farm-to-table dining in the heart of the city",
  theme: "gruvbox" as const,
  borders: "rounded" as const,
  banner: ascii("THE RUSTY FORK", { font: "Ogre", gradient: ["#d4a373", "#e63946"] }),
  animations: {
    boot: true,
    transitions: "fade" as const,
    exitMessage: "Thanks for dining with us! Reservations: (555) 234-5678",
  },
  pages: [
    // ── Menu Page ────────────────────────────────────────────
    page("menu", {
      title: "Menu",
      icon: "🍽",
      content: [
        divider("label", "Appetizers"),
        section("Appetizers", [
          card({ title: "Burrata & Heirloom Tomatoes", subtitle: "$16", body: "Creamy burrata with vine-ripened heirloom tomatoes, basil oil, and aged balsamic reduction" }),
          card({ title: "Crispy Calamari", subtitle: "$14", body: "Lightly fried calamari rings with roasted garlic aioli and charred lemon" }),
          card({ title: "Beef Tartare", subtitle: "$18", body: "Hand-cut prime beef, quail egg yolk, cornichons, capers, and grilled sourdough" }),
          card({ title: "Roasted Beet Salad", subtitle: "$13", body: "Golden and red beets, whipped goat cheese, candied walnuts, arugula" }),
          card({ title: "French Onion Soup", subtitle: "$12", body: "Caramelized onion broth, gruyere crouton, thyme" }),
        ]),
        spacer(),
        divider("label", "Mains"),
        section("Mains", [
          card({ title: "Pan-Seared Salmon", subtitle: "$32", body: "Wild-caught sockeye salmon, lemon beurre blanc, roasted fingerling potatoes, haricots verts" }),
          card({ title: "Dry-Aged Ribeye", subtitle: "$48", body: "28-day dry-aged 16oz prime ribeye, bone marrow butter, truffle fries" }),
          card({ title: "Braised Short Ribs", subtitle: "$36", body: "Slow-braised beef short ribs, red wine demi-glace, creamy polenta, gremolata" }),
          card({ title: "Roasted Duck Breast", subtitle: "$38", body: "Magret duck breast, cherry gastrique, wild rice pilaf, roasted root vegetables" }),
          card({ title: "Mushroom Risotto", subtitle: "$26", body: "Arborio rice, wild mushroom medley, parmesan, truffle oil, fresh herbs" }),
          card({ title: "Grilled Swordfish", subtitle: "$34", body: "Mediterranean swordfish steak, olive tapenade, saffron couscous, grilled zucchini" }),
        ]),
        spacer(),
        divider("label", "Sides"),
        section("Sides", [
          card({ title: "Truffle Fries", subtitle: "$12", body: "Hand-cut kennebec potatoes, white truffle oil, parmesan, fresh herbs" }),
          card({ title: "Grilled Broccolini", subtitle: "$10", body: "Charred broccolini, chili flakes, lemon zest, toasted almonds" }),
          card({ title: "Creamed Spinach", subtitle: "$11", body: "Baby spinach, nutmeg bechamel, gruyere gratin" }),
          card({ title: "Roasted Brussels Sprouts", subtitle: "$12", body: "Crispy brussels sprouts, pancetta, maple glaze, pecans" }),
        ]),
        spacer(),
        divider("label", "Desserts"),
        section("Desserts", [
          card({ title: "Creme Brulee", subtitle: "$14", body: "Classic vanilla bean custard, caramelized sugar, fresh berries" }),
          card({ title: "Chocolate Lava Cake", subtitle: "$16", body: "Warm dark chocolate fondant, vanilla bean ice cream, raspberry coulis" }),
          card({ title: "Tiramisu", subtitle: "$14", body: "Espresso-soaked ladyfingers, mascarpone cream, cocoa dusted" }),
          card({ title: "Seasonal Fruit Tart", subtitle: "$13", body: "Buttery pate sucree, pastry cream, glazed seasonal fruits" }),
          card({ title: "Affogato", subtitle: "$12", body: "Double espresso poured over house-made vanilla gelato, amaretti cookie" }),
        ]),
      ],
    }),

    // ── Drinks Page ──────────────────────────────────────────
    page("drinks", {
      title: "Drinks",
      icon: "🍷",
      content: [
        divider("label", "Wine Selection"),
        section("Wine Selection", [
          card({ title: "Chateau Margaux 2015", subtitle: "$28/glass", body: "Bordeaux, France - Full-bodied red with blackcurrant, violet, and cedar notes" }),
          card({ title: "Cloudy Bay Sauvignon Blanc", subtitle: "$16/glass", body: "Marlborough, NZ - Crisp and aromatic with passion fruit and citrus" }),
          card({ title: "Barolo Riserva 2012", subtitle: "$32/glass", body: "Piedmont, Italy - Elegant nebbiolo with tar, rose, and truffle complexity" }),
          card({ title: "Domaine Ott Rose", subtitle: "$18/glass", body: "Provence, France - Delicate pale rose with strawberry and mineral finish" }),
        ]),
        spacer(),
        divider("label", "Cocktails"),
        section("Cocktails", [
          card({ title: "The Rusty Nail", subtitle: "$18", body: "Our signature: aged scotch, Drambuie, honey, orange peel. House favorite since 2015." }),
          card({ title: "Smoked Old Fashioned", subtitle: "$20", body: "Bourbon, applewood smoke, demerara, Angostura, flamed orange zest" }),
          card({ title: "Lavender Collins", subtitle: "$16", body: "Gin, fresh lavender syrup, lemon, sparkling water, edible flowers" }),
          card({ title: "Espresso Martini", subtitle: "$17", body: "Vodka, fresh espresso, coffee liqueur, vanilla, three bean garnish" }),
        ]),
      ],
    }),

    // ── About Page ───────────────────────────────────────────
    page("about", {
      title: "About",
      icon: "📖",
      content: [
        markdown(`
# Our Story

**The Rusty Fork** was born in 2015 from a simple belief: that great food starts with great ingredients and even greater people.

Chef **Marcus Rivera** spent fifteen years cooking in Michelin-starred kitchens across Europe before returning to his hometown with a vision: a restaurant that honors tradition while embracing innovation. Every dish on our menu tells a story — from the locally sourced heirloom tomatoes in our burrata to the 28-day dry-aged ribeye from our partner ranch in Montana.

## Our Philosophy

We believe in:
- **Seasonal menus** that celebrate what's fresh and local
- **Sustainable sourcing** from farms within 100 miles
- **Zero-waste kitchen** practices — nose-to-tail, root-to-stem
- **Living wages** for every member of our team
- **Community first** — 5% of profits go to local food banks

## Awards & Recognition

Our team has been honored with numerous accolades including a James Beard nomination for Best New Restaurant (2016), two Michelin stars (2018-present), and Food & Wine's Restaurant of the Year (2020).

We are open for dinner six nights a week and brunch on weekends. We look forward to welcoming you.
        `),
        spacer(2),
        divider("label", "Press"),
        quote(
          "The Rusty Fork redefines farm-to-table dining with dishes that are as visually stunning as they are delicious.",
          "The New York Times"
        ),
        spacer(),
        quote(
          "Chef Rivera's braised short ribs might be the best dish I've eaten this decade. Worth the trip alone.",
          "Bon Appetit Magazine"
        ),
        spacer(),
        quote(
          "An extraordinary commitment to sustainability matched only by the extraordinary flavors on every plate.",
          "Eater National"
        ),
      ],
    }),

    // ── Hours Page ───────────────────────────────────────────
    page("hours", {
      title: "Hours",
      icon: "🕐",
      content: [
        table(
          ["Day", "Dinner", "Brunch", "Bar"],
          [
            ["Monday", "Closed", "Closed", "Closed"],
            ["Tuesday", "5:00 PM - 10:00 PM", "—", "4:00 PM - 11:00 PM"],
            ["Wednesday", "5:00 PM - 10:00 PM", "—", "4:00 PM - 11:00 PM"],
            ["Thursday", "5:00 PM - 10:00 PM", "—", "4:00 PM - 12:00 AM"],
            ["Friday", "5:00 PM - 11:00 PM", "—", "4:00 PM - 1:00 AM"],
            ["Saturday", "5:00 PM - 11:00 PM", "10:00 AM - 2:00 PM", "4:00 PM - 1:00 AM"],
            ["Sunday", "5:00 PM - 9:00 PM", "10:00 AM - 2:00 PM", "4:00 PM - 10:00 PM"],
          ]
        ),
        spacer(2),
        divider("label", "Location"),
        markdown(`
## Find Us

**The Rusty Fork**
742 Elm Street, Suite 100
Portland, OR 97205

*Valet parking available Friday & Saturday evenings.*
*Street parking and garage at 3rd & Elm.*

For private dining and events, please contact us directly.
        `),
        spacer(),
        link("View on Google Maps", "https://maps.google.com/?q=742+Elm+Street+Portland+OR", { icon: "📍" }),
        spacer(),
        link("Reserve on OpenTable", "https://www.opentable.com/the-rusty-fork", { icon: "📅" }),
      ],
    }),

    // ── Contact Page ─────────────────────────────────────────
    page("contact", {
      title: "Contact",
      icon: "📬",
      content: [
        markdown(`
## Get in Touch

We'd love to hear from you. For reservations, press inquiries, or private events, reach out through any of the channels below.
        `),
        spacer(),
        link("Instagram: @theRustyFork", "https://instagram.com/theRustyFork", { icon: "📸" }),
        spacer(),
        link("Phone: (555) 234-5678", "tel:+15552345678", { icon: "📞" }),
        spacer(),
        link("Email: hello@therustyfork.com", "mailto:hello@therustyfork.com", { icon: "✉️" }),
        spacer(),
        link("Private Events & Catering", "https://therustyfork.com/events", { icon: "🎉" }),
      ],
    }),
  ],
};

// ─── Run Standard Site Tests ───────────────────────────────

const report = testSiteConfig(config, "The Rusty Fork — Restaurant Site");
const extraResults: TestResult[] = [];

// ─── Extra Tests ───────────────────────────────────────────

const gruvboxTheme = (themes as any)["gruvbox"];

// Test: Render 20 cards at width 40 — check no overflow
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(40, gruvboxTheme);
  const allCards = config.pages[0].content.filter(b => b.type === "section")
    .flatMap((s: any) => s.content.filter((b: any) => b.type === "card"));

  let totalCards = 0;
  for (const c of allCards) {
    const lines = renderBlock(c, ctx);
    const overflow = assertNoOverflow(lines, 40, `Card "${(c as any).title}" narrow render`);
    if (!overflow.passed) {
      throw new Error(overflow.error);
    }
    totalCards++;
  }

  if (totalCards < 20) {
    throw new Error(`Expected 20+ cards but found ${totalCards}`);
  }
}, "20 cards render without overflow at width 40"));

// Test: Render hours table at widths 40, 60, 80 — check alignment
for (const w of [40, 60, 80]) {
  extraResults.push(assertNoThrow(() => {
    const ctx = createTestContext(w, gruvboxTheme);
    const hoursPage = config.pages.find(p => p.id === "hours")!;
    const tableBlock = hoursPage.content.find(b => b.type === "table")!;
    const lines = renderBlock(tableBlock, ctx);

    if (lines.length === 0) throw new Error("Table rendered 0 lines");

    // Check that all plain-text lines have consistent lengths (alignment check)
    const plainLengths = lines.map(l => stripAnsi(l).length);
    const maxLen = Math.max(...plainLengths);

    // All lines in a well-formed table should be the same width
    // Allow a tolerance of 2 chars for minor formatting
    for (let i = 0; i < plainLengths.length; i++) {
      if (Math.abs(plainLengths[i] - maxLen) > 2) {
        throw new Error(
          `Table alignment issue at line ${i}: length ${plainLengths[i]} vs max ${maxLen}. Content: "${stripAnsi(lines[i]).substring(0, 50)}"`
        );
      }
    }
  }, `Hours table alignment at width ${w}`));
}

// Test: Render 5 quote blocks — check border alignment
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, gruvboxTheme);
  const quoteBlocks = [
    { type: "quote" as const, text: "The Rusty Fork redefines farm-to-table dining with dishes that are as visually stunning as they are delicious.", attribution: "The New York Times" },
    { type: "quote" as const, text: "Chef Rivera's braised short ribs might be the best dish I've eaten this decade.", attribution: "Bon Appetit Magazine" },
    { type: "quote" as const, text: "An extraordinary commitment to sustainability matched only by the extraordinary flavors on every plate.", attribution: "Eater National" },
    { type: "quote" as const, text: "One of the most exciting restaurants to open in Portland in years. Every detail is considered.", attribution: "Portland Monthly" },
    { type: "quote" as const, text: "The cocktail program alone is worth the visit. The Rusty Nail is now legendary.", attribution: "Punch Magazine" },
  ];

  for (const q of quoteBlocks) {
    const lines = renderBlock(q, ctx);
    if (lines.length === 0) throw new Error(`Quote rendered 0 lines`);

    // Check border chars are all aligned in same column
    const borderPositions = lines.map(l => {
      const plain = stripAnsi(l);
      return plain.indexOf("\u2502"); // vertical bar character
    });

    const firstBorder = borderPositions.find(p => p >= 0);
    if (firstBorder !== undefined) {
      for (let i = 0; i < borderPositions.length; i++) {
        if (borderPositions[i] >= 0 && borderPositions[i] !== firstBorder) {
          throw new Error(
            `Quote border misalignment: line ${i} border at col ${borderPositions[i]}, expected ${firstBorder}`
          );
        }
      }
    }
  }
}, "5 quote blocks — border alignment"));

// Test: Section headers render correctly
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, gruvboxTheme);
  const sectionBlock = section("Appetizers", [
    card({ title: "Test Item", subtitle: "$10", body: "A test item" }),
  ]);
  const lines = renderBlock(sectionBlock, ctx);
  if (lines.length === 0) throw new Error("Section rendered 0 lines");

  // First line should contain the section title
  const firstLinePlain = stripAnsi(lines[0]);
  if (!firstLinePlain.includes("Appetizers")) {
    throw new Error(`Section header does not contain title. Got: "${firstLinePlain}"`);
  }

  // Second line should be a separator
  if (lines.length < 2) throw new Error("Section missing separator line");
  const secondLinePlain = stripAnsi(lines[1]);
  if (!secondLinePlain.includes("─")) {
    throw new Error(`Section separator missing dash chars. Got: "${secondLinePlain}"`);
  }
}, "Section headers render correctly"));

// Test: divider("label", "Mains") renders the label centered
extraResults.push(assertNoThrow(() => {
  const ctx = createTestContext(80, gruvboxTheme);
  const divBlock = divider("label", "Mains");
  const lines = renderBlock(divBlock, ctx);
  if (lines.length === 0) throw new Error("Divider rendered 0 lines");

  const plain = stripAnsi(lines[0]);
  if (!plain.includes("Mains")) {
    throw new Error(`Divider does not contain label "Mains". Got: "${plain}"`);
  }

  // Check centering: the label should be roughly in the middle
  const idx = plain.indexOf("Mains");
  const center = Math.floor(plain.length / 2);
  const labelCenter = idx + Math.floor("Mains".length / 2);
  const drift = Math.abs(center - labelCenter);
  if (drift > 5) {
    throw new Error(
      `Label "Mains" not centered: label center at ${labelCenter}, line center at ${center}, drift ${drift}`
    );
  }
}, 'divider("label", "Mains") renders label centered'));

// ─── Merge & Print Report ──────────────────────────────────

const finalReport: TestReport = {
  project: report.project,
  total: report.total + extraResults.length,
  passed: report.passed + extraResults.filter(r => r.passed).length,
  failed: report.failed + extraResults.filter(r => !r.passed).length,
  results: [...report.results, ...extraResults],
  bugs: [...report.bugs],
};

console.log(formatReport(finalReport));

// Summary line for quick scanning
const status = finalReport.failed === 0 ? "ALL PASSED" : `${finalReport.failed} FAILED`;
console.log(`\n>> ${finalReport.project}: ${finalReport.total} tests, ${finalReport.passed} passed, ${finalReport.failed} failed — ${status}`);
if (finalReport.bugs.length > 0) {
  console.log(`>> Bugs found: ${finalReport.bugs.length}`);
}
