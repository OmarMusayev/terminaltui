/**
 * InputManager escape-sequence parsing — the seams an adversarial review found.
 *
 * The parser learned to swallow terminator-delimited terminal replies (OSC/DCS/
 * APC/PM/SOS) so a kitty graphics ack could not type `_ G i = 3 1 ; O K` into
 * the app. Two regressions came with it and neither was reachable from any
 * existing assertion:
 *
 *  1. The grace period for a half-arrived reply was a SILENCE window that
 *     `handleData` re-armed on every chunk, so typing after a stray ESC + `]`
 *     froze the UI for as long as the user kept typing (3.7 s measured).
 *  2. An un-terminated run was dropped wholesale, so ESC + `]` + arrow ate all
 *     three keys instead of the two real ones being delivered.
 *
 * Everything here drives the real InputManager through a fake TerminalIO, at
 * real wall-clock timings, because both defects are about WHEN keys arrive.
 */
import { InputManager } from "../src/core/input.js";
import type { TerminalIO } from "../src/core/terminal-io.js";

let passed = 0;
let failed = 0;
const pending: Array<{ name: string; fn: () => Promise<void> }> = [];

function test(name: string, fn: () => Promise<void>): void {
  pending.push({ name, fn });
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** A TerminalIO that only remembers the data listener, so tests can feed bytes. */
function harness(): {
  im: InputManager;
  feed: (bytes: string) => void;
  keys: string[];
  stamped: Array<{ name: string; at: number }>;
  stop: () => void;
} {
  let listener: ((data: string) => void) | null = null;
  const io = {
    setRawMode() {},
    onData(fn: (data: string) => void) { listener = fn; },
    removeDataListener() { listener = null; },
    write() {},
  } as unknown as TerminalIO;

  const im = new InputManager();
  im.attachIO(io);
  im.start();

  const keys: string[] = [];
  const stamped: Array<{ name: string; at: number }> = [];
  const t0 = Date.now();
  im.on("keypress", (k: { name: string }) => {
    keys.push(k.name);
    stamped.push({ name: k.name, at: Date.now() - t0 });
  });

  return { im, feed: (bytes: string) => listener?.(bytes), keys, stamped, stop: () => im.stop() };
}

console.log("\n\x1b[1m  Input parser\x1b[0m\n");

// ─── Terminal replies are still swallowed ─────────────────

test("a complete OSC reply is swallowed and emits nothing", async () => {
  const h = harness();
  h.feed("\x1b]11;rgb:1e1e/1e1e/1e1e\x07");
  h.feed("a");
  await sleep(120);
  assertEqual(h.keys, ["a"], "only the real keystroke survives");
  h.stop();
});

test("a kitty APC ack split across reads is swallowed", async () => {
  const h = harness();
  h.feed("\x1b_Gi=31");
  await sleep(30);
  h.feed(";OK\x1b\\");
  h.feed("b");
  await sleep(120);
  assertEqual(h.keys, ["b"], "the ack must not be typed as keystrokes");
  h.stop();
});

// ─── Regression 1: the hold is a deadline, not a silence window ────

test("continuous typing after a stray ESC + ] cannot stall the UI indefinitely", async () => {
  const h = harness();
  h.feed("\x1b");
  h.feed("]");
  // Keys at 100 ms — well inside the 500 ms window, so a silence-based timer
  // would re-arm forever and deliver nothing until the user stopped.
  for (const ch of "hello world") {
    await sleep(100);
    h.feed(ch);
  }
  const delivered = h.keys.length;
  assert(
    delivered >= 6,
    `keys must flow while typing continues (got ${delivered} of 13 during ~1.1 s of typing)`,
  );
  const last = h.stamped[h.stamped.length - 1];
  assert(last.at < 1500, `last key delivered at ${last.at} ms, should track typing`);
  await sleep(120);
  assertEqual(h.keys.length, 13, "escape + ] + 11 characters, all eventually delivered");
  h.stop();
});

test("the string-sequence deadline is absolute: ~500 ms from the first partial byte", async () => {
  const h = harness();
  const t0 = Date.now();
  h.feed("\x1b_");
  // Keep feeding inside the window without ever terminating the sequence.
  for (let i = 0; i < 4; i++) {
    await sleep(150);
    h.feed("x");
  }
  await sleep(250);
  assert(h.keys.length > 0, "the buffer must drain rather than grow forever");
  const first = h.stamped[0].at;
  assert(
    first >= 400 && first <= 900,
    `first delivery at ${first} ms should sit near the 500 ms deadline, not after ${Date.now() - t0} ms of typing`,
  );
  h.stop();
});

// ─── Regression 2: an abandoned run is not a reply ────────

test("ESC + introducer + a real key delivers all three, not just the last", async () => {
  for (const intro of ["]", "P", "_", "^", "X"]) {
    const h = harness();
    h.feed("\x1b");
    h.feed(intro);
    h.feed("\x1b[A");
    await sleep(150);
    // The introducer re-parses as the literal character the user typed; the
    // key NAME for an uppercase letter is that letter (parseChar keeps case).
    assertEqual(h.keys, ["escape", intro, "up"], `ESC + ${intro} + up`);
    h.stop();
  }
});

test("ESC + ] + each of several follower keys keeps every keystroke", async () => {
  const followers: Array<[string, string]> = [
    ["\x1b[A", "up"],
    ["\x1b[H", "home"],
    ["\x1b[3~", "delete"],
    ["\x1b[Z", "tab"],
    ["\x1bOA", "up"],
  ];
  for (const [bytes, name] of followers) {
    const h = harness();
    h.feed("\x1b]");
    h.feed(bytes);
    await sleep(150);
    assertEqual(h.keys, ["escape", "]", name], `ESC ] then ${name}`);
    h.stop();
  }
});

// ─── Ordinary keys are untouched ──────────────────────────

test("arrows, SS3 arrows and split-across-reads arrows are unchanged", async () => {
  const h = harness();
  h.feed("\x1b[A\x1b[B\x1b[C\x1b[D");
  h.feed("\x1bOA");
  h.feed("\x1b");
  await sleep(10);
  h.feed("[D");
  await sleep(120);
  assertEqual(h.keys, ["up", "down", "right", "left", "up", "left"], "cursor keys");
  h.stop();
});

test("a lone Escape still arrives at the short timeout", async () => {
  const h = harness();
  h.feed("\x1b");
  await sleep(120);
  assertEqual(h.keys, ["escape"], "bare escape");
  assert(h.stamped[0].at < 200, `bare escape took ${h.stamped[0].at} ms`);
  h.stop();
});

// ─── Run ──────────────────────────────────────────────────

(async () => {
  for (const { name, fn } of pending) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err: unknown) {
      failed++;
      console.log(`  \x1b[31m✘\x1b[0m ${name}`);
      console.log(`    \x1b[31m${(err as Error)?.message ?? err}\x1b[0m`);
    }
  }

  console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
  console.log("");
  if (failed > 0) process.exit(1);
})();
