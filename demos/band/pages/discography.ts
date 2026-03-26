import {
  card,
  spacer,
  searchInput,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Discography", icon: "~" };

export default function Discography() {
  return [
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
    row([
      col([
        card({
          title: "The Weight of Light",
          subtitle: "2025 -- LP",
          body: [
            "Our fourth full-length and most ambitious record. Recorded over nine months at Jackpot! Studio with producer Tucker Martine. Features the Portland Cello Project on three tracks.",
            "",
            "Tracklist:",
            " 1. First Light",
            " 2. Pressure Gradient",
            " 3. The Weight of Light",
            " 4. Harmonic Decay",
            " 5. Cello Suite for Concrete",
            " 6. Glass Hour",
            " 7. Substrata",
            " 8. Thermal Drift",
            " 9. Crescendo in E Minor",
            "10. Aftermath",
            "11. Last Transmission",
          ].join("\n"),
          tags: ["LP", "post-rock", "orchestral"],
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Tidal Memory",
          subtitle: "2023 -- LP",
          body: [
            "Built around field recordings from the Oregon coast. Crashing waves, harbor fog horns, and wind through sea grass woven into six long-form compositions. The closer runs twenty-two minutes.",
            "",
            "Tracklist:",
            "1. Littoral Zone",
            "2. Fog Signal",
            "3. Salt Architecture",
            "4. Undertow",
            "5. Bioluminescence",
            "6. Tidal Memory (22:17)",
          ].join("\n"),
          tags: ["LP", "ambient", "field recordings"],
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "When the Grid Goes Dark",
          subtitle: "2021 -- LP",
          body: [
            "Written during lockdown and recorded entirely in our home studios. Heavier and more aggressive than anything we had done before. Distorted bass drones, feedback loops, and analog synths.",
            "",
            "Tracklist:",
            "1. Blackout Sequence",
            "2. Fault Line",
            "3. Grid Collapse",
            "4. Static Worship",
            "5. Drone Cathedral",
            "6. Voltage Hymn",
            "7. When the Grid Goes Dark",
          ].join("\n"),
          tags: ["LP", "drone", "experimental"],
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Aphelion",
          subtitle: "2019 -- EP",
          body: [
            "Four-track EP that caught the attention of Sargent House. Reverb-drenched guitars, tremolo picking, and a shoegaze influence we have since moved away from. Still gets requested at every show.",
            "",
            "Tracklist:",
            "1. Aphelion",
            "2. Solar Wind",
            "3. Perihelion",
            "4. Event Horizon",
          ].join("\n"),
          tags: ["EP", "shoegaze", "reverb"],
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "Cathedral Sessions",
          subtitle: "2018 -- Live",
          body: [
            "Our debut recording. A single 40-minute improvised session captured live in an abandoned church in northeast Portland. One room, four musicians, no overdubs. Raw and unpolished but full of the energy that started everything.",
            "",
            "Tracklist:",
            "1. Cathedral Sessions (40:12)",
          ].join("\n"),
          tags: ["live", "improvised", "debut"],
        }),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
