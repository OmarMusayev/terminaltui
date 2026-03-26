import {
  card,
  markdown,
  tabs,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Schedule", icon: ">" };

export default function Schedule() {
  return [
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
  ];
}
