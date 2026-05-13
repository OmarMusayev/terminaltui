import { card, divider, markdown, row, col, quote, badge, spacer } from "../../../src/index.js";

export const metadata = { label: "Home", order: 0 };

export default function Home() {
  return [
    markdown("**Next.js for the terminal.** Write a `pages/` directory of TypeScript files. Get an interactive TUI with file-based routing, components, themes, and SSH hosting. Distribute it with `npx`."),
    spacer(),
    divider("=", "By the numbers"),
    row([
      col([card({ title: "30+", subtitle: "components", body: "Cards, tables, forms,\ntabs, accordions, more." })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "10", subtitle: "themes", body: "Cyberpunk, Dracula,\nNord, Catppuccin..." })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "2,127", subtitle: "tests", body: "Unit, integration,\nemulator, demo suites." })], { span: 3, xs: 12, sm: 6 }),
      col([card({ title: "1", subtitle: "dependency", body: "Just esbuild. ssh2\nis optional." })], { span: 3, xs: 12, sm: 6 }),
    ], { gap: 1 }),
    spacer(),
    divider("=", "What you can build"),
    row([
      col([card({
        title: "Portfolios",
        subtitle: "npx your-name",
        body: "Distribute a beautiful interactive portfolio as a single npx command. No build, no host, no domain.",
        tags: ["popular"],
      })], { span: 4, xs: 12 }),
      col([card({
        title: "Dashboards",
        subtitle: "live, reactive, gorgeous",
        body: "API fetchers, sparklines, live charts, log streams, persistent state. Real-time without React.",
        tags: ["popular"],
      })], { span: 4, xs: 12 }),
      col([card({
        title: "SSH apps",
        subtitle: "ssh you.com",
        body: "Host any TUI over SSH. Visitors connect with `ssh host -p 2222` and see your app instantly.",
        tags: ["unique"],
      })], { span: 4, xs: 12 }),
    ], { gap: 1 }),
    spacer(),
    quote("If you've used Next.js, you already know the shape. pages/about.ts becomes /about. pages/projects/[slug].ts is a dynamic route. api/stats.ts is GET /api/stats.", "the docs, basically"),
    spacer(),
    markdown("**Use the menu or press ← / → to explore. Press `q` to quit anytime.**"),
  ];
}
