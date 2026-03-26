import { card, spacer, row, col } from "../../../src/index.js";

export const metadata = { label: "Features", icon: ">>" };

export default function Features() {
  return [
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
  ];
}
