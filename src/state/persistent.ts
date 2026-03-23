import { createState, setRenderCallback, getRenderCallback } from "./reactive.js";
import type { StateContainer, PersistentStateOptions } from "./types.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function createPersistentState<T extends Record<string, any>>(
  options: PersistentStateOptions<T>,
): StateContainer<T> {
  // Load from disk or use defaults
  let initial: T = { ...options.defaults };
  try {
    if (existsSync(options.path)) {
      const raw = readFileSync(options.path, "utf-8");
      const loaded = JSON.parse(raw);
      // Merge loaded with defaults (defaults fill in missing keys)
      initial = { ...options.defaults, ...loaded };
    }
  } catch {
    // File doesn't exist or is corrupt — use defaults
  }

  const state = createState(initial);

  // Debounced write to disk
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite = false;

  function writeToDisk(): void {
    try {
      const dir = dirname(options.path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const data = state.get();
      const json = JSON.stringify(data, null, 2);
      writeFileSync(options.path, json, "utf-8");
    } catch {
      // Silently fail on write errors
    }
    pendingWrite = false;
  }

  function scheduleWrite(): void {
    if (pendingWrite) return;
    pendingWrite = true;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(writeToDisk, 500);
  }

  // Subscribe to all changes and write to disk
  state.on("*", () => {
    scheduleWrite();
  });

  // Flush on process exit
  const flushOnExit = () => {
    if (pendingWrite) {
      if (writeTimer) clearTimeout(writeTimer);
      writeToDisk();
    }
  };
  process.on("exit", flushOnExit);
  process.on("SIGINT", flushOnExit);
  process.on("SIGTERM", flushOnExit);

  return state;
}
