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
      placeholder: "Search drinks and pastries...",
      action: "navigate",
      maxResults: 5,
      items: [
        { label: "Espresso", value: "espresso", keywords: ["coffee", "double shot", "La Marzocca"] },
        { label: "Cortado", value: "cortado", keywords: ["coffee", "espresso", "milk", "Gibraltar"] },
        { label: "Flat White", value: "flat-white", keywords: ["coffee", "espresso", "microfoam"] },
        { label: "Cappuccino", value: "cappuccino", keywords: ["coffee", "foam", "latte art"] },
        { label: "Oat Latte", value: "oat-latte", keywords: ["coffee", "oat milk", "iced", "Oatly"] },
        { label: "Pour Over", value: "pour-over", keywords: ["filter", "Kalita Wave", "single-origin"] },
        { label: "Batch Brew", value: "batch-brew", keywords: ["filter", "drip", "house blend"] },
        { label: "Cold Brew", value: "cold-brew", keywords: ["coffee", "iced", "nitro", "18 hour"] },
        { label: "AeroPress", value: "aeropress", keywords: ["filter", "inverted", "concentrated"] },
        { label: "Matcha Latte", value: "matcha-latte", keywords: ["tea", "matcha", "Uji", "Kyoto"] },
        { label: "Hojicha Latte", value: "hojicha-latte", keywords: ["tea", "roasted", "Japanese"] },
        { label: "Chai", value: "chai", keywords: ["tea", "spiced", "masala", "cardamom"] },
        { label: "London Fog", value: "london-fog", keywords: ["tea", "Earl Grey", "vanilla", "lavender"] },
        { label: "Loose Leaf Selection", value: "loose-leaf", keywords: ["tea", "Darjeeling", "oolong"] },
        { label: "Almond Croissant", value: "almond-croissant", keywords: ["pastry", "frangipane", "baked"] },
        { label: "Banana Bread", value: "banana-bread", keywords: ["pastry", "walnut", "vegan"] },
        { label: "Morning Bun", value: "morning-bun", keywords: ["pastry", "cinnamon", "orange zest"] },
        { label: "Seasonal Scone", value: "seasonal-scone", keywords: ["pastry", "Meyer lemon", "poppy seed"] },
        { label: "Cookie", value: "cookie", keywords: ["pastry", "chocolate chip", "brown butter"] },
      ],
    }),
    spacer(),
    tabs([
      {
        label: "Espresso",
        content: [
          row([
            col([
              card({
                title: "Espresso",
                subtitle: "$3.50",
                body: "Double shot pulled on our La Marzocca Strada. We rotate single-origin beans and dial in fresh every morning. Clean, syrupy, and intense.",
              }),
              card({
                title: "Cortado",
                subtitle: "$4.50",
                body: "Equal parts espresso and steamed milk in a 4oz Gibraltar glass. Smooth and balanced with no foam — lets the coffee speak for itself.",
              }),
              card({
                title: "Oat Latte",
                subtitle: "$5.50",
                body: "Double shot with Oatly Barista oat milk. Naturally sweet, creamy, and full-bodied. Available hot or iced. Add lavender or vanilla for $0.75.",
              }),
            ], { span: 6, xs: 12 }),
            col([
              card({
                title: "Flat White",
                subtitle: "$5.00",
                body: "Double ristretto with velvety microfoam. Silky texture and a strong coffee flavor that lingers. Our most popular drink by a wide margin.",
              }),
              card({
                title: "Cappuccino",
                subtitle: "$5.00",
                body: "Classic Italian proportions — one-third espresso, one-third steamed milk, one-third dense foam. Latte art on every cup, because life is short.",
              }),
            ], { span: 6, xs: 12 }),
          ]),
        ],
      },
      {
        label: "Filter",
        content: [
          row([
            col([
              card({
                title: "Pour Over",
                subtitle: "$5.00",
                body: "Single cup brewed on a Kalita Wave. Choose from our rotating single-origin selection. Brewed to order — please allow 4 minutes for something worth waiting for.",
              }),
              card({
                title: "Batch Brew",
                subtitle: "$3.00",
                body: "Always fresh, never older than 30 minutes. Our house blend of Colombian and Ethiopian naturals — crowd-pleasing, clean, and endlessly drinkable.",
              }),
              card({
                title: "AeroPress",
                subtitle: "$4.50",
                body: "Inverted method, single cup. Concentrated and clean with a body somewhere between espresso and pour over. Great with our Ethiopian beans.",
              }),
            ], { span: 6, xs: 12 }),
            col([
              card({
                title: "Cold Brew",
                subtitle: "$5.00",
                body: "Steeped for 18 hours with our Guatemala Antigua. Chocolatey, clean, and dangerously smooth. Served over ice or from the nitro tap.",
              }),
              card({
                title: "Matcha Latte",
                subtitle: "$5.50",
                body: "Ceremonial-grade Uji matcha from Kyoto, whisked to order with your choice of milk. Earthy, sweet, and vibrant green. A ritual in a cup.",
              }),
              card({
                title: "Chai",
                subtitle: "$5.00",
                body: "House-made masala chai simmered with whole spices — cardamom, cinnamon, clove, black pepper, and fresh ginger. Not from a box, never from a syrup.",
              }),
            ], { span: 6, xs: 12 }),
          ]),
        ],
      },
      {
        label: "Pastries",
        content: [
          row([
            col([
              card({
                title: "Almond Croissant",
                subtitle: "$5.50",
                body: "Twice-baked butter croissant filled with frangipane cream, topped with sliced almonds and powdered sugar. Baked at 5am daily. Gone by noon.",
              }),
              card({
                title: "Banana Bread",
                subtitle: "$4.00",
                body: "Dense, moist, and loaded with walnuts. Made with brown butter and a drizzle of tahini. Vegan option available — just ask at the counter.",
              }),
              card({
                title: "Morning Bun",
                subtitle: "$4.50",
                body: "Flaky laminated pastry rolled with orange zest, cinnamon, and brown sugar. Inspired by the Tartine classic. Usually gone by 10am.",
              }),
            ], { span: 6, xs: 12 }),
            col([
              card({
                title: "Seasonal Scone",
                subtitle: "$4.00",
                body: "This week: Meyer lemon and poppy seed with a vanilla bean glaze. Crispy outside, tender inside. Pairs beautifully with a pour over.",
              }),
              card({
                title: "Cookie",
                subtitle: "$3.50",
                body: "Brown butter chocolate chip with Maldon sea salt. Crispy edges, gooey center. Made with three kinds of Valrhona chocolate. Our cult favorite.",
              }),
            ], { span: 6, xs: 12 }),
          ]),
        ],
      },
    ]),
  ];
}
