import {
  defineSite,
  page,
  card,
  divider,
  markdown,
  link,
  spacer,
  searchInput,
  skillBar,
  sparkline,
} from "../../src/index.js";

export default defineSite({
  name: "Alex Rivera",
  tagline: "senior fullstack engineer",
  banner: {
    text: "ALEX",
    font: "ANSI Shadow",
    gradient: ["#ff2a6d", "#05d9e8"],
  },
  theme: "cyberpunk",
  animations: {
    boot: true,
    transitions: "slide",
    exitMessage: "$ logout",
  },
  pages: [
    page("about", {
      title: "About",
      icon: "~",
      content: [
        markdown(`
# About Me

I'm Alex Rivera, a senior fullstack engineer based in Brooklyn, NY with eight years
of experience building products that scale. I specialize in TypeScript, React, and
Node.js on the frontend and backend, with deep expertise in PostgreSQL, Redis, and
cloud-native infrastructure on AWS and GCP.

I've led engineering teams at two YC-backed startups through Series B, shipped
consumer products used by millions, and contributed to open-source projects across
the JavaScript ecosystem. I care deeply about developer experience, test coverage,
and writing code that the next person can actually read. When I'm not coding, I'm
rock climbing, reading science fiction, or tinkering with mechanical keyboards.
        `),
        spacer(),
        sparkline([4, 7, 12, 9, 15, 22, 18, 25, 30, 28, 35, 42, 38, 45, 40, 52, 48, 55, 60, 58]),
        spacer(),
        divider("Skills"),
        skillBar("TypeScript / JavaScript", 95),
        skillBar("React / Next.js", 92),
        skillBar("Node.js / Express / Fastify", 90),
        skillBar("PostgreSQL / Redis", 88),
        skillBar("AWS / GCP / Docker", 85),
      ],
    }),

    page("projects", {
      title: "Projects",
      icon: ">>",
      content: [
        searchInput({
          id: "search-projects",
          placeholder: "Search projects...",
          action: "navigate",
          items: [
            { label: "Patchwork", value: "patchwork", keywords: ["React", "collaborative", "editor"] },
            { label: "Vektor", value: "vektor", keywords: ["CLI", "TypeScript", "database"] },
            { label: "Halflight", value: "halflight", keywords: ["React Native", "meditation", "mobile"] },
            { label: "Terracotta", value: "terracotta", keywords: ["design system", "components", "open source"] },
            { label: "Canopy", value: "canopy", keywords: ["real-time", "analytics", "dashboard"] },
            { label: "Fathom", value: "fathom", keywords: ["NLP", "search", "semantic"] },
          ],
        }),
        spacer(),
        card({
          title: "Patchwork",
          subtitle: "Lead Engineer @ Stitch (2024 - Present)",
          body: "A collaborative document editor built on CRDTs that handles 50k+ concurrent users. Real-time cursors, inline comments, version history, and a plugin SDK used by 200+ teams. Built with React, Hocuspocus, and Y.js.",
          tags: ["React", "CRDTs", "WebSockets", "TypeScript"],
          url: "https://stitch.dev/patchwork",
        }),
        card({
          title: "Vektor",
          subtitle: "Open Source (2024)",
          body: "A type-safe database query builder and migration toolkit for TypeScript. Compiles queries at build time for zero-runtime overhead. Supports PostgreSQL, SQLite, and MySQL with full IntelliSense. 4.2k GitHub stars.",
          tags: ["TypeScript", "PostgreSQL", "CLI", "Open Source"],
          url: "https://github.com/arivera/vektor",
        }),
        card({
          title: "Halflight",
          subtitle: "Co-founder @ Halflight (2022 - 2023)",
          body: "A meditation and breathwork app with adaptive audio that responds to biometric data from Apple Watch. 180k downloads in the first year. Featured in the App Store and covered by TechCrunch.",
          tags: ["React Native", "HealthKit", "Audio", "Mobile"],
          url: "https://halflight.app",
        }),
        card({
          title: "Terracotta",
          subtitle: "Open Source (2023)",
          body: "A headless component library for React with built-in accessibility, animation primitives, and theme tokens. Used by 900+ projects. Fully tree-shakable with zero dependencies outside React.",
          tags: ["React", "Design System", "A11y", "Open Source"],
          url: "https://github.com/arivera/terracotta",
        }),
        card({
          title: "Canopy",
          subtitle: "Senior Engineer @ Verdant (2021 - 2022)",
          body: "Real-time analytics dashboard for e-commerce brands. Ingests 2M events/day through a custom pipeline built on Kafka and ClickHouse. Sub-second query times on datasets with billions of rows.",
          tags: ["Next.js", "Kafka", "ClickHouse", "Real-time"],
          url: "https://verdant.io/canopy",
        }),
        card({
          title: "Fathom",
          subtitle: "Open Source (2022)",
          body: "A semantic search engine for codebases. Uses transformer embeddings to index and query code by meaning rather than keywords. Supports 12 languages. Powers internal search at three mid-size companies.",
          tags: ["Python", "NLP", "Search", "Open Source"],
          url: "https://github.com/arivera/fathom",
        }),
      ],
    }),

    page("experience", {
      title: "Experience",
      icon: "[]",
      content: [
        divider("Work"),
        card({
          title: "Lead Engineer",
          subtitle: "Stitch -- 2024 - Present",
          body: "Leading a team of six engineers building Patchwork, a collaborative editing platform. Architected the CRDT sync layer, designed the plugin SDK, and drove adoption from 40 to 200+ enterprise teams. Reduced editor crash rate by 97% through a custom OT fallback system.",
        }),
        card({
          title: "Senior Fullstack Engineer",
          subtitle: "Verdant -- 2021 - 2024",
          body: "Built the real-time analytics stack from the ground up. Designed the event ingestion pipeline handling 2M events/day, implemented the query engine on ClickHouse, and led the frontend team shipping the dashboard used by 500+ e-commerce brands.",
        }),
        card({
          title: "Co-founder & CTO",
          subtitle: "Halflight -- 2022 - 2023",
          body: "Co-founded a wellness startup building an adaptive meditation app. Led all technical decisions, built the React Native app, integrated HealthKit biometrics, and shipped the audio engine. Reached 180k downloads before the company was acqui-hired.",
        }),
        card({
          title: "Software Engineer",
          subtitle: "Basecamp Labs (YC S19) -- 2019 - 2021",
          body: "First engineering hire at a seed-stage project management startup. Built the core product in React and Node.js, set up CI/CD and infrastructure on AWS, and helped scale from 0 to 15k active users before Series A.",
        }),
        spacer(),
        divider("Education"),
        card({
          title: "B.S. Computer Science",
          subtitle: "Carnegie Mellon University -- 2015 - 2019",
          body: "Concentration in software engineering and human-computer interaction. Teaching assistant for Distributed Systems (15-440). Capstone project on real-time collaborative editing algorithms.",
        }),
        card({
          title: "Recurse Center",
          subtitle: "Brooklyn, NY -- Fall 2019",
          body: "Twelve-week self-directed programming retreat. Focused on systems programming in Rust, built a toy database engine, and contributed to open-source developer tools.",
        }),
      ],
    }),

    page("writing", {
      title: "Writing",
      icon: "//",
      content: [
        card({
          title: "CRDTs in Production: What Nobody Tells You",
          subtitle: "February 2026",
          body: "After two years running CRDTs in a collaborative editor used by 200+ teams, here are the real tradeoffs. Tombstone bloat, clock drift, and the undo problem are harder than any blog post suggests. Includes our solutions and benchmarks.",
          url: "https://alexrivera.dev/blog/crdts-in-production",
        }),
        card({
          title: "Replacing Redux with Signals: A Migration Story",
          subtitle: "October 2025",
          body: "How we migrated a 120k-line React app from Redux to a signals-based architecture over three months without a single day of downtime. Bundle size dropped 34% and re-render counts fell by 80%.",
          url: "https://alexrivera.dev/blog/replacing-redux-with-signals",
        }),
        card({
          title: "The Case for Boring Technology in 2025",
          subtitle: "July 2025",
          body: "PostgreSQL, Express, and server-rendered HTML got us to 15k users and $2M ARR. A defense of choosing proven tools over the latest framework, and why the most productive stack is the one your team already knows.",
          url: "https://alexrivera.dev/blog/boring-technology-2025",
        }),
        card({
          title: "Building Accessible Components from Scratch",
          subtitle: "March 2025",
          body: "The lessons I learned building Terracotta, a headless component library with first-class accessibility. Covers ARIA patterns, focus management, screen reader testing, and why most component libraries get it wrong.",
          url: "https://alexrivera.dev/blog/accessible-components",
        }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "->",
      content: [
        link("GitHub", "https://github.com/arivera", { icon: ">" }),
        link("Twitter", "https://twitter.com/alexrivera_dev", { icon: ">" }),
        link("LinkedIn", "https://linkedin.com/in/alexrivera", { icon: ">" }),
        link("Email", "mailto:alex@alexrivera.dev", { icon: ">" }),
        link("Blog", "https://alexrivera.dev/blog", { icon: ">" }),
        link("Resume", "https://alexrivera.dev/resume.pdf", { icon: ">" }),
        link("Mastodon", "https://hachyderm.io/@alexrivera", { icon: ">" }),
        link("Polywork", "https://polywork.com/alexrivera", { icon: ">" }),
      ],
    }),
  ],
});
