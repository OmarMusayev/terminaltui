import {
  defineSite,
  page,
  card,
  hero,
  link,
  markdown,
  divider,
  spacer,
  accordion,
  form,
  textInput,
  button,
} from "../../src/index.js";

export default defineSite({
  name: "Warpspeed",
  tagline: "Deploy to the edge in seconds",
  banner: {
    text: "WARPSPEED",
    font: "ANSI Shadow",
  },
  theme: "tokyoNight",
  borders: "heavy",
  animations: {
    boot: true,
    transitions: "wipe",
  },
  pages: [
    page("home", {
      title: "Home",
      icon: "~",
      content: [
        hero({
          title: "Deploy to the Edge in 3 Seconds",
          subtitle:
            "Push your code. We handle the rest. Warpspeed automatically builds, optimizes, and deploys your applications to 300+ edge locations worldwide. No config files, no Docker, no Kubernetes.",
          cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
        }),
        spacer(),
        markdown(`
Trusted by 12,000+ developers and teams at **Vercel**, **Linear**, **Resend**, and **Raycast**.
        `),
        spacer(),
        form({
          id: "signup",
          onSubmit: async (data) => ({ success: "Welcome aboard! Check your email." }),
          fields: [
            textInput({ id: "email", label: "Email", placeholder: "you@company.com", validate: (v) => v.includes("@") ? null : "Enter a valid email" }),
            button({ label: "Get Started", style: "primary" }),
          ],
        }),
        spacer(),
        markdown(`

\`\`\`
$ warp deploy
  ▸ Detecting framework... Next.js 15
  ▸ Building... done (2.1s)
  ▸ Deploying to 312 edge nodes... done (0.8s)
  ▸ Live at https://your-app.warp.dev
\`\`\`
        `),
      ],
    }),

    page("features", {
      title: "Features",
      icon: "*",
      content: [
        card({
          title: "Edge Computing",
          body: "Your code runs within 50ms of every user on Earth. We compile to WebAssembly and distribute across 312 points of presence. Cold starts under 5ms, guaranteed.",
          tags: ["Edge", "WebAssembly", "Global"],
        }),
        card({
          title: "Auto-Scaling",
          body: "From zero to ten million requests without touching a config. Scale-to-zero when idle, burst to thousands of instances in milliseconds. Pay only for what you use, down to the microsecond.",
          tags: ["Scaling", "Serverless", "Cost"],
        }),
        card({
          title: "Git Push to Deploy",
          body: "Connect your GitHub repo and every push to main goes live. Preview deployments for every pull request. Automatic rollback if health checks fail.",
          tags: ["Git", "CI/CD", "Previews"],
        }),
        card({
          title: "Real-Time Analytics",
          body: "See every request, error, and performance metric in real time. Built-in Web Vitals tracking, error monitoring, and custom dashboards. No third-party tools needed.",
          tags: ["Analytics", "Monitoring", "Observability"],
        }),
        card({
          title: "Automatic SSL & Domains",
          body: "Free SSL certificates provisioned and renewed automatically. Custom domains with one click. Wildcard support, DNSSEC, and automatic HTTPS redirect included.",
          tags: ["SSL", "Security", "DNS"],
        }),
        card({
          title: "Team Collaboration",
          body: "Role-based access control, shared environments, deploy previews with commenting, and audit logs. Built for teams from 2 to 2,000 engineers.",
          tags: ["Teams", "RBAC", "Collaboration"],
        }),
      ],
    }),

    page("pricing", {
      title: "Pricing",
      icon: "$",
      content: [
        card({
          title: "Free",
          subtitle: "$0 / month",
          body: "100 deployments/mo · 50 edge locations · 100 GB bandwidth · 1 team member · 3 custom domains · Community support",
          tags: ["Hobby", "Side Projects"],
          url: "https://warpspeed.dev/signup",
        }),
        card({
          title: "Pro",
          subtitle: "$20 / month",
          body: "Unlimited deployments · 312 edge locations · 1 TB bandwidth · 10 team members · 50 custom domains · Priority email support",
          tags: ["Teams", "Startups"],
          url: "https://warpspeed.dev/signup?plan=pro",
        }),
        card({
          title: "Enterprise",
          subtitle: "Custom pricing",
          body: "Unlimited deployments · 312 + private edge locations · Unlimited bandwidth · Unlimited team members · Unlimited custom domains · Dedicated support + SLA",
          tags: ["SOC 2", "SSO/SAML", "99.99% SLA"],
          url: "https://warpspeed.dev/contact-sales",
        }),
        spacer(),
        markdown(`
All plans include: **Git integration**, **automatic SSL**, **preview deployments**, **Web Analytics**, and **DDoS protection**.

Enterprise includes SOC 2 compliance, SSO/SAML, 99.99% SLA, and a dedicated solutions engineer.
        `),
      ],
    }),

    page("docs", {
      title: "Quick Start",
      icon: ">",
      content: [
        accordion([
          {
            label: "1. Install the CLI",
            content: [
              markdown(`Install the Warpspeed CLI globally via npm:

\`\`\`
$ npm install -g @warpspeed/cli
\`\`\``),
            ],
          },
          {
            label: "2. Authenticate",
            content: [
              markdown(`Log in to your Warpspeed account:

\`\`\`
$ warp login
\`\`\`

This opens your browser for OAuth. Your token is stored securely in \`~/.warpspeed/credentials\`.`),
            ],
          },
          {
            label: "3. Deploy your project",
            content: [
              markdown(`Navigate to your project directory and deploy:

\`\`\`
$ cd my-project
$ warp deploy
  ▸ Detecting framework... Next.js 15
  ▸ Building... done (2.1s)
  ▸ Deploying to 312 edge nodes... done (0.8s)
  ▸ Live at https://my-project.warp.dev
\`\`\``),
            ],
          },
          {
            label: "4. Configure custom domain",
            content: [
              markdown(`Point your domain to Warpspeed:

\`\`\`
$ warp domains add myapp.com
  ▸ Add CNAME: myapp.com -> cname.warp.dev
  ▸ SSL provisioned automatically
\`\`\``),
            ],
          },
        ]),
        divider(),
        card({
          title: "Framework Support",
          body: "Next.js · Remix · Astro · SvelteKit · Nuxt · Vite · Gatsby · Hugo · Jekyll — if it builds, it ships. All frameworks get automatic image optimization, asset compression, and intelligent caching.",
          tags: ["Auto-Detect", "Zero Config"],
        }),
        card({
          title: "Full Documentation",
          body: "Guides, API reference, CLI reference, examples, and troubleshooting for every supported framework and feature.",
          url: "https://docs.warpspeed.dev",
        }),
      ],
    }),

    page("links", {
      title: "Links",
      icon: "->",
      content: [
        link("Documentation", "https://docs.warpspeed.dev", { icon: ">" }),
        link("GitHub", "https://github.com/warpspeed-dev", { icon: ">" }),
        link("Status Page", "https://status.warpspeed.dev", { icon: ">" }),
        link("Support", "mailto:support@warpspeed.dev", { icon: ">" }),
      ],
    }),
  ],
});
