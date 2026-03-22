import { runSiteTests, page, card, link, markdown, divider, spacer, themes } from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "Alex Chen",
  handle: "@alexchen",
  tagline: "full-stack dev",
  theme: "nord" as const,
  borders: "single" as const,
  pages: [
    page("about", {
      title: "About",
      icon: "\ud83d\udc64",
      content: [
        markdown("I am a full-stack developer with 8 years of experience building web applications. I specialize in TypeScript, React, and Node.js. Currently working at a fintech startup building payment infrastructure."),
      ],
    }),
    page("projects", {
      title: "Projects",
      icon: "\ud83d\ude80",
      content: [
        card({ title: "TaskFlow", body: "A project management tool built with React and GraphQL", tags: ["React", "GraphQL", "TypeScript"] }),
        card({ title: "DataPipe", body: "Real-time data pipeline framework for Node.js", tags: ["Node.js", "Streams", "Redis"], subtitle: "v2.1" }),
      ],
    }),
    page("links", {
      title: "Links",
      icon: "\ud83d\udd17",
      content: [
        link("GitHub", "https://github.com/alexchen"),
        link("LinkedIn", "https://linkedin.com/in/alexchen"),
        link("Blog", "https://alexchen.dev/blog"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-1-minimal-portfolio");
writeFileSync("test-sites/minimal-portfolio/report.json", JSON.stringify(report, null, 2));

// Print summary
const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 1 — Minimal Portfolio: ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
