/**
 * Graphics capability detection — which image path a terminal actually gets.
 *
 * The cell tiers need none of this (tier.ts resolves those from colour mode and
 * TERM alone, with zero bytes on the wire). This module exists for the one
 * decision that cells cannot answer: may we hand this terminal REAL PIXELS via
 * the kitty graphics protocol?
 *
 * Two properties are load-bearing and everything here is arranged around them:
 *
 * 1. **Some terminals are damaged by being asked.** Report §5 documents Apple
 *    Terminal routing APC/SOS/PM to the screen like DCS, and consuming one byte
 *    of an unknown OSC before printing the rest (`printf "\x1b]something\x1b\\"`
 *    renders `omething`). A probe is therefore gated behind a hard denylist that
 *    emits NOTHING, not behind a timeout that recovers afterwards. Detection is
 *    a positive allowlist; the default answer is "no".
 *
 * 2. **A reply cannot be taken back off stdin.** `process.stdin` is an
 *    EventEmitter, so every listener sees the same bytes — a temporary probe
 *    listener does not hide a reply from an already-attached key handler
 *    (report §6.1). `input.ts` now swallows OSC/DCS/APC/PM/SOS safely, so a
 *    stray reply is no longer able to type `q` into a navigation-mode app, but
 *    the probe must still run BEFORE `InputManager.start()`. See
 *    `probeGraphics()` for the exact window.
 *
 * Everything except `probeGraphics()` is synchronous, pure over its inputs and
 * free of I/O, so the render path can call `detectGraphics()` /
 * `getGraphicsCapability()` without leaving the frame.
 */

import { IMAGE_TIER_ENV, imageEnvPinsCells } from "./tier.js";

/**
 * What the image engine is allowed to draw with.
 *
 * INVARIANT: `kittyPlaceholders` implies `kitty`. The reverse does not hold —
 * Konsole speaks transmit-direct but has no Unicode-placeholder support at all,
 * so a renderer built on placeholders (the only variant that survives cell
 * diffing, Panel clipping and `cutToWidth`) MUST gate on `kittyPlaceholders`
 * and treat `kitty` alone as "classic cursor-anchored placements only".
 */
export interface GraphicsCapability {
  /** kitty graphics protocol usable at all (transmit + place). */
  kitty: boolean;
  /** Unicode-placeholder variant (`U=1` + U+10EEEE cells) usable. */
  kittyPlaceholders: boolean;
  /** How the verdict was reached. "denied" means a hard rule refused, no probe. */
  source: "env" | "query" | "override" | "denied";
  /** Human-readable justification, for `--debug`-style output and bug reports. */
  reason: string;
}

/** Inputs to detection. Every field is optional; the defaults read the real process. */
export interface GraphicsDetectOptions {
  /**
   * The client's TERM from an SSH pty-req. Presence of this field switches
   * detection into REMOTE mode, where every local terminal marker
   * (`TERM_PROGRAM`, `KITTY_WINDOW_ID`, `TMUX`, `process.stdout.isTTY`, …)
   * describes the server and is deliberately ignored — report §7.2.
   */
  termType?: string;
  /** Environment to read. Defaults to `process.env`. Passing it bypasses the memo. */
  env?: NodeJS.ProcessEnv;
  /**
   * Whether this is an interactive local TTY. Defaults to stdin AND stdout both
   * being TTYs. Passing it bypasses the memo. Ignored in remote mode, where the
   * pty-req is the TTY evidence and the server's own stdio is irrelevant.
   */
  isTTY?: boolean;
}

/** Escape hatch this module owns: `off` | `kitty` | `auto`. */
const GRAPHICS_ENV = "TERMINALTUI_GRAPHICS";

/**
 * kitty graphics support query: a 1x1 RGB pixel (`AAAA`) transmitted direct,
 * action `q`. A terminal that speaks the protocol answers
 * `\x1b_Gi=31;OK\x1b\\`; one that does not answers nothing at all, which is
 * why the sentinel below exists.
 */
export const KITTY_GRAPHICS_QUERY = "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\";

