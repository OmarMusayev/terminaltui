import { detectColorSupport } from "../style/colors.js";

export interface TerminalCapabilities {
  colorDepth: "truecolor" | "256" | "16" | "none";
  unicode: boolean;
  columns: number;
  rows: number;
  isTTY: boolean;
  terminalName: string;
  isAppleTerminal: boolean;
}

export function detectTerminal(): TerminalCapabilities {
  const isTTY = !!process.stdout.isTTY;
  const env = process.env;

  // Terminal program detection
  const termProgram = env.TERM_PROGRAM ?? "";
  const isAppleTerminal = termProgram === "Apple_Terminal";
  const terminalName = termProgram || env.TERM || "unknown";

  // Color depth: delegate to the canonical env sniffer in style/colors.ts
  // (single source of truth for NO_COLOR / TERM_PROGRAM / COLORTERM / TERM —
  // including the Apple Terminal 256-color cap; its truecolor is buggy).
  // Non-TTY output gets no color regardless of what the env advertises.
  // TTY floor: an interactive TTY with no env signals at all (TERM unset —
  // e.g. Windows conhost, or a PTY with a stripped environment) still gets
  // 16-color output; only an explicit NO_COLOR may force "none" on a TTY.
  const detected = detectColorSupport();
  const colorDepth: TerminalCapabilities["colorDepth"] = !isTTY
    ? "none"
    : detected === "none" && env.NO_COLOR === undefined
      ? "16"
      : detected;

  // Unicode support detection
  const unicode =
    env.LANG?.includes("UTF-8") ||
    env.LANG?.includes("utf8") ||
    env.LC_ALL?.includes("UTF-8") ||
    termProgram === "iTerm.app" ||
    termProgram === "WezTerm" ||
    env.WT_SESSION !== undefined ||
    process.platform === "darwin";

  return {
    colorDepth,
    unicode: !!unicode,
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    isTTY,
    terminalName,
    isAppleTerminal,
  };
}
