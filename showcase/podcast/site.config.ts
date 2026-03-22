import {
  defineSite,
  page,
  card,
  markdown,
  quote,
  link,
  divider,
  spacer,
  asciiArt,
  accordion,
} from "../../src/index.js";

export default defineSite({
  name: "Syntax Error",
  tagline: "A weekly deep dive into the tech that breaks (and the people who fix it)",
  banner: {
    text: "SYNTAX",
    font: "Electronic",
  },
  theme: "monokai",
  borders: "rounded",
  animations: {
    transitions: "fade",
    exitMessage: "Thanks for listening. New episodes drop every Wednesday.",
  },
  pages: [
    page("episodes", {
      title: "Episodes",
      icon: ">",
      content: [
        card({
          title: "Ep.47: The Great Monorepo Migration",
          subtitle: "March 19, 2026",
          body: "Guest: Jared Palmer (Turborepo). How Vercel migrated 200+ packages into a single monorepo, the tooling nightmares they hit, and why Jared thinks monorepos won the build tool wars.",
        }),
        card({
          title: "Ep.46: Writing a Compiler in a Weekend",
          subtitle: "March 12, 2026",
          body: "Guest: Lily Chen. She built a toy language compiler in 48 hours at a hackathon. We walk through lexing, parsing, codegen, and why every developer should try writing a compiler at least once.",
        }),
        card({
          title: "Ep.45: The State of CSS in 2026",
          subtitle: "March 5, 2026",
          body: "Guest: Adam Argyle (Google Chrome). Container queries shipped, :has() changed everything, and anchor positioning is here. We explore what modern CSS makes possible and what's still missing.",
        }),
        card({
          title: "Ep.44: Postgres is the Answer",
          subtitle: "February 26, 2026",
          body: "Guest: Craig Kerstiens (Crunchy Data). From JSONB to pgvector, Postgres keeps absorbing other databases. We discuss when Postgres is genuinely enough and when you need something else.",
        }),
        card({
          title: "Ep.43: Debugging Production at 3 AM",
          subtitle: "February 19, 2026",
          body: "Guest: Charity Majors (Honeycomb). War stories from the trenches of observability. How to build systems you can actually debug, why logs aren't enough, and the art of the 3 AM incident response.",
        }),
        card({
          title: "Ep.42: The Bun Runtime One Year Later",
          subtitle: "February 12, 2026",
          body: "Guest: Jarred Sumner (Oven). A candid conversation about Bun's first year in production. What worked, what didn't, the Node.js compatibility journey, and the road to 2.0.",
        }),
        card({
          title: "Ep.41: AI Code Review — Help or Hype?",
          subtitle: "February 5, 2026",
          body: "Guest: Swyx (smol.ai). We put three AI code review tools through their paces on real PRs. Spoiler: they caught bugs we missed, but also suggested changes that would break everything.",
        }),
        card({
          title: "Ep.40: Rust in the Browser with WASM",
          subtitle: "January 29, 2026",
          body: "Guest: Lin Clark. From Figma to Photoshop, WASM is powering serious applications. We explore the Rust-to-WASM pipeline, component model, and what WASI means for server-side WASM.",
        }),
        card({
          title: "Ep.39: Why SQLite is Everywhere",
          subtitle: "January 22, 2026",
          body: "Guest: Richard Hipp (SQLite). The most deployed database in history, running on every phone and browser. We talk about testing methodology, backward compatibility, and the Lemon parser.",
        }),
        card({
          title: "Ep.38: Designing Developer Tools",
          subtitle: "January 15, 2026",
          body: "Guest: Guillermo Rauch (Vercel). What makes a developer tool feel magical? We discuss error messages, zero-config defaults, progressive disclosure, and why DX is the new UX.",
        }),
        card({
          title: "Ep.37: The Edge Computing Debate",
          subtitle: "January 8, 2026",
          body: "Guest: Sunil Pai (PartyKit). Is the edge a revolution or a marketing term? We debate when edge computing actually helps, when it's overkill, and the real-world latency numbers nobody shares.",
        }),
        card({
          title: "Ep.36: Open Source Sustainability",
          subtitle: "January 1, 2026",
          body: "Guest: Evan You (Vue/Vite). The economics of open source. Sponsorship models, VC-funded OSS, license changes, and how Evan built a sustainable career around open source JavaScript tooling.",
        }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "?",
      content: [
        markdown(`
## About Syntax Error

**Syntax Error** is a weekly podcast — an honest, technical, and occasionally unhinged conversation about the tools, patterns, and mistakes that shape how we build software. New episodes every Wednesday.
        `),
        card({
          title: "Ava Torres",
          subtitle: "Co-host",
          body: "Full-stack engineer turned podcaster. 10 years shipping software at startups and big tech before picking up a microphone. Known for deep dives into languages, runtimes, and asking the questions nobody else will.",
          tags: ["Host", "Languages & Runtimes"],
        }),
        card({
          title: "Ryan Kowalski",
          subtitle: "Co-host",
          body: "Infrastructure engineer and recovering on-call addict. Spent a decade building and breaking distributed systems. Brings the war stories, the debugging instincts, and an unhealthy obsession with Postgres.",
          tags: ["Host", "Infrastructure & DevOps"],
        }),
        divider(),
        accordion([
          {
            label: "What We Cover",
            content: [
              markdown(`
- **Languages & Runtimes** — Deep dives into Rust, TypeScript, Go, Python, and whatever else is exciting
- **Infrastructure** — Databases, deployment, observability, and the art of keeping things running
- **Developer Tools** — Build systems, editors, CLIs, and the tools that make (or break) our workflows
- **Career & Culture** — Open source sustainability, hiring, burnout, and the human side of engineering
              `),
            ],
          },
          {
            label: "Episode Format",
            content: [
              markdown(`
Each episode runs **45-60 minutes** and follows a loose structure: guest intro, deep topic exploration, hot takes, and a closing "what's in your terminal" segment where guests share their setup.
              `),
            ],
          },
          {
            label: "By The Numbers",
            content: [
              markdown(`
- **47 episodes** published since launch
- **18,000+ weekly listeners** across all platforms
- **4.8 star average** on Apple Podcasts (320+ ratings)
- Featured in **Hacker News**, **Changelog**, and **Dev.to** roundups
              `),
            ],
          },
        ]),
        spacer(),
        quote(
          "Syntax Error is the podcast I wish existed when I started my career. Technical enough to learn from, human enough to enjoy. It's the only dev podcast I never skip.",
          "5-star review on Apple Podcasts",
        ),
      ],
    }),

    page("subscribe", {
      title: "Subscribe",
      icon: "+",
      content: [
        markdown(`
## Listen Everywhere

New episodes drop every **Wednesday at 6 AM Pacific**. Subscribe on your favorite platform so you never miss an episode.
        `),
        spacer(),
        link("Apple Podcasts", "https://podcasts.apple.com/syntaxerror", { icon: ">" }),
        link("Spotify", "https://open.spotify.com/show/syntaxerror", { icon: ">" }),
        link("Overcast", "https://overcast.fm/+syntaxerror", { icon: ">" }),
        link("YouTube", "https://youtube.com/@syntaxerrorpod", { icon: ">" }),
        link("RSS Feed", "https://syntaxerror.dev/feed.xml", { icon: ">" }),
        link("Website", "https://syntaxerror.dev", { icon: ">" }),
      ],
    }),

    page("sponsors", {
      title: "Sponsors",
      icon: "$",
      content: [
        markdown(`
## Our Sponsors

Syntax Error is made possible by companies that care about developers. Interested in sponsoring? Email **sponsors@syntaxerror.dev** for our media kit.
        `),
        spacer(),
        card({
          title: "Sentry",
          subtitle: "Season 3 sponsor",
          body: "Application monitoring that tells you what broke, why, and how to fix it. Sentry's error tracking and performance monitoring is used by 4M+ developers. Code breaks, Sentry fixes. Use code SYNTAXERROR for 3 months free.",
          tags: ["Monitoring", "Error Tracking"],
        }),
        card({
          title: "Neon",
          subtitle: "Season 3 sponsor",
          body: "Serverless Postgres that scales to zero. Neon separates compute from storage so you get instant branching, autoscaling, and a generous free tier. The Postgres experience your side projects deserve.",
          tags: ["Database", "Serverless", "Postgres"],
        }),
        card({
          title: "Linear",
          subtitle: "Season 2 sponsor",
          body: "Issue tracking built for modern software teams. Linear is fast, opinionated, and beautiful. If you've ever rage-quit Jira, Linear is the tool you've been waiting for. Try it free at linear.app.",
          tags: ["Project Management", "Dev Tools"],
        }),
        card({
          title: "Fly.io",
          subtitle: "Season 1 sponsor",
          body: "Run your full-stack apps close to your users. Fly.io transforms Docker images into micro-VMs running on hardware in 30+ regions. Real servers, real IPs, real fast. Deploy your first app in 5 minutes.",
          tags: ["Hosting", "Edge", "Infrastructure"],
        }),
      ],
    }),

    page("stats", {
      title: "Stats",
      icon: "#",
      content: [
        card({
          title: "18,200 Weekly Listeners",
          subtitle: "Growth over 25 weeks",
          body: "From 2,100 listeners at launch to 18,200 — a 766% increase in six months. Consistent week-over-week growth driven by word of mouth, guest cross-promotion, and Hacker News features.",
          tags: ["Audience", "Growth"],
        }),
        {
          type: "custom" as const,
          render: (width: number) => {
            const listenerData = [
              2100, 2400, 3100, 3800, 4200, 4600, 5100, 5800, 6200, 7100,
              7600, 8400, 9200, 9800, 10500, 11200, 12100, 13400, 14200, 15100,
              15800, 16200, 16900, 17400, 18200,
            ];
            const sparkWidth = Math.min(width - 4, 60);
            const spark = asciiArt.sparkline(listenerData, sparkWidth);
            return [
              "  Listeners over 25 weeks (2.1k -> 18.2k)",
              "",
              ...spark.map((line) => "  " + line),
              "",
            ];
          },
        },
        spacer(),
        card({
          title: "Top Episodes by Downloads",
          subtitle: "All-time download leaders",
          body: "Database episodes dominate — SQLite and Postgres are the most downloaded by a wide margin. Infrastructure and open source topics round out the top five.",
          tags: ["Downloads", "Top Content"],
        }),
        {
          type: "custom" as const,
          render: (width: number) => {
            const chartWidth = Math.min(width - 4, 60);
            const chart = asciiArt.barChart(
              [
                { label: "Ep.39: SQLite", value: 42300 },
                { label: "Ep.44: Postgres", value: 38700 },
                { label: "Ep.47: Monorepo", value: 35200 },
                { label: "Ep.43: Debugging", value: 31400 },
                { label: "Ep.36: Open Source", value: 28900 },
              ],
              { width: chartWidth, showValues: true },
            );
            return ["", ...chart.map((line) => "  " + line), ""];
          },
        },
        spacer(),
        card({
          title: "Community & Reach",
          subtitle: "Podcast milestones",
          body: "4.8 star average on Apple Podcasts from 320+ ratings. Featured in Hacker News, Changelog, and Dev.to roundups. Active Discord community with 2,400+ members.",
          tags: ["Community", "Ratings"],
        }),
      ],
    }),
  ],
});
