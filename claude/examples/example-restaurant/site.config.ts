import { defineSite, page, section, card, table, quote, link, markdown, ascii, themes, divider } from "terminaltui";

export default defineSite({
  name: "The Rusty Fork",
  tagline: "farm-to-table dining since 2018",
  banner: ascii("Rusty Fork", { font: "Ogre", gradient: ["#d4a373", "#e63946"] }),
  theme: themes.gruvbox,
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "Thanks for visiting! See you at the table." },

  pages: [
    page("menu", {
      title: "Menu",
      icon: "◆",
      content: [
        section("Starters", [
          card({ title: "Heirloom Tomato Salad", subtitle: "$14", body: "Burrata, basil oil, aged balsamic, sea salt" }),
          card({ title: "Crispy Pork Belly Bites", subtitle: "$16", body: "Apple mostarda, pickled shallots, micro greens" }),
          card({ title: "Charred Octopus", subtitle: "$18", body: "Romesco, chorizo crumble, smoked paprika" }),
        ]),
        divider("label", "Mains"),
        section("Mains", [
          card({ title: "Dry-Aged Ribeye", subtitle: "$42", body: "12oz, bone marrow butter, roasted garlic, hand-cut fries" }),
          card({ title: "Pan-Seared Salmon", subtitle: "$32", body: "Miso glaze, bok choy, forbidden rice, yuzu vinaigrette" }),
          card({ title: "Wild Mushroom Risotto", subtitle: "$26", body: "Arborio, truffle oil, parmesan crisp, fresh herbs" }),
        ]),
        divider("label", "Desserts"),
        section("Desserts", [
          card({ title: "Crème Brûlée", subtitle: "$12", body: "Madagascar vanilla, torched sugar, fresh berries" }),
          card({ title: "Dark Chocolate Tart", subtitle: "$14", body: "Ganache, sea salt, espresso whipped cream" }),
        ]),
      ],
    }),

    page("drinks", {
      title: "Drinks",
      icon: "◈",
      content: [
        section("Wine", [
          card({ title: "House Red — Cabernet Sauvignon", subtitle: "$14/glass" }),
          card({ title: "House White — Sauvignon Blanc", subtitle: "$12/glass" }),
          card({ title: "Rosé — Provence", subtitle: "$13/glass" }),
        ]),
        divider(),
        section("Cocktails", [
          card({ title: "Rusty Nail", subtitle: "$16", body: "Our signature. Scotch, Drambuie, orange peel." }),
          card({ title: "Garden Gimlet", subtitle: "$14", body: "Gin, cucumber, elderflower, lime." }),
        ]),
      ],
    }),

    page("about", {
      title: "Our Story",
      icon: "▣",
      content: [
        markdown(`Chef Maria Torres opened The Rusty Fork in a converted
          blacksmith shop in 2018. Every dish is built on relationships
          with local farmers and a refusal to cut corners.`),
        divider(),
        quote("One of the best meals I've had in this city.", "Chicago Tribune"),
        quote("The kind of place that makes you slow down and savor.", "Eater"),
        quote("If you only eat at one restaurant this year, make it this one.", "Bon Appétit"),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "▤",
      content: [
        table(["Day", "Hours"], [
          ["Mon — Thu", "5:00 PM — 10:00 PM"],
          ["Fri — Sat", "5:00 PM — 11:00 PM"],
          ["Sunday", "Brunch 10AM — 2PM · Dinner 5PM — 9PM"],
        ]),
        divider(),
        markdown("**Address:** 847 N. Damen Ave, Chicago, IL 60622"),
        link("Google Maps", "https://maps.google.com"),
        link("Reservations (OpenTable)", "https://opentable.com"),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "◉",
      content: [
        link("Instagram", "https://instagram.com/therustyfork"),
        link("Phone", "tel:+13125551234"),
        link("Email", "mailto:hello@rustyfork.com"),
        link("Private Events", "mailto:events@rustyfork.com"),
      ],
    }),
  ],
});
