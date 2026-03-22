import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, hero, table, timeline, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "TermConf 2026",
  tagline: "The conference for terminal-first developers — June 12-14, Portland OR",
  theme: "nord" as const,
  borders: "single" as const,
  pages: [
    page("home", {
      title: "Home",
      icon: "🏠",
      content: [
        hero({
          title: "TermConf 2026",
          subtitle: "Three days of talks, workshops, and hallway conversations about building beautiful things in the terminal. June 12-14 at the Revolution Hall in Portland, Oregon.",
        }),
        spacer(1),
        markdown("**Early bird tickets on sale now.** Use code TERMINAL20 for 20% off until April 30."),
        spacer(1),
        link("Buy Tickets", "https://termconf.dev/tickets"),
      ],
    }),
    page("schedule", {
      title: "Schedule",
      icon: "📅",
      content: [
        section("Day 1 — Thursday, June 12", [
          timeline([
            { date: "9:00 AM", title: "Registration & Coffee", description: "Pick up your badge, grab a coffee, and settle in. Continental breakfast provided." },
            { date: "10:00 AM", title: "Opening Keynote: The Terminal Renaissance", description: "Mitchell Hashimoto on why terminal applications are experiencing a golden age and what comes next." },
            { date: "11:30 AM", title: "Building TUIs with Rust and Ratatui", description: "Orhun Parmaksiz walks through building a production-grade TUI application from scratch using Ratatui." },
            { date: "2:00 PM", title: "Workshop: Terminal Graphics with Sixel", description: "Hands-on workshop on rendering images, charts, and data visualizations directly in your terminal." },
            { date: "4:00 PM", title: "Lightning Talks (10 speakers x 5 min)", description: "Fast-paced talks on tmux plugins, Neovim configurations, shell scripting patterns, and more." },
          ]),
        ]),
        spacer(1),
        section("Day 2 — Friday, June 13", [
          timeline([
            { date: "9:30 AM", title: "Accessibility in the Terminal", description: "Devin Prater on making terminal applications usable with screen readers and assistive technology." },
            { date: "11:00 AM", title: "The Art of CLI Design", description: "Sarah Drasner on designing command-line interfaces that are intuitive, discoverable, and delightful." },
            { date: "1:30 PM", title: "GPU-Accelerated Terminal Emulators", description: "Joe Wilm on the internals of Alacritty, GPU rendering pipelines, and the future of terminal performance." },
            { date: "3:00 PM", title: "Workshop: Building a Shell from Scratch", description: "Implement a POSIX-compliant shell in 3 hours. Parsing, job control, signals, and pipelines." },
            { date: "5:30 PM", title: "Unconference & Social", description: "Open-space discussions, demos, and a catered dinner at the venue. Bring your coolest terminal setup." },
          ]),
        ]),
      ],
    }),
    page("speakers", {
      title: "Speakers",
      icon: "🎙",
      content: [
        card({ title: "Mitchell Hashimoto", body: "Creator of Vagrant, Terraform, and Ghostty. Currently building the next generation of terminal infrastructure at his new company.", subtitle: "Keynote Speaker" }),
        card({ title: "Sarah Drasner", body: "VP of Developer Experience at Netlify. Author of 'SVG Animations' and one of the most influential voices in developer tooling and design.", subtitle: "CLI Design" }),
        card({ title: "Orhun Parmaksiz", body: "Open source maintainer and creator of git-cliff, kmon, and a core contributor to the Ratatui TUI framework for Rust.", subtitle: "Rust TUI Workshop" }),
        card({ title: "Joe Wilm", body: "Creator of Alacritty, the GPU-accelerated terminal emulator. Expert in graphics programming, Rust, and systems-level performance optimization.", subtitle: "Terminal Rendering" }),
        card({ title: "Devin Prater", body: "Accessibility advocate and screen reader power user. Works at the intersection of assistive technology and developer tooling.", subtitle: "Accessibility" }),
        card({ title: "Julia Evans", body: "Author of Wizard Zines and creator of beloved technical comics explaining complex systems concepts. Expert in Linux internals and debugging.", subtitle: "Lightning Talk" }),
      ],
    }),
    page("venue", {
      title: "Venue",
      icon: "📍",
      content: [
        markdown(
          "## Revolution Hall\n\n" +
          "TermConf 2026 takes place at **Revolution Hall**, a beautifully restored 1924 high school " +
          "auditorium in Portland's inner SE. The venue features a 850-seat main hall with excellent " +
          "acoustics, multiple breakout rooms for workshops, and a rooftop bar with views of Mt. Hood.\n\n" +
          "### Getting There\n\n" +
          "Revolution Hall is easily accessible by public transit (Bus lines 14, 15, and the Orange Line), " +
          "bike (covered parking available), or rideshare. Limited street parking is available.\n\n" +
          "### Hotels\n\n" +
          "We've negotiated group rates at two nearby hotels. Use code TERMCONF when booking."
        ),
        spacer(1),
        table(
          ["Hotel", "Distance", "Rate"],
          [
            ["Jupiter Hotel", "0.3 miles", "$159/night"],
            ["Kex Portland", "0.8 miles", "$129/night"],
            ["Hotel Eastlund", "1.1 miles", "$189/night"],
          ]
        ),
        spacer(1),
        link("Revolution Hall Website", "https://revolutionhall.com"),
      ],
    }),
    page("sponsors", {
      title: "Sponsors",
      icon: "🤝",
      content: [
        table(
          ["Tier", "Sponsor", "Contribution"],
          [
            ["Platinum", "Ghostty", "Terminal emulator"],
            ["Platinum", "Warp", "AI-powered terminal"],
            ["Gold", "Vercel", "Cloud platform"],
            ["Gold", "Railway", "Infrastructure"],
            ["Silver", "Fig", "Terminal autocomplete"],
            ["Silver", "Charm", "TUI framework"],
            ["Community", "Neovim Foundation", "Text editor"],
            ["Community", "Ratatui", "Rust TUI library"],
          ]
        ),
        spacer(1),
        markdown("Interested in sponsoring TermConf 2026? We have a few remaining slots. Reach out to sponsors@termconf.dev for our prospectus."),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-6-conference");
writeFileSync("test-sites/conference/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 6 — Conference (TermConf 2026): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