/**
 * XTVERSION. Answers `\x1bP>|<name and version>\x1b\\`.
 *
 * Included deliberately, beyond the bare kitty query: a positive graphics reply
 * proves the protocol is understood but says NOTHING about the Unicode
 * placeholder variant, and the split runs right through the middle of the
 * terminals that answer it (kitty and Ghostty implement `U=1`; WezTerm, Konsole,
 * Contour, Rio and Warp do not — report §5 matrix). Without a name, every
 * probed positive would have to be demoted to transmit-direct, which is the one
 * mode this framework's write path cannot use. The name also survives SSH,
 * unlike `TERM_PROGRAM` (report §6.2 step 2).
 */
const XTVERSION_QUERY = "\x1b[>0q";

/**
 * Primary DA. MUST BE LAST: it is the deadline, not the timer.
 *
 * Terminals silently drop queries they do not implement, so "read until the
 * graphics reply" deadlocks on every terminal without graphics — which is most
 * of them. DA1 is answered by essentially every VT-compatible terminal, and
 * kitty's spec requires a conforming terminal to answer `a=q` before processing
 * later input, so "DA1 came back, the graphics query did not" is a definitive
 * negative rather than a timeout.
 */
const PRIMARY_DA_QUERY = "\x1b[c";

/**
 * The complete probe, one batched write. Order matters — DA1 last.
 *
 * CSI ONLY. {@link KITTY_GRAPHICS_QUERY} used to lead this string, and sending
 * an APC to a terminal we have not identified is exactly what the exploration
 * report forbids: Terminal.app routes APC/SOS/PM like DCS and paints the body
 * on the screen. The denylist that was supposed to keep it away from Apple
 * Terminal recognises that terminal by `TERM_PROGRAM`, which ssh does not
 * forward (`SendEnv LANG LC_*`; TERM travels in the pty-req and TERM_PROGRAM
 * does not) and `sudo` strips under `env_reset` — so `ssh devbox && npx
 * terminaltui dev` is a LOCAL run on devbox with `TERM=xterm-256color` and no
 * TERM_PROGRAM, i.e. the ambiguous branch, i.e. 43 bytes of APC painted at row
 * one of the alt screen.
 *
 * Removing it costs NO capability, which is the part worth checking rather than
 * assuming: a positive APC answer alone never enabled anything. The pixel tier
 * requires `kittyPlaceholders`, and `placeholderSupportFromName` only ever
 * returns true for a terminal that NAMED itself kitty or Ghostty in XTVERSION.
 * A terminal that answers the graphics query without such a name (Contour, Rio,
 * Warp, Konsole) was already routed to cells. So the name decides, and the name
 * comes from a CSI that every VT-compatible terminal either answers or ignores
 * silently.
 */
export const GRAPHICS_PROBE = XTVERSION_QUERY + PRIMARY_DA_QUERY;

/**
 * Wall-clock backstop for the probe.
 *
 * The sentinel normally lands in single-digit milliseconds on a local TTY; this
 * only covers terminals that answer nothing whatsoever. It sits directly in app
 * startup, AFTER the alt screen has been entered and cleared and BEFORE the
 * first frame, so every millisecond of it is a millisecond of blank screen —
 * measured at 306 ms of blank under `script -q /dev/null`, a real TTY that
 * never replies, and the same for `expect`, CI ptys and any emulator harness
 * that does not emulate a terminal.
 *
 * 150 ms is two orders of magnitude more than a real terminal needs to answer
 * DA1 — a query every VT-compatible terminal implements — and half the blank
 * screen. Real budgets in the wild: timg 250 ms for graphics, terminal-query
 * 100 ms, Yazi 1000 ms.
 */
export const GRAPHICS_PROBE_TIMEOUT_MS = 150;

/** Ceiling on bytes buffered while waiting for the sentinel (a paste, say). */
const PROBE_MAX_REPLY_BYTES = 8192;

/**
 * Minimum kitty version with Unicode placeholders (`U=1`), shipped in 0.28.
 * Only checkable when XTVERSION gave us a version string.
 */
const KITTY_PLACEHOLDER_MIN = { major: 0, minor: 28 };

/** The subset of TerminalIO a probe needs. `ProcessTerminalIO` satisfies it structurally. */
export interface ProbeTransport {
  write(data: string): void;
  onData(cb: (data: string) => void): void;
  removeDataListener(cb: (data: string) => void): void;
  setRawMode(enabled: boolean): void;
}

