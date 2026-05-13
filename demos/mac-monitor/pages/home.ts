import { dynamic, fetcher, row, col, card, markdown, divider } from "../../../src/index.js";

export const metadata = { label: "Overview", order: 0 };

export default function Home() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/system", refreshInterval: 3000 });
      if (!result.data) return [markdown("Loading system info...")];
      const d = result.data as any;

      const rootVol = d.disk.volumes.find((v: any) => v.mountPoint === "/");

      return [
        markdown(`${d.system.hostname} -- macOS ${d.system.os} -- ${d.system.chip} -- Up ${d.system.uptime}`),
        divider(),
        // Row 1: CPU + Memory
        row([
          col([card({
            title: "## CPU",
            subtitle: `${d.cpu.usage.toFixed(1)}% usage`,
            body: `User: ${d.cpu.user.toFixed(1)}% -- Sys: ${d.cpu.sys.toFixed(1)}%\nCores: ${d.cpu.cores} -- Load: ${d.cpu.loadAvg}\n `,
          })], { span: 6, xs: 12 }),
          col([card({
            title: "[] Memory",
            subtitle: `${d.memory.used.toFixed(1)} / ${d.memory.total.toFixed(1)} GB (${d.memory.usagePercent.toFixed(0)}%)`,
            body: `Active: ${d.memory.active.toFixed(1)} GB -- Wired: ${d.memory.wired.toFixed(1)} GB\nCompressed: ${d.memory.compressed.toFixed(1)} GB -- Pressure: ${d.memory.pressure}\n `,
          })], { span: 6, xs: 12 }),
        ], { gap: 1 }),
        // Row 2: GPU + Disk
        row([
          col([card({
            title: "^^ GPU",
            subtitle: d.gpu?.name ?? "N/A",
            body: d.gpu
              ? `Cores: ${d.gpu.cores}${d.gpu.utilization >= 0 ? ` -- Util: ${d.gpu.utilization}%` : ""}\nVRAM: ${d.gpu.vram} -- Metal: ${d.gpu.metalSupport}\n `
              : "No GPU info\n \n ",
          })], { span: 6, xs: 12 }),
          col([card({
            title: "// Disk (/)",
            subtitle: rootVol ? `${rootVol.used} / ${rootVol.size} (${rootVol.usagePercent}%)` : "N/A",
            body: rootVol ? `Available: ${rootVol.available}\n \n ` : "N/A\n \n ",
          })], { span: 6, xs: 12 }),
        ], { gap: 1 }),
        // Row 3: Network + Battery
        row([
          col([card({
            title: "<> Network",
            subtitle: `${d.network.connections} connections`,
            body: `Local IP: ${d.network.localIp}\n \n `,
          })], { span: 6, xs: 12 }),
          col([card({
            title: "++ Battery",
            subtitle: d.battery.percent >= 0 ? `${d.battery.percent}% -- ${d.battery.source}` : "No battery",
            body: d.battery.percent >= 0
              ? `Health: ${d.battery.health}% -- Cycles: ${d.battery.cycleCount}\n \n `
              : "No battery detected\n \n ",
          })], { span: 6, xs: 12 }),
        ], { gap: 1 }),
      ];
    }),
  ];
}
