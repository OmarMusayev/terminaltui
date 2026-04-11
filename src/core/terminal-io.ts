/**
 * TerminalIO — abstraction over terminal I/O streams.
 * Allows the TUI runtime to target process.stdin/stdout (local dev)
 * or an SSH channel (remote serve).
 */

export interface TerminalIO {
  /** Write output data to the terminal. */
  write(data: string): void;
  /** Current terminal width in columns. */
  columns: number;
  /** Current terminal height in rows. */
  rows: number;
  /** Register a callback for terminal resize events. */
  onResize(cb: (cols: number, rows: number) => void): void;
  /** Register a callback for incoming data (keystrokes). */
  onData(cb: (data: string) => void): void;
  /** Remove a previously registered data listener. */
  removeDataListener(cb: (data: string) => void): void;
  /** Enable raw mode for keystroke capture (no-op if not applicable). */
  setRawMode(enabled: boolean): void;
  /** The TERM type reported by the client (e.g. "xterm-256color", "xterm-kitty"). */
  termType?: string;
  /** Clean up resources. */
  dispose(): void;
}

/**
 * ProcessTerminalIO — wraps process.stdin/stdout for local terminal use.
 * This preserves the existing behavior of the `dev` command.
 */
export class ProcessTerminalIO implements TerminalIO {
  private rawModeWas: boolean | undefined;
  private resizeHandler: (() => void) | null = null;
  private resizeCallbacks: Array<(cols: number, rows: number) => void> = [];

  get columns(): number {
    return process.stdout.columns || 80;
  }

  get rows(): number {
    return process.stdout.rows || 24;
  }

  write(data: string): void {
    process.stdout.write(data);
  }

  onResize(cb: (cols: number, rows: number) => void): void {
    this.resizeCallbacks.push(cb);
    if (!this.resizeHandler) {
      this.resizeHandler = () => {
        const cols = this.columns;
        const rows = this.rows;
        for (const fn of this.resizeCallbacks) fn(cols, rows);
      };
      process.stdout.on("resize", this.resizeHandler);
      if (typeof process.on === "function") {
        process.on("SIGWINCH", this.resizeHandler);
      }
    }
  }

  onData(cb: (data: string) => void): void {
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", cb);
  }

  removeDataListener(cb: (data: string) => void): void {
    process.stdin.removeListener("data", cb);
  }

  setRawMode(enabled: boolean): void {
    if (process.stdin.isTTY) {
      if (this.rawModeWas === undefined) {
        this.rawModeWas = process.stdin.isRaw;
      }
      process.stdin.setRawMode(enabled);
    }
  }

  dispose(): void {
    if (process.stdin.isTTY && this.rawModeWas !== undefined) {
      process.stdin.setRawMode(this.rawModeWas);
    }
    process.stdin.pause();
    if (this.resizeHandler) {
      process.stdout.removeListener("resize", this.resizeHandler);
      if (typeof process.removeListener === "function") {
        process.removeListener("SIGWINCH", this.resizeHandler);
      }
    }
    this.resizeCallbacks = [];
  }
}
