/**
 * Unit tests for graphics capability detection (src/image/capability.ts) and
 * the terminal sniffer it feeds (src/helpers/detect-terminal.ts).
 *
 * No PTY and no child process: the ladder is pure over (env, isTTY, termType),
 * and the one asynchronous piece — the active probe — talks to an injected
 * transport that records every byte written to it.
 *
 * The load-bearing assertion in here is "Apple Terminal receives ZERO bytes".
 * Report §5 measured Terminal.app printing the body of an unknown OSC to the
 * screen and routing APC like DCS, so a probe there is not merely useless, it
 * is visible corruption of the user's session.
 *
 * Run:  npx tsx test/test-graphics-capability.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import {
  detectGraphics,
  shouldProbeGraphics,
  probeGraphics,
  resetGraphicsCache,
  setGraphicsCapability,
  getGraphicsCapability,
  parseGraphicsProbeReply,
  capabilityFromProbe,
  GRAPHICS_PROBE,
  KITTY_GRAPHICS_QUERY,
  GRAPHICS_PROBE_TIMEOUT_MS,
  type GraphicsCapability,
  type ProbeTransport,
} from "../src/image/capability.js";
import { detectTerminal } from "../src/helpers/detect-terminal.js";

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err?.message ?? err}\x1b[0m`);
  }
}

const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];
function asyncTest(name: string, fn: () => Promise<void>): void {
  asyncTests.push({ name, fn });
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Run `fn` with `patch` applied to process.env, then restore exactly. */
function withEnv(patch: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) saved[key] = process.env[key];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetGraphicsCache();
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetGraphicsCache();
  }
}

/**
 * A terminal that records everything sent to it and replies with a script.
 * Structurally a TerminalIO, which is what the runtime will pass.
 */
class FakeTerminal implements ProbeTransport {
  writes: string[] = [];
  rawModeCalls: boolean[] = [];
  listeners: Array<(data: string) => void> = [];
  /** Chunks delivered (in order, one macrotask apart) after the probe writes. */
  script: string[] = [];
  /** Set to throw from write(), to prove the promise still settles. */
  throwOnWrite = false;

  write(data: string): void {
    this.writes.push(data);
    if (this.throwOnWrite) throw new Error("EPIPE");
    this.script.forEach((chunk, i) => setTimeout(() => this.emit(chunk), i + 1));
  }
  onData(cb: (data: string) => void): void {
    this.listeners.push(cb);
  }
  removeDataListener(cb: (data: string) => void): void {
    this.listeners = this.listeners.filter(l => l !== cb);
  }
  setRawMode(enabled: boolean): void {
    this.rawModeCalls.push(enabled);
  }
  emit(data: string): void {
    for (const l of [...this.listeners]) l(data);
  }
  /** Every byte this terminal was made to display. */
  get bytesWritten(): number {
    return this.writes.join("").length;
  }
}

/**
 * The environment table. Each row is a complete simulated environment plus the
 * verdict the ladder must reach. `isTTY` defaults to true so that a row only
 * fails the TTY gate when it says so.
 */
interface Row {
  name: string;
  env: Record<string, string>;
  isTTY?: boolean;
  termType?: string;
  kitty: boolean;
  placeholders: boolean;
  source: GraphicsCapability["source"];
  probe: boolean;
}

