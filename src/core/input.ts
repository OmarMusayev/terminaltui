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

/**
 * How long to wait for the rest of an escape sequence before treating a
 * lone ESC as the escape key. Terminal input is a byte stream with no chunk
 * boundaries — "\x1b" + "[A" can arrive as two reads (SSH latency), and
 * "\x1b[A\x1b[A" as one (fast keys, paste).
 */
const ESCAPE_TIMEOUT_MS = 50;

export class InputManager extends EventEmitter {
  private started = false;
  private io: TerminalIO | null = null;
  private buffer = "";
  private escapeTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
    this.buffer = "";

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
    // New data resolves any pending "is this a bare ESC?" question.
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
    this.buffer += data;
    this.drainBuffer(false);
  };

  /**
   * Consume complete keys from the front of the buffer. A trailing partial
   * escape sequence is held until more data arrives or the escape timeout
   * fires (flushPartialEscape=true), at which point the ESC is emitted alone.
   */
  private drainBuffer(flushPartialEscape: boolean): void {
    const keys: KeyPress[] = [];
    let buf = this.buffer;

    while (buf.length > 0) {
      if (buf[0] === "\x1b") {
        const match = matchEscapeSequence(buf);
        if (match === "partial") {
          if (!flushPartialEscape) break; // wait for the rest of the sequence
          keys.push(makeKey("escape", "", false, false, false, "\x1b"));
          buf = buf.slice(1);
          continue;
        }
        if (match) {
          if (match.key) keys.push(match.key);
          buf = buf.slice(match.length);
          continue;
        }
        // ESC followed by something that can't start a sequence
        keys.push(makeKey("escape", "", false, false, false, "\x1b"));
        buf = buf.slice(1);
        continue;
      }

      // Plain input: consume one full code point (never split surrogate pairs)
      const cp = buf.codePointAt(0)!;
      if (cp >= 0xd800 && cp <= 0xdbff && buf.length === 1) {
        // Trailing high surrogate: wait for its low half; drop it on timeout
        // rather than emit a malformed char.
        if (!flushPartialEscape) break;
        buf = "";
        break;
      }
      const ch = String.fromCodePoint(cp);
      keys.push(parseChar(ch));
      buf = buf.slice(ch.length);
    }

    this.buffer = buf;
    if (this.buffer.length > 0 && !this.escapeTimer) {
      this.escapeTimer = setTimeout(() => {
        this.escapeTimer = null;
        this.drainBuffer(true);
      }, ESCAPE_TIMEOUT_MS);
      this.escapeTimer.unref?.();
    }

    for (const key of keys) {
      // In-band resize (xterm window-op format: CSI 8 ; rows ; cols t).
      // Sent by hosts that can't deliver SIGWINCH with real dimensions —
      // e.g. the emulator's non-PTY fallback where stdin is a pipe.
      if (key.name === "resize") {
        const m = /^\x1b\[8;(\d+);(\d+)t$/.exec(key.sequence);
        if (m) this.emit("resize", { rows: Number(m[1]), columns: Number(m[2]) });
        continue;
      }
      this.emit("keypress", key);
    }
  }
}

/** Known complete escape sequences → key descriptors. */
const SEQUENCE_KEYS: Record<string, { name: string; shift?: boolean }> = {
  "\x1b[A": { name: "up" },
  "\x1b[B": { name: "down" },
  "\x1b[C": { name: "right" },
  "\x1b[D": { name: "left" },
  // SS3 variants (application cursor mode)
  "\x1bOA": { name: "up" },
  "\x1bOB": { name: "down" },
  "\x1bOC": { name: "right" },
  "\x1bOD": { name: "left" },
  "\x1b[Z": { name: "tab", shift: true },
  "\x1b[3~": { name: "delete" },
  "\x1b[H": { name: "home" },
  "\x1b[1~": { name: "home" },
  "\x1bOH": { name: "home" },
  "\x1b[F": { name: "end" },
  "\x1b[4~": { name: "end" },
  "\x1bOF": { name: "end" },
};

// CSI: ESC [ , parameter bytes 0x30-0x3F, intermediate bytes 0x20-0x2F, final byte 0x40-0x7E
const CSI_COMPLETE = /^\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/;
const CSI_PARTIAL = /^\x1b\[[\x30-\x3f]*[\x20-\x2f]*$/;

type SequenceMatch = { length: number; key: KeyPress | null } | "partial" | null;

/**
 * Match an escape sequence at the start of buf. Returns "partial" if buf is a
 * prefix of a possible sequence, a match (key=null for unknown sequences,
 * which are dropped rather than leaked as literal characters), or null if the
 * ESC cannot start a sequence.
 */
function matchEscapeSequence(buf: string): SequenceMatch {
  if (buf.length === 1) return "partial";
  const next = buf[1];

  if (next === "[") {
    const m = CSI_COMPLETE.exec(buf);
    if (m) {
      const seq = m[0];
      // In-band resize report (CSI 8 ; rows ; cols t) — surfaced as a
      // pseudo-key so drainBuffer can emit a "resize" event instead.
      if (/^\x1b\[8;\d+;\d+t$/.test(seq)) {
        return { length: seq.length, key: makeKey("resize", "", false, false, false, seq) };
      }
      const known = SEQUENCE_KEYS[seq];
      return {
        length: seq.length,
        key: known ? makeKey(known.name, "", false, false, known.shift ?? false, seq) : null,
      };
    }
    return CSI_PARTIAL.test(buf) ? "partial" : null;
  }

  if (next === "O") {
    if (buf.length === 2) return "partial";
    const seq = buf.slice(0, 3);
    const known = SEQUENCE_KEYS[seq];
    return {
      length: seq.length,
      key: known ? makeKey(known.name, "", false, false, false, seq) : null,
    };
  }

  return null;
}

/** Map a single code point of plain input to a KeyPress. */
function parseChar(ch: string): KeyPress {
  if (ch === "\r" || ch === "\n") return makeKey("return", "", false, false, false, ch);
  if (ch === "\t") return makeKey("tab", "", false, false, false, ch);
  if (ch === "\x7f" || ch === "\b") return makeKey("backspace", "", false, false, false, ch);
  if (ch === " ") return makeKey("space", " ", false, false, false, ch);

  const code = ch.charCodeAt(0);
  if (code <= 26 && code > 0) {
    // Ctrl+letter
    const letter = String.fromCharCode(code + 96); // a=1, b=2, etc.
    return makeKey(letter, ch, true, false, false, ch);
  }
  return makeKey(ch, ch, false, false, false, ch);
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
