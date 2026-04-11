import { EventEmitter } from "node:events";
import type { TerminalIO } from "./terminal-io.js";

export interface ScreenSize {
  columns: number;
  rows: number;
}

// Use globalThis to ensure singleton across esbuild re-bundles
const SCREEN_KEY = "__terminaltui_screen__";

export class Screen extends EventEmitter {
  private _size: ScreenSize;
  private io: TerminalIO | null = null;

  constructor() {
    super();
    this._size = this.measure();
  }

  get size(): ScreenSize {
    return this._size;
  }

  get columns(): number {
    return this._size.columns;
  }

  get rows(): number {
    return this._size.rows;
  }

  /** Bind this Screen to a TerminalIO source for dimensions and resize events. */
  attachIO(io: TerminalIO): void {
    this.io = io;
    this._size = this.measure();
    io.onResize((cols, rows) => {
      this._size = { columns: cols, rows };
      this.emit("resize", this._size);
    });
  }

  /** Attach resize listeners using process.stdout (legacy path). Only call once. */
  attachListeners(): void {
    const onResize = () => {
      this._size = this.measure();
      this.emit("resize", this._size);
    };
    process.stdout.on("resize", onResize);
    if (typeof process.on === "function") {
      process.on("SIGWINCH", onResize);
    }
  }

  private measure(): ScreenSize {
    if (this.io) {
      return {
        columns: this.io.columns || 80,
        rows: this.io.rows || 24,
      };
    }
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }
}

// Singleton: reuse across esbuild re-evaluations
let screenInstance: Screen;
if ((globalThis as any)[SCREEN_KEY]) {
  screenInstance = (globalThis as any)[SCREEN_KEY];
} else {
  screenInstance = new Screen();
  screenInstance.attachListeners();
  (globalThis as any)[SCREEN_KEY] = screenInstance;
}

export const screen = screenInstance;
export function getScreenSize(): ScreenSize {
  return screen.size;
}
