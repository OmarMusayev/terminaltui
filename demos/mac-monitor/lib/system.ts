/**
 * macOS system info helpers — wraps shell commands and parses output.
 * All functions return parsed data objects. Errors return sensible defaults.
 * Compatible with: Intel Macs, Apple Silicon, desktops (no battery), laptops.
 */
import { execSync } from "child_process";

const cache = new Map<string, { value: string; ts: number }>();
const CACHE_TTL = 3000;
const SLOW_CACHE_TTL = 5000;
const SLOW_COMMANDS = ["system_profiler", "ioreg", "memory_pressure"];

function exec(cmd: string): string {
  const now = Date.now();
  const cached = cache.get(cmd);
  const ttl = SLOW_COMMANDS.some(s => cmd.includes(s)) ? SLOW_CACHE_TTL : CACHE_TTL;
  if (cached && now - cached.ts < ttl) return cached.value;

  try {
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
    cache.set(cmd, { value: result, ts: now });
    return result;
  } catch {
    return "";
  }
}

// ─── CPU ──────────────────────────────────────────────────

export function getCpuInfo() {
  const name = exec("sysctl -n machdep.cpu.brand_string") || "Unknown CPU";
  const cores = parseInt(exec("sysctl -n hw.ncpu")) || 1;

  // ps-based CPU — instant, works on all macOS
  const totalCpu = parseFloat(exec("ps -A -o %cpu | awk '{s+=$1} END {print s}'")) || 0;
  const usage = Math.min(totalCpu, 100);
  const loadAvg = exec("sysctl -n vm.loadavg").replace(/[{}]/g, "").trim() || "N/A";

  return {
    name, cores,
    user: Math.round(usage * 0.7 * 10) / 10,
    sys: Math.round(usage * 0.3 * 10) / 10,
    idle: Math.round((100 - usage) * 10) / 10,
    usage: Math.round(usage * 10) / 10,
    loadAvg,
  };
}

// ─── Memory ───────────────────────────────────────────────

export function getMemoryInfo() {
  const totalBytes = parseInt(exec("sysctl -n hw.memsize")) || 0;
  const total = totalBytes / (1024 ** 3);

  const vmstat = exec("vm_stat");
  const pageSizeMatch = vmstat.match(/page size of (\d+) bytes/);
  const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1]) : 16384;

  const parse = (label: string) => {
    const m = vmstat.match(new RegExp(`${label}:\\s+(\\d+)`));
    return m ? (parseInt(m[1]) * pageSize) / (1024 ** 3) : 0;
  };

  const free = parse("Pages free");
  const active = parse("Pages active");
  const inactive = parse("Pages inactive");
  const wired = parse("Pages wired down");
  const compressed = parse("Pages occupied by compressor");
  const used = active + wired + compressed;

  let pressure = "Normal";
  try {
    const pressureOutput = exec("memory_pressure 2>/dev/null");
    if (pressureOutput.includes("critical")) pressure = "Critical";
    else if (pressureOutput.includes("warn")) pressure = "Warning";
  } catch { /* memory_pressure may not exist on older macOS */ }

  let swapUsed = 0;
  try {
    const swapOutput = exec("sysctl -n vm.swapusage");
    const swapMatch = swapOutput.match(/used\s*=\s*([\d.]+)M/);
    swapUsed = swapMatch ? parseFloat(swapMatch[1]) / 1024 : 0;
  } catch { /* ignore */ }

  return {
    total, used, free, active, inactive, wired, compressed,
    pressure, swapUsed,
    usagePercent: total > 0 ? (used / total) * 100 : 0,
  };
}

// ─── Disk ─────────────────────────────────────────────────

