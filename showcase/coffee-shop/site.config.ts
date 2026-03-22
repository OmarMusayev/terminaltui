import {
  defineSite,
  page,
  card,
  section,
  link,
  markdown,
  spacer,
} from "../../src/index.js";

export default defineSite({
  name: "Ember & Brew",
  tagline: "Specialty coffee roasters — est. 2019",
  banner: {
    text: "EMBER",
    font: "Bloody",
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
        section("Espresso", [
          card({
            title: "Espresso",
            subtitle: "$3.50",
            body: "Double shot pulled on our La Marzocca Strada. Rotating single-origin, dialed in fresh every morning.",
          }),
          card({
            title: "Cortado",
            subtitle: "$4.50",
            body: "Equal parts espresso and steamed milk in a 4oz Gibraltar glass. Smooth, balanced, no foam.",
          }),
          card({
            title: "Flat White",
            subtitle: "$5.00",
            body: "Double ristretto with velvety microfoam milk. Silky texture, strong coffee flavor. Our most popular drink.",
          }),
          card({
            title: "Cappuccino",
            subtitle: "$5.00",
            body: "Classic Italian proportions — one-third espresso, one-third steamed milk, one-third dense foam. Latte art on every cup.",
          }),
          card({
            title: "Oat Latte",
            subtitle: "$5.50",
            body: "Double shot with Oatly Barista oat milk. Naturally sweet, creamy, and full-bodied. Available hot or iced.",
          }),
          card({
            title: "Mocha",
            subtitle: "$5.50",
            body: "Espresso with house-made dark chocolate ganache and steamed milk. We use Valrhona 66% — no syrups, no shortcuts.",
          }),
        ]),
        spacer(),
        section("Filter Coffee", [
          card({
            title: "Pour Over",
            subtitle: "$5.00",
            body: "Single cup brewed on a Kalita Wave. Choose from our rotating selection of single-origin beans. Brewed to order — please allow 4 minutes.",
          }),
          card({
            title: "Batch Brew",
            subtitle: "$3.00",
            body: "Always fresh, never more than 30 minutes old. Our house blend — a crowd-pleasing mix of Colombian and Ethiopian naturals.",
          }),
          card({
            title: "Cold Brew",
            subtitle: "$5.00",
            body: "Steeped for 18 hours with our Guatemala Antigua. Clean, chocolatey, and dangerously smooth. Served over ice or on nitro tap.",
          }),
          card({
            title: "AeroPress",
            subtitle: "$5.50",
            body: "Inverted method, 2-minute steep, bypassed. Produces a clean, concentrated cup with bright acidity. Barista's choice of bean.",
          }),
        ]),
        spacer(),
        section("Tea", [
          card({
            title: "Matcha Latte",
            subtitle: "$5.50",
            body: "Ceremonial-grade Uji matcha from Kyoto, Japan. Whisked to order with your choice of milk. Earthy, sweet, and vibrant green.",
          }),
          card({
            title: "Hojicha Latte",
            subtitle: "$5.00",
            body: "Roasted Japanese green tea with a toasty, caramel-like flavor. Lower caffeine than matcha — perfect for afternoons.",
          }),
          card({
            title: "Chai",
            subtitle: "$5.00",
            body: "House-made masala chai simmered with whole spices — cardamom, cinnamon, clove, black pepper, and fresh ginger. Not from a box.",
          }),
          card({
            title: "Loose Leaf Selection",
            subtitle: "$4.00",
            body: "Rotating selection of premium loose leaf teas. Currently: Darjeeling first flush, Tie Guan Yin oolong, and Egyptian chamomile.",
          }),
        ]),
        spacer(),
        section("Pastries", [
          card({
            title: "Almond Croissant",
            subtitle: "$5.50",
            body: "Twice-baked butter croissant filled with frangipane cream, topped with sliced almonds and powdered sugar. Baked at 5am daily.",
          }),
          card({
            title: "Banana Bread",
            subtitle: "$4.00",
            body: "Dense, moist, and loaded with walnuts. Made with brown butter and a hint of tahini. Vegan option available.",
          }),
          card({
            title: "Morning Bun",
            subtitle: "$4.50",
            body: "Flaky laminated pastry rolled with orange zest, cinnamon, and brown sugar. The Tartine classic. Gone by 10am most days.",
          }),
          card({
            title: "Seasonal Scone",
            subtitle: "$4.00",
            body: "This week: Meyer lemon and poppy seed with a vanilla bean glaze. Crispy outside, tender inside. Pairs beautifully with a pour over.",
          }),
          card({
            title: "Cookie",
            subtitle: "$3.50",
            body: "Brown butter chocolate chip with Maldon sea salt. Crispy edges, gooey center. Made with three kinds of chocolate. Our cult favorite.",
          }),
        ]),
      ],
    }),

    page("beans", {
      title: "Our Beans",
      icon: "~",
      content: [
        markdown(`
# Currently Roasting

We source directly from smallholder farms and cooperatives. Every bag is roasted in small batches at our roastery in the back of the shop. Here's what's on the shelf right now.
        `),
        spacer(),
        card({
          title: "Ethiopia Yirgacheffe — Kochere",
          subtitle: "$22 / 12oz",
          body: "Bright and complex with notes of jasmine, bergamot, and ripe blueberry. A natural process lot from the Kochere district at 2,100 meters. Our lightest roast — best as a pour over.",
          tags: ["Light Roast", "Washed", "Floral"],
        }),
        card({
          title: "Colombia Huila — La Esperanza",
          subtitle: "$19 / 12oz",
          body: "Sweet and balanced with brown sugar, red apple, and a hint of cinnamon. Grown by the Ortega family at Finca La Esperanza, 1,800 meters. Works beautifully in any brew method.",
          tags: ["Medium Roast", "Washed", "Sweet"],
        }),
        card({
          title: "Guatemala Antigua — Finca El Cerezo",
          subtitle: "$20 / 12oz",
          body: "Rich and full-bodied with dark chocolate, toasted almond, and a clean caramel finish. Our go-to for cold brew and espresso. A crowd favorite since day one.",
          tags: ["Medium-Dark Roast", "Washed", "Chocolatey"],
        }),
        card({
          title: "Kenya AA — Nyeri",
          subtitle: "$24 / 12oz",
          body: "Intense and juicy with blackcurrant, grapefruit, and a sparkling phosphoric acidity. Double-washed and sun-dried at 1,900 meters. Not for the faint of heart — this coffee wakes you up in every sense.",
          tags: ["Light Roast", "Washed", "Fruity"],
        }),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "@",
      content: [
        card({
          title: "Hours",
          subtitle: "Open 7 days",
          body: "Mon – Fri\u2003\u20036:30 AM – 5:00 PM\nSaturday\u2003\u20037:00 AM – 5:00 PM\nSunday\u2003\u2003\u20037:30 AM – 4:00 PM",
        }),
        spacer(),
        card({
          title: "Ember & Brew",
          subtitle: "NE Alberta",
          body: "1847 NE Alberta Street\nPortland, OR 97211\n\nStreet parking available. Bike rack out front.\nDogs welcome on the patio.",
        }),
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
        link("Instagram", "https://instagram.com/emberandbrew", { icon: ">" }),
        link("Order Online", "https://order.emberandbrew.com", { icon: ">" }),
        link("Wholesale Inquiries", "mailto:wholesale@emberandbrew.com", { icon: ">" }),
        link("Gift Cards", "https://emberandbrew.com/gift", { icon: ">" }),
        link("Join Our Newsletter", "https://emberandbrew.com/newsletter", { icon: ">" }),
        link("Careers", "https://emberandbrew.com/careers", { icon: ">" }),
      ],
    }),
  ],
});
