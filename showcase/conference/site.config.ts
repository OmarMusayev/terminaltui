import {
  defineSite,
  page,
  hero,
  tabs,
  timeline,
  card,
  accordion,
  markdown,
  link,
  spacer,
  divider,
} from "../../src/index.js";

export default defineSite({
  name: "TermConf 2026",
  tagline: "The Terminal Renaissance",
  banner: {
    text: "TERMCONF",
    font: "Ogre",
  },
  theme: "nord",
  borders: "single",
  animations: {
    boot: true,
    transitions: "slide",
    exitMessage: "See you at TermConf 2026! June 15-16, Portland OR.",
  },
  pages: [
    page("home", {
      title: "Home",
      icon: "~",
      content: [
        hero({
          title: "The Terminal Renaissance",
          subtitle:
            "June 15-16, Portland OR. Two days on CLI tools, TUI frameworks, and terminal culture. 30+ speakers, workshops, and the largest gathering of terminal enthusiasts on the West Coast.",
          cta: { label: "Register Now", url: "https://termconf.dev/register" },
        }),
        spacer(),
        markdown(`
## Why TermConf?

The terminal is having a moment. From GPU-accelerated emulators to rich TUI frameworks, from AI-powered shells to elegant CLI tools, the command line is being reimagined for a new generation.

TermConf brings together the builders, artists, and thinkers pushing the terminal forward. Whether you ship CLI tools, design TUI interfaces, or just live in your terminal, this is your conference.

**Early bird tickets available through May 1st.**
        `),
      ],
    }),

    page("schedule", {
      title: "Schedule",
      icon: ">",
      content: [
        tabs([
          {
            label: "Day 1 — June 15",
            content: [
              timeline([
                {
                  title: "Sophia Chen",
                  period: "9:00 AM",
                  subtitle: "Keynote",
                  description:
                    "The State of the Terminal — A sweeping look at how terminal technology has evolved over the past decade and where we're headed. Covering GPU rendering, Unicode, adaptive theming, and the convergence of CLI and GUI.",
                },
                {
                  title: "Marcus Rivera",
                  period: "10:30 AM",
                  subtitle: "Warp",
                  description:
                    "Building a Modern Terminal Emulator — Lessons from building Warp: GPU-accelerated rendering, collaborative features, and rethinking the terminal UX from first principles.",
                },
                {
                  title: "Yuki Tanaka",
                  period: "11:30 AM",
                  subtitle: "Charm",
                  description:
                    "TUI Frameworks in Go: Bubble Tea and Beyond — Deep dive into compositional TUI architecture, the Elm-inspired model, and how Charm's ecosystem is making beautiful CLIs accessible to everyone.",
                },
                {
                  title: "Priya Sharma",
                  period: "1:30 PM",
                  subtitle: "Vercel",
                  description:
                    "CLI DX That Sparks Joy — Designing CLI tools that developers actually enjoy using. Covering argument parsing, interactive prompts, progress indicators, error messages, and the art of helpful --help.",
                },
                {
                  title: "Erik Johansson",
                  period: "3:00 PM",
                  subtitle: "Ghostty",
                  description:
                    "Cross-Platform Terminal Rendering — The surprising challenges of making terminals look identical across macOS, Linux, and Windows. Font rendering, color spaces, and the quest for pixel-perfect output.",
                },
                {
                  title: "Amara Osei",
                  period: "4:30 PM",
                  subtitle: "Independent",
                  description:
                    "ASCII Art in the Age of AI — Generative ASCII art, procedural scenes, and the intersection of creative coding and terminal constraints. Live demo of AI-assisted terminal art generation.",
                },
              ]),
            ],
          },
          {
            label: "Day 2 — June 16",
            content: [
              timeline([
                {
                  title: "Daniel Park",
                  period: "9:00 AM",
                  subtitle: "Anthropic",
                  description:
                    "AI Meets the Command Line — How LLMs are transforming CLI workflows. From intelligent autocompletion to conversational interfaces, exploring the future of human-terminal interaction.",
                },
                {
                  title: "Lucia Fernandez",
                  period: "10:30 AM",
                  subtitle: "Nushell",
                  description:
                    "Rethinking the Shell — Why structured data should replace text streams. A tour of Nushell's pipeline architecture and how treating the shell as a programming language changes everything.",
                },
                {
                  title: "Kai Nakamura",
                  period: "11:30 AM",
                  subtitle: "Dataflow",
                  description:
                    "Terminal Dashboards for Infrastructure — Building real-time monitoring TUIs for distributed systems. Covering data streaming, sparklines, heat maps, and making P99 latency visible at a glance.",
                },
                {
                  title: "Zara Okonkwo",
                  period: "1:30 PM",
                  subtitle: "Figma",
                  description:
                    "Designing for 80 Columns — UI/UX principles for terminal interfaces. Grid systems, typography in monospace, color theory for 256-color palettes, and making TUIs feel as polished as GUIs.",
                },
                {
                  title: "Oliver Schmidt",
                  period: "3:00 PM",
                  subtitle: "Zellij",
                  description:
                    "Terminal Multiplexers Reimagined — Beyond tmux: plugin systems, WebAssembly extensions, floating panes, and building a terminal workspace that adapts to your workflow.",
                },
                {
                  title: "Maya Williams",
                  period: "4:30 PM",
                  subtitle: "Community Panel",
                  description:
                    "The Future of Terminal Culture — A panel discussion on open source sustainability, terminal accessibility, the retro computing revival, and what the next decade holds for CLI enthusiasts.",
                },
              ]),
            ],
          },
        ]),
      ],
    }),

    page("speakers", {
      title: "Speakers",
      icon: "*",
      content: [
        card({
          title: "Sophia Chen",
          subtitle: "Creator of Alacritty",
          body: "Keynote: The State of the Terminal — Tracing the evolution of terminal technology and charting the course ahead.",
          tags: ["Keynote", "Terminal Emulators"],
        }),
        card({
          title: "Marcus Rivera",
          subtitle: "Engineering Lead at Warp",
          body: "Building a Modern Terminal Emulator — GPU rendering, collaboration, and rethinking UX.",
          tags: ["Warp", "GPU", "Rust"],
        }),
        card({
          title: "Yuki Tanaka",
          subtitle: "Core Team at Charm",
          body: "TUI Frameworks in Go — Bubble Tea architecture, composability, and the Charm ecosystem.",
          tags: ["Go", "Bubble Tea", "TUI"],
        }),
        card({
          title: "Priya Sharma",
          subtitle: "DX Engineer at Vercel",
          body: "CLI DX That Sparks Joy — Designing command-line tools developers love to use.",
          tags: ["DX", "CLI Design", "UX"],
        }),
        card({
          title: "Daniel Park",
          subtitle: "AI Researcher at Anthropic",
          body: "AI Meets the Command Line — LLMs, conversational shells, and intelligent CLI tooling.",
          tags: ["AI", "LLM", "CLI"],
        }),
        card({
          title: "Lucia Fernandez",
          subtitle: "Creator of Nushell",
          body: "Rethinking the Shell — Structured data pipelines and the shell as a programming language.",
          tags: ["Nushell", "Shell", "Data"],
        }),
        card({
          title: "Oliver Schmidt",
          subtitle: "Creator of Zellij",
          body: "Terminal Multiplexers Reimagined — Plugins, WebAssembly, and adaptive workspaces.",
          tags: ["Zellij", "Multiplexer", "WASM"],
        }),
        card({
          title: "Amara Osei",
          subtitle: "Independent Artist & Developer",
          body: "ASCII Art in the Age of AI — Generative art, procedural scenes, and creative coding in the terminal.",
          tags: ["ASCII Art", "Creative Coding", "AI"],
        }),
      ],
    }),

    page("venue", {
      title: "Venue",
      icon: "#",
      content: [
        markdown(`
## Oregon Convention Center

TermConf 2026 takes place at the **Oregon Convention Center** in Portland's Central Eastside — the largest convention center in the Pacific Northwest, featuring sustainably powered facilities and excellent public transit access.

The conference occupies **Hall D** with seating for 800 attendees, plus two breakout rooms for workshops and an open lounge area with power outlets at every seat (naturally).
        `),
        spacer(),
        card({
          title: "Venue Details",
          subtitle: "Oregon Convention Center — Hall D",
          body: "777 NE Martin Luther King Jr Blvd, Portland, OR 97232. Garage parking on-site at $15/day with EV charging available. MAX Green/Orange Line to Convention Center station (2 min walk).",
          tags: ["800 Seats", "Workshops", "Lounge"],
        }),
        spacer(),
        card({
          title: "Hotel Block",
          subtitle: "Hyatt Regency Portland — $189/night",
          body: "Use code TERMCONF26 for the discounted block rate. 5-minute walk from the convention center. Book by May 15 to guarantee availability.",
          tags: ["Partner Hotel", "Block Rate"],
          url: "https://hyatt.com/termconf26",
        }),
        spacer(),
        divider("label", "Getting There"),
        spacer(),
        link("Get Directions", "https://maps.google.com/?q=Oregon+Convention+Center", { icon: ">" }),
        link("MAX Light Rail Schedule", "https://trimet.org/max", { icon: ">" }),
        link("Portland Airport Shuttle", "https://portlandairportshuttle.com", { icon: ">" }),
        link("Book Hotel (Hyatt Regency)", "https://hyatt.com/termconf26", { icon: ">" }),
      ],
    }),

    page("sponsors", {
      title: "Sponsors",
      icon: "$",
      content: [
        markdown(`
## Our Sponsors

TermConf is made possible by the generous support of companies building the future of the terminal.
        `),
        spacer(),
        accordion([
          {
            label: "Platinum Sponsors",
            content: [
              card({
                title: "Warp",
                subtitle: "Keynote Stage Sponsor",
                body: "Main hall branding, keynote stage naming rights, and 20 attendee tickets. Warp is reimagining the terminal with GPU-accelerated rendering and collaborative features.",
                tags: ["Platinum", "Keynote Stage", "20 Tickets"],
                url: "https://warp.dev",
              }),
              card({
                title: "Charm",
                subtitle: "Workshop Space Sponsor",
                body: "Workshop space, after-party sponsor, and 15 attendee tickets. Charm builds delightful CLI tools and the Bubble Tea TUI framework for Go.",
                tags: ["Platinum", "Workshops", "15 Tickets"],
                url: "https://charm.sh",
              }),
              card({
                title: "Ghostty",
                subtitle: "Lounge Area Sponsor",
                body: "Lanyard sponsor, lounge area naming rights, and 15 attendee tickets. Ghostty is a fast, cross-platform terminal emulator focused on correctness.",
                tags: ["Platinum", "Lounge", "15 Tickets"],
                url: "https://ghostty.org",
              }),
            ],
          },
          {
            label: "Gold Sponsors",
            content: [
              card({
                title: "Anthropic",
                subtitle: "AI Track Sponsor",
                body: "AI track sponsorship, demo booth, and 10 attendee tickets. Anthropic builds Claude, powering the next generation of AI-assisted terminal workflows.",
                tags: ["Gold", "AI Track", "10 Tickets"],
                url: "https://anthropic.com",
              }),
              card({
                title: "Vercel",
                subtitle: "DX Track Sponsor",
                body: "DX track sponsorship, swag bags, and 10 attendee tickets. Vercel is the platform for frontend developers, with world-class CLI tooling.",
                tags: ["Gold", "DX Track", "10 Tickets"],
                url: "https://vercel.com",
              }),
              card({
                title: "Zellij",
                subtitle: "Breakout Room Sponsor",
                body: "Breakout room sponsorship, demo booth, and 8 attendee tickets. Zellij is a modern terminal multiplexer with WebAssembly plugin support.",
                tags: ["Gold", "Breakout Room", "8 Tickets"],
                url: "https://zellij.dev",
              }),
            ],
          },
          {
            label: "Silver Sponsors",
            content: [
              card({
                title: "Nerd Fonts",
                subtitle: "Badge Sponsor",
                body: "Conference badge sponsorship and 5 attendee tickets. Nerd Fonts patches developer-targeted fonts with a high number of glyphs and icons.",
                tags: ["Silver", "Badges", "5 Tickets"],
                url: "https://nerdfonts.com",
              }),
              card({
                title: "Starship",
                subtitle: "Coffee Station Sponsor",
                body: "Coffee station sponsorship and 5 attendee tickets. Starship is a minimal, blazing-fast, and infinitely customizable cross-shell prompt.",
                tags: ["Silver", "Coffee", "5 Tickets"],
                url: "https://starship.rs",
              }),
            ],
          },
        ]),
        spacer(),
        divider(),
        spacer(),
        link("Become a Sponsor", "https://termconf.dev/sponsors", { icon: "$" }),
        link("Contact: sponsors@termconf.dev", "mailto:sponsors@termconf.dev", { icon: ">" }),
      ],
    }),
  ],
});
