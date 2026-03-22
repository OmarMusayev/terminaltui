import {
  runSiteTests, page, card, link, markdown, divider, spacer, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "The Quiet Corner",
  tagline: "Essays on solitude, craft, and the inner life",
  theme: "dracula" as const,
  borders: "dashed" as const,
  pages: [
    page("posts", {
      title: "Posts",
      icon: "📝",
      content: [
        card({
          title: "On Keeping a Notebook",
          body: "Why I still write longhand every morning, and how the physical act of forming letters changes the way I think. The notebook is not a productivity tool — it is a mirror.",
          subtitle: "March 2026",
        }),
        card({
          title: "The Library at the End of the World",
          body: "A visit to the Svalbard seed vault's lesser-known neighbor: a decommissioned coal mine that stores the world's most important digital archives on film reels designed to last a thousand years.",
          subtitle: "February 2026",
        }),
        card({
          title: "Slowness as Rebellion",
          body: "In an attention economy that profits from your urgency, choosing to be slow is a radical act. On walking, reading, and the lost art of sitting still.",
          subtitle: "January 2026",
        }),
        card({
          title: "What the Beekeeper Knows",
          body: "My neighbor has kept bees for forty years. Last summer, she taught me more about patience, systems thinking, and collective intelligence than any business book ever has.",
          subtitle: "December 2025",
        }),
        card({
          title: "The Tyranny of the Algorithm",
          body: "How recommendation engines have quietly reshaped not just what we consume, but how we create. When the machine becomes the audience, authenticity erodes.",
          subtitle: "November 2025",
        }),
        card({
          title: "Letters to No One",
          body: "I've been writing letters to a person who doesn't exist. It started as a writing exercise and became something deeper — a conversation with the self I might have been.",
          subtitle: "October 2025",
        }),
        card({
          title: "The Silence Between Songs",
          body: "A meditation on negative space in music, art, and life. Why the pause is as important as the note, and what happens when we stop filling every gap.",
          subtitle: "September 2025",
        }),
        card({
          title: "Learning to See",
          body: "After six months of daily sketching, I finally understand what artists mean when they say most people don't actually look at things. Seeing is a skill, and it can be trained.",
          subtitle: "August 2025",
        }),
      ],
    }),
    page("about", {
      title: "About",
      icon: "👤",
      content: [
        markdown(
          "## About This Corner\n\n" +
          "My name is Elena Voss. I write essays about the things that move slowly — " +
          "craft, solitude, attention, and the inner life. This is not a blog in the usual sense. " +
          "There are no listicles, no growth hacks, no hot takes designed to go viral.\n\n" +
          "I publish when something is ready, which is usually once or twice a month. " +
          "Each piece goes through at least five drafts. Some take months. The one about " +
          "the beekeeper took nearly a year because I wanted to observe a full cycle of seasons.\n\n" +
          "### Background\n\n" +
          "I spent a decade as a literary editor at a small press in Vermont. Before that, I " +
          "studied philosophy at Reed College, where I wrote my thesis on Simone Weil's concept " +
          "of attention. I live in a converted barn in the Green Mountains with two cats named " +
          "after Borges characters (Funes and Tlön).\n\n" +
          "### Why a Terminal Site?\n\n" +
          "Because the web has become noisy and I wanted a space that feels like opening a book — " +
          "just text, no distractions. The constraints of a terminal force a kind of honesty. " +
          "There's nowhere to hide behind fancy animations or stock photography. It's just the words.\n\n" +
          "### Colophon\n\n" +
          "Written in Markdown. Published via terminaltui. Set in your terminal's monospace font, " +
          "which is exactly as it should be. No analytics, no cookies, no tracking of any kind. " +
          "If you want to reach me, send an email. I read every one."
        ),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "🔗",
      content: [
        link("Email", "mailto:elena@thequietcorner.com"),
        link("RSS Feed", "https://thequietcorner.com/feed.xml"),
        link("Are.na", "https://are.na/elena-voss"),
        link("Substack Archive", "https://elenavoss.substack.com"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-5-blog-writing");
writeFileSync("test-sites/blog-writing/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 5 — Blog (The Quiet Corner): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