export function getDiskInfo() {
  // Use df -lh (local only) and calculate real usage from the root APFS container.
  // On APFS, individual volume "used" is misleading because space is shared.
  // The real picture: total = size, real_used = total - available.
  const dfOutput = exec("df -lh");
  if (!dfOutput) return { volumes: [] };

  const lines = dfOutput.split("\n").slice(1);
  const volumes = lines
    .filter(l => l.startsWith("/dev/"))
    .map(l => {
      const parts = l.split(/\s+/);
      const size = parts[1] || "0";
      const available = parts[3] || "0";
      const mountPoint = parts.slice(8).join(" ") || parts[5] || "/";

      // Calculate real used = total - available (not the misleading per-volume "used")
      const sizeBytes = parseSize(size);
      const availBytes = parseSize(available);
      const realUsed = sizeBytes - availBytes;
      const realPercent = sizeBytes > 0 ? Math.round((realUsed / sizeBytes) * 100) : 0;

      return {
        filesystem: parts[0] || "",
        size,
        used: formatSize(realUsed),
        available,
        usagePercent: realPercent,
        mountPoint,
      };
    });

  // Deduplicate — only show one entry per APFS container (the root "/" mount)
  // Other APFS volumes (/System/Volumes/*) share the same pool
  const seen = new Set<string>();
  const deduped = volumes.filter(v => {
    // Keep root and any non-System volume mounts
    if (v.mountPoint === "/") { seen.add(v.filesystem); return true; }
    if (v.mountPoint.startsWith("/System/Volumes")) return false;
    if (seen.has(v.filesystem)) return false;
    seen.add(v.filesystem);
    return true;
  });

  return { volumes: deduped };
}

function parseSize(s: string): number {
  const match = s.match(/([\d.]+)\s*(\w+)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("t")) return val * 1024 * 1024 * 1024 * 1024;
  if (unit.startsWith("g")) return val * 1024 * 1024 * 1024;
  if (unit.startsWith("m")) return val * 1024 * 1024;
  if (unit.startsWith("k")) return val * 1024;
  return val;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 4) return (bytes / (1024 ** 4)).toFixed(1) + "Ti";
  if (bytes >= 1024 ** 3) return (bytes / (1024 ** 3)).toFixed(0) + "Gi";
  if (bytes >= 1024 ** 2) return (bytes / (1024 ** 2)).toFixed(0) + "Mi";
  return (bytes / 1024).toFixed(0) + "Ki";
}

// ─── Network ──────────────────────────────────────────────

export function getNetworkInfo() {
  const connections = parseInt(exec("netstat -an 2>/dev/null | grep ESTABLISHED | wc -l").trim()) || 0;

  const netstatOutput = exec("netstat -ib 2>/dev/null");
  const lines = netstatOutput ? netstatOutput.split("\n").slice(1) : [];
  const interfaces = lines
    .filter(l => l.trim().length > 0)
    .map(l => {
      const parts = l.split(/\s+/);
      if (parts.length < 10) return null;
      return {
        name: parts[0],
        bytesIn: parseInt(parts[6]) || 0,
        bytesOut: parseInt(parts[9]) || 0,
      };
    })
    .filter((iface): iface is NonNullable<typeof iface> => iface !== null)
    .filter(iface => ["en0", "en1", "en2", "lo0"].includes(iface.name));

  // Try multiple interfaces for IP (en0 = WiFi, en1 = Ethernet on some Macs)
  let localIp = exec("ipconfig getifaddr en0 2>/dev/null");
  if (!localIp) localIp = exec("ipconfig getifaddr en1 2>/dev/null");
  if (!localIp) localIp = "Not connected";

  return { connections, interfaces, localIp };
}

// ─── Battery ──────────────────────────────────────────────

export function getBatteryInfo() {
  const pmset = exec("pmset -g batt 2>/dev/null");

  // Desktop Macs have no battery
  if (!pmset || (!pmset.includes("InternalBattery") && !pmset.includes("%"))) {
    return {
      percent: -1, source: "AC Power", charging: false,
      timeRemaining: "N/A", cycleCount: 0, health: 100, temperature: "N/A",
    };
  }

  const source = pmset.includes("AC Power") ? "AC Power" : "Battery";
  const percentMatch = pmset.match(/(\d+)%/);
  const percent = percentMatch ? parseInt(percentMatch[1]) : -1;
  const charging = pmset.includes("charging") && !pmset.includes("not charging");
  const timeMatch = pmset.match(/(\d+:\d+) remaining/);
  const timeRemaining = timeMatch ? timeMatch[1] : charging ? "Calculating..." : "N/A";

  let cycleCount = 0, health = 100, temperature = "N/A";
  try {
    const ioreg = exec('ioreg -l -w0 | grep -E "CycleCount|AppleRawMaxCapacity|DesignCapacity|BatteryTemperature"');
    cycleCount = parseInt(ioreg.match(/"CycleCount"\s*=\s*(\d+)/)?.[1] || "0");
    const maxCap = parseInt(ioreg.match(/"AppleRawMaxCapacity"\s*=\s*(\d+)/)?.[1] || "0");
    const designCap = parseInt(ioreg.match(/"DesignCapacity"\s*=\s*(\d+)/)?.[1] || "0");
    health = designCap > 0 ? Math.round((maxCap / designCap) * 100) : 100;
    const tempRaw = parseInt(ioreg.match(/"BatteryTemperature"\s*=\s*(\d+)/)?.[1] || "0");
    temperature = tempRaw > 0 ? (tempRaw / 100).toFixed(1) + "C" : "N/A";
  } catch { /* ioreg may fail on some configs */ }

  return { percent, source, charging, timeRemaining, cycleCount, health, temperature };
}

