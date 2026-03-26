import { EventEmitter } from "node:events";

export interface ScreenSize {
  columns: number;
  rows: number;
}

class Screen extends EventEmitter {
  private _size: ScreenSize;

  constructor() {
    super();
    this._size = this.measure();
    process.stdout.on("resize", () => {
      this._size = this.measure();
      this.emit("resize", this._size);
    });
    // Also listen for SIGWINCH directly — handles non-TTY environments
    // where process.stdout doesn't emit 'resize'
    if (typeof process.on === "function") {
      process.on("SIGWINCH", () => {
        this._size = this.measure();
        this.emit("resize", this._size);
      });
    }
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

  private measure(): ScreenSize {
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }
}

export const screen = new Screen();
export function getScreenSize(): ScreenSize {
  return screen.size;
}