/** Parsed contents of a probe reply. Exported so the ladder is unit-testable. */
export interface GraphicsProbeReply {
  /** An APC `_G` response arrived, in any form — proof the protocol is parsed. */
  kitty: boolean;
  /** The status word from that response: "OK", "EBADF", … or null. */
  kittyCode: string | null;
  /** XTVERSION name, e.g. "kitty(0.32.2)" or "ghostty 1.0.1". */
  terminalName: string | null;
  /** DA1 came back, so every earlier query has answered or been ignored. */
  sentinel: boolean;
  /**
   * DA1 parameters, split on ";". Member `"4"` means sixel — an EXACT member
   * test only; substring matching would let "14"/"24"/"64" pass. Nothing here
   * consumes it yet; it is recorded so a future sixel tier costs no extra probe.
   */
  daParams: string[];
}

// ─── Memoisation ──────────────────────────────────────────

/**
 * Verdicts by cache key. A terminal's identity cannot change inside one
 * process, so this is memoised rather than recomputed per frame — the render
 * path calls `getGraphicsCapability()` for every image, every frame.
 *
 * Keyed by termType so one server process can serve a kitty client and an
 * Apple Terminal client at once. Bounded because the key comes off the wire:
 * a client chooses its own pty-req TERM string, and an unbounded map keyed on
 * attacker-chosen strings is a slow leak.
 */
const memo = new Map<string, GraphicsCapability>();
const MEMO_MAX_ENTRIES = 32;

/** The capability for the CURRENT session, set by the runtime after probing. */
let sessionCapability: GraphicsCapability | null = null;

/**
 * Drop every memoised verdict and the session capability.
 *
 * For tests, which mutate `process.env` between cases, and for anything that
 * legitimately re-detects (a new SSH session with a different pty-req).
 */
export function resetGraphicsCache(): void {
  memo.clear();
  sessionCapability = null;
}

/**
 * Publish the capability for the current session.
 *
 * Same shape and the same caveat as `setColorMode()` in style/colors.ts: it is
 * module-level state that the runtime swaps per SSH session, so concurrent
 * sessions on different terminals can observe each other's value between
 * frames. The failure is bounded — `detectGraphics()` with no `termType` on a
 * non-TTY server resolves to "denied", i.e. cells — and fixing it properly
 * means moving it into the runtime's AsyncLocalStorage, which is runtime.ts's
 * call, not this module's.
 */
export function setGraphicsCapability(cap: GraphicsCapability): void {
  sessionCapability = cap;
}

/**
 * The capability the renderer should draw with.
 *
 * Returns whatever the runtime published for this session, falling back to a
 * fresh environment read. Synchronous and memoised: safe inside a frame.
 */
export function getGraphicsCapability(): GraphicsCapability {
  return sessionCapability ?? detectGraphics();
}

// ─── The ladder ───────────────────────────────────────────

/**
 * Decide which graphics path a terminal gets, from the environment alone.
 *
 * Order is: overrides, then the hard denylist (which is what makes "no probe
 * bytes reached Apple Terminal" a property of the design rather than of the
 * caller), then a positive allowlist. Anything unrecognised resolves to cells.
 *
 * @param opts Detection inputs. Pass `termType` for an SSH session.
 */
export function detectGraphics(opts?: GraphicsDetectOptions): GraphicsCapability {
  // An injected env or TTY flag describes a hypothetical terminal, not this
  // process — memoising it would poison every later real call.
  const injected = opts?.env !== undefined || opts?.isTTY !== undefined;
  const key = memoKey(opts);

  if (!injected) {
    const hit = memo.get(key);
    if (hit) return hit;
  }

  const cap = decide(opts).cap;

  if (!injected && memo.size < MEMO_MAX_ENTRIES) memo.set(key, cap);
  return cap;
}

/**
 * Cache key for one detection.
 *
 * Namespaced rather than "the termType or empty string": a client is free to
 * send an EMPTY pty-req TERM, and an unprefixed key would file that remote
 * verdict in the local process's slot.
 */
function memoKey(opts?: GraphicsDetectOptions): string {
  return opts?.termType === undefined ? "local" : `remote:${opts.termType}`;
}

