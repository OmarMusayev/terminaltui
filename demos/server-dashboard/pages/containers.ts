import { markdown, spacer, table, split } from "../../../src/index.js";

export const metadata = { label: "Containers", icon: "#" };

export default function Containers() {
  return [
    split({
      direction: "horizontal",
      ratio: 55,
      first: [
        table(
          ["Container", "Status", "CPU", "Mem"],
          [
            ["nginx", "up", "2.3%", "128M"],
            ["app-web-1", "up", "18.4%", "512M"],
            ["app-web-2", "up", "15.7%", "489M"],
            ["app-worker", "up", "8.2%", "256M"],
            ["postgres", "up", "5.1%", "2.1G"],
            ["redis", "up", "1.8%", "384M"],
            ["prometheus", "up", "3.4%", "768M"],
            ["grafana", "up", "2.1%", "256M"],
          ],
        ),
      ],
      second: [
        markdown("### Access Logs — nginx"),
        spacer(),
        markdown(`\`\`\`
[12:00:01] GET /api/health 200 — 2ms
[12:00:02] GET /api/users 200 — 14ms
[12:00:03] POST /api/auth/login 200 — 87ms
[12:00:04] GET /api/posts?page=2 200 — 23ms
[12:00:05] GET /static/bundle.js 304 — 1ms
[12:00:06] GET /api/metrics 200 — 5ms
[12:00:07] POST /api/webhooks/stripe 200 — 112ms
[12:00:08] GET /api/health 200 — 1ms
\`\`\``),
      ],
    }),
  ];
}
