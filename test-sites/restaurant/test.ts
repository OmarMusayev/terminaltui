import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, quote, table, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "The Rusty Fork",
  tagline: "Farm-to-table dining in the heart of downtown",
  theme: "gruvbox" as const,
  borders: "rounded" as const,
  pages: [
    page("menu", {
      title: "Menu",
      icon: "🍽",
      content: [
        section("Starters", [
          card({ title: "Roasted Beet Salad", body: "Heirloom beets, goat cheese mousse, candied walnuts, citrus vinaigrette. Served on a bed of wild arugula.", subtitle: "$14" }),
          card({ title: "Charred Octopus", body: "Spanish octopus, romesco sauce, fingerling potatoes, smoked paprika oil. Grilled over mesquite.", subtitle: "$18" }),
          card({ title: "Burrata & Stone Fruit", body: "Creamy burrata, seasonal stone fruit, basil oil, aged balsamic, grilled sourdough.", subtitle: "$16" }),
        ]),
        spacer(1),
        section("Mains", [
          card({ title: "Pan-Seared Salmon", body: "Wild-caught king salmon, forbidden rice, miso butter, pickled ginger, crispy shallots.", subtitle: "$32" }),
          card({ title: "Braised Short Rib", body: "72-hour braised beef short rib, celery root puree, red wine jus, gremolata.", subtitle: "$38" }),
          card({ title: "Wild Mushroom Risotto", body: "Arborio rice, foraged mushroom medley, truffle oil, aged parmesan, fresh thyme.", subtitle: "$26" }),
          card({ title: "Grilled Heritage Pork Chop", body: "Double-cut Berkshire pork, apple mostarda, roasted root vegetables, sage brown butter.", subtitle: "$34" }),
        ]),
        spacer(1),
        section("Desserts", [
          card({ title: "Dark Chocolate Torte", body: "Valrhona chocolate, espresso crème anglaise, hazelnut praline, gold leaf.", subtitle: "$14" }),
          card({ title: "Lemon Posset", body: "Meyer lemon cream, fresh berries, shortbread crumble, vanilla bean.", subtitle: "$12" }),
          card({ title: "Cheese Board", body: "Rotating selection of three artisan cheeses, honeycomb, fig jam, marcona almonds.", subtitle: "$18" }),
        ]),
      ],
    }),
    page("story", {
      title: "Our Story",
      icon: "📖",
      content: [
        markdown(
          "## From a Food Truck to Your Table\n\n" +
          "The Rusty Fork started in 2018 as a beat-up food truck parked outside a brewery in Portland. " +
          "Chef Marcus Bell had just left a Michelin-starred kitchen in San Francisco with a simple idea: " +
          "serve honest food made from ingredients grown within 50 miles.\n\n" +
          "Three years and a lot of late nights later, we opened our brick-and-mortar location on SE Division. " +
          "The truck is retired now — it sits in our parking lot as a reminder of where we started — but the " +
          "philosophy hasn't changed. Every dish on our menu tells the story of the farmers, foragers, and " +
          "makers who grew it.\n\n" +
          "We change our menu seasonally, source our proteins from ranches we've visited personally, and " +
          "bake all our bread in-house every morning before dawn."
        ),
        spacer(1),
        quote("Marcus doesn't cook to impress. He cooks to connect. That's what makes The Rusty Fork special.", "Portland Monthly"),
        quote("The best farm-to-table experience in the Pacific Northwest, hands down.", "Bon Appétit"),
        quote("A restaurant that actually lives up to the hype. Every single bite tells you someone cared.", "Eater Portland"),
      ],
    }),
    page("hours", {
      title: "Hours & Location",
      icon: "🕐",
      content: [
        table(
          ["Day", "Lunch", "Dinner"],
          [
            ["Monday", "Closed", "Closed"],
            ["Tuesday", "11:30 — 2:00", "5:00 — 9:30"],
            ["Wednesday", "11:30 — 2:00", "5:00 — 9:30"],
            ["Thursday", "11:30 — 2:00", "5:00 — 10:00"],
            ["Friday", "11:30 — 2:30", "5:00 — 10:30"],
            ["Saturday", "10:00 — 2:30", "5:00 — 10:30"],
            ["Sunday", "10:00 — 2:30", "5:00 — 9:00"],
          ]
        ),
        spacer(1),
        markdown("**Address:** 2847 SE Division St, Portland, OR 97202\n\n**Phone:** (503) 555-0178\n\nReservations recommended for parties of 4 or more. Walk-ins welcome at the bar."),
        spacer(1),
        link("Make a Reservation", "https://resy.com/cities/pdx/the-rusty-fork"),
      ],
    }),
    page("contact", {
      title: "Contact",
      icon: "📬",
      content: [
        link("Instagram", "https://instagram.com/therustyforkpdx"),
        link("Email Us", "mailto:hello@therustyfork.com"),
        link("Careers", "https://therustyfork.com/careers"),
        link("Press Inquiries", "mailto:press@therustyfork.com"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-2-restaurant");
writeFileSync("test-sites/restaurant/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 2 — Restaurant (The Rusty Fork): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