/**
 * Whether an active probe could still change the answer.
 *
 * False for every denied terminal (so the probe is a no-op there, not merely
 * harmless), false when an override or a decisive env marker already settled
 * it, and false for every remote session — probing over SSH costs a round trip
 * on the one path where round trips are most expensive, and the report budgets
 * it at 1200 ms. True only for a local interactive TTY whose environment names
 * no terminal we recognise.
 */
export function shouldProbeGraphics(opts?: GraphicsDetectOptions): boolean {
  return decide(opts).ambiguous;
}

/** Internal verdict plus whether a probe is still worth its bytes. */
interface Decision {
  cap: GraphicsCapability;
  ambiguous: boolean;
}

function decide(opts?: GraphicsDetectOptions): Decision {
  const env = opts?.env ?? process.env;
  const remote = opts?.termType !== undefined;
  const term = (remote ? opts!.termType! : env.TERM ?? "").toLowerCase().trim();
  // Local markers describe the SERVER in a serve session and must not leak into
  // a client's verdict. Blanking them here keeps every rule below honest.
  const termProgram = (remote ? "" : env.TERM_PROGRAM ?? "").toLowerCase().trim();

  // ── Step 0: overrides. "off" in either variable is absolute. ──

  const forced = graphicsOverride(env);
  if (forced === "off") {
    return settled(false, false, "override", `${GRAPHICS_ENV}=off`);
  }
  const pinned = imageEnvPinsCells(env);
  if (pinned !== null) {
    return settled(false, false, "override", `${IMAGE_TIER_ENV}=${pinned} pins the cell path`);
  }
  if (forced === "kitty") {
    // Deliberately trusts the human over every check below, including the
    // denylist: this is the escape hatch for a terminal we mis-detect, and a
    // kill switch that could not also be a force switch would be half a tool.
    return settled(true, true, "override", `${GRAPHICS_ENV}=kitty`);
  }

  // ── Step 1: hard denylist. Nothing below this point may emit a probe byte. ──

  if (termProgram === "apple_terminal") {
    return settled(
      false, false, "denied",
      "Apple Terminal has no graphics protocol and echoes unknown escape bodies to the screen; never probed",
    );
  }
  // A multiplexer cannot be interrogated from inside: the reply comes from the
  // OUTER terminal, tmux passthrough is off by default with no in-band way to
  // detect it, and screen's DCS cannot carry an inner ESC at all. TMUX/STY are
  // local-only markers — in a serve session they describe the server's shell.
  if (term.startsWith("screen") || term.startsWith("tmux")) {
    return settled(false, false, "denied", `multiplexer detected (TERM=${term})`);
  }
  if (!remote && env.STY !== undefined) {
    return settled(false, false, "denied", "multiplexer detected (STY set)");
  }
  if (!remote && env.TMUX !== undefined) {
    return settled(false, false, "denied", "multiplexer detected (TMUX set)");
  }
  if (term === "" || term === "dumb") {
    return settled(false, false, "denied", term === "" ? "TERM is unset" : "TERM=dumb");
  }
  // CI and stdio checks are LOCAL-only. In a serve session the frames go down
  // an SSH channel to a real terminal; the server's own stdout being a log file
  // says nothing about the client, and a container that happens to set CI is
  // not a reason to downgrade a human's session.
  if (!remote && isCI(env)) {
    return settled(false, false, "denied", "CI environment");
  }
  if (!remote && !resolveIsTTY(opts)) {
    return settled(false, false, "denied", "stdio is not an interactive TTY");
  }

  // ── Step 2: positive env allowlist. ──
  //
  // Cheap, no round trip, and the ONLY signal that exists server-side over SSH,
  // where the pty-req TERM is all we are given. It under-detects on purpose:
  // iTerm2, WezTerm and Ghostty commonly forward TERM=xterm-256color, and the
  // safe direction for an unrecognised terminal is cells.

  if (term.includes("kitty") || (!remote && env.KITTY_WINDOW_ID !== undefined)) {
    // Placeholders shipped in kitty 0.28 (Jan 2023) and neither TERM nor
    // KITTY_WINDOW_ID carries a version, so this is a verdict WITHOUT version
    // evidence. It is therefore left AMBIGUOUS on a local TTY so the probe
    // actually runs and XTVERSION supplies the version that
    // `placeholderSupportFromName` already knows how to judge — that check used
    // to sit on a branch no kitty session could reach, so a distro-packaged
    // kitty older than 0.28 had the pixel tier forced on and drew a rectangle
    // of U+10EEEE with no automatic recovery. If the probe answers nothing the
    // verdict below stands, so the failure direction is unchanged.
    //
    // Over SSH there is nobody to ask (the probe refuses remote sessions), so
    // the env verdict is final there.
    return {
      cap: {
        kitty: true,
        kittyPlaceholders: true,
        source: "env",
        reason: term.includes("kitty") ? `TERM=${term}` : "KITTY_WINDOW_ID is set",
      },
      ambiguous: !remote,
    };
  }
  if (term.includes("ghostty") || termProgram === "ghostty") {
    return settled(true, true, "env", term.includes("ghostty") ? `TERM=${term}` : "TERM_PROGRAM=ghostty");
  }
  if (term.includes("wezterm") || termProgram === "wezterm" || (!remote && env.WEZTERM_EXECUTABLE !== undefined)) {
    // DECISION: WezTerm gets cells, not pixels. Its kitty implementation is
    // documented as partial and buggy (report §5), and it has no Unicode
    // placeholder support at all — so the only variant it could offer is
    // cursor-anchored placement, which this framework's write path cannot drive
    // safely (no \x1b[2J is ever emitted, so a placement outlives the page that
    // drew it). A correct cell image beats a buggy pixel one, and WezTerm's
    // truecolor quadrant output is already excellent.
    return settled(false, false, "env", "WezTerm: kitty support is partial/buggy and has no Unicode placeholders — using cells");
  }
  if (term.includes("konsole") || (!remote && env.KONSOLE_VERSION !== undefined)) {
    // Konsole >= 22.04 implements transmit-direct only: no animation, no
    // Unicode placeholders. `kittyPlaceholders: false` is what keeps a
    // placeholder-based renderer off it.
    return settled(true, false, "env", "Konsole: kitty transmit-direct only, no Unicode placeholders");
  }

  // ── Step 3: unrecognised. Cells now; a local TTY may still be probed. ──
  return {
    cap: {
      kitty: false,
      kittyPlaceholders: false,
      source: "env",
      reason: remote
        ? `no graphics marker in the client's TERM (${term})`
        : `no graphics marker in the environment (TERM=${term})`,
    },
    ambiguous: !remote,
  };
}

