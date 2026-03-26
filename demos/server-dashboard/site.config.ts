import {
  defineSite,
  page,
  card,
  markdown,
  divider,
  spacer,
  table,
  link,
  progressBar,
  sparkline,
  badge,
  split,
  row,
  col,
} from "../../src/index.js";

export default defineSite({
  name: "Server Dashboard",
  tagline: "real-time infrastructure monitoring",
  banner: {
    text: "SERVMON",
    font: "ANSI Shadow",
    gradient: ["#50fa7b", "#8be9fd"],
  },
  theme: "hacker",
  borders: "single",
  animations: {
    boot: true,
    exitMessage: "Session terminated.",
  },
  pages: [
    // ── Overview ─────────────────────────────────────────────
    page("overview", {
      title: "Overview",
      icon: "~",
      content: [
        row([
          col(
            [
              card({
                title: "CPU Usage",
                subtitle: "45%",
                body: "4 cores / 8 threads",
              }),
              progressBar("Usage", 45),
              spacer(),
              sparkline([12, 18, 25, 22, 30, 45, 38, 42, 45, 40, 35, 45]),
            ],
            { span: 4, sm: 6, xs: 12 },
          ),
          col(
            [
              card({
                title: "Memory",
                subtitle: "72%",
                body: "12.4 GB / 16 GB used",
              }),
              progressBar("RAM", 72),
              spacer(),
              markdown("Swap: 1.2 GB / 8 GB"),
            ],
            { span: 4, sm: 6, xs: 12 },
          ),
          col(
            [
              card({
                title: "Disk I/O",
                subtitle: "31%",
                body: "148 GB / 480 GB used",
              }),
              progressBar("SSD", 31),
              spacer(),
              markdown("Read: 45 MB/s  Write: 12 MB/s"),
            ],
            { span: 4, sm: 6, xs: 12 },
          ),
        ], { gap: 1 }),

        divider("System Details"),

        split({
          direction: "horizontal",
          ratio: 55,
          first: [
            table(
              ["Metric", "Value"],
              [
                ["Hostname", "prod-web-01"],
                ["Uptime", "47d 12h 33m"],
                ["Kernel", "6.8.0-45-generic"],
                ["Load Avg", "1.24 / 0.98 / 0.87"],
                ["Processes", "284 running"],
                ["TCP Conns", "1,247 active"],
              ],
            ),
          ],
          second: [
            markdown("### Quick Status"),
            spacer(),
            badge("nginx", "running"),
            badge("postgres", "running"),
            badge("redis", "running"),
            badge("worker", "running"),
            badge("cron", "running"),
            badge("smtp", "stopped"),
            spacer(),
            divider("Alerts"),
            markdown("**WARN** — smtp service stopped at 11:42"),
            markdown("**OK** — All other services nominal"),
          ],
        }),
      ],
    }),

    // ── Containers ───────────────────────────────────────────
    page("containers", {
      title: "Containers",
      icon: "#",
      content: [
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
      ],
    }),

    // ── Network ──────────────────────────────────────────────
    page("network", {
      title: "Network",
      icon: "*",
      content: [
        row([
          col(
            [
              card({
                title: "Bandwidth In",
                subtitle: "88 Mbps current",
                body: "Peak: 92 Mbps (12:00:15)\nAvg (1h): 71 Mbps",
              }),
              sparkline([45, 52, 48, 67, 72, 58, 63, 71, 68, 75, 82, 78, 85, 90, 88, 92]),
            ],
            { span: 6, xs: 12 },
          ),
          col(
            [
              card({
                title: "Active Connections",
                subtitle: "1,248 total",
                body: "TCP/UDP across all services",
              }),
              table(
                ["Port", "Service", "Connections"],
                [
                  ["443", "HTTPS", "1,024"],
                  ["5432", "PostgreSQL", "48"],
                  ["6379", "Redis", "156"],
                  ["9090", "Prometheus", "12"],
                  ["3000", "Grafana", "8"],
                ],
              ),
            ],
            { span: 6, xs: 12 },
          ),
        ], { gap: 1 }),

        divider("DNS Resolution"),

        row([
          col(
            [
              table(
                ["Endpoint", "Latency", "Status"],
                [
                  ["api.example.com", "12ms", "OK"],
                  ["cdn.example.com", "4ms", "OK"],
                  ["db-primary", "1ms", "OK"],
                  ["db-replica", "2ms", "OK"],
                  ["redis-cluster", "<1ms", "OK"],
                ],
              ),
            ],
            { span: 12 },
          ),
        ]),
      ],
    }),

    // ── Logs ─────────────────────────────────────────────────
    page("logs", {
      title: "Logs",
      icon: ">",
      content: [
        split({
          direction: "horizontal",
          ratio: 30,
          first: [
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
          ],
          second: [
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
          ],
        }),
      ],
    }),
  ],
});
