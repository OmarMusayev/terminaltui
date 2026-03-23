import { EventEmitter } from "node:events";

export interface KeyPress {
  name: string;
  char: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

export type KeyHandler = (key: KeyPress) => void;

class InputManager extends EventEmitter {
  private started = false;
  private rawModeWas: boolean | undefined;

  start(): void {
    if (this.started) return;
    this.started = true;

    if (process.stdin.isTTY) {
      this.rawModeWas = process.stdin.isRaw;
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", this.handleData);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    process.stdin.removeListener("data", this.handleData);
    if (process.stdin.isTTY && this.rawModeWas !== undefined) {
      process.stdin.setRawMode(this.rawModeWas);
    }
    process.stdin.pause();
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

export const input = new InputManager();
