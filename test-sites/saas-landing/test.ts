import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, hero, table, list, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "Warpspeed",
  tagline: "Deploy at the speed of thought",
  theme: "tokyoNight" as const,
  borders: "heavy" as const,
  pages: [
    page("home", {
      title: "Home",
      icon: "🏠",
      content: [
        hero({
          title: "Ship Faster Than Ever",
          subtitle: "Warpspeed is the deployment platform that eliminates the gap between writing code and running it in production. Zero config. Instant rollbacks. Global edge network.",
        }),
        spacer(1),
        markdown("**Trusted by 40,000+ teams** including engineers at Shopify, Linear, and Notion."),
        spacer(1),
        link("Start Free Trial", "https://warpspeed.dev/signup"),
      ],
    }),
    page("features", {
      title: "Features",
      icon: "⚡",
      content: [
        card({ title: "Instant Deploys", body: "Push to git and your site is live in under 3 seconds. Our incremental build engine only rebuilds what changed.", tags: ["CI/CD", "Git Integration"] }),
        card({ title: "Edge Functions", body: "Run server-side logic at 300+ edge locations worldwide. Sub-10ms cold starts with our custom V8 isolate runtime.", tags: ["Serverless", "Edge Computing"] }),
        card({ title: "Preview Environments", body: "Every pull request gets its own isolated preview URL with seeded databases and mocked third-party services.", tags: ["Collaboration", "QA"] }),
        card({ title: "Observability Built In", body: "Real-time logs, distributed tracing, error tracking, and performance metrics. No third-party tools required.", tags: ["Monitoring", "Debugging"] }),
        card({ title: "Infrastructure as Code", body: "Define your entire stack in a single warpspeed.toml file. Databases, cron jobs, queues, and secrets — all version controlled.", tags: ["DevOps", "IaC"] }),
      ],
    }),
    page("pricing", {
      title: "Pricing",
      icon: "💰",
      content: [
        table(
          ["Feature", "Hobby (Free)", "Pro ($20/mo)", "Enterprise"],
          [
            ["Deploys / month", "100", "Unlimited", "Unlimited"],
            ["Build minutes", "300 min", "6,000 min", "Custom"],
            ["Edge functions", "10", "Unlimited", "Unlimited"],
            ["Team members", "1", "10", "Unlimited"],
            ["Preview environments", "3", "Unlimited", "Unlimited"],
            ["Custom domains", "1", "20", "Unlimited"],
            ["Support", "Community", "Email (24h)", "Dedicated CSM"],
            ["SLA", "—", "99.9%", "99.99%"],
            ["SOC 2 / HIPAA", "—", "—", "Included"],
          ]
        ),
        spacer(1),
        link("Start Free Trial", "https://warpspeed.dev/signup"),
      ],
    }),
    page("quickstart", {
      title: "Quick Start",
      icon: "📘",
      content: [
        list([
          "Install the CLI: npm install -g @warpspeed/cli",
          "Authenticate: warp login",
          "Initialize your project: warp init",
          "Deploy: warp deploy",
          "Visit your live URL printed in the terminal",
        ], "ordered"),
        spacer(1),
        markdown("That's it. Five commands and you're live on a global CDN with automatic HTTPS, preview deploys, and instant rollbacks.\n\nFor advanced configuration, see the full documentation."),
        spacer(1),
        link("Full Documentation", "https://docs.warpspeed.dev"),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-3-saas-landing");
writeFileSync("test-sites/saas-landing/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 3 — SaaS Landing (Warpspeed): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
