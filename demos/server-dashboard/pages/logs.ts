import {
  card,
  markdown,
  spacer,
  sparkline,
  columns,
  panel,
} from "../../../src/index.js";

export const metadata = { label: "Logs", icon: ">" };

export default function Logs() {
  return [
    columns([
      panel({ width: "30%", content: [
        card({
          title: "nginx",
          subtitle: "48 entries/min",
          body: "Reverse proxy and static file server. No errors in the last hour.",
          tags: ["healthy"],
        }),
        sparkline([10, 12, 15, 14, 18, 20, 22, 25, 30, 28, 24, 20]),
        spacer(),
        card({
          title: "app-web",
          subtitle: "124 entries/min",
          body: "2 warnings (slow queries) in the last hour.",
          tags: ["warning"],
        }),
        sparkline([40, 55, 62, 70, 85, 90, 110, 124, 118, 105, 95, 88]),
        spacer(),
        card({
          title: "postgres",
          subtitle: "67 entries/min",
          body: "All queries within SLA. Replication lag: 0ms.",
          tags: ["healthy"],
        }),
        sparkline([30, 35, 42, 50, 55, 60, 67, 65, 58, 52, 48, 45]),
        spacer(),
        card({
          title: "worker",
          subtitle: "18 entries/min",
          body: "Queue depth: 12. No failed jobs.",
          tags: ["healthy"],
        }),
        sparkline([5, 8, 10, 12, 15, 18, 16, 14, 12, 10, 8, 6]),
      ]}),
      panel({ width: "70%", content: [
        markdown("### Log Stream"),
        spacer(),
        markdown(`\`\`\`
12:00:01 [nginx]    GET /api/health → 200 (2ms)
12:00:01 [app-web]  Processing HealthCheck
12:00:02 [nginx]    GET /api/users → 200 (14ms)
12:00:02 [app-web]  Query users SELECT * FROM users LIMIT 50 (8ms)
12:00:02 [postgres] Query completed: 8ms, rows: 50
12:00:03 [nginx]    POST /api/auth/login → 200 (87ms)
12:00:03 [app-web]  Auth: bcrypt compare (72ms)
12:00:03 [app-web]  Session created: user_id=4821
12:00:04 [redis]    SET session:4821 EX 3600
12:00:04 [nginx]    GET /api/posts?page=2 → 200 (23ms)
12:00:04 [app-web]  Query posts offset=20 limit=20 (15ms)
12:00:04 [postgres] Query completed: 15ms, rows: 20
12:00:05 [worker]   Job enqueued: email.welcome user_id=4821
12:00:05 [worker]   Job started: email.welcome
12:00:06 [worker]   Job completed: email.welcome (340ms)
12:00:06 [nginx]    GET /api/metrics → 200 (5ms)
12:00:07 [nginx]    POST /api/webhooks/stripe → 200 (112ms)
12:00:07 [app-web]  Stripe webhook: invoice.paid sub_id=sub_1N3x
12:00:08 [postgres] Checkpoint completed: wrote 24 buffers
\`\`\``),
      ]}),
    ]),
  ];
}
