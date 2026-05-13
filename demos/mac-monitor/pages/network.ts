import { dynamic, fetcher, card, markdown, table, divider } from "../../../src/index.js";

export const metadata = { label: "Network", order: 4 };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function Network() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/network", refreshInterval: 3000 });
      if (!result.data) return [markdown("Loading network info...")];
      const d = result.data as any;

      return [
        card({
          title: "Network Overview",
          body: [
            `Active Connections: ${d.connections}`,
            `Local IP (en0):    ${d.localIp}`,
          ].join("\n"),
        }),
        divider("Interfaces"),
        table(
          ["Interface", "Bytes In", "Bytes Out"],
          d.interfaces.map((iface: any) => [
            iface.name,
            formatBytes(iface.bytesIn),
            formatBytes(iface.bytesOut),
          ]),
        ),
      ];
    }),
  ];
}
