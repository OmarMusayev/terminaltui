import {
  defineSite, page, card, table, markdown, link,
  ascii, divider, spacer, list, quote, hero,
  form, textInput, textArea, select, button,
  asciiArt, progressBar, badge, accordion,
  dynamic, fetcher, request,
} from "../../src/index.js";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { hostname, cpus, totalmem, freemem, uptime, platform, arch, homedir, tmpdir } from "node:os";

// ─── Stateful backend data ────────────────────────────────

const eventLog: { time: string; event: string }[] = [];

function logEvent(event: string) {
  eventLog.unshift({
    time: new Date().toLocaleTimeString(),
    event,
  });
  if (eventLog.length > 50) eventLog.pop();
}

logEvent("System monitor started");

// ─── Notes storage (in-memory) ────────────────────────────

const notes: { id: number; title: string; body: string; created: string }[] = [];
let nextNoteId = 1;

// ─── Site config ──────────────────────────────────────────

export default defineSite({
  name: "SysMon",
  tagline: "local system monitor — powered by API routes",
  banner: ascii("SysMon", { font: "ANSI Shadow", gradient: ["#50fa7b", "#8be9fd"] }),
  theme: "dracula",
  borders: "rounded",
  animations: { boot: true, transitions: "fade", exitMessage: "SysMon stopped." },

  // ═══════════════════════════════════════════════════════
  //  API ROUTES — backend endpoints on localhost
  // ═══════════════════════════════════════════════════════

  api: {

    // ── System info (static-ish) ───────────────────────
    "GET /system/info": async () => {
      const cpu = cpus();
      return {
        hostname: hostname(),
        platform: platform(),
        arch: arch(),
        cpuModel: cpu[0]?.model ?? "unknown",
        cpuCores: cpu.length,
        totalMemGB: (totalmem() / 1073741824).toFixed(1),
        nodeVersion: process.version,
        home: homedir(),
        tmp: tmpdir(),
      };
    },

    // ── Live stats (changes every call) ────────────────
    "GET /system/stats": async () => {
      const cpu = cpus();
      const totalIdle = cpu.reduce((sum, c) => sum + c.times.idle, 0);
      const totalTick = cpu.reduce((sum, c) =>
        sum + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0);
      const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

      const memTotal = totalmem();
      const memFree = freemem();
      const memUsed = memTotal - memFree;
      const memPercent = Math.round((memUsed / memTotal) * 100);

      return {
        uptime: Math.round(uptime()),
        cpuUsage,
        memTotal: (memTotal / 1073741824).toFixed(1),
        memUsed: (memUsed / 1073741824).toFixed(1),
        memFree: (memFree / 1073741824).toFixed(1),
        memPercent,
        timestamp: Date.now(),
      };
    },

    // ── Disk usage ─────────────────────────────────────
    "GET /system/disk": async () => {
      try {
        const df = execSync("df -h / 2>/dev/null || df -h C:\\ 2>/dev/null").toString().trim();
        const lines = df.split("\n");
        return { raw: lines, ok: true };
      } catch {
        return { raw: ["disk info unavailable"], ok: false };
      }
    },

    // ── Process list ───────────────────────────────────
    "GET /processes": async () => {
      try {
        const ps = execSync("ps aux --sort=-%mem 2>/dev/null | head -11 || ps aux | head -11")
          .toString().trim();
        const lines = ps.split("\n");
        const header = lines[0];
        const procs = lines.slice(1).map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            user: parts[0],
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(" ").substring(0, 40),
          };
        });
        return { processes: procs, count: procs.length };
      } catch {
        return { processes: [], count: 0 };
      }
    },

    // ── Process lookup by PID ──────────────────────────
    "GET /processes/:pid": async (req) => {
      try {
        const info = execSync(`ps -p ${req.params.pid} -o pid,ppid,user,%cpu,%mem,command 2>/dev/null`)
          .toString().trim();
        return { info: info.split("\n"), found: true };
      } catch {
        return { info: [], found: false, message: `PID ${req.params.pid} not found` };
      }
    },

    // ── Network interfaces ─────────────────────────────
    "GET /network": async () => {
      try {
        const out = execSync("ifconfig 2>/dev/null || ip addr 2>/dev/null")
          .toString().trim();
        const interfaces: { name: string; ip: string }[] = [];
        const blocks = out.split(/\n(?=\S)/);
        for (const block of blocks) {
          const nameMatch = block.match(/^(\S+?)[:]/);
          const ipMatch = block.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
          if (nameMatch && ipMatch) {
            interfaces.push({ name: nameMatch[1], ip: ipMatch[1] });
          }
        }
        return { interfaces };
      } catch {
        return { interfaces: [] };
      }
    },

    // ── Directory listing ──────────────────────────────
    "GET /files": async (req) => {
      const dir = req.query.dir || ".";
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
          .filter(e => !e.name.startsWith("."))
          .slice(0, 25)
          .map(e => ({
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
            size: e.isFile() ? statSync(`${dir}/${e.name}`).size : null,
          }));
        return { dir, entries, count: entries.length };
      } catch (err: any) {
        return { dir, entries: [], count: 0, error: err.message };
      }
    },

    // ── Read a file ────────────────────────────────────
    "GET /files/read": async (req) => {
      const path = req.query.path || "./README.md";
      try {
        const content = readFileSync(path, "utf-8");
        const lines = content.split("\n");
        return {
          path,
          lines: lines.length,
          preview: lines.slice(0, 20).join("\n"),
          sizeBytes: Buffer.byteLength(content),
        };
      } catch (err: any) {
        return { path, error: err.message };
      }
    },

    // ── Event log ──────────────────────────────────────
    "GET /events": async () => {
      return { events: eventLog.slice(0, 20), total: eventLog.length };
    },

    "POST /events": async (req) => {
      const { event } = req.body as any;
      if (!event) return { error: "event field required" };
      logEvent(event);
      return { success: true, total: eventLog.length };
    },

    // ── Notes CRUD ─────────────────────────────────────
    "GET /notes": async () => {
      return { notes, count: notes.length };
    },

    "POST /notes": async (req) => {
      const { title, body } = req.body as any;
      if (!title) return { error: "title required" };
      const note = {
        id: nextNoteId++,
        title,
        body: body || "",
        created: new Date().toLocaleTimeString(),
      };
      notes.push(note);
      logEvent(`Note created: "${title}"`);
      return { success: true, note };
    },

    "DELETE /notes/:id": async (req) => {
      const id = parseInt(req.params.id, 10);
      const idx = notes.findIndex(n => n.id === id);
      if (idx === -1) return { error: "not found" };
      const [removed] = notes.splice(idx, 1);
      logEvent(`Note deleted: "${removed.title}"`);
      return { success: true, removed };
    },

    // ── Shell command execution ────────────────────────
    "POST /exec": async (req) => {
      const { cmd } = req.body as any;
      if (!cmd) return { error: "cmd field required" };
      // Safety: only allow read-only commands
      const allowed = ["echo", "date", "whoami", "uname", "uptime", "which", "env", "pwd", "ls"];
      const base = cmd.trim().split(/\s+/)[0];
      if (!allowed.includes(base)) {
        return { error: `Command "${base}" not allowed. Allowed: ${allowed.join(", ")}` };
      }
      try {
        const output = execSync(cmd, { timeout: 5000 }).toString().trim();
        logEvent(`Executed: ${cmd}`);
        return { output, exitCode: 0 };
      } catch (err: any) {
        return { output: err.message, exitCode: 1 };
      }
    },

    // ── Health check ───────────────────────────────────
    "GET /health": async () => {
      return { status: "ok", pid: process.pid, uptime: Math.round(uptime()) };
    },
  },

  // ═══════════════════════════════════════════════════════
  //  PAGES — consume the API routes above
  // ═══════════════════════════════════════════════════════

  pages: [

    // ── Dashboard ────────────────────────────────────────
    page("dashboard", {
      title: "Dashboard",
      icon: "◆",
      content: [
        hero({
          title: "System Monitor",
          subtitle: "Live stats from your machine, powered by terminaltui API routes.",
          art: asciiArt.scene("server", { width: 28 }).join("\n"),
        }),
        spacer(),

        // System info (fetched once)
        divider("System Info"),
        dynamic(["sysinfo"], () => {
          const info = fetcher({ url: "/system/info" });
          if (info.loading) return markdown("Loading system info...");
          if (info.error) return markdown(`Error: ${info.error.message}`);
          const d = info.data as any;
          return table(
            ["Property", "Value"],
            [
              ["Hostname", d.hostname],
              ["Platform", `${d.platform} (${d.arch})`],
              ["CPU", `${d.cpuModel}`],
              ["Cores", `${d.cpuCores}`],
              ["Total Memory", `${d.totalMemGB} GB`],
              ["Node.js", d.nodeVersion],
            ],
          );
        }),
        spacer(),

        // Live stats (auto-refresh)
        divider("Live Stats"),
        dynamic(["stats"], () => {
          const stats = fetcher({ url: "/system/stats", refreshInterval: 3000 });
          if (stats.loading) return markdown("Loading stats...");
          if (stats.error) return markdown(`Error: ${stats.error.message}`);
          const d = stats.data as any;
          const hours = Math.floor(d.uptime / 3600);
          const mins = Math.floor((d.uptime % 3600) / 60);
          return [
            markdown(`**Uptime:** ${hours}h ${mins}m`),
            progressBar(`CPU Usage`, d.cpuUsage, 100),
            progressBar(`Memory (${d.memUsed}/${d.memTotal} GB)`, d.memPercent, 100),
          ];
        }),
        spacer(),

        // Disk usage
        divider("Disk Usage"),
        dynamic(["disk"], () => {
          const disk = fetcher({ url: "/system/disk" });
          if (disk.loading) return markdown("Loading disk info...");
          const d = disk.data as any;
          if (!d.ok) return markdown("Disk info unavailable");
          return markdown("```\n" + d.raw.join("\n") + "\n```");
        }),
      ],
    }),

    // ── Processes ────────────────────────────────────────
    page("processes", {
      title: "Processes",
      icon: "◈",
      content: [
        divider("Top Processes by Memory"),
        dynamic(["procs"], () => {
          const procs = fetcher({ url: "/processes", refreshInterval: 5000 });
          if (procs.loading) return markdown("Loading processes...");
          if (procs.error) return markdown(`Error: ${procs.error.message}`);
          const d = procs.data as any;
          if (d.count === 0) return markdown("No process info available");
          return table(
            ["PID", "User", "CPU%", "MEM%", "Command"],
            d.processes.map((p: any) => [p.pid, p.user, p.cpu, p.mem, p.command]),
          );
        }),
        spacer(),
        divider("Network Interfaces"),
        dynamic(["net"], () => {
          const net = fetcher({ url: "/network" });
          if (net.loading) return markdown("Loading network info...");
          const d = net.data as any;
          if (d.interfaces.length === 0) return markdown("No interfaces found");
          return table(
            ["Interface", "IP Address"],
            d.interfaces.map((i: any) => [i.name, i.ip]),
          );
        }),
      ],
    }),

    // ── Files ────────────────────────────────────────────
    page("files", {
      title: "Files",
      icon: "▤",
      content: [
        divider("Project Directory"),
        dynamic(["files"], () => {
          const files = fetcher({ url: "/files?dir=." });
          if (files.loading) return markdown("Loading files...");
          if (files.error) return markdown(`Error: ${files.error.message}`);
          const d = files.data as any;
          if (d.error) return markdown(`Error: ${d.error}`);
          return [
            markdown(`**${d.count} items** in \`${d.dir}\``),
            table(
              ["Name", "Type", "Size"],
              d.entries.map((e: any) => [
                e.name,
                e.type === "dir" ? "📁 dir" : "📄 file",
                e.size !== null ? `${(e.size / 1024).toFixed(1)} KB` : "—",
              ]),
            ),
          ];
        }),
        spacer(),
        divider("README Preview"),
        dynamic(["readme"], () => {
          const file = fetcher({ url: "/files/read?path=./README.md" });
          if (file.loading) return markdown("Loading README...");
          const d = file.data as any;
          if (d.error) return markdown(`Could not read README: ${d.error}`);
          return [
            markdown(`**${d.lines} lines** · ${(d.sizeBytes / 1024).toFixed(1)} KB`),
            markdown(d.preview),
          ];
        }),
      ],
    }),

    // ── Notes ────────────────────────────────────────────
    page("notes", {
      title: "Notes",
      icon: "✎",
      content: [
        divider("Create Note"),
        form({
          id: "create-note",
          resetOnSubmit: true,
          onSubmit: async (data) => {
            const res = await request.post("/notes", {
              title: data.title,
              body: data.body,
            });
            if (res.ok && (res.data as any).success) {
              return { success: `Note "${data.title}" created!` };
            }
            return { error: (res.data as any)?.error || "Failed to create note" };
          },
          fields: [
            textInput({ id: "title", label: "Title", placeholder: "My note..." }),
            textArea({ id: "body", label: "Body", placeholder: "Write something...", rows: 3 }),
            button({ label: "Save Note", style: "primary" }),
          ],
        }),
        spacer(),
        divider("Saved Notes"),
        dynamic(["notes-list"], () => {
          const data = fetcher({ url: "/notes", refreshInterval: 2000 });
          if (data.loading) return markdown("Loading notes...");
          if (data.error) return markdown(`Error: ${data.error.message}`);
          const d = data.data as any;
          if (d.count === 0) return markdown("_No notes yet. Create one above!_");
          return d.notes.map((n: any) =>
            card({
              title: n.title,
              subtitle: `#${n.id} · ${n.created}`,
              body: n.body || "(no body)",
            })
          );
        }),
      ],
    }),

    // ── Event Log ────────────────────────────────────────
    page("events", {
      title: "Event Log",
      icon: "▸",
      content: [
        divider("Recent Events"),
        dynamic(["events"], () => {
          const data = fetcher({ url: "/events", refreshInterval: 2000 });
          if (data.loading) return markdown("Loading events...");
          if (data.error) return markdown(`Error: ${data.error.message}`);
          const d = data.data as any;
          if (d.total === 0) return markdown("_No events yet._");
          return table(
            ["Time", "Event"],
            d.events.map((e: any) => [e.time, e.event]),
          );
        }),
        spacer(),
        divider("Log Custom Event"),
        form({
          id: "log-event",
          resetOnSubmit: true,
          onSubmit: async (data) => {
            const res = await request.post("/events", { event: data.event });
            if (res.ok && (res.data as any).success) {
              return { success: "Event logged!" };
            }
            return { error: (res.data as any)?.error || "Failed to log event" };
          },
          fields: [
            textInput({ id: "event", label: "Event", placeholder: "Something happened..." }),
            button({ label: "Log Event", style: "secondary" }),
          ],
        }),
        spacer(),
        divider("Run Command"),
        form({
          id: "run-cmd",
          resetOnSubmit: true,
          onSubmit: async (data) => {
            const res = await request.post("/exec", { cmd: data.cmd });
            const d = res.data as any;
            if (d.error) return { error: d.error };
            return { success: `$ ${data.cmd}\n${d.output}` };
          },
          fields: [
            textInput({ id: "cmd", label: "Command", placeholder: "echo hello | date | whoami | uname | uptime" }),
            button({ label: "Execute", style: "danger" }),
          ],
        }),
        spacer(),
        divider("API Health"),
        dynamic(["health"], () => {
          const data = fetcher({ url: "/health", refreshInterval: 5000 });
          if (data.loading) return markdown("Checking...");
          const d = data.data as any;
          return markdown(`**Status:** ${d.status} · **PID:** ${d.pid} · **Uptime:** ${d.uptime}s`);
        }),
      ],
    }),
  ],
});
