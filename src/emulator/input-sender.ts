/**
 * Input sender — maps key names to terminal escape codes.
 */

export type KeyName =
  | "up" | "down" | "left" | "right"
  | "enter" | "return" | "escape" | "backspace" | "tab"
  | "space" | "delete" | "home" | "end"
  | "pageup" | "pagedown"
  | "f1" | "f2" | "f3" | "f4" | "f5" | "f6"
  | "f7" | "f8" | "f9" | "f10" | "f11" | "f12"
  | string;  // single char or "ctrl+x" combos

const KEY_MAP: Record<string, string> = {
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  enter: "\r",
  return: "\r",
  escape: "\x1b",
  backspace: "\x7f",
  tab: "\t",
  space: " ",
  delete: "\x1b[3~",
  home: "\x1b[H",
  end: "\x1b[F",
  pageup: "\x1b[5~",
  pagedown: "\x1b[6~",
  f1: "\x1bOP",
  f2: "\x1bOQ",
  f3: "\x1bOR",
  f4: "\x1bOS",
  f5: "\x1b[15~",
  f6: "\x1b[17~",
  f7: "\x1b[18~",
  f8: "\x1b[19~",
  f9: "\x1b[20~",
  f10: "\x1b[21~",
  f11: "\x1b[23~",
  f12: "\x1b[24~",
};

/**
 * Resolve a key name to its escape sequence.
 *
 * Supports:
 * - Named keys: "up", "down", "enter", "escape", etc.
 * - Modifier combos: "ctrl+c", "ctrl+d", "ctrl+l"
 * - Single characters: "q", "a", "1", ":"
 */
export function resolveKey(key: string): string {
  // Lowercase for lookup
  const lower = key.toLowerCase();

  // Check direct map first
  if (KEY_MAP[lower]) return KEY_MAP[lower];

  // ctrl+X combos
  if (lower.startsWith("ctrl+")) {
    const letter = lower.slice(5);
    if (letter.length === 1) {
      const code = letter.charCodeAt(0) - 96; // a=1, b=2, ..., z=26
      if (code >= 1 && code <= 26) {
        return String.fromCharCode(code);
      }
    }
    // Special: ctrl+[ = escape
    if (letter === "[") return "\x1b";
    // ctrl+? = DEL
    if (letter === "?") return "\x7f";
  }

  // Single character
  if (key.length === 1) return key;

  // Unknown — return as-is
  return key;
}

export class InputSender {
  private writeFn: (data: string) => void;

  constructor(writeFn: (data: string) => void) {
    this.writeFn = writeFn;
  }

  /** Send a single key. */
  send(key: string): void {
    this.writeFn(resolveKey(key));
  }

  /** Send a key multiple times. */
  sendTimes(key: string, times: number): void {
    const seq = resolveKey(key);
    for (let i = 0; i < times; i++) {
      this.writeFn(seq);
    }
  }

  /** Send a sequence of keys. */
  sendSequence(keys: string[]): void {
    for (const key of keys) {
      this.writeFn(resolveKey(key));
    }
  }

  /** Type a string character by character. */
  typeString(str: string): void {
    for (const ch of str) {
      this.writeFn(ch);
    }
  }
}
