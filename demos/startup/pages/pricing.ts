import { card, markdown, spacer, row, col } from "../../../src/index.js";

export const metadata = { label: "Pricing", icon: "$" };

export default function Pricing() {
  return [
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
  ];
}
