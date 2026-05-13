import { dynamic, fetcher, card, markdown, progressBar, divider } from "../../../src/index.js";

export const metadata = { label: "Disk", order: 3 };

export default function Disk() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/disk", refreshInterval: 5000 });
      if (!result.data) return [markdown("Loading disk info...")];
      const d = result.data as any;

      return [
        divider("Volumes"),
        ...d.volumes.map((v: any) => [
          card({
            title: v.mountPoint,
            subtitle: v.filesystem,
            body: [
              `Size:      ${v.size}`,
              `Used:      ${v.used}`,
              `Available: ${v.available}`,
              `Usage:     ${v.usagePercent}%`,
            ].join("\n"),
          }),
          progressBar(v.mountPoint, v.usagePercent, 100),
        ]).flat(),
      ];
    }),
  ];
}
