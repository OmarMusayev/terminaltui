import {
  defineSite,
  page,
  card,
  divider,
  table,
  link,
  markdown,
  spacer,
  form,
  textInput,
  textArea,
  select,
  numberInput,
  button,
  searchInput,
  quote,
  split,
  tabs,
  row,
  col,
  container,
  section,
} from "../../src/index.js";

export default defineSite({
  name: "The Rusty Fork",
  tagline: "farm-to-table dining since 2018",
  banner: {
    text: "RUSTY FORK",
    font: "Ogre",
    gradient: ["#fe8019", "#fabd2f"],
  },
  theme: "gruvbox",
  borders: "rounded",
  animations: {
    boot: true,
    transitions: "fade",
  },
  pages: [
    page("menu", {
      title: "Menu",
      icon: "*",
      content: [
        searchInput({
          id: "search-menu",
          placeholder: "Search the menu...",
          action: "navigate",
          items: [
            { label: "Burrata & Heirloom Tomato", value: "burrata", keywords: ["starter", "vegetarian", "cheese"] },
            { label: "Charred Octopus", value: "octopus", keywords: ["starter", "seafood", "grilled"] },
            { label: "Bone Marrow & Toast", value: "bone-marrow", keywords: ["starter", "meat"] },
            { label: "Wild Mushroom Soup", value: "mushroom-soup", keywords: ["starter", "vegetarian", "vegan"] },
            { label: "Tuna Tartare", value: "tuna-tartare", keywords: ["starter", "raw", "seafood"] },
            { label: "Dry-Aged Ribeye", value: "ribeye", keywords: ["main", "steak", "beef"] },
            { label: "Pan-Seared Halibut", value: "halibut", keywords: ["main", "seafood", "fish"] },
            { label: "Duck Breast", value: "duck", keywords: ["main", "poultry"] },
            { label: "Handmade Pappardelle", value: "pappardelle", keywords: ["main", "pasta", "vegetarian option"] },
            { label: "Whole Roasted Branzino", value: "branzino", keywords: ["main", "seafood", "fish"] },
            { label: "Dark Chocolate Fondant", value: "fondant", keywords: ["dessert", "chocolate"] },
            { label: "Creme Brulee", value: "creme-brulee", keywords: ["dessert", "classic"] },
            { label: "Seasonal Panna Cotta", value: "panna-cotta", keywords: ["dessert", "gluten free"] },
            { label: "Cheese Board", value: "cheese-board", keywords: ["dessert", "cheese", "vegetarian"] },
            { label: "The Rusty Nail", value: "rusty-nail", keywords: ["cocktail", "scotch", "signature"] },
            { label: "Garden of Eden", value: "garden-of-eden", keywords: ["cocktail", "gin", "refreshing"] },
            { label: "Midnight in Oaxaca", value: "oaxaca", keywords: ["cocktail", "mezcal", "smoky"] },
            { label: "Paper Plane", value: "paper-plane", keywords: ["cocktail", "bourbon", "bitter"] },
          ],
        }),
        spacer(),
        tabs([
          {
            label: "Starters",
            content: [
              row([
                col([
                  card({
                    title: "Burrata & Heirloom Tomato",
                    subtitle: "$16",
                    body: "Creamy burrata over vine-ripened heirloom tomatoes with aged balsamic reduction, basil oil, and flaky Maldon sea salt.",
                    tags: ["vegetarian", "gluten free"],
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
                    tags: ["gluten free option"],
                  }),
                ], { span: 6, xs: 12 }),
                col([
                  card({
                    title: "Charred Octopus",
                    subtitle: "$19",
                    body: "Spanish octopus grilled over binchotan charcoal, served with fingerling potatoes, smoked paprika aioli, and pickled fresno chilis.",
                    tags: ["gluten free"],
                  }),
                  card({
                    title: "Wild Mushroom Soup",
                    subtitle: "$14",
                    body: "A velvety blend of porcini, chanterelle, and hen-of-the-woods mushrooms finished with truffle cream and chive oil. Served with warm focaccia.",
                    tags: ["vegetarian", "vegan option"],
                  }),
                ], { span: 6, xs: 12 }),
              ]),
            ],
          },
          {
            label: "Mains",
            content: [
              row([
                col([
                  card({
                    title: "Dry-Aged Ribeye",
                    subtitle: "$52",
                    body: "45-day dry-aged prime ribeye, 16oz. Served with truffle pommes puree, roasted bone marrow butter, and charred broccolini.",
                    tags: ["gluten free"],
                  }),
                  card({
                    title: "Duck Breast",
                    subtitle: "$36",
                    body: "Muscovy duck breast with tart cherry gastrique, sweet potato gratin, wilted arugula, and candied pecans.",
                    tags: ["gluten free"],
                  }),
                  card({
                    title: "Whole Roasted Branzino",
                    subtitle: "$34",
                    body: "Mediterranean sea bass roasted whole with fennel, Castelvetrano olives, cherry tomatoes, and salsa verde. Deboned tableside.",
                    tags: ["gluten free"],
                  }),
                ], { span: 6, xs: 12 }),
                col([
                  card({
                    title: "Pan-Seared Halibut",
                    subtitle: "$38",
                    body: "Wild Alaskan halibut with saffron risotto, English peas, Meyer lemon beurre blanc, and crispy capers.",
                    tags: ["gluten free"],
                  }),
                  card({
                    title: "Handmade Pappardelle",
                    subtitle: "$28",
                    body: "Fresh egg pappardelle with slow-braised short rib ragu, pecorino Romano, and gremolata. Our signature pasta dish, perfected over six years.",
                    tags: ["signature dish"],
                  }),
                ], { span: 6, xs: 12 }),
              ]),
            ],
          },
          {
            label: "Desserts",
            content: [
              row([
                col([
                  card({
                    title: "Dark Chocolate Fondant",
                    subtitle: "$14",
                    body: "Valrhona 70% dark chocolate with a molten center, served with salted caramel gelato and cocoa nib tuile.",
                  }),
                  card({
                    title: "Seasonal Panna Cotta",
                    subtitle: "$13",
                    body: "Buttermilk panna cotta with roasted stone fruit compote, honey, and toasted pistachios.",
                    tags: ["gluten free"],
                  }),
                ], { span: 6, xs: 12 }),
                col([
                  card({
                    title: "Creme Brulee",
                    subtitle: "$12",
                    body: "Classic Tahitian vanilla bean custard with a caramelized sugar crust. Simple, perfect, timeless.",
                    tags: ["gluten free"],
                  }),
                  card({
                    title: "Cheese Board",
                    subtitle: "$22",
                    body: "Selection of five artisanal cheeses with honeycomb, fig preserves, marcona almonds, and house-made crackers.",
                    tags: ["vegetarian"],
                  }),
                ], { span: 6, xs: 12 }),
              ]),
            ],
          },
          {
            label: "Cocktails",
            content: [
              row([
                col([
                  card({
                    title: "The Rusty Nail",
                    subtitle: "$16",
                    body: "Our namesake. Blended Scotch, Drambuie, house-made honey syrup, and a torched orange peel. Smoky, sweet, unforgettable.",
                    tags: ["signature"],
                  }),
                  card({
                    title: "Midnight in Oaxaca",
                    subtitle: "$17",
                    body: "Mezcal, Ancho Reyes, fresh lime, agave, and activated charcoal. Served in a smoked glass with a chili-salt rim.",
                  }),
                ], { span: 6, xs: 12 }),
                col([
                  card({
                    title: "Garden of Eden",
                    subtitle: "$15",
                    body: "Empress gin, elderflower liqueur, cucumber, fresh basil, lime, and sparkling water. Changes color as you drink.",
                  }),
                  card({
                    title: "Paper Plane",
                    subtitle: "$15",
                    body: "Equal parts bourbon, Aperol, Amaro Nonino, and fresh lemon. A modern classic -- bitter, bright, and perfectly balanced.",
                  }),
                ], { span: 6, xs: 12 }),
              ]),
            ],
          },
        ]),
      ],
    }),

    page("wine", {
      title: "Wine",
      icon: "~",
      content: [
        tabs([
          {
            label: "Red",
            content: [
              card({
                title: "Ridge Monte Bello Cabernet Sauvignon",
                subtitle: "$32 / $128",
                body: "Santa Cruz Mountains, CA -- Structured and age-worthy. Dark cassis, graphite, dried herbs, and iron. Decanted tableside.",
              }),
              card({
                title: "Barolo Massolino Parussi",
                subtitle: "$28 / $112",
                body: "Piedmont, Italy -- Single vineyard Nebbiolo with rose petal, tar, and cherry. Earthy and elegant with silky tannins.",
              }),
              card({
                title: "Chateauneuf-du-Pape Clos des Papes",
                subtitle: "$26 / $104",
                body: "Rhone Valley, France -- Grenache-dominant blend with blackberry, lavender, garrigue, and warm spice. Exceptional with the ribeye.",
              }),
            ],
          },
          {
            label: "White",
            content: [
              card({
                title: "Cloudy Bay Sauvignon Blanc",
                subtitle: "$16 / $64",
                body: "Marlborough, New Zealand -- Vibrant and aromatic with passion fruit, citrus, and a crisp mineral finish. Perfect with our halibut.",
              }),
              card({
                title: "Domaine Weinbach Riesling Grand Cru",
                subtitle: "$22 / $88",
                body: "Alsace, France -- Off-dry with stunning acidity. Stone fruit, petrol, and white flowers. Pairs beautifully with the duck breast.",
              }),
              card({
                title: "Burgundy Meursault Roulot",
                subtitle: "$30 / $120",
                body: "Burgundy, France -- Rich Chardonnay with hazelnut, citrus peel, and a long mineral finish. No new oak, pure terroir expression.",
              }),
            ],
          },
          {
            label: "Sparkling",
            content: [
              card({
                title: "Champagne Billecart-Salmon Brut Rose",
                subtitle: "$24 / $96",
                body: "Champagne, France -- Delicate salmon pink with wild strawberry, brioche, and fine persistent bubbles. Our most popular aperitif.",
              }),
              card({
                title: "Franciacorta Ca' del Bosco Cuvee Prestige",
                subtitle: "$18 / $72",
                body: "Lombardy, Italy -- Italy's answer to Champagne. Crisp green apple, toasted almond, and elegant mousse. Outstanding value.",
              }),
            ],
          },
        ]),
      ],
    }),

    page("story", {
      title: "Our Story",
      icon: "&",
      content: [
        container([
          markdown(`
# Our Story

The Rusty Fork started as a Thursday-night supper club in a rented commercial kitchen
in Portland's Pearl District. Chef Elena Vasquez, after a decade cooking at restaurants
in San Sebastian, Mexico City, and New York, wanted to build something rooted in
community -- a place where the food was exceptional but the atmosphere felt like dinner
at a friend's house. The first menu was five dishes, one seating, thirty chairs.

Word spread fast. By 2019, we had outgrown the supper club and signed the lease on
our current space: a former ironworks foundry with 30-foot ceilings, original brick,
and a wood-fired hearth that anchors the open kitchen. We source from eleven farms
within 60 miles, butcher whole animals weekly, and bake every loaf of bread that
touches a table. The name came from a rusted fork Elena found embedded in the foundry
wall during demolition -- it hangs above the pass to this day.
          `),
          spacer(),
          quote(
            "The most exciting restaurant to open in Portland in years. Chef Vasquez cooks with the precision of fine dining and the soul of a home kitchen.",
            "The New York Times",
          ),
          quote(
            "This is food that makes you sit up straighter, then lean in closer. Every plate tells you exactly where it came from.",
            "Bon Appetit",
          ),
          quote(
            "A masterclass in restraint. Nothing on the plate that doesn't belong there. Two stars.",
            "Michelin Guide",
          ),
        ], { maxWidth: 80, padding: 1 }),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "@",
      content: [
        row([
          col([
            table(
              ["Day", "Lunch", "Dinner"],
              [
                ["Monday", "Closed", "Closed"],
                ["Tuesday", "11:30 - 2:30", "5:30 - 10:00"],
                ["Wednesday", "11:30 - 2:30", "5:30 - 10:00"],
                ["Thursday", "11:30 - 2:30", "5:30 - 10:30"],
                ["Friday", "11:30 - 2:30", "5:30 - 11:00"],
                ["Saturday", "10:00 - 3:00", "5:00 - 11:00"],
                ["Sunday", "10:00 - 3:00", "5:00 - 9:30"],
              ],
            ),
          ], { span: 7, xs: 12 }),
          col([
            markdown(`**The Rusty Fork**
827 NW Ironworks Lane
Portland, OR 97209

Reservations strongly recommended for dinner.
Walk-ins welcome at the bar and patio.
Valet parking available Friday and Saturday evenings.`),
            spacer(),
            markdown(`**Phone:** (503) 555-0187
**Email:** hello@therustyfork.com`),
          ], { span: 5, xs: 12, padding: 1 }),
        ]),
        spacer(),
        divider("Contact Us"),
        link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
        link("Google Maps", "https://maps.google.com/?q=827+NW+Ironworks+Lane+Portland+OR", { icon: ">" }),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "->",
      content: [
        split({
          direction: "horizontal",
          ratio: 40,
          first: [
            section("Get in Touch", [
              link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
              link("Instagram", "https://instagram.com/therustyfork", { icon: ">" }),
              link("Email", "mailto:hello@therustyfork.com", { icon: ">" }),
              link("Phone", "tel:+15035550187", { icon: ">" }),
              link("Google Maps", "https://maps.google.com/?q=827+NW+Ironworks+Lane+Portland+OR", { icon: ">" }),
            ]),
          ],
          second: [
            form({
              id: "reservation",
              resetOnSubmit: true,
              onSubmit: async (data) => ({
                success: `Table reserved for ${data.name}, party of ${data.partySize}. See you soon!`,
              }),
              fields: [
                textInput({
                  id: "name",
                  label: "Name",
                  validate: (v) => (v.length > 0 ? null : "Name is required"),
                }),
                textInput({
                  id: "email",
                  label: "Email",
                  validate: (v) => (v.includes("@") ? null : "Please enter a valid email"),
                }),
                select({ id: "date", label: "Date", options: [
                  { label: "Today", value: "today" },
                  { label: "Tomorrow", value: "tomorrow" },
                  { label: "This Friday", value: "friday" },
                  { label: "This Saturday", value: "saturday" },
                  { label: "This Sunday", value: "sunday" },
                ]}),
                numberInput({ id: "partySize", label: "Party Size", defaultValue: 2, min: 1, max: 12 }),
                textArea({ id: "specialRequests", label: "Special Requests", placeholder: "Allergies, celebrations, seating preferences...", rows: 3 }),
                button({ label: "Reserve Table", style: "primary" }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});
