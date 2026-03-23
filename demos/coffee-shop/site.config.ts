import {
  defineSite,
  page,
  card,
  divider,
  link,
  markdown,
  spacer,
  table,
  searchInput,
  textInput,
  textArea,
  select,
  button,
  form,
} from "../../src/index.js";

export default defineSite({
  name: "Ember & Brew",
  tagline: "specialty coffee roasters — est. 2019",
  banner: {
    text: "EMBER",
    font: "Bloody",
    gradient: ["#f5c2e7", "#cba6f7"],
  },
  theme: "catppuccin",
  borders: "rounded",
  animations: {
    boot: true,
  },
  pages: [
    page("menu", {
      title: "Menu",
      icon: "*",
      content: [
        searchInput({
          id: "search-menu",
          placeholder: "Search drinks and pastries...",
          action: "navigate",
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
        divider("Espresso"),
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
          title: "Flat White",
          subtitle: "$5.00",
          body: "Double ristretto with velvety microfoam. Silky texture and a strong coffee flavor that lingers. Our most popular drink by a wide margin.",
        }),
        card({
          title: "Cappuccino",
          subtitle: "$5.00",
          body: "Classic Italian proportions — one-third espresso, one-third steamed milk, one-third dense foam. Latte art on every cup, because life is short.",
        }),
        card({
          title: "Oat Latte",
          subtitle: "$5.50",
          body: "Double shot with Oatly Barista oat milk. Naturally sweet, creamy, and full-bodied. Available hot or iced. Add lavender or vanilla for $0.75.",
        }),
        spacer(),
        divider("Filter & Tea"),
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
        spacer(),
        divider("Pastries"),
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
      ],
    }),

    page("beans", {
      title: "Our Beans",
      icon: "~",
      content: [
        markdown(`
# Currently Roasting

We source directly from smallholder farms and cooperatives across three continents. Every bag is roasted in small batches at our roastery in the back of the shop.
        `),
        spacer(),
        card({
          title: "Ethiopian Yirgacheffe — Kochere",
          subtitle: "$22 / 12oz",
          body: "Bright and complex with notes of jasmine, bergamot, and ripe blueberry. A natural process lot from the Kochere district at 2,100 meters. Our lightest roast — best as a pour over or AeroPress.",
          tags: ["Light Roast", "Natural Process", "Floral", "Fruity"],
        }),
        card({
          title: "Colombian Huila — La Esperanza",
          subtitle: "$19 / 12oz",
          body: "Sweet and balanced with brown sugar, red apple, and a hint of cinnamon. Grown by the Ortega family at Finca La Esperanza, 1,800 meters. Works beautifully in any brew method.",
          tags: ["Medium Roast", "Washed", "Sweet", "Versatile"],
        }),
        card({
          title: "Guatemalan Antigua — Finca El Cerezo",
          subtitle: "$20 / 12oz",
          body: "Rich and full-bodied with dark chocolate, toasted almond, and a clean caramel finish. Volcanic soil, shade-grown at 1,500 meters. Our go-to for espresso and cold brew.",
          tags: ["Medium-Dark Roast", "Washed", "Chocolatey"],
        }),
        card({
          title: "Kenyan AA — Nyeri",
          subtitle: "$24 / 12oz",
          body: "Intense and juicy with blackcurrant, grapefruit, and a sparkling phosphoric acidity. Double-washed and sun-dried at 1,900 meters. Not for the faint of heart.",
          tags: ["Light Roast", "Double-Washed", "Fruity", "Bright"],
        }),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "@",
      content: [
        table(
          ["Day", "Hours"],
          [
            ["Monday - Friday", "6:30 AM - 5:00 PM"],
            ["Saturday", "7:00 AM - 5:00 PM"],
            ["Sunday", "7:30 AM - 4:00 PM"],
            ["Holidays", "8:00 AM - 2:00 PM"],
          ],
        ),
        spacer(),
        markdown(`
### Find Us

**Ember & Brew**
1847 NE Alberta Street
Portland, OR 97211

Street parking available on Alberta and side streets. Bike rack out front. Dogs welcome on the patio — we keep treats behind the counter.
        `),
        spacer(),
        link("Get Directions", "https://maps.google.com/?q=1847+NE+Alberta+St+Portland+OR+97211", { icon: ">" }),
        link("Order Ahead for Pickup", "https://order.emberandbrew.com", { icon: ">" }),
        link("Call Us — (503) 555-0179", "tel:+15035550179", { icon: ">" }),
      ],
    }),

    page("connect", {
      title: "Connect",
      icon: "->",
      content: [
        form({
          id: "catering-inquiry",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `Thanks, ${data.name}! We'll be in touch about your ${data.type} inquiry within 48 hours.`,
          }),
          fields: [
            textInput({
              id: "name",
              label: "Name",
              validate: (v) => (v.trim() ? null : "Required"),
            }),
            textInput({
              id: "email",
              label: "Email",
              validate: (v) => (v.includes("@") ? null : "Enter a valid email"),
            }),
            select({
              id: "type",
              label: "Inquiry Type",
              options: [
                { label: "Catering", value: "catering" },
                { label: "Event", value: "event" },
                { label: "Wholesale", value: "wholesale" },
                { label: "Other", value: "other" },
              ],
            }),
            textArea({
              id: "details",
              label: "Details",
              rows: 3,
              placeholder: "Tell us about your event, order size, or question...",
            }),
            button({ label: "Submit Inquiry", style: "primary" }),
          ],
        }),
        spacer(),
        link("Instagram", "https://instagram.com/emberandbrew", { icon: ">" }),
        link("Order Online", "https://order.emberandbrew.com", { icon: ">" }),
        link("Wholesale Inquiries", "mailto:wholesale@emberandbrew.com", { icon: ">" }),
        link("Gift Cards", "https://emberandbrew.com/gift", { icon: ">" }),
      ],
    }),
  ],
});
