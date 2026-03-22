import { defineSite, page, card, timeline, link, skillBar, section, quote, ascii, markdown, themes, divider, spacer, badge } from "terminaltui";

export default defineSite({
  name: "Alex Chen",
  tagline: "full-stack engineer · open source · coffee enthusiast",
  banner: ascii("Alex Chen", { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.tokyoNight,
  animations: { boot: true, transitions: "fade", exitMessage: "Thanks for stopping by! ✌️" },

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown(`Hey! I'm Alex — a full-stack engineer based in San Francisco.
          I love building developer tools and contributing to open source.
          Currently at **Acme Corp** working on the platform team.`),
        spacer(),
        section("Skills", [
          skillBar("TypeScript", 95),
          skillBar("React", 90),
          skillBar("Node.js", 88),
          skillBar("Rust", 70),
          skillBar("PostgreSQL", 82),
          skillBar("AWS", 78),
        ]),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: "◈",
      content: [
        card({
          title: "fast-deploy",
          subtitle: "★ 2.4k",
          body: "Zero-config deployment CLI. Push to any cloud in seconds.",
          tags: ["TypeScript", "CLI", "Open Source"],
          url: "https://github.com/alexchen/fast-deploy",
        }),
        card({
          title: "query-builder",
          subtitle: "★ 1.1k",
          body: "Type-safe SQL query builder for TypeScript with zero overhead.",
          tags: ["TypeScript", "Database"],
          url: "https://github.com/alexchen/query-builder",
        }),
        card({
          title: "terminal-ui",
          subtitle: "★ 890",
          body: "Beautiful TUI components for Rust CLI applications.",
          tags: ["Rust", "TUI"],
          url: "https://github.com/alexchen/terminal-ui",
        }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "▣",
      content: [
        timeline([
          {
            title: "Senior Platform Engineer",
            subtitle: "Acme Corp",
            period: "2023 — present",
            description: "Leading the developer platform team. Building internal tools that serve 200+ engineers.",
          },
          {
            title: "Software Engineer",
            subtitle: "StartupCo",
            period: "2021 — 2023",
            description: "Full-stack web development. Led the migration from monolith to microservices.",
          },
          {
            title: "Junior Developer",
            subtitle: "AgencyCo",
            period: "2019 — 2021",
            description: "Client projects, WordPress to React migrations, learned the ropes.",
          },
        ]),
      ],
    }),

    page("writing", {
      title: "Writing",
      icon: "▤",
      content: [
        card({ title: "Why I switched from Go to Rust", subtitle: "Mar 2026", body: "A practical comparison for CLI developers." }),
        card({ title: "Building type-safe APIs", subtitle: "Jan 2026", body: "How we eliminated runtime errors with end-to-end type safety." }),
        card({ title: "The case for monorepos", subtitle: "Nov 2025", body: "Why our team moved to a monorepo and never looked back." }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com/alexchen"),
        link("Twitter / X", "https://x.com/alexchen"),
        link("LinkedIn", "https://linkedin.com/in/alexchen"),
        link("Blog", "https://alexchen.dev/blog"),
        link("Email", "mailto:alex@alexchen.dev"),
      ],
    }),
  ],
});
