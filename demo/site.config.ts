import {
  defineSite, page, card, timeline, link, skillBar,
  section, quote, hero, table, list, ascii, markdown,
  themes, divider, spacer, badge
} from "terminaltui";

export default defineSite({
  name: "Omar",
  tagline: "software engineer · builder · creator",
  banner: ascii("OMAR", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.tokyoNight,
  animations: {
    boot: true,
    transitions: "fade",
    exitMessage: "See you next time! ✌️",
  },

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown(`Hey! Welcome to my terminal. I build things that live
          at the intersection of design and engineering.`),
        spacer(),
        section("Skills", [
          skillBar("TypeScript", 92),
          skillBar("React", 88),
          skillBar("Node.js", 85),
          skillBar("Rust", 70),
          skillBar("Python", 78),
        ]),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: "◈",
      content: [
        card({
          title: "terminaltui",
          subtitle: "★ new",
          body: "Turn any website into a beautiful terminal experience. The framework you're looking at right now.",
          tags: ["TypeScript", "CLI", "TUI"],
          url: "https://github.com/terminaltui",
        }),
        card({
          title: "cool-project",
          subtitle: "★ 420",
          body: "A really cool project that does amazing things with code.",
          tags: ["Rust", "Open Source"],
        }),
        card({
          title: "another-thing",
          subtitle: "★ 200",
          body: "Yet another awesome project worth checking out.",
          tags: ["Go", "CLI"],
        }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "▣",
      content: [
        timeline([
          {
            title: "Senior Engineer",
            subtitle: "Cool Company",
            period: "2024 — present",
            description: "Building the future of developer tools.",
          },
          {
            title: "Software Engineer",
            subtitle: "Startup Inc",
            period: "2022 — 2024",
            description: "Full-stack development, shipped 3 major products.",
          },
          {
            title: "Junior Developer",
            subtitle: "Agency Co",
            period: "2020 — 2022",
            description: "Where it all began. Learned fast, shipped faster.",
          },
        ]),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com"),
        link("Twitter / X", "https://x.com"),
        link("LinkedIn", "https://linkedin.com"),
        link("Email", "mailto:hello@example.com"),
      ],
    }),
  ],
});
