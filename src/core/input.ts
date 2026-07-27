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

/**
 * How long to wait for the rest of a terminator-delimited string sequence
 * (OSC/DCS/APC/PM/SOS) before giving up on it.
 *
 * These are terminal *replies*, not keystrokes — a kitty graphics ack, an
 * XTVERSION name, a clipboard report — and they can be kilobytes arriving
 * across several reads on a slow link. Force-draining one at ESCAPE_TIMEOUT_MS
 * would emit its payload as literal keystrokes, which is the exact bug this
 * handling exists to prevent (a kitty `\x1b_Gi=31;OK\x1b\\` reply typing
 * `_ G i = 3 1 ; O K` into the app, where `q` quits).
 *
 * The window is an ABSOLUTE deadline measured from the moment the partial
 * sequence first entered the buffer, not a silence window. A silence window
 * re-armed on every chunk, so typing normally after a stray ESC + `]` froze the
 * whole UI for as long as the user kept typing — 3.7 s measured at 400 ms
 * between keys, and unbounded below 500 ms. Real keys can only sit in this
 * state behind ESC + one of ] P _ ^ X, and such an Alt-chord still falls back
 * to the legacy bare-ESC drain, just this much later.
 */
const STRING_SEQUENCE_TIMEOUT_MS = 500;

/**
 * Ceiling on a buffered, still-unterminated string sequence. Guards against a
 * terminal that opens OSC/DCS and never closes it: without it every later
 * keystroke would be appended to the pending sequence forever and the input
 * manager would go deaf. Well past any real reply (kitty acks are ~20 bytes).
 */
const STRING_SEQUENCE_MAX_BYTES = 64 * 1024;

export class InputManager extends EventEmitter {
  private started = false;
  private io: TerminalIO | null = null;
  private buffer = "";
  private escapeTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * When the buffer first became a partial string sequence, so the hold below
   * is a deadline rather than a silence window. Null whenever the head of the
   * buffer is not a partial string sequence.
   */
  private stringSequenceSince: number | null = null;

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
    this.stringSequenceSince = null;

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

    // Track when the head of the buffer BECAME a partial string sequence, so
    // the grace period below counts from then and not from the last keystroke.
    const partialString = this.buffer.length > 0 && isPartialStringSequence(this.buffer);
    if (!partialString) this.stringSequenceSince = null;
    else if (this.stringSequenceSince === null) this.stringSequenceSince = Date.now();

    if (this.buffer.length > 0 && !this.escapeTimer) {
      // A half-arrived terminal reply gets a much longer grace period than a
      // half-arrived key chord — see STRING_SEQUENCE_TIMEOUT_MS. The remaining
      // time can be zero, in which case the drain lands on the next tick.
      const wait = partialString
        ? Math.max(0, STRING_SEQUENCE_TIMEOUT_MS - (Date.now() - (this.stringSequenceSince ?? 0)))
        : ESCAPE_TIMEOUT_MS;
      this.escapeTimer = setTimeout(() => {
        this.escapeTimer = null;
        this.drainBuffer(true);
      }, wait);
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

/**
 * Introducers of the terminator-delimited "string" families: OSC (ESC ]),
 * DCS (ESC P), APC (ESC _), PM (ESC ^), SOS (ESC X). Terminals volunteer
 * these unsolicited — kitty graphics acks, XTVERSION, XTGETTCAP, clipboard
 * and colour reports — and every byte of one has to be swallowed rather than
 * dispatched as a keystroke.
 */
const STRING_INTRODUCERS = "]P_^X";

/** True while buf holds the start of a string sequence with no terminator yet. */
function isPartialStringSequence(buf: string): boolean {
  return buf.length >= 2 && buf[0] === "\x1b" && STRING_INTRODUCERS.includes(buf[1]);
}

/**
 * Outcome of scanning a string sequence at the head of the buffer.
 *
 * The distinction between "terminated" and "abandoned" is load-bearing:
 * dropping bytes is only sound once a real terminator has been seen. An ESC
 * that is not ST means the run was never a reply at all — it was an Alt-chord
 * followed by a real key — and dropping it ate BOTH keystrokes.
 */
type StringSequenceScan =
  /** A terminator arrived; `end` is one past it and the whole run is a reply. */
  | { kind: "terminated"; end: number }
  /** A non-ST ESC arrived, so this was never a reply. Do not swallow it. */
  | { kind: "abandoned" }
  /** No terminator yet; more bytes may still be in flight. */
  | { kind: "pending" };

/**
 * Scan the string sequence starting at buf[0].
 *
 * All five families end at ST (ESC \); OSC additionally accepts BEL.
 */
function scanStringSequence(buf: string, allowBel: boolean): StringSequenceScan {
  for (let i = 2; i < buf.length; i++) {
    const ch = buf[i];
    if (allowBel && ch === "\x07") return { kind: "terminated", end: i + 1 };
    if (ch === "\x1b") {
      // The "\\" of ST may still be in flight, so an ESC at the very end is
      // not yet evidence either way.
      if (i + 1 >= buf.length) return { kind: "pending" };
      return buf[i + 1] === "\\"
        ? { kind: "terminated", end: i + 2 }
        : { kind: "abandoned" };
    }
  }
  return { kind: "pending" };
}

type SequenceMatch = { length: number; key: KeyPress | null } | "partial" | null;

/**
 * Match an escape sequence at the start of buf. Returns "partial" if buf is a
 * prefix of a possible sequence, a match (key=null for unknown sequences and
 * for terminal replies, which are dropped rather than leaked as literal
 * characters), or null if the ESC cannot start a sequence.
 *
 * Handles CSI (ESC [), SS3 (ESC O) and the string families listed in
 * STRING_INTRODUCERS.
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

  if (STRING_INTRODUCERS.includes(next)) {
    const scan = scanStringSequence(buf, next === "]");
    // Same drop-it pattern as an unknown CSI: drainBuffer's `if (match.key)`
    // consumes the bytes and emits nothing.
    if (scan.kind === "terminated") return { length: scan.end, key: null };
    // Never terminated, so it was an Alt-chord and not a reply. Falling through
    // to null makes drainBuffer emit `escape` and consume one byte, after which
    // the introducer re-parses as the literal character the user typed.
    if (scan.kind === "abandoned") return null;
    // Nothing that long without a terminator can still be a reply; drop it
    // wholesale rather than let the buffer grow without bound.
    if (buf.length > STRING_SEQUENCE_MAX_BYTES) return { length: buf.length, key: null };
    return "partial";
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
