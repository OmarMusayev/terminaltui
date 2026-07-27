import { detectColorSupport } from "../style/colors.js";
import { detectGraphics, getGraphicsCapability } from "../image/capability.js";
import type { GraphicsCapability } from "../image/capability.js";

export interface TerminalCapabilities {
  colorDepth: "truecolor" | "256" | "16" | "none";
  unicode: boolean;
  columns: number;
  rows: number;
  isTTY: boolean;
  terminalName: string;
  isAppleTerminal: boolean;
  /**
   * Raw `TERM` (or the client's pty-req TERM when one is supplied), lowercased
   * and trimmed. Exposed so callers stop re-reading `process.env.TERM` with
   * slightly different normalisation each time.
   */
  term: string;
  /**
   * Inside tmux or GNU screen. The multiplexer cannot be interrogated from the
   * inside, so this is the flag that pushes the image engine onto the tier that
   * asks least of the far end (see image/tier.ts `conservative`).
   */
  isMultiplexed: boolean;
  /**
   * Which image path this terminal gets: real pixels via the kitty graphics
   * protocol, or cells. See image/capability.ts — `source` and `reason` explain
   * how the verdict was reached, for a debug command or a bug report.
   *
   * With no `termType` this is the capability the runtime published for the
   * current session (post-probe if one ran), falling back to a local
   * environment read. In a serve session that local read resolves to "denied"
   * — the server's stdio is not a TTY — so the failure direction is cells, never
   * escape bytes aimed at the wrong terminal.
   */
  graphics: GraphicsCapability;
}

/** Detection inputs. Every existing caller passes nothing and is unaffected. */
export interface DetectTerminalOptions {
  /**
   * The client's `TERM` from an SSH pty-req. Pass it for a serve session:
   * without it, terminal identity is read from the SERVER's environment, which
   * describes whatever shell launched the daemon rather than the user's
   * terminal. `columns`/`rows`/`isTTY` still describe the local process.
   */
  termType?: string;
}

/**
 * Sniff what the terminal on the other end can do.
 *
 * @param opts Pass `termType` for a remote (serve) session.
 */
export function detectTerminal(opts?: DetectTerminalOptions): TerminalCapabilities {
  const isTTY = !!process.stdout.isTTY;
  const env = process.env;

  // Terminal program detection
  const termProgram = env.TERM_PROGRAM ?? "";
  const isAppleTerminal = termProgram === "Apple_Terminal";
  const remote = opts?.termType !== undefined;
  const term = (remote ? opts!.termType! : env.TERM ?? "").toLowerCase().trim();
  const terminalName = (remote ? opts!.termType! : termProgram || env.TERM) || "unknown";

  // Color depth: delegate to the canonical env sniffer in style/colors.ts
  // (single source of truth for NO_COLOR / TERMINALTUI_COLOR / TERM_PROGRAM /
  // COLORTERM / TERM — including Apple Terminal, whose depth is sniffed from
  // its build number because it never sets COLORTERM).
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

  // Multiplexer: TERM is rewritten by tmux/screen themselves, and the env
  // markers catch the case where a user has rewritten TERM back.
  const isMultiplexed =
    term.startsWith("screen") ||
    term.startsWith("tmux") ||
    (!remote && (env.TMUX !== undefined || env.STY !== undefined));

  // Unicode support detection.
  //
  // Every clause is an OR, and clauses are only ever ADDED: this predicate
  // gates image/tier.ts's drop from quadrants to the solid-block tier, so a
  // false negative visibly halves image resolution while a false positive only
  // matters on a terminal whose font lacks block elements. Locale is checked
  // across all three POSIX variables rather than in strict LC_ALL > LC_CTYPE >
  // LANG precedence order, deliberately: `LC_ALL=C` with `LANG=en_US.UTF-8` is
  // a common CI/sudo artefact on machines whose terminal draws UTF-8 perfectly
  // well, and honouring the precedence there would downgrade them.
  const locale = `${env.LC_ALL ?? ""} ${env.LC_CTYPE ?? ""} ${env.LANG ?? ""}`;
  const unicode =
    /utf-?8/i.test(locale) ||
    // Terminals whose own font handling makes the locale irrelevant. All of
    // these ship block elements (report §5 support matrix).
    termProgram === "iTerm.app" ||
    termProgram === "WezTerm" ||
    termProgram === "ghostty" ||
    termProgram === "vscode" ||
    termProgram === "Hyper" ||
    termProgram === "WarpTerminal" ||
    termProgram === "rio" ||
    termProgram === "Tabby" ||
    env.WT_SESSION !== undefined || // Windows Terminal
    env.KITTY_WINDOW_ID !== undefined ||
    env.KONSOLE_VERSION !== undefined ||
    env.VTE_VERSION !== undefined || // GNOME Terminal and the rest of the VTE family
    env.ALACRITTY_SOCKET !== undefined ||
    env.ALACRITTY_WINDOW_ID !== undefined ||
    /kitty|ghostty|alacritty|wezterm|foot|contour|rio|iterm/.test(term) ||
    process.platform === "darwin";

  return {
    colorDepth,
    unicode: !!unicode,
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    isTTY,
    terminalName,
    isAppleTerminal,
    term,
    isMultiplexed,
    // A remote session's verdict is pure over its termType, so it is computed
    // fresh; a local one goes through the session accessor so a completed probe
    // is honoured. Both are memoised inside capability.ts — this runs once per
    // image per frame.
    graphics: remote ? detectGraphics({ termType: opts!.termType }) : getGraphicsCapability(),
  };
}
