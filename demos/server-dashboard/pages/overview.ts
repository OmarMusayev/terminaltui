import {
  card,
  markdown,
  divider,
  spacer,
  table,
  progressBar,
  sparkline,
  badge,
  split,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Overview", icon: "~" };

export default function Overview() {
  return [
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
  ];
}
