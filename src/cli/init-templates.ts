/**
 * Template generators for `terminaltui init`.
 *
 * Extracted from init.ts to keep files under 400 lines.
 */

export function generateMinimal(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, link, markdown, ascii, themes } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "welcome to my terminal")},
  banner: ascii(${JSON.stringify(name)}, { font: "ANSI Shadow" }),
  theme: themes.${theme},

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown("Hello! Edit site.config.ts to customize this site."),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com"),
        link("Website", "https://example.com"),
      ],
    }),
  ],
});
`;
}

export function generatePortfolio(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, card, timeline, link, skillBar, ascii, markdown, themes, divider } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "software engineer")},
  banner: ascii(${JSON.stringify(name)}, { font: "ANSI Shadow", gradient: ["#ff6b6b", "#4ecdc4"] }),
  theme: themes.${theme},
  animations: { boot: true },

  pages: [
    page("about", {
      title: "About",
      icon: "◆",
      content: [
        markdown("Hey! I build things. Edit this file to tell your story."),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: "◈",
      content: [
        card({ title: "Project One", subtitle: "★ 100", body: "A cool project", tags: ["TypeScript"], url: "https://github.com" }),
        card({ title: "Project Two", subtitle: "★ 50", body: "Another project", tags: ["Rust"], url: "https://github.com" }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "▣",
      content: [
        timeline([
          { title: "Senior Engineer", subtitle: "Company", period: "2023 — present", description: "Leading projects" },
          { title: "Software Engineer", subtitle: "Startup", period: "2021 — 2023", description: "Full-stack development" },
        ]),
      ],
    }),

    page("skills", {
      title: "Skills",
      icon: "▤",
      content: [
        skillBar("TypeScript", 90),
        skillBar("Rust", 75),
        skillBar("Python", 80),
        skillBar("Go", 65),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("GitHub", "https://github.com"),
        link("LinkedIn", "https://linkedin.com"),
        link("Email", "mailto:hello@example.com"),
      ],
    }),
  ],
});
`;
}

export function generateLanding(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, hero, card, table, link, list, badge, ascii, themes } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "the future is here")},
  banner: ascii(${JSON.stringify(name)}, { font: "ANSI Shadow", gradient: ["#7c3aed", "#06b6d4"] }),
  theme: themes.${theme},
  animations: { boot: true },

  pages: [
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        hero({ title: "Welcome to ${name}", subtitle: "${tagline || "Build something amazing."}", cta: { label: "Get Started →", url: "https://example.com" } }),
      ],
    }),

    page("features", {
      title: "Features",
      icon: "◈",
      content: [
        card({ title: "Feature One", body: "Description of your first feature", tags: ["Core"] }),
        card({ title: "Feature Two", body: "Description of your second feature", tags: ["Pro"] }),
        card({ title: "Feature Three", body: "Description of your third feature", tags: ["Enterprise"] }),
      ],
    }),

    page("pricing", {
      title: "Pricing",
      icon: "▣",
      content: [
        table(["Plan", "Price", "Features"], [
          ["Free", "$0/mo", "Basic features"],
          ["Pro", "$10/mo", "Everything in Free + more"],
          ["Enterprise", "Custom", "Unlimited everything"],
        ]),
      ],
    }),

    page("docs", {
      title: "Quick Start",
      icon: "▸",
      content: [
        list(["Install the package", "Configure your settings", "Deploy to production"], "number"),
        link("Full Documentation →", "https://docs.example.com"),
      ],
    }),
  ],
});
`;
}

export function generateRestaurant(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, section, card, table, quote, link, markdown, ascii, themes, divider } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "fine dining experience")},
  banner: ascii(${JSON.stringify(name)}, { font: "Ogre", gradient: ["#d4a373", "#e63946"] }),
  theme: themes.${theme},
  borders: "rounded",
  animations: { boot: true, exitMessage: "Thanks for visiting! See you at the table." },

  pages: [
    page("menu", {
      title: "Menu",
      icon: "◆",
      content: [
        section("Starters", [
          card({ title: "Appetizer One", subtitle: "$12", body: "Description of this dish" }),
          card({ title: "Appetizer Two", subtitle: "$14", body: "Description of this dish" }),
        ]),
        divider(),
        section("Mains", [
          card({ title: "Main Course One", subtitle: "$28", body: "Description of this dish" }),
          card({ title: "Main Course Two", subtitle: "$32", body: "Description of this dish" }),
        ]),
      ],
    }),

    page("about", {
      title: "Our Story",
      icon: "◈",
      content: [
        markdown("Tell the story of your restaurant here."),
        divider(),
        quote("A wonderful dining experience.", "— Food Critic"),
      ],
    }),

    page("hours", {
      title: "Hours & Location",
      icon: "▣",
      content: [
        table(["Day", "Hours"], [
          ["Mon — Fri", "11:00 AM — 10:00 PM"],
          ["Sat — Sun", "10:00 AM — 11:00 PM"],
        ]),
        divider(),
        markdown("**Address:** 123 Main Street, Your City"),
        link("Google Maps", "https://maps.google.com"),
        link("Reservations", "https://opentable.com"),
      ],
    }),

    page("contact", {
      title: "Contact",
      icon: "◉",
      content: [
        link("Instagram", "https://instagram.com"),
        link("Phone", "tel:+15551234567"),
        link("Email", "mailto:hello@restaurant.com"),
      ],
    }),
  ],
});
`;
}

export function generateBlog(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, card, link, markdown, ascii, themes } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "thoughts and writing")},
  banner: ascii(${JSON.stringify(name)}, { font: "Small", gradient: ["#ebbcba", "#c4a7e7"] }),
  theme: themes.${theme},

  pages: [
    page("posts", {
      title: "Posts",
      icon: "◆",
      content: [
        card({ title: "My First Post", subtitle: "Mar 2026", body: "A brief summary of what this post is about..." }),
        card({ title: "Another Post", subtitle: "Feb 2026", body: "More interesting thoughts..." }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "◈",
      content: [
        markdown("Write about yourself and your blog here."),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("RSS Feed", "https://example.com/feed"),
        link("Twitter", "https://twitter.com"),
        link("GitHub", "https://github.com"),
      ],
    }),
  ],
});
`;
}

export function generateCreative(name: string, tagline: string, theme: string): string {
  return `import { defineSite, page, markdown, link, ascii, themes, spacer, divider } from "terminaltui";

export default defineSite({
  name: ${JSON.stringify(name)},
  tagline: ${JSON.stringify(tagline || "experiment · create · explore")},
  banner: ascii(${JSON.stringify(name)}, { font: "Slant", gradient: ["#ff2a6d", "#05d9e8", "#ff2a6d"] }),
  theme: themes.${theme},
  animations: { boot: true, exitMessage: "[ end of transmission ]" },

  pages: [
    page("enter", {
      title: "Enter",
      icon: "✦",
      content: [
        spacer(2),
        markdown("Welcome to the void. This is your creative space."),
        spacer(),
        divider("dotted"),
        spacer(),
        markdown("Edit **site.config.ts** to make it yours."),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("The Source", "https://github.com"),
      ],
    }),
  ],
});
`;
}
