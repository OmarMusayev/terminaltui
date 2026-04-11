import { EventEmitter } from "node:events";
import type { TerminalIO } from "./terminal-io.js";

export interface KeyPress {
  name: string;
  char: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

export type KeyHandler = (key: KeyPress) => void;

export class InputManager extends EventEmitter {
  private started = false;
  private io: TerminalIO | null = null;

  /** Bind this InputManager to a TerminalIO source. */
  attachIO(io: TerminalIO): void {
    this.io = io;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    if (this.io) {
      this.io.setRawMode(true);
      this.io.onData(this.handleData);
    } else {
      // Legacy fallback: direct process.stdin (should not happen in normal flow)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", this.handleData);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.io) {
      this.io.removeDataListener(this.handleData);
    } else {
      process.stdin.removeListener("data", this.handleData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    }
  }

  private handleData = (data: string): void => {
    for (const key of parseKeys(data)) {
      this.emit("keypress", key);
    }
  };
}

function parseKeys(data: string): KeyPress[] {
  const keys: KeyPress[] = [];

  if (data === "\x1b[A") {
    keys.push(makeKey("up", "", false, false, false, data));
  } else if (data === "\x1b[B") {
    keys.push(makeKey("down", "", false, false, false, data));
  } else if (data === "\x1b[C") {
    keys.push(makeKey("right", "", false, false, false, data));
  } else if (data === "\x1b[D") {
    keys.push(makeKey("left", "", false, false, false, data));
  } else if (data === "\r" || data === "\n") {
    keys.push(makeKey("return", "", false, false, false, data));
  } else if (data === "\x1b") {
    keys.push(makeKey("escape", "", false, false, false, data));
  } else if (data === "\x7f" || data === "\b") {
    keys.push(makeKey("backspace", "", false, false, false, data));
  } else if (data === "\t") {
    keys.push(makeKey("tab", "", false, false, false, data));
  } else if (data === "\x1b[Z") {
    keys.push(makeKey("tab", "", false, false, true, data));
  } else if (data === "\x1b[3~") {
    keys.push(makeKey("delete", "", false, false, false, data));
  } else if (data === "\x1b[H" || data === "\x1b[1~" || data === "\x1bOH") {
    keys.push(makeKey("home", "", false, false, false, data));
  } else if (data === "\x1b[F" || data === "\x1b[4~" || data === "\x1bOF") {
    keys.push(makeKey("end", "", false, false, false, data));
  } else if (data === " ") {
    keys.push(makeKey("space", " ", false, false, false, data));
  } else {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      if (code <= 26 && code > 0) {
        // Ctrl+letter
        const letter = String.fromCharCode(code + 96); // a=1, b=2, etc.
        keys.push(makeKey(letter, ch, true, false, false, ch));
      } else {
        keys.push(makeKey(ch, ch, false, false, false, ch));
      }
    }
  }

  return keys;
}

function makeKey(
  name: string,
  char: string,
  ctrl: boolean,
  meta: boolean,
  shift: boolean,
  sequence: string
): KeyPress {
  return { name, char, ctrl, meta, shift, sequence };
}

// Default singleton for backward compatibility (used when no TerminalIO is injected)
export const input = new InputManager();
