/**
 * PTY manager — spawns process with pseudo-terminal.
 *
 * Tries node-pty first (full PTY support), falls back to child_process.spawn.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LaunchOptions } from "./types.js";

/**
 * node_modules/.bin dirs of the host project (emulator caller's cwd and this
 * package's own tree). Prepended to the child's PATH so commands like
 * `npx tsx app.ts` resolve local binaries instantly even when cwd is a bare
 * temp dir — otherwise npx hits the registry on a cold cache (CI runners)
 * and its download output pollutes the boot screen.
 */
function localBinPaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url)); // src/emulator or dist/emulator
  const candidates = [
    resolve(process.cwd(), "node_modules", ".bin"),
    resolve(here, "..", "..", "node_modules", ".bin"),
    resolve(here, "..", "..", "..", ".bin"),
  ];
  return candidates.filter((dir, i) => existsSync(dir) && candidates.indexOf(dir) === i);
}

export interface PTYProcess {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(handler: (data: string) => void): void;
  onExit(handler: (code: number | null) => void): void;
  readonly pid: number | null;
  readonly isRunning: boolean;
  /** True if this PTY translates LF to CR+LF (ONLCR). node-pty does this. */
  readonly hasOnlcr: boolean;
}

/**
 * Spawn a PTY process.
 * Tries node-pty for full terminal emulation, falls back to child_process.
 */
export async function spawnPTY(options: LaunchOptions): Promise<PTYProcess> {
  // Parse command into executable and arguments
  const parts = options.command.split(/\s+/);
  const cmd = parts[0];
  const args = [...parts.slice(1), ...(options.args ?? [])];
  const cols = options.cols ?? 80;
  const rows = options.rows ?? 24;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "1",
    // Pixels are off by default inside the emulator, for two reasons that both
    // make suites machine-dependent otherwise. (a) TERM is rewritten above but
    // KITTY_WINDOW_ID is inherited, so a contributor running the suite from
    // kitty or Ghostty would have the app under test negotiate the pixel tier
    // and every cell assertion would fail on their machine only. (b) With
    // node-pty installed the child's stdio IS a TTY and xterm-256color is
    // ambiguous, so the runtime would probe and wait out the full 300 ms
    // deadline at every app launch — the emulator's vterm never answers DA1.
    // Listed before options.env so a graphics test can still opt back in.
    TERMINALTUI_GRAPHICS: "off",
    ...(options.env ?? {}),
  };
  const bins = localBinPaths();
  if (bins.length > 0) {
    // Windows spells it "Path" — writing a second "PATH" key breaks child
    // command resolution there, so extend whichever key already exists.
    const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
    env[pathKey] = [...bins, env[pathKey] ?? ""].join(delimiter);
  }

  // Try node-pty first
  try {
    // Dynamic import — node-pty is an optional peer dependency
    const pty = await import(/* webpackIgnore: true */ "node-pty" as string);
    return createNodePTY(pty, cmd, args, cols, rows, options.cwd, env);
  } catch {
    // node-pty not available, fall back
  }

  // Fallback: child_process with piped stdio
  return createChildProcess(cmd, args, cols, rows, options.cwd, env);
}

function createNodePTY(
  pty: any,
  cmd: string,
  args: string[],
  cols: number,
  rows: number,
  cwd: string | undefined,
  env: Record<string, string>,
): PTYProcess {
  const proc = pty.spawn(cmd, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd: cwd ?? process.cwd(),
    env,
  });

  let running = true;
  let exitCode: number | null = null;
  const dataHandlers: ((data: string) => void)[] = [];
  const exitHandlers: ((code: number | null) => void)[] = [];

  proc.onData((data: string) => {
    for (const h of dataHandlers) h(data);
  });

  proc.onExit(({ exitCode: code }: { exitCode: number }) => {
    running = false;
    exitCode = code;
    for (const h of exitHandlers) h(code);
  });

  return {
    write(data: string) {
      if (running) proc.write(data);
    },
    resize(c: number, r: number) {
      if (running) proc.resize(c, r);
    },
    kill() {
      if (running) {
        running = false;
        proc.kill();
      }
    },
    onData(handler: (data: string) => void) {
      dataHandlers.push(handler);
    },
    onExit(handler: (code: number | null) => void) {
      if (!running) {
        handler(exitCode);
      } else {
        exitHandlers.push(handler);
      }
    },
    get pid() { return proc.pid; },
    get isRunning() { return running; },
    get hasOnlcr() { return false; },  // node-pty PTY slave handles ONLCR in the kernel
  };
}

function createChildProcess(
  cmd: string,
  args: string[],
  cols: number,
  rows: number,
  cwd: string | undefined,
  env: Record<string, string>,
): PTYProcess {
  // Resolve command — if it's "npx", "node", etc. use shell
  const proc: ChildProcess = spawn(cmd, args, {
    cwd: cwd ?? process.cwd(),
    env: { ...env, COLUMNS: String(cols), LINES: String(rows) },
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
    // Own process group (POSIX), so kill() can signal the whole tree:
    // `npx tsx app.ts` is shell -> npx -> tsx -> node, and signalling only
    // the direct child orphans the app alive with our pipes held open.
    detached: process.platform !== "win32",
  });

  let running = true;
  let exitCode: number | null = null;
  const dataHandlers: ((data: string) => void)[] = [];
  const exitHandlers: ((code: number | null) => void)[] = [];

  proc.stdout?.setEncoding("utf-8");
  proc.stderr?.setEncoding("utf-8");

  proc.stdout?.on("data", (data: string) => {
    for (const h of dataHandlers) h(data);
  });

  proc.stderr?.on("data", (data: string) => {
    for (const h of dataHandlers) h(data);
  });

  proc.on("exit", (code) => {
    running = false;
    exitCode = code;
    for (const h of exitHandlers) h(code);
  });

  proc.on("error", () => {
    running = false;
    for (const h of exitHandlers) h(1);
  });

  return {
    write(data: string) {
      if (running && proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write(data);
      }
    },
    resize(c: number, r: number) {
      // child_process doesn't have a real PTY, so SIGWINCH can't carry new
      // dimensions (the child would re-read the stale COLUMNS/LINES env).
      // Send an in-band resize report instead (xterm window-op format:
      // CSI 8 ; rows ; cols t) which the framework's input layer understands.
      if (running && proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write(`\x1b[8;${r};${c}t`);
      }
    },
    kill() {
      if (running) {
        running = false;
        const signalTree = (sig: NodeJS.Signals) => {
          if (process.platform !== "win32" && proc.pid) {
            // Negative pid = whole process group (see detached in spawn).
            try { process.kill(-proc.pid, sig); return; } catch { /* group gone; fall through */ }
          }
          try { proc.kill(sig); } catch { /* already dead */ }
        };
        if (process.platform === "win32" && proc.pid) {
          // /T kills the tree; plain kill() would orphan the app under the shell.
          spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          signalTree("SIGTERM");
        }
        const killTimer = setTimeout(() => {
          signalTree("SIGKILL");
          // Orphans hold our pipe ends open and pin the parent's event loop.
          proc.stdout?.destroy();
          proc.stderr?.destroy();
          proc.stdin?.destroy();
        }, 1000);
        killTimer.unref();
      }
    },
    onData(handler: (data: string) => void) {
      dataHandlers.push(handler);
    },
    onExit(handler: (code: number | null) => void) {
      if (!running) {
        handler(exitCode);
      } else {
        exitHandlers.push(handler);
      }
    },
    get pid() { return proc.pid ?? null; },
    get isRunning() { return running; },
    get hasOnlcr() { return true; },  // shell: true in spawn sets ONLCR
  };
}
