import { dynamic, fetcher, card, markdown, divider, table } from "../../../src/index.js";

export const metadata = { label: "GPU", order: 3 };

export default function Gpu() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/gpu", refreshInterval: 3000 });
      if (!result.data) return [markdown("Loading GPU info...")];
      const d = result.data as any;

      return [
        card({
          title: "^^ " + d.name,
          body: [
            `GPU Cores:     ${d.cores}`,
            `VRAM:          ${d.vram}`,
            `Metal Support: ${d.metalSupport}`,
            d.utilization >= 0 ? `Utilization:   ${d.utilization}%` : "Utilization:   N/A (requires sudo)",
          ].join("\n"),
        }),
        divider("Details"),
        table(
          ["Property", "Value"],
          [
            ["Chipset", d.name],
            ["Cores", String(d.cores)],
            ["VRAM", d.vram],
            ["Metal", d.metalSupport],
            ["Utilization", d.utilization >= 0 ? `${d.utilization}%` : "N/A"],
          ],
        ),
      ];
    }),
  ];
}
