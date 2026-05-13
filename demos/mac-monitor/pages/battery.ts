import { dynamic, fetcher, card, markdown, progressBar, divider } from "../../../src/index.js";

export const metadata = { label: "Battery", order: 5 };

export default function Battery() {
  return [
    dynamic(() => {
      const result = fetcher({ url: "/api/battery", refreshInterval: 5000 });
      if (!result.data) return [markdown("Loading battery info...")];
      const d = result.data as any;

      if (d.percent < 0) {
        return [
          card({ title: "Battery", body: "No battery detected — this Mac may be a desktop model." }),
        ];
      }

      return [
        card({
          title: "Battery Status",
          subtitle: `${d.percent}%`,
        }),
        progressBar("Charge", d.percent, 100),
        divider("Details"),
        markdown(`Power Source:    ${d.source}`),
        markdown(`Charging:        ${d.charging ? "Yes" : "No"}`),
        markdown(`Time Remaining:  ${d.timeRemaining}`),
        markdown(`Cycle Count:     ${d.cycleCount}`),
        markdown(`Health:          ${d.health}%`),
        markdown(`Temperature:     ${d.temperature}`),
      ];
    }),
  ];
}
