import {
  card, table, accordion, sparkline, progressBar, skillBar,
  divider, markdown, row, col, badge, spacer, quote, timeline,
} from "../../../src/index.js";

export const metadata = { label: "Showcase", order: 1 };

export default function Showcase() {
  return [
    markdown("A sampler of the **30+ built-in components**. Everything below comes from a single import."),
    spacer(),

    divider("=", "Cards in a 12-column grid"),
    row([
      col([card({ title: "Revenue", subtitle: "$1.2M", body: "this quarter", tags: ["up"] })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "Users", subtitle: "45,231", body: "active monthly", tags: ["stable"] })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "Uptime", subtitle: "99.97%", body: "last 30 days", tags: ["healthy"] })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "Latency", subtitle: "42ms", body: "p50 response", tags: ["fast"] })], { span: 3, xs: 12, sm: 6 }),
    ], { gap: 1 }),
    spacer(),

    divider("=", "Sparklines + progress bars"),
    markdown("Sparkline — `sparkline([12, 18, 22, 28, 24, 31, 38, 42, 47, 51, 48, 54, 61, 58, 63])`"),
    sparkline([12, 18, 22, 28, 24, 31, 38, 42, 47, 51, 48, 54, 61, 58, 63]),
    progressBar("Build progress", 73, 100),
    progressBar("Disk used", 41, 100),
    skillBar("TypeScript", 95),
    skillBar("Designing for terminals", 88),
    spacer(),

    divider("=", "Tables"),
    table(
      ["Framework", "Lang", "Stars", "Shape"],
      [
        ["terminaltui", "TypeScript", "?", "Framework (pages + routing)"],
        ["Ink", "TypeScript", "38k", "Component library (React)"],
        ["Bubble Tea", "Go", "42k", "TUI framework (Elm-style)"],
        ["Textual", "Python", "36k", "TUI framework + web bridge"],
        ["OpenTUI", "TS + Zig", "11k", "Native core + reconcilers"],
      ],
    ),
    spacer(),

    divider("=", "Accordion — for FAQs and progressive disclosure"),
    accordion([
      {
        label: "How is this different from Ink?",
        content: [markdown("Ink is a component library — you bring your own routing, layout, themes, and lifecycle. terminaltui is a **framework**: file-based routing, 12-column grid, themes, ASCII art, SSH hosting, and 30+ components are included.")],
      },
      {
        label: "Why a 'pages/' directory instead of a single config?",
        content: [markdown("Same reason Next.js does it. One file = one screen. The filesystem is the routing table. `pages/projects/[slug].ts` is a dynamic route. `api/stats.ts` becomes `GET /api/stats`. You can read a project's structure at a glance.")],
      },
      {
        label: "Can AI agents build apps in this?",
        content: [markdown("Yes — the package ships `claude/SKILL.md`, a 2,500+ line API reference written for code generation. `terminaltui create` writes a prompt for Claude Code that scaffolds a full app from a one-line description.")],
      },
      {
        label: "What about SSH hosting?",
        content: [markdown("Run `terminaltui serve --port 2222`. Anyone with an SSH client connects with `ssh host -p 2222` and gets a live interactive session. Each connection is independent. Auth is opt-in (`auth.passwords`).")],
      },
    ]),
    spacer(),

    divider("=", "Timeline"),
    timeline([
      { date: "Mar 2026", title: "v1.0 — released" },
      { date: "Apr 2026", title: "v1.5 — SSH hosting (`terminaltui serve`)" },
      { date: "Apr 2026", title: "v1.6 — file-based routing as the only mode" },
      { date: "May 2026", title: "v1.7 — multi-session SSH correctness + 2,127 tests" },
    ]),
    spacer(),

    quote("There are 18,000+ Bubble Tea apps in the wild. There's room for a TypeScript framework that's just as polished and ships with `npx`.", "the README, basically"),
  ];
}
