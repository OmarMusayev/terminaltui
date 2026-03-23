import {
  defineSite,
  page,
  card,
  divider,
  link,
  markdown,
  spacer,
  form,
  textInput,
  button,
  searchInput,
  quote,
} from "../../src/index.js";

export default defineSite({
  name: "Glass Cathedral",
  tagline: "atmospheric post-rock from Portland, OR",
  banner: {
    text: "GLASS CATHEDRAL",
    font: "Ghost",
    gradient: ["#ebbcba", "#c4a7e7"],
  },
  theme: "rosePine",
  borders: "double",
  animations: {
    boot: true,
    transitions: "wipe",
  },
  pages: [
    page("discography", {
      title: "Discography",
      icon: "~",
      content: [
        searchInput({
          id: "search-albums",
          placeholder: "Search albums...",
          action: "navigate",
          items: [
            { label: "The Weight of Light", value: "weight-of-light", keywords: ["2025", "LP", "post-rock"] },
            { label: "Tidal Memory", value: "tidal-memory", keywords: ["2023", "LP", "ambient"] },
            { label: "When the Grid Goes Dark", value: "grid-goes-dark", keywords: ["2021", "LP", "drone"] },
            { label: "Aphelion", value: "aphelion", keywords: ["2019", "EP", "shoegaze"] },
            { label: "Cathedral Sessions", value: "cathedral-sessions", keywords: ["2018", "live", "debut"] },
          ],
        }),
        spacer(),
        card({
          title: "The Weight of Light",
          subtitle: "2025",
          body: "Our fourth full-length and most ambitious record. Recorded over nine months at Jackpot! Studio with producer Tucker Martine. Eleven tracks moving from near-silence to wall-of-sound crescendos. Features the Portland Cello Project on three tracks.",
          tags: ["LP", "post-rock", "orchestral"],
        }),
        card({
          title: "Tidal Memory",
          subtitle: "2023",
          body: "Built around field recordings from the Oregon coast. Crashing waves, harbor fog horns, and wind through sea grass woven into six long-form compositions. Our quietest and most textural album. The closer runs twenty-two minutes.",
          tags: ["LP", "ambient", "field recordings"],
        }),
        card({
          title: "When the Grid Goes Dark",
          subtitle: "2021",
          body: "Written during lockdown and recorded entirely in our home studios. Heavier and more aggressive than anything we had done before. Distorted bass drones, feedback loops, and analog synths layered over propulsive drumming.",
          tags: ["LP", "drone", "experimental"],
        }),
        card({
          title: "Aphelion",
          subtitle: "2019",
          body: "Four-track EP that caught the attention of Sargent House. Reverb-drenched guitars, tremolo picking, and a shoegaze influence we have since moved away from. Still gets requested at every show.",
          tags: ["EP", "shoegaze", "reverb"],
        }),
        card({
          title: "Cathedral Sessions",
          subtitle: "2018",
          body: "Our debut recording. A single 40-minute improvised session captured live in an abandoned church in northeast Portland. One room, four musicians, no overdubs. Raw and unpolished but full of the energy that started everything.",
          tags: ["live", "improvised", "debut"],
        }),
      ],
    }),

    page("shows", {
      title: "Shows",
      icon: ">>",
      content: [
        searchInput({
          id: "search-shows",
          placeholder: "Search upcoming shows...",
          action: "navigate",
          items: [
            { label: "Apr 12 -- Portland", value: "portland", keywords: ["Revolution Hall", "hometown"] },
            { label: "Apr 18 -- Seattle", value: "seattle", keywords: ["Neumos", "with Caspian"] },
            { label: "Apr 25 -- San Francisco", value: "sf", keywords: ["The Chapel", "sold out"] },
            { label: "May 3 -- Los Angeles", value: "la", keywords: ["Lodge Room", "with Mogwai"] },
            { label: "May 10 -- Denver", value: "denver", keywords: ["Globe Hall"] },
            { label: "Jun 14 -- Chicago", value: "chicago", keywords: ["Thalia Hall", "with Russian Circles"] },
          ],
        }),
        spacer(),
        card({
          title: "Apr 12 -- Portland, OR",
          subtitle: "Revolution Hall",
          body: "Album release show for The Weight of Light. Full album performed front to back with the Portland Cello Project. Support from Grails.",
          tags: ["hometown", "album release", "tickets available"],
        }),
        card({
          title: "Apr 18 -- Seattle, WA",
          subtitle: "Neumos",
          body: "Co-headlining with Caspian. Both bands performing full sets plus a collaborative encore. Doors at 7, music at 8.",
          tags: ["co-headline", "tickets available"],
        }),
        card({
          title: "Apr 25 -- San Francisco, CA",
          subtitle: "The Chapel",
          body: "Intimate show in one of the best rooms on the West Coast. Limited to 400 capacity. Support from Wander.",
          tags: ["sold out"],
        }),
        card({
          title: "May 3 -- Los Angeles, CA",
          subtitle: "Lodge Room",
          body: "Opening for Mogwai on the California leg of their tour. Our first time playing Lodge Room. 45-minute set drawing from all four albums.",
          tags: ["support slot", "tickets available"],
        }),
        card({
          title: "May 10 -- Denver, CO",
          subtitle: "Globe Hall",
          body: "Headline show with local support TBA. Denver has been one of our strongest markets since the first album. After-show hang at the bar next door.",
          tags: ["headline", "tickets available"],
        }),
        card({
          title: "Jun 14 -- Chicago, IL",
          subtitle: "Thalia Hall",
          body: "Co-headlining with Russian Circles. Two of the loudest quiet bands on one stage. Visual projections by Adam Keenan. This will be special.",
          tags: ["co-headline", "tickets available"],
        }),
      ],
    }),

    page("press", {
      title: "Press",
      icon: "//",
      content: [
        quote(
          "Glass Cathedral makes music that feels like watching weather systems collide in slow motion. The Weight of Light is their definitive statement -- enormous, patient, and devastatingly beautiful.",
          "Pitchfork (8.4)",
        ),
        quote(
          "There is a moment twenty minutes into Tidal Memory where the bass drops out and all you hear is waves and a single bowed guitar. I have listened to it a hundred times and it still stops me cold.",
          "The Quietus",
        ),
        quote(
          "When the Grid Goes Dark is what happens when a post-rock band decides to get angry. The heaviest record in their catalog, and one of the best guitar albums of 2021.",
          "Stereogum",
        ),
        quote(
          "In a genre that often mistakes length for depth, Glass Cathedral is the rare band that earns every minute. Their live show is transcendent -- bring earplugs and an open heart.",
          "NPR Music",
        ),
      ],
    }),

    page("about", {
      title: "About",
      icon: "&",
      content: [
        markdown(`
# Glass Cathedral

Glass Cathedral formed in Portland, Oregon in 2017 when four musicians from
different corners of the local scene started meeting weekly in a rented practice
space above a screen-printing shop on SE Hawthorne. The original idea was simple:
play long, slow, loud songs with no vocals and see what happens. Within a year
they had recorded their debut -- a single improvised session in an abandoned
church -- and the name stuck.

Over five years and four records, Glass Cathedral has become one of the most
respected bands in the post-rock world. Their sound draws from Godspeed You!
Black Emperor's orchestral scope, Mogwai's dynamic range, and the Pacific
Northwest's own tradition of atmospheric heaviness. They have toured North America
and Europe extensively, played festivals from Pitchfork to Roadburn, and built a
devoted following that fills 1,000-cap rooms on both coasts.
        `),
        spacer(),
        divider("Members"),
        card({
          title: "Maren Calloway",
          subtitle: "Guitar, Keys, Electronics",
          body: "Classically trained pianist who switched to guitar at 19. Builds the layered textures and looping architecture that define the band's sound. Also plays in the ambient duo Pale Lantern.",
        }),
        card({
          title: "Jesse Okafor",
          subtitle: "Guitar, Lap Steel",
          body: "Grew up playing in church bands in Lagos before moving to Portland for college. Brings a melodic sensibility and rhythmic complexity that grounds the more abstract compositions. Handles most of the live effects processing.",
        }),
        card({
          title: "Danny Reeves",
          subtitle: "Bass, Synth",
          body: "Former jazz upright bassist who fell in love with distortion pedals. Runs a bass rig that rattles windows. Responsible for the sub-frequency drone textures on When the Grid Goes Dark.",
        }),
        card({
          title: "Sofia Trujillo",
          subtitle: "Drums, Percussion",
          body: "The engine of the band. Studied under Matt Cameron and cites both Bill Bruford and Janet Weiss as primary influences. Known for building tension across ten-minute arcs and explosive, cymbal-heavy crescendos.",
        }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "->",
      content: [
        form({
          id: "mailing-list",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `You're on the list. We'll send updates to ${data.email}.`,
          }),
          fields: [
            textInput({
              id: "email",
              label: "Join the mailing list",
              placeholder: "your@email.com",
              validate: (v) => (v.includes("@") ? null : "Please enter a valid email"),
            }),
            button({ label: "Subscribe", style: "primary" }),
          ],
        }),
        spacer(),
        link("Spotify", "https://open.spotify.com/artist/glasscathedral", { icon: ">" }),
        link("Apple Music", "https://music.apple.com/artist/glass-cathedral", { icon: ">" }),
        link("Bandcamp", "https://glasscathedral.bandcamp.com", { icon: ">" }),
        link("Instagram", "https://instagram.com/glasscathedral", { icon: ">" }),
        link("Twitter", "https://twitter.com/glass_cathedral", { icon: ">" }),
        link("Merch Store", "https://glasscathedral.bigcartel.com", { icon: ">" }),
        link("Booking", "mailto:booking@glasscathedral.com", { icon: ">" }),
      ],
    }),
  ],
});
