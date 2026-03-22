import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, table, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "Ember & Brew",
  tagline: "Specialty coffee and wood-fired pastries",
  theme: "gruvbox" as const,
  borders: "rounded" as const,
  pages: [
    page("menu", {
      title: "Menu",
      icon: "☕",
      content: [
        section("Espresso Drinks", [
          card({ title: "Espresso", body: "Double shot pulled on our La Marzocca Strada. Bright, clean, with notes that shift with our rotating single-origin.", subtitle: "$4" }),
          card({ title: "Cortado", body: "Equal parts espresso and steamed milk. Served in a 4oz Gibraltar glass. Our most popular drink.", subtitle: "$5" }),
          card({ title: "Flat White", body: "Double ristretto with velvety microfoam. A bit stronger than a latte, a bit smoother than a cappuccino.", subtitle: "$5.50" }),
          card({ title: "Oat Milk Latte", body: "House-made oat milk steamed with a double shot. Naturally sweet with no added sugar. Available iced.", subtitle: "$6" }),
        ]),
        spacer(1),
        section("Filter Coffee", [
          card({ title: "Pour Over", body: "Single cup brewed on Kalita Wave. Takes 4 minutes but worth the wait. Ask about today's bean.", subtitle: "$5" }),
          card({ title: "Batch Brew", body: "Our daily blend brewed fresh every 30 minutes on a Fetco. Straightforward, reliable, excellent.", subtitle: "$3" }),
          card({ title: "Cold Brew", body: "Steeped for 18 hours with our custom dark roast blend. Served over ice with a splash of cream on request.", subtitle: "$5" }),
          card({ title: "AeroPress", body: "Our barista's choice preparation. Inverted method, 15-second bloom, full immersion. Bold and complex.", subtitle: "$5.50" }),
        ]),
        spacer(1),
        section("Pastries & Baked Goods", [
          card({ title: "Sourdough Croissant", body: "48-hour laminated dough made with cultured butter. Shatteringly flaky outside, honeycomb crumb inside. Baked every morning at 5 AM.", subtitle: "$5" }),
          card({ title: "Morning Bun", body: "Orange zest and cinnamon sugar rolled into laminated dough. Best eaten warm. Usually gone by 10 AM.", subtitle: "$4.50" }),
          card({ title: "Chocolate Babka", body: "Braided brioche with dark chocolate filling and streusel topping. Sliced to order from a whole loaf.", subtitle: "$6" }),
          card({ title: "Savory Scone", body: "Rotating flavor — this week: gruyere, black pepper, and chive. Dense, buttery, pairs perfectly with a cortado.", subtitle: "$4.50" }),
        ]),
        spacer(1),
        section("Non-Coffee Drinks", [
          card({ title: "Matcha Latte", body: "Ceremonial grade Uji matcha whisked with your choice of milk. Earthy, creamy, gently caffeinated.", subtitle: "$6" }),
          card({ title: "Chai", body: "House-made masala chai simmered with whole spices. Black tea, cardamom, ginger, black pepper, clove. Not too sweet.", subtitle: "$5" }),
          card({ title: "Hot Chocolate", body: "Valrhona dark chocolate melted into steamed whole milk. Topped with house-made whipped cream and cocoa nibs.", subtitle: "$5.50" }),
          card({ title: "Sparkling Water", body: "Topo Chico or house-made fruit shrub soda. Current flavors: blackberry-sage, grapefruit-rosemary.", subtitle: "$3" }),
        ]),
      ],
    }),
    page("beans", {
      title: "Our Beans",
      icon: "🫘",
      content: [
        card({
          title: "Ethiopia Yirgacheffe",
          body: "Washed process from the Gedeb district. Jasmine, bergamot, peach. Light roast — our most popular single origin. Grown at 2,000 meters by smallholder farmers in the Gedeo zone.",
          tags: ["Light Roast", "Washed", "Single Origin"],
        }),
        card({
          title: "Colombia Huila",
          body: "Honey processed from Finca El Paraiso. Brown sugar, red apple, milk chocolate. Medium roast that works beautifully as espresso or pour over.",
          tags: ["Medium Roast", "Honey Process", "Single Origin"],
        }),
        card({
          title: "Guatemala Antigua",
          body: "Full natural from the slopes of Volcán de Agua. Dark chocolate, toasted almond, dried fig. Our go-to for milk drinks and cold brew.",
          tags: ["Medium-Dark", "Natural", "Single Origin"],
        }),
        card({
          title: "House Blend",
          body: "A rotating blend designed for consistency and approachability. Currently: 60% Brazil Santos, 25% Colombia, 15% Ethiopia. Caramel, hazelnut, citrus finish.",
          tags: ["Blend", "Medium Roast", "Daily Driver"],
        }),
      ],
    }),
    page("hours", {
      title: "Hours & Location",
      icon: "🕐",
      content: [
        table(
          ["Day", "Hours"],
          [
            ["Monday — Friday", "6:30 AM — 4:00 PM"],
            ["Saturday", "7:00 AM — 5:00 PM"],
            ["Sunday", "7:00 AM — 3:00 PM"],
          ]
        ),
        spacer(1),
        markdown(
          "**Address:** 1847 NE Alberta St, Portland, OR 97211\n\n" +
          "Street parking available. Bike rack out front. We're the building with the big red door " +
          "and the smoke coming out of the chimney — that's the wood-fired oven, not a fire.\n\n" +
          "**WiFi:** Yes, but we turn it off on weekend mornings to encourage conversation. " +
          "If you need to work, come on a weekday.\n\n" +
          "**Dogs:** Well-behaved dogs welcome on the patio."
        ),
      ],
    }),
    page("connect", {
      title: "Connect",
      icon: "🔗",
      content: [
        link("Instagram", "https://instagram.com/emberandbrew"),
        link("Order Beans Online", "https://emberandbrew.com/shop"),
        link("Email", "mailto:hello@emberandbrew.com"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-8-cafe");
writeFileSync("test-sites/cafe/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 8 — Cafe (Ember & Brew): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