/** A verdict no probe can improve on. */
function settled(
  kitty: boolean,
  kittyPlaceholders: boolean,
  source: GraphicsCapability["source"],
  reason: string,
): Decision {
  return { cap: { kitty, kittyPlaceholders, source, reason }, ambiguous: false };
}

/** Read `TERMINALTUI_GRAPHICS`. Unrecognised values fall through to negotiation. */
function graphicsOverride(env: NodeJS.ProcessEnv): "off" | "kitty" | null {
  const raw = env[GRAPHICS_ENV];
  if (raw === undefined) return null;
  const value = raw.toLowerCase().trim();
  if (value === "off" || value === "none" || value === "0" || value === "false") return "off";
  if (value === "kitty" || value === "on" || value === "1" || value === "true") return "kitty";
  return null; // includes "auto", and any typo — a typo must not disable images
}

/**
 * CI detection. Deliberately generous: pixels in a captured log are noise at
 * best, and every major CI provider sets this. `CI=false`/`CI=0` is honoured
 * because some tools set it to opt OUT.
 */
function isCI(env: NodeJS.ProcessEnv): boolean {
  const raw = env.CI;
  if (raw === undefined) return false;
  const value = raw.toLowerCase().trim();
  return value !== "" && value !== "false" && value !== "0";
}

/**
 * Both directions must be TTYs: stdout to receive the image, stdin to carry
 * the reply. A piped stdin (the emulator's non-PTY fallback, a shell pipeline)
 * can never answer a probe, so it must never be sent one.
 */
function resolveIsTTY(opts?: GraphicsDetectOptions): boolean {
  if (opts?.isTTY !== undefined) return opts.isTTY;
  return !!process.stdout.isTTY && !!process.stdin.isTTY;
}

// ─── Active probe ─────────────────────────────────────────

