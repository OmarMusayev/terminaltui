import {
  defineSite,
  page,
  card,
  link,
  hero,
  markdown,
  themes,
  spacer,
  table,
  accordion,
  form,
  textInput,
  button,
  ascii,
} from "terminaltui";

export default defineSite({
  name: "Warpspeed",
  tagline: "deploy at the speed of thought",
  banner: ascii("Warpspeed", { font: "ANSI Shadow", gradient: ["#7aa2f7", "#bb9af7"] }),
  theme: themes.tokyoNight,
  borders: "heavy",
  animations: { boot: true, transitions: "slide", exitMessage: "See you at lightspeed." },

  pages: [
    page("home", {
      title: "Home",
      icon: "◈",
      content: [
        hero({
          title: "Ship to production in seconds, not sprints",
          subtitle: "Warpspeed connects to your repo, builds in the cloud, and deploys globally — zero config required.",
          cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
        }),
        spacer(),
        markdown(`**Trusted by 10,000+ developers** at companies like Stripe, Vercel, and Shopify. From solo hackers to platform teams, Warpspeed handles the infrastructure so you can focus on code.`),
        spacer(),
        card({
          title: "Instant Previews",
          body: "Every pull request gets a live preview URL in under 10 seconds. Share it with your team, your PM, or your mom.",
          tags: ["CI/CD", "Collaboration"],
        }),
        card({
          title: "Edge-First Deploys",
          body: "Your code runs in 40+ regions by default. No CDN configuration, no origin servers to babysit. Just push and go.",
          tags: ["Edge", "Global"],
        }),
        card({
          title: "Built-in Observability",
          body: "Real-time logs, request traces, and error tracking — all in one dashboard. No third-party agents to install.",
          tags: ["Monitoring", "DevEx"],
        }),
        spacer(2),
        form({
          id: "signup",
          onSubmit: async (data) => {
            return { success: `We've sent a magic link to ${data.email}. Check your inbox!` };
          },
          fields: [
            textInput({
              id: "email",
              label: "Start building today",
              placeholder: "you@company.com",
              validate: (v) => v.includes("@") ? null : "Enter a valid email",
            }),
            button({ label: "Get Started", style: "primary" }),
          ],
        }),
      ],
    }),

    page("features", {
      title: "Features",
      icon: "▣",
      content: [
        card({
          title: "Git-Push Deploys",
          body: "Push to main and your site is live. Push to a branch and get an isolated preview. No pipelines to configure, no YAML to debug.",
          tags: ["Deployment"],
        }),
        card({
          title: "Serverless Functions",
          body: "Write an API route, export a handler, deploy. Warpspeed provisions, scales, and monitors your functions automatically.",
          tags: ["Backend", "Serverless"],
        }),
        card({
          title: "Environment Management",
          body: "Manage secrets and env vars per branch, per team, or per deployment. Encrypted at rest, injected at build time.",
          tags: ["Security", "Config"],
        }),
        card({
          title: "Rollbacks in One Click",
          body: "Every deploy is immutable. Roll back to any previous version instantly — no rebuild, no downtime, no sweat.",
          tags: ["Reliability"],
        }),
        card({
          title: "Team Permissions",
          body: "Fine-grained access control for organizations. Viewer, developer, and admin roles with SSO and audit logs.",
          tags: ["Teams", "Enterprise"],
        }),
        card({
          title: "Framework Agnostic",
          body: "Next.js, Remix, Astro, SvelteKit, plain HTML — Warpspeed auto-detects your framework and optimizes the build.",
          tags: ["Frameworks", "Flexibility"],
        }),
      ],
    }),

    page("pricing", {
      title: "Pricing",
      icon: "▤",
      content: [
        markdown(`Simple, transparent pricing. No surprise bills, no per-seat gotchas. Start free and scale when you're ready.`),
        spacer(),
        table(
          ["", "Free", "Pro", "Enterprise"],
          [
            ["Deployments / mo", "100", "Unlimited", "Unlimited"],
            ["Build minutes", "500", "5,000", "Custom"],
            ["Bandwidth", "10 GB", "100 GB", "Custom"],
            ["Preview deploys", "3 concurrent", "Unlimited", "Unlimited"],
            ["Team members", "1", "10", "Unlimited"],
            ["Custom domains", "1", "25", "Unlimited"],
            ["Analytics", "Basic", "Advanced", "Advanced + Export"],
            ["Support", "Community", "Priority email", "Dedicated + SLA"],
            ["Price", "$0", "$20/mo", "Contact us"],
          ],
        ),
        spacer(),
        button({ label: "Start Free", style: "primary" }),
      ],
    }),

    page("quickstart", {
      title: "Quick Start",
      icon: "▶",
      content: [
        markdown(`Get from zero to deployed in under two minutes. Seriously.`),
        spacer(),
        accordion([
          {
            label: "1. Install the CLI",
            content: [
              markdown(`Install Warpspeed globally via npm:

\`\`\`
npm install -g @warpspeed/cli
\`\`\`

Verify the installation:

\`\`\`
warp --version
\`\`\`

The CLI works on macOS, Linux, and WSL. It handles authentication, deployments, and environment management from your terminal.`),
            ],
          },
          {
            label: "2. Configure your project",
            content: [
              markdown(`Run \`warp init\` in your project root. Warpspeed will detect your framework and generate a \`warp.config.ts\`:

\`\`\`
warp init
\`\`\`

The defaults work for most projects. For monorepos, pass \`--root ./packages/web\` to set the build directory. Environment variables can be added with \`warp env set KEY=VALUE\`.`),
            ],
          },
          {
            label: "3. Deploy",
            content: [
              markdown(`Push to your connected repo, or deploy directly from the CLI:

\`\`\`
warp deploy
\`\`\`

Your first deploy takes about 30 seconds. Subsequent deploys are incremental and usually finish in under 10. You'll get a live URL in your terminal the moment it's ready.`),
            ],
          },
          {
            label: "4. Monitor",
            content: [
              markdown(`Open your dashboard to see real-time logs, request metrics, and deploy history:

\`\`\`
warp dashboard
\`\`\`

Or tail your production logs directly in the terminal:

\`\`\`
warp logs --follow
\`\`\`

Set up alerts for error spikes, high latency, or deployment failures. Warpspeed posts to Slack, Discord, or any webhook.`),
            ],
          },
        ]),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "◉",
      content: [
        link("Documentation", "https://docs.warpspeed.dev"),
        link("GitHub", "https://github.com/warpspeed-dev"),
        link("Discord Community", "https://discord.gg/warpspeed"),
        link("Twitter / X", "https://x.com/warpspeed_dev"),
        link("Status Page", "https://status.warpspeed.dev"),
        link("Blog", "https://warpspeed.dev/blog"),
      ],
    }),
  ],
});