const TABLE: Row[] = [
  // ── kitty family: the whole point of the exercise ──
  // A kitty TERM is a positive verdict WITHOUT version evidence, and Unicode
  // placeholders only shipped in 0.28 — so it stays PROBEABLE on a local TTY.
  // The probe cannot make it worse (silence keeps the env verdict) and it is
  // the only way `placeholderSupportFromName`'s version gate ever runs.
  {
    name: "kitty (TERM=xterm-kitty)",
    env: { TERM: "xterm-kitty", KITTY_WINDOW_ID: "1" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
  {
    name: "kitty with a rewritten TERM (KITTY_WINDOW_ID only)",
    env: { TERM: "xterm-256color", KITTY_WINDOW_ID: "3" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
  {
    name: "Ghostty (TERM_PROGRAM)",
    env: { TERM: "xterm-256color", TERM_PROGRAM: "ghostty" },
    kitty: true, placeholders: true, source: "env", probe: false,
  },
  {
    name: "Ghostty (TERM=xterm-ghostty)",
    env: { TERM: "xterm-ghostty" },
    kitty: true, placeholders: true, source: "env", probe: false,
  },

  // ── deliberate negatives ──
  {
    name: "WezTerm — buggy kitty, no placeholders, gets cells",
    env: { TERM: "xterm-256color", TERM_PROGRAM: "WezTerm", WEZTERM_EXECUTABLE: "/usr/bin/wezterm" },
    kitty: false, placeholders: false, source: "env", probe: false,
  },
  {
    name: "Konsole — transmit-direct only, placeholders off",
    env: { TERM: "xterm-256color", KONSOLE_VERSION: "220400" },
    kitty: true, placeholders: false, source: "env", probe: false,
  },

  // ── hard denylist ──
  {
    name: "Apple Terminal",
    env: { TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "tmux (TERM=tmux-256color)",
    env: { TERM: "tmux-256color", TMUX: "/tmp/tmux-501/default,1,0", KITTY_WINDOW_ID: "1" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "tmux with TERM rewritten back to the outer terminal",
    env: { TERM: "xterm-kitty", TMUX: "/tmp/tmux-501/default,1,0" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "GNU screen (STY)",
    env: { TERM: "screen.xterm-256color", STY: "12345.pts-0.host" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "CI",
    env: { TERM: "xterm-256color", CI: "true", KITTY_WINDOW_ID: "1" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "CI=false is an opt-out, not a denial",
    env: { TERM: "xterm-kitty", CI: "false" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
  {
    name: "non-TTY (piped stdout)",
    env: { TERM: "xterm-kitty" },
    isTTY: false,
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "TERM unset",
    env: {},
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "TERM=dumb",
    env: { TERM: "dumb" },
    kitty: false, placeholders: false, source: "denied", probe: false,
  },

  // ── ambiguous: cells now, but worth a probe ──
  {
    name: "unrecognised local terminal",
    env: { TERM: "xterm-256color" },
    kitty: false, placeholders: false, source: "env", probe: true,
  },
  {
    name: "Alacritty (no protocol, but nothing says so)",
    env: { TERM: "alacritty", ALACRITTY_WINDOW_ID: "1" },
    kitty: false, placeholders: false, source: "env", probe: true,
  },

  // ── SSH: termType is the only signal, and it is never probed ──
  {
    name: "SSH client running kitty",
    env: { TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" },
    termType: "xterm-kitty",
    isTTY: false,
    kitty: true, placeholders: true, source: "env", probe: false,
  },
  {
    name: "SSH client running Ghostty",
    env: {},
    termType: "xterm-ghostty",
    isTTY: false,
    kitty: true, placeholders: true, source: "env", probe: false,
  },
  {
    name: "SSH client forwarding a generic TERM",
    env: { KITTY_WINDOW_ID: "1" },
    termType: "xterm-256color",
    isTTY: false,
    kitty: false, placeholders: false, source: "env", probe: false,
  },
  {
    name: "SSH client inside tmux",
    env: {},
    termType: "screen-256color",
    isTTY: false,
    kitty: false, placeholders: false, source: "denied", probe: false,
  },
  {
    name: "SSH server in CI still serves a kitty client",
    env: { CI: "true" },
    termType: "xterm-kitty",
    isTTY: false,
    kitty: true, placeholders: true, source: "env", probe: false,
  },

  // ── overrides ──
  {
    name: "TERMINALTUI_GRAPHICS=off beats a kitty terminal",
    env: { TERM: "xterm-kitty", TERMINALTUI_GRAPHICS: "off" },
    kitty: false, placeholders: false, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_GRAPHICS=off beats an SSH kitty client",
    env: { TERMINALTUI_GRAPHICS: "off" },
    termType: "xterm-kitty",
    isTTY: false,
    kitty: false, placeholders: false, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_GRAPHICS=kitty forces a mis-detected terminal on",
    env: { TERM: "xterm-256color", TERMINALTUI_GRAPHICS: "kitty" },
    kitty: true, placeholders: true, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_GRAPHICS=kitty overrides the denylist too",
    env: { TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal", TERMINALTUI_GRAPHICS: "kitty" },
    kitty: true, placeholders: true, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_GRAPHICS=auto negotiates normally",
    env: { TERM: "xterm-kitty", TERMINALTUI_GRAPHICS: "auto" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
  {
    name: "TERMINALTUI_GRAPHICS typo does not disable images",
    env: { TERM: "xterm-kitty", TERMINALTUI_GRAPHICS: "yes-please" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
  {
    name: "TERMINALTUI_IMAGE=off suppresses pixels as well as cells",
    env: { TERM: "xterm-kitty", TERMINALTUI_IMAGE: "off" },
    kitty: false, placeholders: false, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_IMAGE=half pins a cell tier",
    env: { TERM: "xterm-kitty", TERMINALTUI_IMAGE: "half" },
    kitty: false, placeholders: false, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_IMAGE=cells means cells, pixels included",
    env: { TERM: "xterm-kitty", TERMINALTUI_IMAGE: "cells" },
    kitty: false, placeholders: false, source: "override", probe: false,
  },
  {
    name: "TERMINALTUI_IMAGE=auto leaves graphics alone",
    env: { TERM: "xterm-kitty", TERMINALTUI_IMAGE: "auto" },
    kitty: true, placeholders: true, source: "env", probe: true,
  },
];

console.log("\n\x1b[1m  Graphics capability — environment ladder\x1b[0m\n");

for (const row of TABLE) {
  test(row.name, () => {
    const opts = {
      env: row.env as NodeJS.ProcessEnv,
      isTTY: row.isTTY ?? true,
      ...(row.termType !== undefined ? { termType: row.termType } : {}),
    };
    const cap = detectGraphics(opts);
    assertEqual(cap.kitty, row.kitty, "kitty");
    assertEqual(cap.kittyPlaceholders, row.placeholders, "kittyPlaceholders");
    assertEqual(cap.source, row.source, "source");
    assert(cap.reason.length > 0, "reason must be non-empty");
    assertEqual(shouldProbeGraphics(opts), row.probe, "shouldProbeGraphics");
  });
}

console.log("\n\x1b[1m  Invariants\x1b[0m\n");

test("kittyPlaceholders implies kitty across the whole table", () => {
  for (const row of TABLE) {
    const cap = detectGraphics({
      env: row.env as NodeJS.ProcessEnv,
      isTTY: row.isTTY ?? true,
      ...(row.termType !== undefined ? { termType: row.termType } : {}),
    });
    assert(!cap.kittyPlaceholders || cap.kitty, `${row.name}: placeholders without kitty`);
  }
});

test("only an ambiguous local terminal is ever probed", () => {
  for (const row of TABLE) {
    const opts = {
      env: row.env as NodeJS.ProcessEnv,
      isTTY: row.isTTY ?? true,
      ...(row.termType !== undefined ? { termType: row.termType } : {}),
    };
    if (!shouldProbeGraphics(opts)) continue;
    assert(row.termType === undefined, `${row.name}: remote sessions must never probe`);
    assertEqual(detectGraphics(opts).source, "env", `${row.name}: probing a settled verdict`);
  }
});

/**
 * Neutralise every variable the ladder consults, so a test only sees what it
 * sets. Whoever runs the suite may be inside tmux, on Apple Terminal, or in CI.
 */
const CLEAN: Record<string, string | undefined> = {
  TERM: undefined,
  TERM_PROGRAM: undefined,
  TMUX: undefined,
  STY: undefined,
  CI: undefined,
  KITTY_WINDOW_ID: undefined,
  KONSOLE_VERSION: undefined,
  WEZTERM_EXECUTABLE: undefined,
  TERMINALTUI_GRAPHICS: undefined,
  TERMINALTUI_IMAGE: undefined,
};

test("an injected environment never poisons the memo", () => {
  withEnv({ ...CLEAN, TERM: "xterm-kitty" }, () => {
    // Ask about a hypothetical Apple Terminal first...
    const apple = detectGraphics({ env: { TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" }, isTTY: true });
    assertEqual(apple.source, "denied", "injected Apple Terminal");
    // ...then about this process, which is kitty.
    assertEqual(detectGraphics({ isTTY: true }).kitty, true, "real env still detected");
  });
});

test("repeated detection is memoised, and resetGraphicsCache clears it", () => {
  withEnv({ ...CLEAN, TERM: "xterm-kitty" }, () => {
    const a = detectGraphics();
    const b = detectGraphics();
    assert(a === b, "the same object must come back on a second call");
    resetGraphicsCache();
    const c = detectGraphics();
    assert(a !== c, "reset must force a fresh verdict");
    assertEqual(c.kitty, a.kitty, "and the fresh verdict must agree");
  });
});

test("a remote verdict is memoised per termType, not globally", () => {
  withEnv({ ...CLEAN, TERM: "xterm-256color" }, () => {
    assertEqual(detectGraphics({ termType: "xterm-kitty" }).kitty, true, "kitty client");
    assertEqual(detectGraphics({ termType: "xterm-256color" }).kitty, false, "generic client");
    assertEqual(detectGraphics({ termType: "xterm-ghostty" }).kitty, true, "ghostty client");
    assertEqual(detectGraphics({ termType: "xterm-kitty" }).kitty, true, "kitty client again");
  });
});

test("an empty pty-req TERM cannot claim the local cache slot", () => {
  withEnv({ ...CLEAN, TERM: "xterm-kitty" }, () => {
    // A client is free to send an empty TERM; that verdict must not become the
    // answer for the local process. (Whether the local one is kitty depends on
    // whether the suite itself has a TTY, so compare the reasons, not the
    // booleans — the point is that the two never share a cache slot.)
    const remote = detectGraphics({ termType: "" });
    const local = detectGraphics();
    assertEqual(remote.source, "denied", "empty remote TERM");
    assertEqual(remote.reason, "TERM is unset", "remote reason");
    assert(local.reason !== remote.reason, `local verdict was overwritten: ${local.reason}`);
  });
});

test("the session capability overrides env until it is reset", () => {
  withEnv({ ...CLEAN, TERM: "xterm-256color" }, () => {
    assertEqual(getGraphicsCapability().kitty, false, "env verdict first");
    setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "query", reason: "probed" });
    assertEqual(getGraphicsCapability().kitty, true, "session verdict wins");
    resetGraphicsCache();
    assertEqual(getGraphicsCapability().kitty, false, "reset restores the env verdict");
  });
});

console.log("\n\x1b[1m  Probe reply parsing\x1b[0m\n");

test("the probe is CSI only, and DA1 is last", () => {
  // The safety property, not a style preference. Terminal.app routes APC/SOS/PM
  // like DCS and paints the body on screen, and the denylist that was supposed
  // to keep an APC away from it keys on TERM_PROGRAM — which ssh does not
  // forward and sudo strips. So no unidentified terminal may ever receive one.
  assert(!GRAPHICS_PROBE.includes("\x1b_"), "the probe must contain no APC");
  assert(!GRAPHICS_PROBE.includes(KITTY_GRAPHICS_QUERY), "the kitty APC query must not be probed");
  assert(!GRAPHICS_PROBE.includes("\x1bX") && !GRAPHICS_PROBE.includes("\x1b^"), "no SOS/PM either");
  for (const ch of GRAPHICS_PROBE) {
    assert(ch === "\x1b" || ch >= " ", "no C0 bytes in the probe");
  }
  assert(GRAPHICS_PROBE.startsWith("\x1b[>0q"), "XTVERSION leads — the name is the whole verdict");
  assert(GRAPHICS_PROBE.endsWith("\x1b[c"), "DA1 must be the final query");
  assertEqual(GRAPHICS_PROBE.indexOf("\x1b[c"), GRAPHICS_PROBE.length - 3, "DA1 must appear exactly once, at the end");
});

test("kitty OK plus a version is a placeholder-capable positive", () => {
  const reply = parseGraphicsProbeReply("\x1b_Gi=31;OK\x1b\\\x1bP>|kitty(0.32.2)\x1b\\\x1b[?62;4c");
  assertEqual(reply.kitty, true, "kitty");
  assertEqual(reply.kittyCode, "OK", "status word");
  assertEqual(reply.terminalName, "kitty(0.32.2)", "XTVERSION name");
  assertEqual(reply.sentinel, true, "sentinel");
  assertEqual(reply.daParams.join(","), "62,4", "DA1 params");
  const cap = capabilityFromProbe(reply);
  assertEqual(cap.kitty, true, "cap.kitty");
  assertEqual(cap.kittyPlaceholders, true, "cap.kittyPlaceholders");
  assertEqual(cap.source, "query", "cap.source");
});

test("a kitty older than 0.28 loses placeholders but keeps the protocol", () => {
  const cap = capabilityFromProbe(
    parseGraphicsProbeReply("\x1b_Gi=31;OK\x1b\\\x1bP>|kitty(0.21.2)\x1b\\\x1b[?62c"),
  );
  assertEqual(cap.kitty, true, "kitty");
  assertEqual(cap.kittyPlaceholders, false, "placeholders");
});

test("Ghostty is placeholder-capable; an unnamed terminal is not", () => {
  const ghostty = capabilityFromProbe(
    parseGraphicsProbeReply("\x1bP>|ghostty 1.0.1\x1b\\\x1b[?62c"),
  );
  assertEqual(ghostty.kittyPlaceholders, true, "ghostty placeholders");

  // Rio speaks the graphics protocol but has no `U=1`, and this write path can
  // only drive placeholders — so it is cells, and the verdict says so rather
  // than reporting a capability nothing consumes.
  const rio = capabilityFromProbe(parseGraphicsProbeReply("\x1bP>|rio 0.1.14\x1b\\\x1b[?62c"));
  assertEqual(rio.kittyPlaceholders, false, "rio has no placeholders");

  const anonymous = capabilityFromProbe(parseGraphicsProbeReply("\x1b[?62c"));
  assertEqual(anonymous.kitty, false, "an unnamed terminal proves nothing");
  assertEqual(anonymous.kittyPlaceholders, false, "placeholders need a name we trust");
});

test("a kitty error response still proves the protocol is parsed", () => {
  const reply = parseGraphicsProbeReply("\x1b_Gi=31;EBADF:bad payload\x1b\\\x1bP>|kitty(0.30.0)\x1b\\\x1b[?62c");
  assertEqual(reply.kittyCode, "EBADF", "status word");
  assertEqual(capabilityFromProbe(reply).kitty, true, "still a positive");
});

test("DA1 alone is a definitive negative; silence is not", () => {
  const answered = capabilityFromProbe(parseGraphicsProbeReply("\x1b[?62;22c"));
  assertEqual(answered.kitty, false, "kitty");
  assertEqual(answered.source, "query", "a sentinel makes the negative evidence");

  const silent = capabilityFromProbe(parseGraphicsProbeReply(""));
  assertEqual(silent.kitty, false, "kitty");
  assertEqual(silent.source, "denied", "no sentinel means no evidence, so no claim");
});

test("sixel is recorded as an exact DA1 member, never a substring", () => {
  assertEqual(parseGraphicsProbeReply("\x1b[?64;4;22c").daParams.includes("4"), true, "4 present");
  assertEqual(parseGraphicsProbeReply("\x1b[?64;14;22c").daParams.includes("4"), false, "14 must not match 4");
});

test("keystrokes typed during the window do not derail the parse", () => {
  const reply = parseGraphicsProbeReply("j\x1b_Gi=31;OK\x1b\\k\x1bP>|kitty(1.0.0)\x1b\\q\x1b[?62c");
  assertEqual(reply.kitty, true, "kitty");
  assertEqual(reply.terminalName, "kitty(1.0.0)", "name");
  assertEqual(reply.sentinel, true, "sentinel");
});

asyncTest("Apple Terminal receives ZERO probe bytes", async () => {
  const io = new FakeTerminal();
  const cap = await probeGraphics(io, {
    env: { TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" } as NodeJS.ProcessEnv,
    isTTY: true,
  });
  assertEqual(io.bytesWritten, 0, "bytes written to Apple Terminal");
  assertEqual(io.writes.length, 0, "write() calls");
  assertEqual(io.rawModeCalls.length, 0, "raw mode must not even be touched");
  assertEqual(io.listeners.length, 0, "no stdin listener may be left attached");
  assertEqual(cap.source, "denied", "source");
  assertEqual(cap.kitty, false, "kitty");
  resetGraphicsCache();
});

asyncTest("no denied or settled environment emits a byte", async () => {
  for (const row of TABLE) {
    if (row.probe) continue;
    const io = new FakeTerminal();
    await probeGraphics(io, {
      env: row.env as NodeJS.ProcessEnv,
      isTTY: row.isTTY ?? true,
      ...(row.termType !== undefined ? { termType: row.termType } : {}),
    });
    assertEqual(io.bytesWritten, 0, `${row.name} wrote probe bytes`);
    assertEqual(io.listeners.length, 0, `${row.name} left a listener attached`);
  }
  resetGraphicsCache();
});

asyncTest("an ambiguous terminal is probed exactly once, in one write", async () => {
  const io = new FakeTerminal();
  io.script = ["\x1b_Gi=31;OK\x1b\\\x1bP>|kitty(0.32.2)\x1b\\\x1b[?62;4c"];
  const started = Date.now();
  const cap = await probeGraphics(io, { env: { TERM: "xterm-256color" } as NodeJS.ProcessEnv, isTTY: true });
  const elapsed = Date.now() - started;

  assertEqual(io.writes.length, 1, "the probe must be one batched write");
  assertEqual(io.writes[0], GRAPHICS_PROBE, "exact probe bytes");
  assertEqual(io.rawModeCalls[0], true, "raw mode enabled before reading");
  assertEqual(cap.kitty, true, "kitty");
  assertEqual(cap.kittyPlaceholders, true, "placeholders");
  assertEqual(cap.source, "query", "source");
  assert(elapsed < GRAPHICS_PROBE_TIMEOUT_MS, `the sentinel must end the wait early (took ${elapsed}ms)`);
  assertEqual(io.listeners.length, 0, "listener detached");
  resetGraphicsCache();
});

asyncTest("a reply split across chunks is reassembled", async () => {
  const io = new FakeTerminal();
  io.script = ["\x1b_Gi=31;", "OK\x1b\\\x1bP>|ghostty 1.1", ".0\x1b\\", "\x1b[?62c"];
  const cap = await probeGraphics(io, { env: { TERM: "xterm-256color" } as NodeJS.ProcessEnv, isTTY: true });
  assertEqual(cap.kitty, true, "kitty");
  assertEqual(cap.kittyPlaceholders, true, "placeholders");
  resetGraphicsCache();
});

asyncTest("a terminal that answers nothing cannot hang startup", async () => {
  const io = new FakeTerminal(); // empty script: total silence
  const started = Date.now();
  const cap = await probeGraphics(io, { env: { TERM: "xterm-256color" } as NodeJS.ProcessEnv, isTTY: true });
  const elapsed = Date.now() - started;

  assertEqual(cap.kitty, false, "kitty");
  assertEqual(cap.source, "denied", "silence is not evidence");
  assert(elapsed >= GRAPHICS_PROBE_TIMEOUT_MS - 20, `must actually wait for the deadline (took ${elapsed}ms)`);
  assert(elapsed < GRAPHICS_PROBE_TIMEOUT_MS + 250, `must not exceed the deadline (took ${elapsed}ms)`);
  assertEqual(io.listeners.length, 0, "listener detached after timeout");
  resetGraphicsCache();
});

asyncTest("a write that throws still settles the promise", async () => {
  const io = new FakeTerminal();
  io.throwOnWrite = true;
  const started = Date.now();
  const cap = await probeGraphics(io, { env: { TERM: "xterm-256color" } as NodeJS.ProcessEnv, isTTY: true });
  assert(Date.now() - started < GRAPHICS_PROBE_TIMEOUT_MS, "a dead terminal must not cost the full deadline");
  assertEqual(cap.kitty, false, "kitty");
  assertEqual(io.listeners.length, 0, "listener detached");
  resetGraphicsCache();
});

asyncTest("a probed verdict is published to the session and the memo", async () => {
  const io = new FakeTerminal();
  io.script = ["\x1b_Gi=31;OK\x1b\\\x1bP>|kitty(0.32.2)\x1b\\\x1b[?62c"];
  const cap = await probeGraphics(io, { env: { TERM: "xterm-256color" } as NodeJS.ProcessEnv, isTTY: true });
  assert(getGraphicsCapability() === cap, "the render path must see the probed verdict");
  assertEqual(detectGraphics().source, "query", "and so must a fresh detectGraphics()");
  resetGraphicsCache();
});

console.log("\n\x1b[1m  detectTerminal integration\x1b[0m\n");

test("existing fields are unchanged", () => {
  const caps = detectTerminal();
  assert(["truecolor", "256", "16", "none"].includes(caps.colorDepth), "colorDepth is a known mode");
  assertEqual(typeof caps.unicode, "boolean", "unicode");
  assertEqual(typeof caps.columns, "number", "columns");
  assertEqual(typeof caps.rows, "number", "rows");
  assertEqual(typeof caps.isTTY, "boolean", "isTTY");
  assertEqual(typeof caps.terminalName, "string", "terminalName");
  assertEqual(typeof caps.isAppleTerminal, "boolean", "isAppleTerminal");
  assert(caps.terminalName.length > 0, "terminalName is never empty");
});

test("new fields are populated", () => {
  withEnv({ ...CLEAN, TERM: "xterm-kitty" }, () => {
    const caps = detectTerminal();
    assertEqual(caps.term, "xterm-kitty", "term");
    assertEqual(caps.isMultiplexed, false, "isMultiplexed");
    assertEqual(typeof caps.graphics.kitty, "boolean", "graphics.kitty");
    assert(caps.graphics.reason.length > 0, "graphics.reason");
  });
});

test("TERM is normalised, not passed through raw", () => {
  withEnv({ ...CLEAN, TERM: "  XTERM-256color  " }, () => {
    assertEqual(detectTerminal().term, "xterm-256color", "term");
  });
});

test("a multiplexer is reported", () => {
  withEnv({ ...CLEAN, TERM: "screen-256color" }, () => {
    assertEqual(detectTerminal().isMultiplexed, true, "TERM=screen-256color");
  });
  withEnv({ ...CLEAN, TERM: "xterm-256color", TMUX: "/tmp/tmux-501/default,1,0" }, () => {
    assertEqual(detectTerminal().isMultiplexed, true, "TMUX set with a rewritten TERM");
  });
  withEnv({ ...CLEAN, TERM: "xterm-256color" }, () => {
    assertEqual(detectTerminal().isMultiplexed, false, "plain terminal");
  });
});

test("graphics reaches the render path through detectTerminal", () => {
  withEnv({ ...CLEAN, TERMINALTUI_GRAPHICS: "off", TERM: "xterm-kitty" }, () => {
    const caps = detectTerminal();
    assertEqual(caps.graphics.kitty, false, "override honoured");
    assertEqual(caps.graphics.source, "override", "source");
  });
});

test("a serve session reads the client's TERM, not the server's env", () => {
  withEnv({ ...CLEAN, TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" }, () => {
    const remote = detectTerminal({ termType: "xterm-kitty" });
    assertEqual(remote.graphics.kitty, true, "client capability");
    assertEqual(remote.term, "xterm-kitty", "term");
    assertEqual(remote.terminalName, "xterm-kitty", "terminalName");
    // ...while the local reading of the same process still sees Apple Terminal.
    assertEqual(detectTerminal().graphics.source, "denied", "local verdict unchanged");
    assertEqual(detectTerminal().isAppleTerminal, true, "isAppleTerminal");
  });
});

test("unicode detection: locale variants", () => {
  const cases: Array<[Record<string, string | undefined>, boolean, string]> = [
    [{ LANG: "en_US.UTF-8" }, true, "LANG UTF-8"],
    [{ LANG: "en_US.utf8" }, true, "LANG utf8"],
    [{ LANG: undefined, LC_ALL: "en_US.UTF-8" }, true, "LC_ALL UTF-8"],
    [{ LANG: undefined, LC_ALL: undefined, LC_CTYPE: "en_US.UTF-8" }, true, "LC_CTYPE UTF-8"],
    // POSIX precedence would say "no" here; we deliberately keep the OR, because
    // LC_ALL=C over a UTF-8 LANG is a sudo/CI artefact, not a font statement.
    [{ LC_ALL: "C", LANG: "en_US.UTF-8" }, true, "LC_ALL=C with a UTF-8 LANG"],
  ];
  for (const [patch, expected, label] of cases) {
    withEnv({ LANG: undefined, LC_ALL: undefined, LC_CTYPE: undefined, ...patch }, () => {
      // Only meaningful where the platform fallback is not already true.
      if (process.platform === "darwin" && !expected) return;
      assertEqual(detectTerminal().unicode, expected, label);
    });
  }
});

test("unicode detection: terminals whose font handling outranks the locale", () => {
  const markers: Array<[Record<string, string | undefined>, string]> = [
    [{ TERM: "xterm-kitty" }, "kitty TERM"],
    [{ KITTY_WINDOW_ID: "1" }, "KITTY_WINDOW_ID"],
    [{ TERM: "xterm-ghostty" }, "ghostty TERM"],
    [{ TERM_PROGRAM: "WezTerm" }, "WezTerm"],
    [{ TERM_PROGRAM: "iTerm.app" }, "iTerm2"],
    [{ TERM_PROGRAM: "vscode" }, "VS Code"],
    [{ WT_SESSION: "abc" }, "Windows Terminal"],
    [{ VTE_VERSION: "7600" }, "VTE family"],
    [{ KONSOLE_VERSION: "220400" }, "Konsole"],
    [{ ALACRITTY_WINDOW_ID: "1" }, "Alacritty"],
    [{ TERM: "foot" }, "foot"],
  ];
  for (const [patch, label] of markers) {
    withEnv(
      {
        LANG: undefined, LC_ALL: undefined, LC_CTYPE: undefined,
        TERM: undefined, TERM_PROGRAM: undefined, WT_SESSION: undefined,
        KITTY_WINDOW_ID: undefined, VTE_VERSION: undefined, KONSOLE_VERSION: undefined,
        ALACRITTY_WINDOW_ID: undefined, ALACRITTY_SOCKET: undefined,
        ...patch,
      },
      () => {
        assertEqual(detectTerminal().unicode, true, label);
      },
    );
  }
});

test("unicode detection never regresses the pre-existing signals", () => {
  // The old predicate: LANG/LC_ALL UTF-8, iTerm2, WezTerm, WT_SESSION, darwin.
  // Each must still be true, since the new predicate only ever adds clauses.
  const legacy: Array<Record<string, string | undefined>> = [
    { LANG: "de_DE.UTF-8" },
    { LANG: "de_DE.utf8" },
    { LC_ALL: "de_DE.UTF-8" },
    { TERM_PROGRAM: "iTerm.app" },
    { TERM_PROGRAM: "WezTerm" },
    { WT_SESSION: "x" },
  ];
  for (const patch of legacy) {
    withEnv({ LANG: undefined, LC_ALL: undefined, LC_CTYPE: undefined, TERM_PROGRAM: undefined, WT_SESSION: undefined, ...patch }, () => {
      assertEqual(detectTerminal().unicode, true, JSON.stringify(patch));
    });
  }
});

test("unicode has a floor: nothing known and no UTF-8 locale", () => {
  // macOS is unconditionally unicode-capable in this predicate (every system
  // font carries block elements), so the floor is only observable elsewhere.
  if (process.platform === "darwin") return;
  withEnv(
    {
      ...CLEAN,
      LANG: undefined, LC_ALL: undefined, LC_CTYPE: undefined,
      WT_SESSION: undefined, VTE_VERSION: undefined,
      ALACRITTY_WINDOW_ID: undefined, ALACRITTY_SOCKET: undefined,
      TERM: "vt100",
    },
    () => {
      assertEqual(detectTerminal().unicode, false, "unknown terminal, C locale");
    },
  );
});

// ─── Run the async block, then summarise ──────────────────

async function main(): Promise<void> {
  console.log("\n\x1b[1m  Active probe\x1b[0m\n");
  for (const { name, fn } of asyncTests) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err: any) {
      failed++;
      console.log(`  \x1b[31m✘\x1b[0m ${name}`);
      console.log(`    \x1b[31m${err?.message ?? err}\x1b[0m`);
    }
  }

  console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
  console.log("");

  if (failed > 0) process.exit(1);
}

void main();
