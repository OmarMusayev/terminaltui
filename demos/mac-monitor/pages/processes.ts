import { dynamic, fetcher, markdown, table, divider, textInput, createState } from "../../../src/index.js";

export const metadata = { label: "Processes", order: 6 };

const filterState = createState({ query: "" });

export default function Processes() {
  return [
    textInput({
      id: "process-filter",
      label: "Filter by name",
      placeholder: "Type to filter processes...",
      onChange: (value: string) => {
        filterState.set("query", value.toLowerCase());
      },
    }),
    dynamic(() => {
      const result = fetcher({ url: "/api/processes", refreshInterval: 2000 });
      if (!result.data) return [markdown("Loading processes...")];
      const d = result.data as any;
      const query = filterState.get("query");

      const filtered = query
        ? d.processes.filter((p: any) => p.command.toLowerCase().includes(query))
        : d.processes;

      const top30 = filtered.slice(0, 30);

      return [
        divider(`Processes (${top30.length} shown${query ? ", filtered" : ""})`),
        table(
          ["PID", "Name", "CPU%", "Mem%", "RSS (KB)"],
          top30.map((p: any) => [
            String(p.pid),
            p.command,
            p.cpu.toFixed(1),
            p.mem.toFixed(1),
            String(p.rss),
          ]),
        ),
      ];
    }),
  ];
}