/**
 * Ask the terminal directly, once, with a hard deadline.
 *
 * WHERE THIS MUST BE CALLED: in `Runtime.startInner()`, AFTER
 * `this.setupTerminal()` and BEFORE `this._input.start()` — runtime.ts:248 and
 * runtime.ts:261 respectively. Not earlier (raw mode is needed to receive the
 * reply un-line-buffered, and `setupTerminal()` is what owns terminal setup),
 * and not later (once `InputManager.start()` has attached its listener, every
 * byte of the reply is also delivered to the key handler; it is swallowed
 * correctly today, but only because input.ts was fixed to do so, and a probe
 * that relies on that is a probe waiting to break). Local `dev` only — this
 * function refuses remote sessions itself.
 *
 * It cannot hang: the promise is settled either by the DA1 sentinel or by a
 * `GRAPHICS_PROBE_TIMEOUT_MS` timer that is armed before the first byte is
 * written, and it settles exactly once.
 *
 * On resolution the verdict is published via `setGraphicsCapability()` and
 * memoised, so later `getGraphicsCapability()` / `detectGraphics()` calls in
 * the render path see it without re-probing.
 *
 * @param io The terminal to talk to. `ProcessTerminalIO` satisfies this.
 * @param opts Same inputs as `detectGraphics()`.
 */
export async function probeGraphics(
  io: ProbeTransport,
  opts?: GraphicsDetectOptions,
): Promise<GraphicsCapability> {
  const decision = decide(opts);
  if (!decision.ambiguous) {
    // Denied, overridden or already decided by env: ZERO bytes are written.
    // This is the branch Apple Terminal, tmux, CI and every SSH session take.
    setGraphicsCapability(decision.cap);
    return decision.cap;
  }

  const reply = await collectProbeReply(io);
  const parsed = parseGraphicsProbeReply(reply);
  const cap = capabilityFromProbe(parsed, decision.cap);

  setGraphicsCapability(cap);
  // Same key `detectGraphics()` would use for this (necessarily local) session,
  // so a later env read cannot silently undo what the terminal just told us.
  memo.set(memoKey(opts), cap);
  return cap;
}

/**
 * Turn a parsed reply into a verdict. Pure, so the mapping is unit-testable.
 *
 * @param fallback What the environment already concluded. Used when the
 *   terminal answered NOTHING: silence is not evidence, and a `TERM=xterm-kitty`
 *   session behind a wrapper that swallows CSI replies must keep the pixel path
 *   the env ladder gave it rather than lose it to a timeout.
 */
export function capabilityFromProbe(
  reply: GraphicsProbeReply,
  fallback?: GraphicsCapability,
): GraphicsCapability {
  const name = reply.terminalName ?? "";

  if (!reply.sentinel && name === "") {
    // Nothing came back at all — not even DA1, which essentially every
    // VT-compatible terminal answers. Silence is not evidence, so it may only
    // PRESERVE a positive the environment already made (a `TERM=xterm-kitty`
    // session behind a wrapper that swallows CSI replies must not lose the
    // pixel path to a timeout); it can never manufacture one.
    if (fallback?.kitty === true) return fallback;
    return {
      kitty: false,
      kittyPlaceholders: false,
      source: "denied",
      reason: "terminal answered nothing before the probe deadline",
    };
  }

  // The NAME is the whole verdict. `placeholderSupportFromName` is the only
  // thing that has ever been allowed to turn the pixel tier on, and it is also
  // where the kitty version gate lives — a build older than 0.28 has no `U=1`
  // and would silently drop the transmission, leaving a rectangle of U+10EEEE.
  if (placeholderSupportFromName(name)) {
    return {
      kitty: true,
      kittyPlaceholders: true,
      source: "query",
      reason: `terminal reports "${name}", which implements Unicode placeholders`,
    };
  }

  if (/kitty|ghostty/i.test(name)) {
    // It named itself kitty or Ghostty but did not clear the version gate, so
    // it is a build predating `U=1`. It still speaks the protocol; it just
    // cannot be driven through placeholders, which is the only variant this
    // write path can use. THIS is the branch the version gate was written for
    // and it used to be unreachable, because a kitty TERM settled the ladder
    // before any probe could run.
    return {
      kitty: true,
      kittyPlaceholders: false,
      source: "query",
      reason: `terminal reports "${name}", which predates Unicode placeholders — using cells`,
    };
  }

  return {
    kitty: false,
    kittyPlaceholders: false,
    source: "query",
    reason: name
      ? `terminal reports "${name}", which is not known to implement Unicode placeholders`
      : "terminal answered DA1 but gave no name, so no graphics protocol is confirmed",
  };
}

