import { defineSite, page, card, quote, link, markdown, ascii, themes, divider, searchInput, form, textInput, button, spacer } from "terminaltui";

export default defineSite({
  name: "GLASS CATHEDRAL",
  tagline: "shoegaze · dream pop · noise",
  banner: ascii("GLASS CATHEDRAL", { font: "Slant", gradient: ["#c084fc", "#fb7185"] }),
  theme: themes.rosePine,
  borders: "double",
  animations: { boot: true, transitions: "fade", exitMessage: "See you at the show." },

  pages: [
    page("music", {
      title: "Discography",
      icon: "♫",
      content: [
        card({
          title: "Dissolve",
          subtitle: "2024 · LP",
          body: "10 tracks. Our most ambitious record yet.",
          tags: ["Shoegaze", "Dream Pop"],
          url: "https://glasscathedral.bandcamp.com/album/dissolve",
        }),
        card({
          title: "Haze EP",
          subtitle: "2023 · EP",
          body: "4 tracks of pure texture.",
          tags: ["Ambient", "Noise"],
          url: "https://glasscathedral.bandcamp.com/album/haze",
        }),
        card({
          title: "First Light",
          subtitle: "2022 · LP",
          body: "The debut. Where it all started.",
          tags: ["Shoegaze"],
          url: "https://glasscathedral.bandcamp.com/album/first-light",
        }),
      ],
    }),

    page("shows", {
      title: "Upcoming Shows",
      icon: "★",
      content: [
        searchInput({
          id: "shows-search",
          placeholder: "Search shows by venue or city...",
          action: "navigate",
          items: [
            { label: "Metro — Chicago, IL", value: "metro-chicago-il", keywords: ["Chicago", "Metro", "Slow Crush", "Narrow Head"] },
            { label: "Rough Trade — Brooklyn, NY", value: "rough-trade-brooklyn-ny", keywords: ["Brooklyn", "New York", "Rough Trade", "album release"] },
            { label: "The Echo — Los Angeles, CA", value: "the-echo-los-angeles-ca", keywords: ["Los Angeles", "The Echo", "Nothing", "Cloakroom"] },
          ],
        }),
        spacer(),
        card({
          title: "Metro — Chicago, IL",
          subtitle: "Mar 28, 2026",
          body: "w/ Slow Crush, Narrow Head. Doors 8pm.",
          url: "https://tickets.example.com",
        }),
        card({
          title: "Rough Trade — Brooklyn, NY",
          subtitle: "Apr 12, 2026",
          body: "Album release show. Limited capacity.",
          url: "https://tickets.example.com",
        }),
        card({
          title: "The Echo — Los Angeles, CA",
          subtitle: "Apr 20, 2026",
          body: "w/ Nothing, Cloakroom. All ages.",
          url: "https://tickets.example.com",
        }),
      ],
    }),

    page("press", {
      title: "Press",
      icon: "◈",
      content: [
        quote("The loudest quiet band you'll ever hear.", "Pitchfork"),
        quote("Dissolve is a masterclass in texture and restraint.", "Stereogum"),
        quote("Like being swallowed whole by a beautiful wave of sound.", "The Line of Best Fit"),
        divider(),
        quote("One of the most exciting new bands in shoegaze.", "Brooklyn Vegan"),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("Bandcamp", "https://glasscathedral.bandcamp.com"),
        link("Spotify", "https://open.spotify.com/artist/glasscathedral"),
        link("Apple Music", "https://music.apple.com/artist/glasscathedral"),
        link("Instagram", "https://instagram.com/glasscathedral"),
        link("Merch", "https://glasscathedral.bigcartel.com"),
        link("Booking", "mailto:booking@glasscathedral.com"),
        form({ id: "mailing-list", onSubmit: async (data) => ({ success: "You're on the list. See you at the next show." }),
          fields: [
            textInput({ id: "email", label: "Join the Mailing List", placeholder: "your@email.com", validate: v => v.includes("@") ? null : "Invalid email" }),
            button({ label: "Subscribe", style: "primary" }),
          ],
        }),
        spacer(),
      ],
    }),
  ],
});
