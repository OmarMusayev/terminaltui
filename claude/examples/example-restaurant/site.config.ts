import { defineSite, page, section, card, table, quote, link, markdown, ascii, themes, divider, searchInput, form, textInput, select, numberInput, button, spacer } from "terminaltui";

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
        searchInput({
          id: "menu-search",
          placeholder: "Search the menu...",
          action: "navigate",
          items: [
            { label: "Heirloom Tomato Salad", value: "heirloom-tomato-salad", keywords: ["starter", "salad", "burrata", "basil"] },
            { label: "Crispy Pork Belly Bites", value: "crispy-pork-belly-bites", keywords: ["starter", "pork", "apple"] },
            { label: "Charred Octopus", value: "charred-octopus", keywords: ["starter", "seafood", "romesco", "chorizo"] },
            { label: "Dry-Aged Ribeye", value: "dry-aged-ribeye", keywords: ["main", "steak", "beef", "bone marrow"] },
            { label: "Pan-Seared Salmon", value: "pan-seared-salmon", keywords: ["main", "fish", "miso", "seafood"] },
            { label: "Wild Mushroom Risotto", value: "wild-mushroom-risotto", keywords: ["main", "vegetarian", "truffle", "risotto"] },
            { label: "Crème Brûlée", value: "creme-brulee", keywords: ["dessert", "vanilla", "berries"] },
            { label: "Dark Chocolate Tart", value: "dark-chocolate-tart", keywords: ["dessert", "chocolate", "espresso"] },
          ],
        }),
        spacer(),
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
        searchInput({
          id: "drinks-search",
          placeholder: "Search drinks...",
          action: "navigate",
          items: [
            { label: "House Red — Cabernet Sauvignon", value: "house-red-cabernet-sauvignon", keywords: ["wine", "red", "cabernet"] },
            { label: "House White — Sauvignon Blanc", value: "house-white-sauvignon-blanc", keywords: ["wine", "white", "sauvignon"] },
            { label: "Rosé — Provence", value: "rose-provence", keywords: ["wine", "rosé", "provence"] },
            { label: "Rusty Nail", value: "rusty-nail", keywords: ["cocktail", "scotch", "drambuie", "signature"] },
            { label: "Garden Gimlet", value: "garden-gimlet", keywords: ["cocktail", "gin", "cucumber", "elderflower"] },
          ],
        }),
        spacer(),
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
        form({ id: "reservation", onSubmit: async (data) => ({ success: `Table reserved for ${data.name}, party of ${data.guests}!` }),
          fields: [
            textInput({ id: "name", label: "Name", validate: v => v ? null : "Name is required" }),
            textInput({ id: "email", label: "Email", validate: v => v.includes("@") ? null : "Invalid email" }),
            select({ id: "date", label: "Date", options: [
              { label: "Today", value: "today" },
              { label: "Tomorrow", value: "tomorrow" },
              { label: "This Weekend", value: "weekend" },
            ]}),
            numberInput({ id: "guests", label: "Party Size", defaultValue: 2, min: 1, max: 20 }),
            button({ label: "Reserve Table", style: "primary" }),
          ],
        }),
        spacer(),
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
