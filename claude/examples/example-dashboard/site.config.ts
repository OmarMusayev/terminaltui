/**
 * Example: System Dashboard with API Routes
 *
 * Demonstrates how to use API routes to read system info,
 * run commands, and display live-updating data.
 */
import {
  defineSite, page, dynamic, fetcher, request,
  markdown, card, table, divider, spacer, hero,
  progressBar, form, textInput, button, ascii,
} from "terminaltui";
import { execSync } from "child_process";
import { hostname, cpus, totalmem, freemem, uptime } from "os";
import { readdirSync } from "fs";

// In-memory event log
const events: { time: string; message: string }[] = [];
function log(msg: string) {
  events.unshift({ time: new Date().toLocaleTimeString(), message: msg });
  if (events.length > 30) events.pop();
}
log("Dashboard started");

export default defineSite({
  name: "Dashboard",
  tagline: "system monitor with API routes",
  banner: ascii("Dashboard", { font: "Small", gradient: ["#50fa7b", "#8be9fd"] }),
  theme: "hacker",
  borders: "rounded",
  animations: { boot: true, transitions: "fade" },

  // ─── API Routes ─────────────────────────────────────
  api: {
    "GET /system": async () => ({
      hostname: hostname(),
      cores: cpus().length,
      memTotal: (totalmem() / 1073741824).toFixed(1),
      memFree: (freemem() / 1073741824).toFixed(1),
      memPercent: Math.round(((totalmem() - freemem()) / totalmem()) * 100),
      uptime: Math.round(uptime()),
    }),

    "GET /files": async () => {
      const files = readdirSync(".").filter(f => !f.startsWith("."));
      return { files, count: files.length };
    },

    "GET /events": async () => ({ events }),

    "POST /events": async (req) => {
      const { message } = req.body as any;
      if (!message) return { error: "message required" };
      log(message);
      return { success: true };
    },

    "GET /health": async () => ({
      status: "ok",
      pid: process.pid,
      uptime: Math.round(uptime()),
    }),
  },

  // ─── Pages ──────────────────────────────────────────
  pages: [
    page("overview", {
      title: "Overview",
      icon: "◆",
      content: [
        divider("System"),
        dynamic(["sys"], () => {
          const sys = fetcher({ url: "/system", refreshInterval: 5000 });
          if (sys.loading) return markdown("Loading...");
          if (sys.error) return markdown(`Error: ${sys.error.message}`);
          const d = sys.data as any;
          const h = Math.floor(d.uptime / 3600);
          const m = Math.floor((d.uptime % 3600) / 60);
          return [
            table(["Property", "Value"], [
              ["Hostname", d.hostname],
              ["CPU Cores", String(d.cores)],
              ["Memory", `${d.memFree} / ${d.memTotal} GB free`],
              ["Uptime", `${h}h ${m}m`],
            ]),
            progressBar("Memory", d.memPercent, 100),
          ];
        }),
        spacer(),
        divider("Project Files"),
        dynamic(["files"], () => {
          const f = fetcher({ url: "/files" });
          if (f.loading) return markdown("Loading...");
          const d = f.data as any;
          return markdown(`**${d.count} files:** ${d.files.slice(0, 10).join(", ")}`);
        }),
      ],
    }),

    page("events", {
      title: "Events",
      icon: "▸",
      content: [
        divider("Log"),
        dynamic(["events"], () => {
          const ev = fetcher({ url: "/events", refreshInterval: 3000 });
          if (ev.loading) return markdown("Loading...");
          const d = ev.data as any;
          if (d.events.length === 0) return markdown("_No events yet._");
          return table(["Time", "Event"], d.events.map((e: any) => [e.time, e.message]));
        }),
        spacer(),
        divider("Add Event"),
        form({
          id: "add-event",
          resetOnSubmit: true,
          onSubmit: async (data) => {
            const res = await request.post("/events", { message: data.msg });
            if (res.ok) return { success: "Logged!" };
            return { error: "Failed" };
          },
          fields: [
            textInput({ id: "msg", label: "Message", placeholder: "Something happened..." }),
            button({ label: "Log", style: "primary" }),
          ],
        }),
      ],
    }),

    page("health", {
      title: "Health",
      icon: "♥",
      content: [
        dynamic(["health"], () => {
          const h = fetcher({ url: "/health", refreshInterval: 10000 });
          if (h.loading) return markdown("Checking...");
          const d = h.data as any;
          return card({
            title: "API Health",
            body: `Status: ${d.status}\nPID: ${d.pid}\nUptime: ${d.uptime}s`,
            tags: [d.status === "ok" ? "healthy" : "unhealthy"],
          });
        }),
      ],
    }),
  ],
});
