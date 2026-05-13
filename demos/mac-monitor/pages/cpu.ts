import { dynamic, fetcher, row, col, card, markdown, table, progressBar, divider } from "../../../src/index.js";

export const metadata = { label: "CPU", order: 1 };

export default function Cpu() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/cpu", refreshInterval: 2000 });
      if (!result.data) return [markdown("Loading CPU info...")];
      const d = result.data as any;

      return [
        row([
          col([
            card({
              title: "CPU Info",
              subtitle: d.name,
              body: [
                `Cores: ${d.cores}`,
                `Load Average: ${d.loadAvg}`,
                `User: ${d.user.toFixed(1)}%`,
                `System: ${d.sys.toFixed(1)}%`,
                `Idle: ${d.idle.toFixed(1)}%`,
              ].join("\n"),
            }),
            divider(),
            progressBar("Total Usage", d.usage, 100),
            progressBar("User", d.user, 100),
            progressBar("System", d.sys, 100),
          ], { span: 5, xs: 12 }),
          col([
            divider("Top 10 Processes by CPU"),
            table(
              ["PID", "Name", "CPU%", "Mem%"],
              d.topProcesses.map((p: any) => [
                String(p.pid),
                p.command,
                p.cpu.toFixed(1),
                p.mem.toFixed(1),
              ]),
            ),
          ], { span: 7, xs: 12 }),
        ], { gap: 1 }),
      ];
    }),
  ];
}
