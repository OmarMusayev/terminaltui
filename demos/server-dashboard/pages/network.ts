import {
  card,
  divider,
  sparkline,
  table,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Network", icon: "*" };

export default function Network() {
  return [
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
  ];
}
