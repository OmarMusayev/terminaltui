import {
  defineSite,
  page,
  card,
  section,
  table,
  link,
  markdown,
  spacer,
} from "../../src/index.js";

export default defineSite({
  name: "The Rusty Fork",
  tagline: "Modern American kitchen & craft cocktails",
  banner: {
    text: "RUSTY FORK",
    font: "Calvin S",
    gradient: ["#d4a373", "#e63946"],
  },
  theme: "gruvbox",
  borders: "rounded",
  animations: {
    boot: true,
    transitions: "fade",
    exitMessage: "Thanks for dining with us!",
  },
  pages: [
    page("menu", {
      title: "Menu",
      icon: "*",
      content: [
        section("Starters", [
          card({
            title: "Burrata & Heirloom Tomato",
            subtitle: "$16",
            body: "Creamy burrata over vine-ripened heirloom tomatoes with aged balsamic reduction, basil oil, and flaky Maldon sea salt.",
          }),
          card({
            title: "Charred Octopus",
            subtitle: "$19",
            body: "Spanish octopus grilled over binchotan charcoal, served with fingerling potatoes, smoked paprika aioli, and pickled fresno chilis.",
          }),
          card({
            title: "Bone Marrow & Toast",
            subtitle: "$17",
            body: "Roasted bone marrow with chimichurri, capers, shallot jam, and grilled sourdough from our house bakery.",
          }),
          card({
            title: "Tuna Tartare",
            subtitle: "$21",
            body: "Yellowfin tuna with avocado mousse, crispy shallots, ponzu, and sesame tuile. Served with wonton chips.",
          }),
        ]),
        spacer(),
        section("Mains", [
          card({
            title: "Dry-Aged Ribeye",
            subtitle: "$52",
            body: "45-day dry-aged prime ribeye, 16oz. Served with truffle pommes purée, roasted bone marrow butter, and charred broccolini.",
          }),
          card({
            title: "Pan-Seared Halibut",
            subtitle: "$38",
            body: "Wild Alaskan halibut with saffron risotto, English peas, Meyer lemon beurre blanc, and crispy capers.",
          }),
          card({
            title: "Duck Breast",
            subtitle: "$36",
            body: "Muscovy duck breast with tart cherry gastrique, sweet potato gratin, wilted arugula, and candied pecans.",
          }),
          card({
            title: "Handmade Pappardelle",
            subtitle: "$28",
            body: "Fresh egg pappardelle with slow-braised short rib ragù, pecorino Romano, and gremolata. Our signature pasta.",
          }),
          card({
            title: "Whole Roasted Branzino",
            subtitle: "$34",
            body: "Mediterranean sea bass roasted whole with fennel, Castelvetrano olives, cherry tomatoes, and salsa verde.",
          }),
        ]),
        spacer(),
        section("Desserts", [
          card({
            title: "Dark Chocolate Fondant",
            subtitle: "$14",
            body: "Valrhona 70% dark chocolate with a molten center, served with salted caramel gelato and cocoa nib tuile.",
          }),
          card({
            title: "Crème Brûlée",
            subtitle: "$12",
            body: "Classic Tahitian vanilla bean custard with a caramelized sugar crust. Simple, perfect, timeless.",
          }),
          card({
            title: "Seasonal Panna Cotta",
            subtitle: "$13",
            body: "Buttermilk panna cotta with roasted stone fruit compote, honey, and toasted pistachios.",
          }),
          card({
            title: "Cheese Board",
            subtitle: "$22",
            body: "Selection of five artisanal cheeses with honeycomb, fig preserves, marcona almonds, and house-made crackers.",
          }),
        ]),
        spacer(),
        section("Cocktails", [
          card({
            title: "The Rusty Nail",
            subtitle: "$16",
            body: "Our namesake. Blended Scotch, Drambuie, house-made honey syrup, and a torched orange peel. Smoky, sweet, unforgettable.",
          }),
          card({
            title: "Garden of Eden",
            subtitle: "$15",
            body: "Empress gin, elderflower liqueur, cucumber, fresh basil, lime, and sparkling water. Changes color as you drink.",
          }),
          card({
            title: "Midnight in Oaxaca",
            subtitle: "$17",
            body: "Mezcal, Ancho Reyes, fresh lime, agave, and activated charcoal. Served in a smoked glass with a chili-salt rim.",
          }),
          card({
            title: "Paper Plane",
            subtitle: "$15",
            body: "Equal parts bourbon, Aperol, Amaro Nonino, and fresh lemon. A modern classic — bitter, bright, and perfectly balanced.",
          }),
        ]),
      ],
    }),

    page("wine", {
      title: "Wine",
      icon: "~",
      content: [
        section("Wine Selection", [
          card({
            title: "Domaine Tempier Bandol Rosé",
            subtitle: "$18 / $72",
            body: "Provence, France — Dry, elegant Mourvèdre-based rosé with notes of white peach, wild herbs, and sea spray. The benchmark for serious rosé.",
          }),
          card({
            title: "Cloudy Bay Sauvignon Blanc",
            subtitle: "$16 / $64",
            body: "Marlborough, New Zealand — Vibrant and aromatic with passion fruit, citrus, and a crisp mineral finish. Perfect with our halibut.",
          }),
          card({
            title: "Domaine Weinbach Riesling Grand Cru",
            subtitle: "$22 / $88",
            body: "Alsace, France — Off-dry with stunning acidity. Stone fruit, petrol, and white flowers. Pairs beautifully with the duck breast.",
          }),
          card({
            title: "Ridge Monte Bello Cabernet Sauvignon",
            subtitle: "$32 / $128",
            body: "Santa Cruz Mountains, CA — Structured and age-worthy. Dark cassis, graphite, dried herbs, and iron. Decanted tableside.",
          }),
          card({
            title: "Barolo Massolino Parussi",
            subtitle: "$28 / $112",
            body: "Piedmont, Italy — Single vineyard Nebbiolo with rose petal, tar, and cherry. Earthy and elegant with silky tannins. A stunner.",
          }),
          card({
            title: "Château d'Yquem Sauternes",
            subtitle: "$45 (3oz pour)",
            body: "Bordeaux, France — The world's greatest dessert wine. Honeyed apricot, saffron, and crème brûlée. Pair with our cheese board.",
          }),
        ]),
      ],
    }),

    page("story", {
      title: "Our Story",
      icon: "&",
      content: [
        markdown(`
# Our Story

The Rusty Fork began in 2019 as a pop-up dinner series in a converted warehouse in the Arts District. Chef Marcus Bell, after 15 years in Michelin-starred kitchens across New York and Copenhagen, wanted to strip away the pretension and focus on what matters: exceptional ingredients cooked with care.

What started as monthly gatherings for 30 guests quickly became the hardest reservation in the city. In 2021, we opened our permanent home — a restored 1920s hardware store with exposed brick, salvaged wood, and an open kitchen where the action is the entertainment.

Our philosophy is simple: source obsessively, cook honestly, and never stop learning. We work with 12 local farms, butcher whole animals in-house, and bake all our bread and pastries daily. The menu changes with the seasons because the best food is the food that's ready right now.

The name? Marcus found a rusty fork buried in the wall during renovation. It's been our good luck charm ever since. You'll find it framed behind the bar.
        `),
        spacer(),
        section("Press", [
          card({
            title: "\"Precise, soulful, and completely unpretentious.\"",
            subtitle: "The New York Times",
            body: "One of the most exciting restaurants to open in the last five years. Chef Bell's cooking is precise, soulful, and completely unpretentious.",
          }),
          card({
            title: "\"This is food that makes you feel alive.\"",
            subtitle: "Bon Appétit",
            body: "The Rusty Fork proves that great dining doesn't need white tablecloths. This is food that makes you feel alive.",
          }),
          card({
            title: "\"A masterclass in restraint. Two stars.\"",
            subtitle: "Michelin Guide",
            body: "Every dish is exactly what it needs to be — nothing more, nothing less. Two stars, well deserved.",
          }),
        ]),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "@",
      content: [
        table(
          ["Day", "Lunch", "Dinner"],
          [
            ["Monday", "Closed", "Closed"],
            ["Tuesday", "11:30 – 2:30", "5:30 – 10:00"],
            ["Wednesday", "11:30 – 2:30", "5:30 – 10:00"],
            ["Thursday", "11:30 – 2:30", "5:30 – 10:30"],
            ["Friday", "11:30 – 2:30", "5:30 – 11:00"],
            ["Saturday", "10:00 – 3:00", "5:00 – 11:00"],
            ["Sunday", "10:00 – 3:00", "5:00 – 9:30"],
          ]
        ),
        spacer(),
        markdown(`
**The Rusty Fork**
742 Arts District Blvd
Los Angeles, CA 90013

Reservations recommended. Walk-ins welcome at the bar.
Valet parking available Thursday – Saturday.
        `),
        spacer(),
        link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
        link("Call Us — (213) 555-0142", "tel:+12135550142", { icon: ">" }),
        link("View on Google Maps", "https://maps.google.com/?q=742+Arts+District+Blvd+Los+Angeles+CA", { icon: ">" }),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "->",
      content: [
        link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
        link("Instagram", "https://instagram.com/therustyfork", { icon: ">" }),
        link("Email", "mailto:hello@therustyfork.com", { icon: ">" }),
        link("Phone", "tel:+12135550142", { icon: ">" }),
      ],
    }),
  ],
});
