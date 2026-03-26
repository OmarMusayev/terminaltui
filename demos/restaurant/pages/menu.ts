import {
  card,
  spacer,
  searchInput,
  tabs,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Menu", icon: "*" };

export default function Menu() {
  return [
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
  ];
}