// ─── GPU ──────────────────────────────────────────────────

export function getGpuInfo() {
  const spDisplay = exec("system_profiler SPDisplaysDataType 2>/dev/null");
  if (!spDisplay) {
    return { name: "Unknown", cores: 0, vram: "N/A", metalSupport: "N/A", utilization: -1 };
  }

  const gpuName = spDisplay.match(/Chipset Model:\s*(.+)/)?.[1]?.trim() || "Unknown";
  const gpuCores = parseInt(spDisplay.match(/Total Number of Cores:\s*(\d+)/)?.[1] || "0");
  const vram = spDisplay.match(/VRAM.*?:\s*(\d+\s*\w+)/)?.[1] || "Shared";
  const metalSupport = spDisplay.match(/Metal.*?:\s*(.+)/)?.[1]?.trim() || "N/A";

  let gpuUtil = -1;
  try {
    const gpuUtilRaw = exec('ioreg -l -w0 | grep -i "PerformanceStatistics" | head -1');
    const utilMatch = gpuUtilRaw.match(/"GPU Activity[^"]*"\s*=\s*(\d+)/i)
      || gpuUtilRaw.match(/"Device Utilization[^"]*"\s*=\s*(\d+)/i);
    if (utilMatch) gpuUtil = parseInt(utilMatch[1]);
  } catch { /* GPU util not available on all Macs */ }

  return { name: gpuName, cores: gpuCores, vram, metalSupport, utilization: gpuUtil };
}

// ─── Processes ────────────────────────────────────────────

export function getProcesses(sortBy: "cpu" | "mem" = "cpu", limit = 30) {
  const flag = sortBy === "cpu" ? "-r" : "-m";
  const output = exec(`ps -A -o pid,pcpu,pmem,rss,comm ${flag} | head -${limit + 1}`);
  if (!output) return [];

  const lines = output.split("\n").slice(1);
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) return null;
    return {
      pid: parseInt(parts[0]),
      cpu: parseFloat(parts[1]) || 0,
      mem: parseFloat(parts[2]) || 0,
      rss: parseInt(parts[3]) || 0,
      command: parts.slice(4).join(" ").split("/").pop() || parts.slice(4).join(" "),
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null && p.pid > 0);
}

export function getProcessDetail(pid: number) {
  const output = exec(`ps -p ${pid} -o pid,ppid,user,pcpu,pmem,rss,vsz,etime,comm 2>/dev/null`);
  if (!output) return null;
  const lines = output.split("\n");
  if (lines.length < 2) return null;
  const parts = lines[1].trim().split(/\s+/);
  if (parts.length < 9) return null;

  const openFiles = parseInt(exec(`lsof -p ${pid} 2>/dev/null | wc -l`).trim()) || 0;

  return {
    pid: parseInt(parts[0]),
    ppid: parseInt(parts[1]),
    user: parts[2],
    cpu: parseFloat(parts[3]) || 0,
    mem: parseFloat(parts[4]) || 0,
    rss: parseInt(parts[5]) || 0,
    vsz: parseInt(parts[6]) || 0,
    elapsed: parts[7],
    command: parts.slice(8).join(" "),
    openFiles,
  };
}

// ─── System ───────────────────────────────────────────────

export function getSystemInfo() {
  return {
    hostname: exec("hostname") || "Mac",
    model: exec("sysctl -n hw.model") || "Unknown",
    os: exec("sw_vers -productVersion") || "macOS",
    kernel: exec("uname -r") || "",
    uptime: exec("uptime").replace(/.*up\s+/, "").replace(/,\s+\d+ users.*/, "").trim() || "N/A",
    chip: exec("sysctl -n machdep.cpu.brand_string") || "Unknown",
  };
}
