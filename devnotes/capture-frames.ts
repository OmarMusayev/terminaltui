/**
 * capture-frames.ts — boots each demo in the headless emulator and dumps
 * real rendered screens as colour-accurate HTML fragments for the website.
 *
 * Run: npx tsx devnotes/capture-frames.ts
 * Out: web/src/data/frames.json  { [demo]: [{ label, cols, rows, html }] }
 */
import { TUIEmulator } from "../src/emulator/index.js";
import type { Cell } from "../src/emulator/types.js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURE_THEME = process.env.TERMINALTUI_CAPTURE_THEME ?? "flintNight";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createRunDir(demo: string): string {
  const dir = join(tmpdir(), `tui-shot-${demo}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const demoDir = join(PROJECT_ROOT, "demos", demo);
  writeFileSync(
    join(dir, "run.ts"),
    `// The emulator falls back to pipes when node-pty is absent, and the runtime
// correctly refuses colour on a non-TTY. Present as a TTY so the capture gets
// the same truecolor output a real terminal would see.
Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
Object.defineProperty(process.stdin,  "isTTY", { value: true, configurable: true });
// A pipe has no setRawMode; the input manager calls it on start.
if (typeof (process.stdin as any).setRawMode !== "function") {
  (process.stdin as any).setRawMode = () => process.stdin;
}
process.stdout.columns = Number(process.env.COLUMNS ?? 100);
process.stdout.rows    = Number(process.env.LINES   ?? 32);
// Dynamic import inside an IIFE: static imports are hoisted above the patch.
(async () => {
  const { default: sourceConfig } = await import("${demoDir}/config.js");
  const { runFileBasedSite } = await import("${PROJECT_ROOT}/src/index.js");
  runFileBasedSite({
    config: { ...sourceConfig, theme: ${JSON.stringify(CAPTURE_THEME)} },
    pagesDir: "${demoDir}/pages",
    outDir: "${demoDir}/.terminaltui",
  });
})();
`,
  );
  return dir;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Collapse a cell grid into run-length-encoded spans. Trailing blank rows dropped. */
function cellsToHtml(grid: Cell[][]): string {
  const rows = [...grid];
  while (rows.length && rows[rows.length - 1].every((c) => c.char === " " || c.char === "")) rows.pop();

  const key = (c: Cell) =>
    `${c.fg ?? ""}|${c.bg ?? ""}|${c.bold ? 1 : 0}${c.dim ? 1 : 0}${c.italic ? 1 : 0}${c.underline ? 1 : 0}${c.inverse ? 1 : 0}`;

  const open = (c: Cell) => {
    let fg = c.fg, bg = c.bg;
    if (c.inverse) { const t = fg; fg = bg ?? "#0b0c0b"; bg = t ?? "#e8e8e0"; }
    const st: string[] = [];
    if (fg) st.push(`color:${fg}`);
    if (bg) st.push(`background:${bg}`);
    if (c.bold) st.push("font-weight:700");
    if (c.dim) st.push("opacity:.6");
    if (c.italic) st.push("font-style:italic");
    if (c.underline) st.push("text-decoration:underline");
    return st.length ? `<span style="${st.join(";")}">` : "<span>";
  };

  return rows
    .map((row) => {
      // trim trailing blanks on the row, keeping background runs intact
      let end = row.length;
      while (end > 0 && (row[end - 1].char === " " || row[end - 1].char === "") && !row[end - 1].bg) end--;
      if (end === 0) return "";
      let out = "";
      let run = "";
      let cur: Cell | null = null;
      for (let i = 0; i < end; i++) {
        const c = row[i];
        if (!cur || key(c) !== key(cur)) {
          if (cur) out += open(cur) + esc(run) + "</span>";
          cur = c;
          run = "";
        }
        run += c.char === "" ? " " : c.char;
      }
      if (cur) out += open(cur) + esc(run) + "</span>";
      return out;
    })
    .join("\n");
}

interface Shot { label: string; cols: number; rows: number; html: string }

/**
 * demo -> frames to capture. `page` uses the emulator's menu-aware navigateTo
 * (matched against the menu label), which is far more reliable than counting
 * arrow presses. Omit `page` to capture the boot/menu screen.
 */
const PLAN: Record<string, { label: string; page?: string }[]> = {
  welcome:                [{ label: "home" }, { label: "showcase", page: "showcase" }, { label: "themes", page: "themes" }],
  "developer-portfolio":  [{ label: "home" }, { label: "projects", page: "projects" }, { label: "experience", page: "experience" }],
  "mac-monitor":          [{ label: "home" }, { label: "cpu", page: "cpu" }],
  dashboard:              [{ label: "home" }, { label: "posts", page: "posts" }],
  "server-dashboard":     [{ label: "home" }],
  restaurant:             [{ label: "home" }, { label: "menu", page: "menu" }],
  startup:                [{ label: "home" }, { label: "pricing", page: "pricing" }, { label: "features", page: "features" }],
  conference:             [{ label: "home" }, { label: "schedule", page: "schedule" }, { label: "speakers", page: "speakers" }],
  // `page` matches the MENU LABEL, which is not always the filename.
  band:                   [{ label: "home" }, { label: "tour", page: "Shows" }, { label: "discography", page: "Discography" }],
  "coffee-shop":          [{ label: "home" }, { label: "menu", page: "menu" }],
  freelancer:             [{ label: "home" }, { label: "work", page: "work" }, { label: "services", page: "services" }],
  cinema:                [{ label: "home" }, { label: "how", page: "How it works" }],
};

const COLS = Number(process.env.COLS ?? 100);
const ROWS = Number(process.env.ROWS ?? 32);

async function capture(demo: string): Promise<Shot[]> {
  const runDir = createRunDir(demo);
  const shots: Shot[] = [];
  let emu: TUIEmulator | null = null;
  try {
    emu = await TUIEmulator.launch({ command: "tsx run.ts", cwd: runDir, cols: COLS, rows: ROWS, timeout: 45000 });
    await emu.waitForBoot({ timeout: 20000 });
    await sleep(1200);

    for (const step of PLAN[demo]) {
      try {
        if (step.page) { await emu.navigateTo(step.page); await sleep(1100); }
        else { await emu.goHome(); await sleep(700); }
      } catch (e) {
        console.error(`\n  ! ${demo}/${step.label}: ${(e as Error).message}`);
        continue;
      }
      shots.push({ label: step.label, cols: COLS, rows: ROWS, html: cellsToHtml(emu.screen.cells()) });
    }
  } catch (e) {
    console.error(`  ! ${demo}: ${(e as Error).message}`);
  } finally {
    try { await emu?.close(); } catch {}
  }
  return shots;
}

const only = process.argv[2];
const demos = only ? [only] : Object.keys(PLAN);
// A single-demo run merges into the existing file rather than clobbering it.
const outPath = join(PROJECT_ROOT, "web/src/data/frames.json");
let out: Record<string, Shot[]> = {};
if (only && existsSync(outPath)) out = JSON.parse(readFileSync(outPath, "utf8"));
for (const d of demos) {
  process.stdout.write(`capturing ${d} ... `);
  out[d] = await capture(d);
  console.log(`${out[d].length} frame(s)`);
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`\nwrote ${outPath}`);
