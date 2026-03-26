import {
  card,
  hero,
  markdown,
  spacer,
  form,
  textInput,
  button,
  row,
  col,
  container,
} from "../../../src/index.js";

export const metadata = { label: "Home", icon: "~" };

export default function Home() {
  return [
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
  ];
}
