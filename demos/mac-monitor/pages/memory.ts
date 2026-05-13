import { dynamic, fetcher, row, col, card, markdown, table, progressBar, divider } from "../../../src/index.js";

export const metadata = { label: "Memory", order: 2 };

export default function Memory() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/memory", refreshInterval: 2000 });
      if (!result.data) return [markdown("Loading memory info...")];
      const d = result.data as any;

      return [
        row([
          col([
            card({
              title: "Memory Usage",
              subtitle: `${d.used.toFixed(1)} / ${d.total.toFixed(1)} GB`,
            }),
            progressBar("Used", d.usagePercent, 100),
            divider("Breakdown"),
            markdown(`Active:     ${d.active.toFixed(2)} GB`),
            markdown(`Wired:      ${d.wired.toFixed(2)} GB`),
            markdown(`Compressed: ${d.compressed.toFixed(2)} GB`),
            markdown(`Inactive:   ${d.inactive.toFixed(2)} GB`),
            markdown(`Free:       ${d.free.toFixed(2)} GB`),
            markdown(`Swap Used:  ${d.swapUsed.toFixed(2)} GB`),
            divider(),
            markdown(`Pressure: ${d.pressure}`),
          ], { span: 5, xs: 12 }),
          col([
            divider("Top 10 Processes by Memory"),
            table(
              ["PID", "Name", "Mem%", "RSS (KB)"],
              d.topProcesses.map((p: any) => [
                String(p.pid),
                p.command,
                p.mem.toFixed(1),
                String(p.rss),
              ]),
            ),
          ], { span: 7, xs: 12 }),
        ], { gap: 1 }),
      ];
    }),
  ];
}
