import {
  defineSite,
  page,
  card,
  link,
  markdown,
  spacer,
} from "../../src/index.js";

export default defineSite({
  name: "GLASS CATHEDRAL",
  tagline: "Shoegaze / dream pop from Portland, OR",
  banner: {
    text: "GLASS",
    font: "Ghost",
    gradient: ["#eb6f92", "#c4a7e7"],
  },
  theme: "rosePine",
  borders: "double",
  animations: {
    transitions: "fade",
    exitMessage: "Thanks for listening.",
  },
  pages: [
    page("discography", {
      title: "Discography",
      icon: "~",
      content: [
        card({
          title: "Violet Hour",
          subtitle: "2025 · LP",
          body: "Our third full-length and most expansive work yet. Recorded in a converted church in rural Oregon over three months. Layers of reverb-drenched guitars, analog synths, and whispered vocals dissolve into each other across 52 minutes. A meditation on memory and impermanence.",
          tags: ["Shoegaze", "Dream Pop", "Ambient"],
        }),
        card({
          title: "Refraction",
          subtitle: "2024 · LP",
          body: "Dense, heavy, and luminous. We pushed into heavier territory — drop-tuned guitars through walls of distortion, motorik rhythms, and swirling feedback that opens up into moments of startling beauty. Produced by the legendary Alan Moulder.",
          tags: ["Shoegaze", "Noise Pop", "Post-Punk"],
        }),
        card({
          title: "Pale Light",
          subtitle: "2023 · EP",
          body: "Five songs written during a Pacific Northwest winter. Sparse and intimate compared to our full-lengths — acoustic guitars layered with tape delay, bowed bass, and field recordings of rain. Our most emotionally direct release.",
          tags: ["Dream Pop", "Slowcore", "Lo-Fi"],
        }),
        card({
          title: "Cathedral",
          subtitle: "2022 · LP",
          body: "Our debut album and the record that gave us our name. Built from four-track demos recorded in a basement, then rebuilt in the studio with orchestral arrangements. Equal parts My Bloody Valentine and Sigur Rós.",
          tags: ["Shoegaze", "Post-Rock", "Orchestral"],
        }),
        card({
          title: "Demo Tape",
          subtitle: "2021 · Demo",
          body: "The four songs that started everything. Recorded on a Tascam 424 in a single weekend. Lo-fi, raw, and urgent. Originally self-released on cassette in a run of 50 copies — now a collector's item.",
          tags: ["Lo-Fi", "Shoegaze", "Cassette"],
        }),
      ],
    }),

    page("shows", {
      title: "Shows",
      icon: "*",
      content: [
        card({
          title: "The Fillmore",
          subtitle: "April 12, 2026",
          body: "San Francisco, CA — Headlining with special guests Anemone. Doors at 7pm, show at 8:30pm. Limited VIP balcony tickets available.",
        }),
        card({
          title: "Primavera Sound",
          subtitle: "June 5, 2026",
          body: "Barcelona, Spain — Main stage set at the Parc del Fòrum. Our first European festival appearance. Playing the full Violet Hour album front to back.",
        }),
        card({
          title: "Pitchfork Music Festival",
          subtitle: "July 18, 2026",
          body: "Chicago, IL — Blue stage, 6:30pm. Part of the Friday lineup alongside Blonde Redhead and Duster. Festival passes on sale now.",
        }),
        card({
          title: "The Crocodile",
          subtitle: "August 3, 2026",
          body: "Seattle, WA — Intimate club show. Two sets: an acoustic set of Pale Light material followed by a full-volume headlining set. 400 capacity, will sell out.",
        }),
        card({
          title: "Desert Daze",
          subtitle: "October 10, 2026",
          body: "Lake Perris, CA — Sunset slot on the Moon Stage. Extended set with improvised sections and projections by visual artist Hana Kim.",
        }),
        card({
          title: "Le Guess Who?",
          subtitle: "November 21, 2026",
          body: "Utrecht, Netherlands — Curated program at TivoliVredenburg. Performing Refraction in full with a string quartet from the Netherlands Chamber Orchestra.",
        }),
      ],
    }),

    page("press", {
      title: "Press",
      icon: "\"",
      content: [
        card({
          title: "Pitchfork",
          subtitle: "9.0 · Best New Music",
          body: "\"Glass Cathedral have perfected the art of beautiful noise. Violet Hour is the shoegaze album of the decade — a towering wall of sound that somehow feels weightless.\"",
          tags: ["Violet Hour"],
        }),
        card({
          title: "The Quietus",
          subtitle: "Feature Review",
          body: "\"There are bands that play shoegaze and there are bands that live inside the sound. Glass Cathedral are the latter. Refraction is 45 minutes of sustained transcendence.\"",
          tags: ["Refraction"],
        }),
        card({
          title: "NME",
          subtitle: "Album Review",
          body: "\"If My Bloody Valentine and Cocteau Twins had a band practice in a cathedral during a thunderstorm, it might sound something like this. Astonishing.\"",
          tags: ["Cathedral"],
        }),
        card({
          title: "Stereogum",
          subtitle: "Best New Bands",
          body: "\"Pale Light strips everything back to reveal the songwriting beneath the reverb. These are genuinely great songs, not just great textures. The future of dream pop.\"",
          tags: ["Pale Light"],
        }),
        card({
          title: "Brooklyn Vegan",
          subtitle: "Live Review",
          body: "\"The live show is a religious experience. Four people making a sound so massive it rewires your nervous system. I left the venue a different person.\"",
          tags: ["Live"],
        }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "&",
      content: [
        markdown(`
# Glass Cathedral

Glass Cathedral formed in Portland, Oregon in 2021 when guitarist and vocalist **Maren Solberg** and bassist **Theo Vasquez** started recording four-track experiments in a leaky basement apartment. The project was never meant to be a band — just a way to process the disorientation of a world in flux. But the songs kept coming, and when drummer **Jin Park** and synth player **Elise Morrow** joined, the sound expanded into something none of them could have made alone.

The band's name comes from their debut album *Cathedral* — itself named after the reverb preset Maren accidentally left on during an entire recording session. "We hit playback and everything sounded like it was being performed inside a massive stone building," she says. "We kept it. That accident became our whole aesthetic."

Their sound is built on contrasts: crushing distortion against delicate melody, whispered vocals buried under avalanches of guitar, tight rhythmic precision dissolving into freeform noise. They cite **My Bloody Valentine**, **Slowdive**, **Cocteau Twins**, **Sigur Rós**, and **Grouper** as influences, but their music has evolved into something distinctly their own — heavier, more rhythmic, and more emotionally exposed than any of their reference points. Three albums in, Glass Cathedral are one of the most important guitar bands working today.
        `),
        spacer(),
        card({
          title: "Maren Solberg",
          subtitle: "Guitar · Vocals",
          body: "Songwriter and sonic architect. Builds cathedrals of sound from layers of reverb-drenched guitar and whispered vocals. The accidental reverb preset that named the band was hers.",
        }),
        card({
          title: "Theo Vasquez",
          subtitle: "Bass",
          body: "Co-founder and low-end anchor. His melodic bass lines give the band's walls of sound their harmonic foundation. Started the four-track experiments with Maren in 2021.",
        }),
        card({
          title: "Jin Park",
          subtitle: "Drums",
          body: "Brings motorik precision and dynamic range — from tight rhythmic drive to freeform improvisation. The rhythmic backbone that lets everything else dissolve.",
        }),
        card({
          title: "Elise Morrow",
          subtitle: "Synths · Keys",
          body: "Analog synth textures and atmospheric layers. Her arrival expanded the project from a duo into a full band and pushed the sound into new territory.",
        }),
        spacer(),
        link("Booking Inquiries", "mailto:booking@glasscathedral.com", { icon: ">" }),
        link("Management — Pitch & Sync", "mailto:mgmt@glasscathedral.com", { icon: ">" }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "->",
      content: [
        link("Bandcamp", "https://glasscathedral.bandcamp.com", { icon: ">" }),
        link("Spotify", "https://open.spotify.com/artist/glasscathedral", { icon: ">" }),
        link("Instagram", "https://instagram.com/glasscathedral", { icon: ">" }),
        link("Merch", "https://glasscathedral.bigcartel.com", { icon: ">" }),
        link("Booking", "mailto:booking@glasscathedral.com", { icon: ">" }),
      ],
    }),
  ],
});
