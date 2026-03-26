import {
  card,
  spacer,
  searchInput,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Speakers", icon: "*" };

export default function Speakers() {
  return [
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
  ];
}