/**
 * Whether an XTVERSION name is a terminal known to implement `U=1`.
 *
 * Conservative by construction: only kitty and Ghostty self-report a name we
 * will act on. A blank name is NOT treated as kitty — Contour, Rio and Warp all
 * answer the graphics query without placeholder support, and a false positive
 * there paints a grid of U+10EEEE tofu across the user's screen.
 */
function placeholderSupportFromName(name: string): boolean {
  if (/ghostty/i.test(name)) return true;
  if (!/kitty/i.test(name)) return false;

  const version = /kitty[^0-9]*(\d+)\.(\d+)/i.exec(name);
  if (!version) return true; // named itself kitty but gave no version: trust it
  const major = Number(version[1]);
  const minor = Number(version[2]);
  if (major > KITTY_PLACEHOLDER_MIN.major) return true;
  return major === KITTY_PLACEHOLDER_MIN.major && minor >= KITTY_PLACEHOLDER_MIN.minor;
}

/**
 * Extract every answer from a raw probe reply.
 *
 * The reply is scanned as one blob rather than parsed as a stream: replies
 * interleave with whatever the user typed during the window, and the three
 * patterns are unambiguous enough to be found positionally.
 */
export function parseGraphicsProbeReply(reply: string): GraphicsProbeReply {
  // APC _G ... ST. Any response proves the protocol is parsed, including an
  // error code — a terminal that does not implement it stays silent instead.
  const kittyMatch = /\x1b_G([^\x1b]*)\x1b\\/.exec(reply);
  const kittyCode = kittyMatch ? /;([A-Za-z_][A-Za-z0-9_]*)/.exec(kittyMatch[1])?.[1] ?? null : null;

  const nameMatch = /\x1bP>\|([^\x1b]*)\x1b\\/.exec(reply);
  const daMatch = /\x1b\[\?([0-9;]*)c/.exec(reply);

  return {
    kitty: kittyMatch !== null,
    kittyCode,
    terminalName: nameMatch ? nameMatch[1] : null,
    sentinel: daMatch !== null,
    daParams: daMatch ? daMatch[1].split(";").filter(p => p !== "") : [],
  };
}

/**
 * Write the probe and gather bytes until the sentinel or the deadline.
 *
 * Keystrokes typed inside the window are consumed here and dropped: input has
 * not started yet, there is nowhere to deliver them, and re-emitting them would
 * mean replaying a terminal reply as keys. The window is normally a few
 * milliseconds because the sentinel ends it, not the timer.
 */
function collectProbeReply(io: ProbeTransport): Promise<string> {
  return new Promise<string>(resolve => {
    let buffer = "";
    let settledOnce = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onData = (data: string): void => {
      buffer += data;
      if (buffer.length > PROBE_MAX_REPLY_BYTES) {
        finish();
        return;
      }
      // DA1 last in, DA1 last out: its arrival proves every earlier query has
      // answered or been dropped, so there is nothing left to wait for.
      if (/\x1b\[\?[0-9;]*c/.test(buffer)) finish();
    };

    const finish = (): void => {
      if (settledOnce) return;
      settledOnce = true;
      if (timer) clearTimeout(timer);
      // Never let teardown failure strand the promise — an app that cannot
      // start is strictly worse than a duplicate listener.
      try {
        io.removeDataListener(onData);
      } catch {
        /* ignore */
      }
      resolve(buffer);
    };

    // Armed BEFORE the write, so a throwing or blocking write cannot leave the
    // promise pending. Not unref'd: this timer is the only guarantee that
    // startup continues on a terminal that answers nothing.
    timer = setTimeout(finish, GRAPHICS_PROBE_TIMEOUT_MS);

    try {
      // Raw mode must be on to receive a reply without line buffering. Left on
      // afterwards on purpose: `InputManager.start()` is about to enable it
      // anyway, and toggling it off and on again drops bytes in between.
      io.setRawMode(true);
      io.onData(onData);
      io.write(GRAPHICS_PROBE);
    } catch {
      finish();
    }
  });
}
