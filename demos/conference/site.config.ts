import {
  defineSite,
  page,
  card,
  hero,
  section,
  divider,
  markdown,
  link,
  spacer,
  searchInput,
  tabs,
  row,
  col,
  container,
} from "../../src/index.js";

export default defineSite({
  name: "TermConf 2026",
  tagline: "The Terminal Renaissance — June 15-16, Portland OR",
  banner: {
    text: "TERMCONF",
    font: "Ogre",
    gradient: ["#88c0d0", "#5e81ac"],
  },
  theme: "nord",
  borders: "single",
  animations: {
    boot: true,
    transitions: "slide",
    exitMessage: "See you at TermConf 2026!",
  },
  pages: [
    // ── Home ──────────────────────────────────────────────
    page("home", {
      title: "Home",
      icon: "~",
      content: [
        hero({
          title: "The Terminal Renaissance",
          subtitle:
            "June 15-16, Portland OR. Two days of talks on CLI tools, TUI frameworks, and terminal culture. 30+ speakers, hands-on workshops, and the largest gathering of terminal enthusiasts on the West Coast.",
          cta: { label: "Register Now", url: "https://termconf.dev/register" },
        }),
        spacer(),
        container(
          [
            markdown(`
## Why TermConf?

The terminal is having a moment. From GPU-accelerated emulators to rich TUI frameworks, from AI-powered shells to elegant CLI tools, the command line is being reimagined for a new generation.

TermConf brings together the builders, designers, and thinkers pushing the terminal forward. Whether you ship CLI tools, design TUI interfaces, or simply live in your terminal, this is your conference.
            `),
          ],
          { maxWidth: 90 },
        ),
        spacer(),
        row(
          [
            col(
              [
                card({
                  title: "30+ Talks",
                  subtitle: "Two stages, two days",
                  body: "From keynotes to deep dives, covering GPU rendering, AI-powered shells, TUI frameworks, and the art of designing for 80 columns.",
                  tags: ["Keynotes", "Deep Dives"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Hands-On Workshops",
                  subtitle: "Build something real",
                  body: "Half-day workshops on Bubble Tea, Rust CLI tooling, terminal rendering, and AI-assisted development. Limited to 30 seats each.",
                  tags: ["Bubble Tea", "Rust CLI", "AI Dev"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Networking",
                  subtitle: "Meet your terminal people",
                  body: "Open lounge with power outlets at every seat, after-party at a Portland brewery, and hallway track conversations that turn into open source collaborations.",
                  tags: ["Lounge", "After-Party"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        spacer(),
        row([
          col(
            [
              card({
                title: "Tickets",
                subtitle: "Early bird pricing ends May 1st",
                body: "General admission $299. Student tickets $99. Group discounts available for teams of 5+.",
                tags: ["$299 General", "$99 Student"],
              }),
            ],
            { span: 6, sm: 12, xs: 12 },
          ),
          col(
            [
              card({
                title: "Conference at a Glance",
                subtitle: "June 15-16, 2026",
                body: "30+ speakers across 12 sessions. Hands-on workshops, open lounge, and after-party. The largest gathering of terminal enthusiasts on the West Coast.",
                tags: ["2 Days", "30+ Speakers", "800 Seats"],
              }),
            ],
            { span: 6, sm: 12, xs: 12 },
          ),
        ]),
      ],
    }),

    // ── Schedule ──────────────────────────────────────────
    page("schedule", {
      title: "Schedule",
      icon: ">",
      content: [
        tabs([
          {
            label: "Day 1 — June 15",
            content: [
              row(
                [
                  col(
                    [
                      markdown("### Main Stage"),
                      card({
                        title: "The State of the Terminal",
                        subtitle: "9:00 AM — Keynote",
                        body: "Sophia Chen — A sweeping look at how terminal technology has evolved over the past decade and where we're headed. Covering GPU rendering, Unicode, adaptive theming, and the convergence of CLI and GUI.",
                        tags: ["Keynote"],
                      }),
                      card({
                        title: "Building a Modern Terminal Emulator",
                        subtitle: "10:30 AM",
                        body: "Marcus Rivera (Warp) — Lessons from building Warp: GPU-accelerated rendering, collaborative features, and rethinking the terminal UX from first principles. Why Rust was the right call and what they'd do differently.",
                        tags: ["Infrastructure"],
                      }),
                      card({
                        title: "CLI DX That Sparks Joy",
                        subtitle: "1:30 PM",
                        body: "Priya Sharma (Vercel) — Designing CLI tools developers actually enjoy using. Argument parsing, interactive prompts, progress indicators, error messages, and the underappreciated art of writing helpful --help output.",
                        tags: ["Design"],
                      }),
                    ],
                    { span: 6, sm: 12, xs: 12 },
                  ),
                  col(
                    [
                      markdown("### Track B"),
                      card({
                        title: "TUI Frameworks in Go: Bubble Tea and Beyond",
                        subtitle: "11:30 AM",
                        body: "Yuki Tanaka (Charm) — Deep dive into compositional TUI architecture with the Elm-inspired model. How Charm's ecosystem is making beautiful command-line interfaces accessible to everyone, and what's next for Lip Gloss.",
                        tags: ["Frameworks"],
                      }),
                      card({
                        title: "Cross-Platform Terminal Rendering",
                        subtitle: "3:00 PM",
                        body: "Erik Johansson (Ghostty) — The surprising challenges of making terminals look identical across macOS, Linux, and Windows. Font rendering pipelines, color space conversions, and the quest for pixel-perfect output.",
                        tags: ["Infrastructure"],
                      }),
                      card({
                        title: "ASCII Art in the Age of AI",
                        subtitle: "4:30 PM",
                        body: "Amara Osei — Generative ASCII art, procedural scenes, and the intersection of creative coding and terminal constraints. Live demo of AI-assisted terminal art generation using diffusion models.",
                        tags: ["Creative"],
                      }),
                    ],
                    { span: 6, sm: 12, xs: 12 },
                  ),
                ],
                { gap: 1 },
              ),
            ],
          },
          {
            label: "Day 2 — June 16",
            content: [
              row(
                [
                  col(
                    [
                      markdown("### Main Stage"),
                      card({
                        title: "AI Meets the Command Line",
                        subtitle: "9:00 AM — Keynote",
                        body: "Daniel Park (Anthropic) — How LLMs are transforming CLI workflows. From intelligent autocompletion to conversational interfaces, exploring the future of human-terminal interaction and agentic coding tools.",
                        tags: ["AI"],
                      }),
                      card({
                        title: "Rethinking the Shell",
                        subtitle: "10:30 AM",
                        body: "Lucia Fernandez (Nushell) — Why structured data should replace text streams. A tour of Nushell's pipeline architecture and how treating the shell as a typed programming language changes everything about scripting.",
                        tags: ["Shells"],
                      }),
                      card({
                        title: "Designing for 80 Columns",
                        subtitle: "1:30 PM",
                        body: "Zara Okonkwo (Figma) — UI/UX principles for terminal interfaces. Grid systems, typography in monospace, color theory for 256-color palettes, and making TUIs feel as polished as their GUI counterparts.",
                        tags: ["Design"],
                      }),
                    ],
                    { span: 6, sm: 12, xs: 12 },
                  ),
                  col(
                    [
                      markdown("### Track B"),
                      card({
                        title: "Terminal Dashboards for Infrastructure",
                        subtitle: "11:30 AM",
                        body: "Kai Nakamura (Dataflow) — Building real-time monitoring TUIs for distributed systems. Data streaming, sparklines, heat maps, and making P99 latency visible at a glance without leaving your terminal.",
                        tags: ["Infrastructure"],
                      }),
                      card({
                        title: "Terminal Multiplexers Reimagined",
                        subtitle: "3:00 PM",
                        body: "Oliver Schmidt (Zellij) — Beyond tmux: plugin systems, WebAssembly extensions, floating panes, and building a terminal workspace that adapts to your workflow instead of the other way around.",
                        tags: ["Tools"],
                      }),
                      card({
                        title: "The Future of Terminal Culture",
                        subtitle: "4:30 PM — Panel",
                        body: "Maya Williams — A closing panel on open source sustainability, terminal accessibility, the retro computing revival, and what the next decade holds for CLI enthusiasts. Audience Q&A to follow.",
                        tags: ["Community"],
                      }),
                    ],
                    { span: 6, sm: 12, xs: 12 },
                  ),
                ],
                { gap: 1 },
              ),
            ],
          },
        ]),
      ],
    }),

    // ── Speakers ──────────────────────────────────────────
    page("speakers", {
      title: "Speakers",
      icon: "*",
      content: [
        searchInput({
          id: "speaker-search",
          placeholder: "Search speakers and talks...",
          action: "navigate",
          items: [
            { label: "Sophia Chen — The State of the Terminal", value: "sophia-chen", keywords: ["keynote", "alacritty", "terminal"] },
            { label: "Marcus Rivera — Building a Modern Terminal Emulator", value: "marcus-rivera", keywords: ["warp", "gpu", "rust"] },
            { label: "Yuki Tanaka — TUI Frameworks in Go", value: "yuki-tanaka", keywords: ["charm", "bubble tea", "go"] },
            { label: "Priya Sharma — CLI DX That Sparks Joy", value: "priya-sharma", keywords: ["vercel", "dx", "ux"] },
            { label: "Erik Johansson — Cross-Platform Terminal Rendering", value: "erik-johansson", keywords: ["ghostty", "rendering", "font"] },
            { label: "Amara Osei — ASCII Art in the Age of AI", value: "amara-osei", keywords: ["ascii", "creative coding", "art"] },
            { label: "Daniel Park — AI Meets the Command Line", value: "daniel-park", keywords: ["anthropic", "ai", "llm"] },
            { label: "Lucia Fernandez — Rethinking the Shell", value: "lucia-fernandez", keywords: ["nushell", "shell", "data"] },
            { label: "Kai Nakamura — Terminal Dashboards for Infrastructure", value: "kai-nakamura", keywords: ["dataflow", "monitoring", "dashboards"] },
            { label: "Zara Okonkwo — Designing for 80 Columns", value: "zara-okonkwo", keywords: ["figma", "design", "ux"] },
            { label: "Oliver Schmidt — Terminal Multiplexers Reimagined", value: "oliver-schmidt", keywords: ["zellij", "multiplexer", "wasm"] },
            { label: "Maya Williams — The Future of Terminal Culture", value: "maya-williams", keywords: ["community", "panel", "open source"] },
          ],
          maxResults: 8,
        }),
        spacer(),
        // Row 1: speakers 1-3
        row(
          [
            col(
              [
                card({
                  title: "Sophia Chen",
                  subtitle: "Creator of Alacritty",
                  body: "Keynote: The State of the Terminal. Sophia built one of the first GPU-accelerated terminal emulators and has spent a decade pushing terminal performance forward.",
                  tags: ["Keynote", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Marcus Rivera",
                  subtitle: "Engineering Lead at Warp",
                  body: "Building a Modern Terminal Emulator. Marcus leads the rendering team at Warp, where he works on GPU pipelines and collaborative terminal features.",
                  tags: ["Infrastructure", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Yuki Tanaka",
                  subtitle: "Core Team at Charm",
                  body: "TUI Frameworks in Go. Yuki maintains Bubble Tea and Lip Gloss, the most popular TUI libraries in the Go ecosystem, used by thousands of CLI tools.",
                  tags: ["Frameworks", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        // Row 2: speakers 4-6
        row(
          [
            col(
              [
                card({
                  title: "Priya Sharma",
                  subtitle: "DX Engineer at Vercel",
                  body: "CLI DX That Sparks Joy. Priya designs the developer experience for Vercel's CLI and has strong opinions about what makes a command-line tool feel right.",
                  tags: ["Design", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Erik Johansson",
                  subtitle: "Core Contributor to Ghostty",
                  body: "Cross-Platform Terminal Rendering. Erik has spent three years making terminal rendering pixel-perfect across operating systems and font stacks.",
                  tags: ["Infrastructure", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Amara Osei",
                  subtitle: "Independent Artist and Developer",
                  body: "ASCII Art in the Age of AI. Amara creates generative ASCII art installations and has pioneered techniques for using diffusion models within terminal constraints.",
                  tags: ["Creative", "Day 1"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        // Row 3: speakers 7-9
        row(
          [
            col(
              [
                card({
                  title: "Daniel Park",
                  subtitle: "AI Researcher at Anthropic",
                  body: "AI Meets the Command Line. Daniel works on Claude's terminal integration and studies how LLMs can transform developer workflows in the CLI.",
                  tags: ["AI", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Lucia Fernandez",
                  subtitle: "Creator of Nushell",
                  body: "Rethinking the Shell. Lucia created Nushell to prove that shells don't have to treat everything as text — structured data pipelines change everything.",
                  tags: ["Shells", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Kai Nakamura",
                  subtitle: "Founder of Dataflow",
                  body: "Terminal Dashboards for Infrastructure. Kai builds real-time monitoring TUIs used by SRE teams at companies running thousands of production services.",
                  tags: ["Infrastructure", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        // Row 4: speakers 10-12
        row(
          [
            col(
              [
                card({
                  title: "Zara Okonkwo",
                  subtitle: "Design Systems Lead at Figma",
                  body: "Designing for 80 Columns. Zara brings GUI design rigor to the terminal, applying grid systems and color theory to make TUIs feel as polished as native apps.",
                  tags: ["Design", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Oliver Schmidt",
                  subtitle: "Creator of Zellij",
                  body: "Terminal Multiplexers Reimagined. Oliver built Zellij to modernize the multiplexer with WebAssembly plugins, floating panes, and a friendlier default experience.",
                  tags: ["Tools", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Maya Williams",
                  subtitle: "Community Organizer and Writer",
                  body: "The Future of Terminal Culture. Maya writes about open source sustainability and organizes terminal meetups across the Pacific Northwest. She'll moderate the closing panel.",
                  tags: ["Community", "Day 2"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
      ],
    }),

    // ── Venue ─────────────────────────────────────────────
    page("venue", {
      title: "Venue",
      icon: "#",
      content: [
        row([
          col(
            [
              markdown(`
## Oregon Convention Center

TermConf 2026 takes place at the **Oregon Convention Center** in Portland's Central Eastside — the largest convention center in the Pacific Northwest. Sustainably powered, excellent transit access, and 5 minutes from some of the best coffee in the country.

The conference occupies **Hall D** with seating for 800 attendees, plus two breakout rooms for workshops and an open lounge with power outlets at every seat.
              `),
              spacer(),
              card({
                title: "Getting There",
                subtitle: "Transit & Parking",
                body: "MAX Green and Orange Line to Convention Center station — a 2-minute walk to the entrance. Garage parking on-site at $15/day with EV charging available.",
                tags: ["MAX Light Rail", "On-Site Parking", "EV Charging"],
              }),
              spacer(),
              link("Get Directions", "https://maps.google.com/?q=Oregon+Convention+Center", { icon: ">" }),
              link("MAX Light Rail Schedule", "https://trimet.org/max", { icon: ">" }),
            ],
            { span: 7, sm: 12, xs: 12 },
          ),
          col(
            [
              card({
                title: "Oregon Convention Center — Hall D",
                subtitle: "777 NE MLK Jr Blvd, Portland, OR 97232",
                body: "800-seat main hall, two breakout rooms for workshops, and an open lounge with power outlets at every seat. Full catering, high-speed Wi-Fi, and on-site A/V support.",
                tags: ["800 Seats", "Workshops", "Lounge"],
              }),
              card({
                title: "Hyatt Regency Portland",
                subtitle: "Partner Hotel — $189/night with code TERMCONF26",
                body: "Five-minute walk from the convention center. Book by May 15 to guarantee the block rate. Complimentary Wi-Fi and late checkout for conference attendees.",
                tags: ["Partner Hotel", "Block Rate"],
              }),
              card({
                title: "Nearby Dining",
                subtitle: "Portland's Central Eastside",
                body: "Some of the best coffee and food in the Pacific Northwest within walking distance. Stumptown Coffee (3 min), Pine State Biscuits (5 min), Pok Pok (10 min).",
                tags: ["Coffee", "Restaurants"],
              }),
              spacer(),
              link("Book Hotel (Hyatt Regency)", "https://hyatt.com/termconf26", { icon: ">" }),
            ],
            { span: 5, sm: 12, xs: 12 },
          ),
        ]),
      ],
    }),

    // ── Sponsors ───────────────────────────────────────────
    page("sponsors", {
      title: "Sponsors",
      icon: "$",
      content: [
        markdown(`
## Our Sponsors

TermConf is made possible by companies building the future of the terminal. Interested in sponsoring? Packages start at $2,500.
        `),
        spacer(),

        // Gold Sponsors
        section("Gold Sponsors", [
          row([
            col(
              [
                card({
                  title: "Warp",
                  subtitle: "Keynote Stage Sponsor",
                  body: "Reimagining the terminal with GPU-accelerated rendering and collaborative features. Main hall branding, keynote stage naming rights, and 20 attendee tickets.",
                  tags: ["Gold", "20 Tickets"],
                }),
              ],
              { span: 6, sm: 12, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Charm",
                  subtitle: "Workshop Space Sponsor",
                  body: "Makers of Bubble Tea, Lip Gloss, and the tools that make beautiful CLIs possible. Workshop sponsorship, after-party host, and 15 attendee tickets.",
                  tags: ["Gold", "15 Tickets"],
                }),
              ],
              { span: 6, sm: 12, xs: 12 },
            ),
          ]),
        ]),
        spacer(),

        // Silver Sponsors
        section("Silver Sponsors", [
          row([
            col(
              [
                card({
                  title: "Anthropic",
                  subtitle: "AI Track Sponsor",
                  body: "Building Claude and pioneering AI-assisted developer workflows. AI track sponsorship, demo booth, and 10 attendee tickets.",
                  tags: ["Silver", "10 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Vercel",
                  subtitle: "DX Track Sponsor",
                  body: "The platform for frontend developers with world-class CLI tooling. DX track sponsorship, swag bags, and 10 attendee tickets.",
                  tags: ["Silver", "10 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Ghostty",
                  subtitle: "Lounge Sponsor",
                  body: "A fast, cross-platform terminal emulator focused on correctness and native rendering. Lounge naming rights, lanyard sponsor, and 8 attendee tickets.",
                  tags: ["Silver", "8 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ]),
        ]),
        spacer(),

        // Community Sponsors
        section("Community Sponsors", [
          row([
            col(
              [
                card({
                  title: "Nerd Fonts",
                  subtitle: "Badge Sponsor",
                  body: "Patches developer-targeted fonts with a high number of glyphs and icons. Conference badge sponsorship and 5 attendee tickets.",
                  tags: ["Community", "5 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Starship",
                  subtitle: "Coffee Station Sponsor",
                  body: "A minimal, blazing-fast, and infinitely customizable cross-shell prompt. Coffee station sponsorship and 5 attendee tickets.",
                  tags: ["Community", "5 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Zellij",
                  subtitle: "Breakout Room Sponsor",
                  body: "A modern terminal multiplexer with WebAssembly plugin support and floating panes. Breakout room sponsorship and 5 attendee tickets.",
                  tags: ["Community", "5 Tickets"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ]),
        ]),
        spacer(),
        link("Become a Sponsor", "https://termconf.dev/sponsors", { icon: "$" }),
        link("Contact: sponsors@termconf.dev", "mailto:sponsors@termconf.dev", { icon: ">" }),
      ],
    }),
  ],
});
