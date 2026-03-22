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

  // Color depth detection
  // NO_COLOR standard: https://no-color.org/
  // Apple Terminal claims 256color but has broken truecolor rendering
  let colorDepth: TerminalCapabilities["colorDepth"] = "none";
  if (env.NO_COLOR !== undefined) {
    colorDepth = "none";
  } else if (isTTY) {
    if (isAppleTerminal) {
      // Apple Terminal: force 256-color mode — its truecolor is buggy
      colorDepth = "256";
    } else if (
      env.COLORTERM === "truecolor" ||
      env.COLORTERM === "24bit" ||
      termProgram === "iTerm.app" ||
      termProgram === "Hyper" ||
      termProgram === "WezTerm" ||
      termProgram === "WarpTerminal" ||
      env.WT_SESSION !== undefined || // Windows Terminal
      env.TERM?.includes("24bit") ||
      env.TERM?.includes("truecolor")
    ) {
      colorDepth = "truecolor";
    } else if (env.TERM?.includes("256color")) {
      colorDepth = "256";
    } else if (isTTY) {
      colorDepth = "16";
    }
  }

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
