import { card, divider, markdown, row, col, spacer, link, quote } from "../../../src/index.js";

export const metadata = { label: "Get Started", order: 4 };

export default function GetStarted() {
  return [
    markdown("**You're already running a terminaltui app right now.** Here's how to make your own."),
    spacer(),

    divider("=", "Scaffold a new project"),
    markdown([
      "```bash",
      "npx terminaltui init my-site",
      "cd my-site",
      "npx terminaltui dev",
      "```",
    ].join("\n")),
    markdown("Six built-in templates: `minimal`, `portfolio`, `landing`, `restaurant`, `blog`, `creative`. Pick during the prompt or pass as an arg: `npx terminaltui init my-site portfolio`."),
    spacer(),

    divider("=", "Or explore the other built-in demos"),
    markdown([
      "```bash",
      "npx terminaltui demo developer-portfolio   # cyberpunk; skill bars, project grid",
      "npx terminaltui demo dashboard             # live API data, persistent state",
      "npx terminaltui demo restaurant            # tabbed menu, reservation form",
      "npx terminaltui demo server-dashboard      # system metrics, log stream",
      "npx terminaltui demo mac-monitor           # live macOS system stats (darwin only)",
      "npx terminaltui demo startup               # pricing tiers, feature accordion",
      "npx terminaltui demo conference            # schedule, speakers, sponsors",
      "npx terminaltui demo coffee-shop           # catppuccin; menu, catering form",
      "npx terminaltui demo band                  # rosePine; albums, tour dates",
      "npx terminaltui demo freelancer            # services, testimonials, contact",
      "```",
    ].join("\n")),
    spacer(),

    divider("=", "Host your TUI over SSH"),
    markdown([
      "```bash",
      "cd my-site",
      "npx terminaltui serve --port 2222",
      "",
      "# from any machine:",
      "ssh localhost -p 2222",
      "```",
    ].join("\n")),
    markdown("Each connection gets an independent session. Arrow keys, forms, navigation — everything works over SSH."),
    spacer(),

    divider("=", "Have an AI agent build one"),
    markdown([
      "```bash",
      "npx terminaltui create",
      "```",
    ].join("\n")),
    markdown("`create` writes a prompt for Claude Code (or any agent) that includes the 2,500+ line `SKILL.md` API reference. One sentence in, a working `pages/`-shaped project out."),
    spacer(),

    divider("=", "Where to go from here"),
    row([
      col([card({ title: "Docs", subtitle: "everything in one place", body: "github.com/OmarMusayev/terminaltui/tree/main/docs" })], { span: 4, xs: 12, sm: 6 }),
      col([card({ title: "GitHub", subtitle: "source + issues + stars", body: "github.com/OmarMusayev/terminaltui" })], { span: 4, xs: 12, sm: 6 }),
      col([card({ title: "npm", subtitle: "the package", body: "npmjs.com/package/terminaltui" })], { span: 4, xs: 12, sm: 6 }),
    ], { gap: 1 }),
    spacer(),

    link("GitHub repo", "https://github.com/OmarMusayev/terminaltui"),
    link("Docs", "https://github.com/OmarMusayev/terminaltui/tree/main/docs"),
    link("npm package", "https://www.npmjs.com/package/terminaltui"),
    spacer(),

    quote("This whole tour is itself a terminaltui app. 5 pages, ~250 lines of TypeScript. You can write something this polished in an afternoon."),
    spacer(),

    markdown("**Press `q` to quit. When you do, you'll see one final hint.**"),
  ];
}
