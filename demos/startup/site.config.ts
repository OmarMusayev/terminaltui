import {
  defineSite,
  page,
  card,
  hero,
  accordion,
  link,
  markdown,
  spacer,
  form,
  textInput,
  button,
  row,
  col,
  container,
  section,
} from "../../src/index.js";

export default defineSite({
  name: "Warpspeed",
  tagline: "deploy at the speed of thought",
  banner: {
    text: "WARPSPEED",
    font: "Electronic",
    gradient: ["#7aa2f7", "#bb9af7"],
  },
  theme: "tokyoNight",
  borders: "heavy",
  animations: {
    boot: true,
    exitMessage: "$ warpspeed --stop",
  },
  pages: [
    // ── Home ──────────────────────────────────────────────────
    page("home", {
      title: "Home",
      icon: "~",
      content: [
        hero({
          title: "Ship faster with Warpspeed",
          subtitle:
            "Deploy any application to production in under 90 seconds. Zero config. Automatic scaling. Built-in observability. The deployment platform engineers actually enjoy using.",
          cta: { label: "Get Started Free", url: "https://warpspeed.dev/signup" },
        }),
        spacer(),
        markdown(
          `**Trusted by 10,000+ developers** at companies like Stripe, Vercel, Linear, and Planetscale.`,
        ),
        spacer(),
        container(
          [
            row(
              [
                col(
                  [
                    card({
                      title: "Zero-Config Deploys",
                      body: "Push to main and Warpspeed handles the rest. Auto-detects your framework, builds optimally, and deploys to the edge in seconds. No Dockerfiles, no YAML, no waiting.",
                      tags: ["Core"],
                    }),
                  ],
                  { span: 4, sm: 6, xs: 12 },
                ),
                col(
                  [
                    card({
                      title: "Instant Rollbacks",
                      body: "Every deploy is immutable and versioned. Roll back to any previous deployment with a single command. Automatic rollback triggers on error rate spikes or latency degradation.",
                      tags: ["Reliability"],
                    }),
                  ],
                  { span: 4, sm: 6, xs: 12 },
                ),
                col(
                  [
                    card({
                      title: "Built-in Observability",
                      body: "Logs, metrics, and traces unified in one dashboard. Real-time error tracking, latency percentiles, and cost attribution per endpoint. No third-party tools required.",
                      tags: ["Monitoring"],
                    }),
                  ],
                  { span: 4, sm: 6, xs: 12 },
                ),
              ],
              { gap: 1 },
            ),
            spacer(),
            row(
              [
                col(
                  [
                    card({
                      title: "10M+",
                      body: "Deployments processed across all teams worldwide.",
                      tags: ["Deploys"],
                    }),
                  ],
                  { span: 3, sm: 6, xs: 12 },
                ),
                col(
                  [
                    card({
                      title: "99.99%",
                      body: "Platform uptime over the last 12 months.",
                      tags: ["Uptime"],
                    }),
                  ],
                  { span: 3, sm: 6, xs: 12 },
                ),
                col(
                  [
                    card({
                      title: "150ms avg",
                      body: "Average deploy-to-live latency globally.",
                      tags: ["Speed"],
                    }),
                  ],
                  { span: 3, sm: 6, xs: 12 },
                ),
                col(
                  [
                    card({
                      title: "5,000+",
                      body: "Engineering teams shipping with Warpspeed daily.",
                      tags: ["Teams"],
                    }),
                  ],
                  { span: 3, sm: 6, xs: 12 },
                ),
              ],
              { gap: 1 },
            ),
          ],
          { maxWidth: 100, padding: 1 },
        ),
        spacer(),
        form({
          id: "signup",
          resetOnSubmit: true,
          onSubmit: async (data) => ({
            success: `Welcome aboard! Check ${data.email} for your activation link.`,
          }),
          fields: [
            textInput({
              id: "email",
              label: "Email",
              placeholder: "you@company.com",
              validate: (v) =>
                v.includes("@") ? null : "Please enter a valid email",
            }),
            button({ label: "Get Started", style: "primary" }),
          ],
        }),
      ],
    }),

    // ── Features ──────────────────────────────────────────────
    page("features", {
      title: "Features",
      icon: ">>",
      content: [
        row(
          [
            col(
              [
                card({
                  title: "Edge-First Architecture",
                  body: "Your application runs on 300+ edge nodes across six continents. Requests are routed to the nearest node automatically. Average cold start time: 12ms. P99 latency under 50ms worldwide.",
                  tags: ["Infrastructure", "Performance"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Preview Deployments",
                  body: "Every pull request gets a unique, shareable URL with its own isolated environment. Preview deployments include seeded databases, mock services, and branch-specific environment variables.",
                  tags: ["Workflow", "Collaboration"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        spacer(),
        row(
          [
            col(
              [
                card({
                  title: "Managed Databases",
                  body: "Provision PostgreSQL, Redis, or SQLite databases with one click. Automatic backups every hour, point-in-time recovery, and seamless connection pooling. Read replicas in every region your app runs.",
                  tags: ["Data", "Infrastructure"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Secrets & Config",
                  body: "Encrypted environment variables with team-level access controls. Secrets are injected at runtime and never stored in plaintext. Rotate credentials without redeploying. Full audit log of every change.",
                  tags: ["Security", "DevOps"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        spacer(),
        row(
          [
            col(
              [
                card({
                  title: "Custom Domains & TLS",
                  body: "Add custom domains with automatic TLS certificate provisioning and renewal. Wildcard certificates, HSTS preloading, and DNSSEC supported out of the box. DNS propagation in under 60 seconds.",
                  tags: ["Networking", "Security"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Team Collaboration",
                  body: "Role-based access control with SSO integration. Deploy locks, approval gates, and audit trails for production environments. Slack and Discord notifications for every deployment event.",
                  tags: ["Teams", "Enterprise"],
                }),
              ],
              { span: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
      ],
    }),

    // ── Pricing ───────────────────────────────────────────────
    page("pricing", {
      title: "Pricing",
      icon: "$",
      content: [
        row(
          [
            col(
              [
                card({
                  title: "Free",
                  subtitle: "$0/mo",
                  body: [
                    "- 100 deploys/month",
                    "- 3 edge regions",
                    "- 1 team member",
                    "- 5 concurrent previews",
                    "- Community support",
                  ].join("\n"),
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Pro",
                  subtitle: "$20/mo",
                  body: [
                    "- Unlimited deploys",
                    "- All 300+ regions",
                    "- 10 team members",
                    "- Unlimited previews",
                    "- Priority email support",
                  ].join("\n"),
                  tags: ["Popular"],
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
            col(
              [
                card({
                  title: "Enterprise",
                  subtitle: "Custom pricing",
                  body: [
                    "- Unlimited deploys",
                    "- All + dedicated regions",
                    "- Unlimited members",
                    "- Unlimited + SSO previews",
                    "- Dedicated CSM + SLA",
                  ].join("\n"),
                }),
              ],
              { span: 4, sm: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
        spacer(),
        markdown(`
All plans include automatic TLS, DDoS protection, and CI/CD integration.
Pro includes managed databases, custom domains, and deploy previews.
Enterprise adds SSO, audit logs, VPC peering, and a 99.99% uptime SLA.

**Start free. No credit card required.**
        `),
      ],
    }),

    // ── Quick Start ───────────────────────────────────────────
    page("quickstart", {
      title: "Quick Start",
      icon: ">_",
      content: [
        container(
          [
            accordion([
              {
                label: "1. Install the CLI",
                content: [
                  markdown(`
Install Warpspeed globally using your preferred package manager:

\`\`\`
npm install -g warpspeed
\`\`\`

Verify the installation:

\`\`\`
warpspeed --version
\`\`\`

Authenticate with your account:

\`\`\`
warpspeed login
\`\`\`
                  `),
                ],
              },
              {
                label: "2. Configure your project",
                content: [
                  markdown(`
Navigate to your project directory and initialize Warpspeed:

\`\`\`
cd my-app
warpspeed init
\`\`\`

Warpspeed auto-detects your framework (Next.js, Remix, Astro, SvelteKit, and 40+ more).
Review the generated \`warpspeed.toml\` and adjust settings if needed. Most projects
need zero configuration changes.
                  `),
                ],
              },
              {
                label: "3. Deploy to production",
                content: [
                  markdown(`
Deploy with a single command:

\`\`\`
warpspeed deploy --prod
\`\`\`

Your application is live on a globally distributed edge network in under 90 seconds.
Warpspeed assigns a \`.warpspeed.app\` URL immediately, or add a custom domain:

\`\`\`
warpspeed domains add myapp.com
\`\`\`
                  `),
                ],
              },
              {
                label: "4. Monitor and iterate",
                content: [
                  markdown(`
View real-time logs and metrics:

\`\`\`
warpspeed logs --follow
warpspeed metrics
\`\`\`

Set up alerts for error rate or latency thresholds:

\`\`\`
warpspeed alerts create --metric error_rate --threshold 1% --channel slack
\`\`\`

Every push to your main branch triggers an automatic deployment. Preview deployments
are created for every pull request. Roll back instantly if anything goes wrong:

\`\`\`
warpspeed rollback
\`\`\`
                  `),
                ],
              },
            ]),
          ],
          { maxWidth: 80 },
        ),
      ],
    }),

    // ── Links ─────────────────────────────────────────────────
    page("links", {
      title: "Links",
      icon: "->",
      content: [
        row(
          [
            col(
              [
                section("Resources", [
                  link("Documentation", "https://docs.warpspeed.dev", { icon: ">" }),
                  link("GitHub", "https://github.com/warpspeed-dev", { icon: ">" }),
                  link("Blog", "https://warpspeed.dev/blog", { icon: ">" }),
                ]),
              ],
              { span: 6, xs: 12 },
            ),
            col(
              [
                section("Community", [
                  link("Discord Community", "https://discord.gg/warpspeed", { icon: ">" }),
                  link("Status Page", "https://status.warpspeed.dev", { icon: ">" }),
                  link("Twitter", "https://twitter.com/warpspeed_dev", { icon: ">" }),
                ]),
              ],
              { span: 6, xs: 12 },
            ),
          ],
          { gap: 1 },
        ),
      ],
    }),
  ],
});
