/**
 * PTY manager — spawns process with pseudo-terminal.
 *
 * Tries node-pty first (full PTY support), falls back to child_process.spawn.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { LaunchOptions } from "./types.js";

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
    ...(options.env ?? {}),
  };

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
      // child_process doesn't support resize natively
      // Send SIGWINCH if we can — but just update env for future use
    },
    kill() {
      if (running) {
        running = false;
        proc.kill("SIGTERM");
        setTimeout(() => {
          try { proc.kill("SIGKILL"); } catch {}
        }, 1000);
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
