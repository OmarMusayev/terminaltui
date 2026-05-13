import {
  card, divider, markdown, row, col, sparkline, progressBar, spacer,
  dynamic, fetcher,
} from "../../../src/index.js";

export const metadata = { label: "Live Data", order: 3 };

interface StatsResponse {
  tick: number;
  cpu: { current: number; history: number[] };
  memory: { current: number; history: number[] };
  network: { current: number; history: number[]; unit: string };
  requests: { total: number; perSecond: number };
}

export default function LiveData() {
  return [
    markdown("This page is rendered with `dynamic()` + `fetcher()`. The values below come from a local `api/stats.ts` route in this demo and refresh every second. Everything you see auto-updates."),
    spacer(),

    dynamic(() => {
      const result = fetcher<StatsResponse>({
        url: "/api/stats",
        refreshInterval: 1000,
      });

      if (!result.data) {
        return [markdown("*Connecting to local API route...*")];
      }

      const d = result.data;

      return [
        divider("=", `Tick ${d.tick} — refreshing every 1s`),
        row([
          col([card({ title: "CPU", subtitle: `${d.cpu.current}%`, body: "userland + system" })], { span: 3, xs: 12, sm: 6 }),
          col([card({ title: "Memory", subtitle: `${d.memory.current}%`, body: "resident pages" })], { span: 3, xs: 12, sm: 6 }),
          col([card({ title: "Network", subtitle: `${d.network.current} ${d.network.unit}`, body: "in + out" })], { span: 3, xs: 12, sm: 6 }),
          col([card({ title: "Requests", subtitle: `${d.requests.perSecond}/s`, body: `${d.requests.total} total` })], { span: 3, xs: 12, sm: 6 }),
        ], { gap: 1 }),
        spacer(),

        divider("=", "Sparklines"),
        markdown(`**CPU** (last ${d.cpu.history.length} ticks)`),
        sparkline(d.cpu.history),
        markdown(`**Memory** (last ${d.memory.history.length} ticks)`),
        sparkline(d.memory.history),
        markdown(`**Network throughput** (${d.network.unit})`),
        sparkline(d.network.history),
        spacer(),

        divider("=", "Progress bars (also live)"),
        progressBar("CPU load", d.cpu.current, 100),
        progressBar("Memory pressure", d.memory.current, 100),
      ];
    }),

    spacer(),
    divider("=", "How this works"),
    markdown([
      "```ts",
      "// pages/live-data.ts",
      "dynamic(() => {",
      "  const result = fetcher<StatsResponse>({",
      "    url: \"/api/stats\",",
      "    refreshInterval: 1000,",
      "  });",
      "  if (!result.data) return [markdown(\"loading\")];",
      "  return [sparkline(result.data.cpu.history)];",
      "});",
      "",
      "// api/stats.ts",
      "export async function GET() {",
      "  return { cpu: { current: 42, history: [...] } };",
      "}",
      "```",
    ].join("\n")),
  ];
}
