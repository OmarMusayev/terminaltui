import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, quote, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "GLASS CATHEDRAL",
  tagline: "Post-rock / ambient from Brooklyn, NY",
  theme: "rosePine" as const,
  borders: "double" as const,
  pages: [
    page("discography", {
      title: "Discography",
      icon: "💿",
      content: [
        card({
          title: "The Weight of Light",
          body: "Our third full-length album. Recorded over six months at Sonic Ranch in Tornillo, TX. Ten tracks exploring themes of memory, distance, and the spaces between words. Features the 12-minute closer \"Heliograph\" with a 40-piece string section.",
          subtitle: "2025 — LP — Sargent House",
          tags: ["Post-Rock", "Ambient", "Orchestral"],
        }),
        card({
          title: "Tidal Architectures",
          body: "A concept EP about coastal erosion and impermanence. Five tracks, each named after a lighthouse that no longer exists. Recorded live to tape at Electrical Audio with Steve Albini engineering.",
          subtitle: "2023 — EP — Self-Released",
          tags: ["Post-Rock", "Field Recordings"],
        }),
        card({
          title: "When the Grid Goes Dark",
          body: "Our debut LP. Lo-fi recordings from a rented cabin in the Catskills during a week-long ice storm. The power went out on day three — we finished the album on battery-powered amps and a four-track cassette recorder.",
          subtitle: "2021 — LP — Sargent House",
          tags: ["Lo-Fi", "Post-Rock", "Noise"],
        }),
      ],
    }),
    page("shows", {
      title: "Shows",
      icon: "🎤",
      content: [
        card({
          title: "Roadburn Festival",
          body: "Performing the entirety of 'The Weight of Light' with a live string quartet. Our first European festival appearance.",
          subtitle: "April 18, 2026 — Tilburg, Netherlands",
        }),
        card({
          title: "Le Guess Who?",
          body: "Curating a stage with Grouper, Tim Hecker, and Midori Takada. Two-hour extended set with visuals by Daito Manabe.",
          subtitle: "May 9, 2026 — Utrecht, Netherlands",
        }),
        card({
          title: "Brooklyn Steel",
          body: "Hometown album release show with support from Deafheaven and Chat Pile. Limited-edition vinyl available only at the door.",
          subtitle: "June 14, 2026 — Brooklyn, NY",
        }),
        card({
          title: "Pitchfork Music Festival",
          body: "Closing the Blue Stage on Saturday night. First time playing Pitchfork since 2022.",
          subtitle: "July 19, 2026 — Chicago, IL",
        }),
      ],
    }),
    page("press", {
      title: "Press",
      icon: "📰",
      content: [
        quote(
          "Glass Cathedral make music that feels like watching a building collapse in slow motion — terrifying, beautiful, and impossible to look away from.",
          "Pitchfork (8.7)"
        ),
        quote(
          "The Weight of Light is a masterclass in tension and release. Every track earns its climax.",
          "The Quietus"
        ),
        quote(
          "If Godspeed You! Black Emperor and Brian Eno had a band together, it might sound something like this.",
          "Stereogum"
        ),
        quote(
          "One of the most emotionally devastating live performances I have witnessed in twenty years of covering music.",
          "NPR Music"
        ),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "🔗",
      content: [
        link("Bandcamp", "https://glasscathedral.bandcamp.com"),
        link("Spotify", "https://open.spotify.com/artist/glasscathedral"),
        link("Instagram", "https://instagram.com/glasscathedral"),
        link("Merch Store", "https://glasscathedral.bigcartel.com"),
        link("Booking / Press", "mailto:mgmt@glasscathedral.com"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-4-band-page");
writeFileSync("test-sites/band-page/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 4 — Band Page (GLASS CATHEDRAL): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
