/**
 * Video playback: the clock, the transport, and the invariants that keep a
 * moving block from wrecking the page around it.
 *
 * Everything here runs against an INJECTED clock (`setNowFn`), so "a 90 ms
 * stall drops two frames" is asserted by advancing a number rather than by
 * sleeping. A test that slept would be both slow and flaky, and it could not
 * express the stall case at all.
 */
import { encodePack } from "../src/video/pack.js";
import {
  VideoPlayer, playersOf, rearm, registerPlayer, setNowFn, stopAllVideo,
  sweepPlayers, unregisterPlayer, videoActive,
} from "../src/video/player.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try { fn(); passed++; } catch (e: any) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
  }
}

function eq(got: unknown, want: unknown, what: string): void {
  if (got !== want) throw new Error(`${what}: got ${String(got)}, want ${String(want)}`);
}

console.log("\n  Video Playback Tests\n");

// ─── Fixtures ─────────────────────────────────────────────

/**
 * A pack whose "frames" are single bytes.
 *
 * The player never decodes in these tests — it only decides WHICH frame is
 * current — so a frame's payload only has to be distinguishable. Using one
 * byte keeps the whole fixture inside a few hundred bytes and makes the
 * zero-copy assertions easy to read.
 */
function fakePack(frameCount: number, fps = 10, delaysMs?: number[]): Uint8Array {
  const frames = Array.from({ length: frameCount }, (_, i) => new Uint8Array([i]));
  return encodePack({
    width: 64, height: 32, fps, frameCount,
    durationMs: delaysMs ? delaysMs.reduce((a, b) => a + b, 0) : (frameCount / fps) * 1000,
    sourceSha1: "0".repeat(40),
    ...(delaysMs ? { delaysMs } : {}),
  }, frames);
}

/** Drive the clock by hand. Returns a setter. */
function fakeClock(start = 1_000_000): (t: number) => void {
  let t = start;
  setNowFn(() => t);
  return (next: number) => { t = next; };
}

// ─── Frame selection is arithmetic ────────────────────────

test("frame index derives from wall clock, not a counter", () => {
  const at = fakeClock(1000);
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true }); // 100 ms/frame
  eq(p.currentFrame(), 0, "at t+0");
  at(1050); eq(p.currentFrame(), 0, "at t+50ms");
  at(1100); eq(p.currentFrame(), 1, "at t+100ms");
  at(1250); eq(p.currentFrame(), 2, "at t+250ms");
});

test("a stall DROPS frames rather than replaying them", () => {
  const at = fakeClock(1000);
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  eq(p.currentFrame(), 0, "start");
  // 90 ms of nothing, then the process wakes up 350 ms late.
  at(1350);
  eq(p.currentFrame(), 3, "after a 350ms gap the target is frame 3, not frame 1");
  // The point of the property: the NEXT observation is also absolute, so the
  // player never speeds up to catch back up.
  at(1450);
  eq(p.currentFrame(), 4, "still one frame per 100ms after the stall");
});

test("looping wraps and keeps constant cost after many cycles", () => {
  const at = fakeClock(0);
  const p = new VideoPlayer(fakePack(4, 10), { autoplay: true, loop: true }); // 400ms loop
  at(400); eq(p.currentFrame(), 0, "one full loop returns to 0");
  at(500); eq(p.currentFrame(), 1, "into the second loop");
  // An hour later: still correct, and computed without walking an hour of frames.
  at(3_600_000); eq(p.currentFrame(), 0, "an hour in, exactly on a loop boundary");
  at(3_600_250); eq(p.currentFrame(), 2, "an hour in, mid-loop");
});

test("a non-looping video parks on its last frame and stops playing", () => {
  const at = fakeClock(0);
  const p = new VideoPlayer(fakePack(4, 10), { autoplay: true, loop: false });
  at(1000);
  eq(p.currentFrame(), 3, "parks on the last frame");
  eq(p.playing, false, "and stops asking for repaints");
  eq(p.nextDueAt(), null, "so it has no next due time");
});

test("per-frame delays are honoured, not averaged into an fps", () => {
  const at = fakeClock(0);
  // Frame 0 is held for a second; the rest run at 40 ms.
  const p = new VideoPlayer(fakePack(4, 12, [1000, 40, 40, 40]), { autoplay: true });
  at(500); eq(p.currentFrame(), 0, "still on the held frame at 500ms");
  at(999); eq(p.currentFrame(), 0, "still on it at 999ms");
  at(1000); eq(p.currentFrame(), 1, "moves at 1000ms");
  at(1040); eq(p.currentFrame(), 2, "then every 40ms");
});

test("the fps cap can only slow playback down, never speed it up", () => {
  // Each player is constructed at a KNOWN clock value, because the epoch is
  // taken from now() at construction — building both up front and then moving
  // the clock once would give them different epochs and assert nothing.
  const at = fakeClock(0);
  // A 10 fps pack asked to play at 60: there are no frames in between.
  const fast = new VideoPlayer(fakePack(10, 10), { autoplay: true, fps: 60 });
  at(100); eq(fast.currentFrame(), 1, "60fps request on a 10fps pack still advances at 10fps");

  at(0);
  const slow = new VideoPlayer(fakePack(10, 10), { autoplay: true, fps: 2 });
  at(100); eq(slow.currentFrame(), 0, "a 2fps cap holds frame 0 past 100ms");
  at(500); eq(slow.currentFrame(), 1, "and moves at 500ms");
});

// ─── Transport ────────────────────────────────────────────

test("pause holds the current frame; resume rebases the epoch", () => {
  const at = fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  at(250);
  eq(p.currentFrame(), 2, "playing");
  p.pause();
  at(5000);
  eq(p.currentFrame(), 2, "paused frames do not advance, however long the pause");
  eq(p.playing, false, "state is paused");
  p.play();
  at(5100);
  eq(p.currentFrame(), 3, "resuming continues from where it stopped, not from where the clock is");
});

test("seek moves and pauses; it wraps when looping", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10), { poster: 0 });
  p.seekBy(3); eq(p.currentFrame(), 3, "forward");
  p.seekBy(-1); eq(p.currentFrame(), 2, "back");
  p.seekBy(-5); eq(p.currentFrame(), 7, "wraps backwards past zero");
  p.seekBy(5); eq(p.currentFrame(), 2, "wraps forwards past the end");
});

test("toggle round-trips", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10));
  eq(p.playing, false, "starts idle without autoplay");
  p.toggle(); eq(p.playing, true, "toggled to playing");
  p.toggle(); eq(p.playing, false, "toggled back");
});

test("autoplay is OFF by default", () => {
  fakeClock(0);
  eq(new VideoPlayer(fakePack(10, 10)).playing, false, "default");
  eq(new VideoPlayer(fakePack(10, 10), { autoplay: true }).playing, true, "explicit opt-in");
});

test("a frozen player cannot be started BY ANY ROUTE", () => {
  const at = fakeClock(0);
  // The guarantee `TERMINALTUI_VIDEO=off` makes to a screenshot tool or a test
  // harness is that the screen will not change. An earlier version only
  // suppressed autoplay, so pressing Space un-froze it and the emulator's
  // waitForIdle started throwing — caught by the e2e suite, pinned here.
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true, frozen: true });
  eq(p.playing, false, "autoplay is refused");
  p.play();   eq(p.playing, false, "play() is refused");
  p.toggle(); eq(p.playing, false, "toggle() is refused");
  at(5000);   eq(p.currentFrame(), 0, "and the frame never advances");
});

test("a frozen player still seeks, so the transport is not dead", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10), { frozen: true });
  p.seekBy(3);
  eq(p.currentFrame(), 3, "seeking is a deliberate, bounded change — not motion");
});

// ─── The identity invariant ───────────────────────────────

test("repaints between ticks return the IDENTICAL rows instance", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10));
  const rows = ["a", "b"];
  p.putRows("k1", rows);
  const first = p.cachedRows("k1");
  const second = p.cachedRows("k1");
  if (first !== rows || second !== rows) throw new Error("memo did not return the same instance");
  if (first !== second) throw new Error("two reads returned different instances");
  eq(p.cachedRows("k2"), null, "a different key misses");
});

test("the memo holds exactly one entry, so it cannot evict the image caches", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10));
  p.putRows("k1", ["a"]);
  p.putRows("k2", ["b"]);
  eq(p.cachedRows("k1"), null, "the older entry is gone");
  if (p.cachedRows("k2") === null) throw new Error("the newest entry should be held");
});

test("lastGoodRows survives a miss, so a corrupt frame re-shows the last picture", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(10, 10));
  const good = ["picture"];
  p.putRows("k1", good);
  p.putRows("k2", ["next"]);
  if (p.lastGoodRows === null) throw new Error("lastGoodRows was cleared");
});

// ─── Failure paths never throw ────────────────────────────

test("a malformed pack yields an error player rather than an exception", () => {
  fakeClock(0);
  for (const [name, bytes] of [
    ["empty", new Uint8Array(0)],
    ["3 bytes", new Uint8Array([1, 2, 3])],
    ["wrong magic", new Uint8Array([0x41, 0x42, 0x43, 0x44, 0, 0, 0, 0])],
    ["truncated", fakePack(10, 10).subarray(0, 20)],
  ] as Array<[string, Uint8Array]>) {
    let p: VideoPlayer;
    try {
      p = new VideoPlayer(bytes);
    } catch (e: any) {
      throw new Error(`${name} threw: ${e.message}`);
    }
    eq(p.state, "error", `${name} state`);
    if (p.loadError === null) throw new Error(`${name} reported no error`);
    // And every accessor must stay safe on an error player.
    eq(p.currentFrame(), 0, `${name} currentFrame`);
    eq(p.frameCount, 0, `${name} frameCount`);
    eq(p.nextDueAt(), null, `${name} nextDueAt`);
    eq(p.frameBytes(0), null, `${name} frameBytes`);
    eq(p.size, null, `${name} size`);
    p.play(); p.pause(); p.toggle(); p.seekBy(3); // must not throw
  }
});

test("a missing file yields an error player", () => {
  fakeClock(0);
  const p = new VideoPlayer("/nonexistent/nope.tvf");
  eq(p.state, "error", "state");
  if (p.loadError === null) throw new Error("expected a load error");
});

test("a single-frame pack never schedules", () => {
  fakeClock(0);
  const p = new VideoPlayer(fakePack(1, 10), { autoplay: true });
  eq(p.playing, false, "one frame is a still, not a video");
});

// ─── The scheduler ────────────────────────────────────────

/** Minimal Repaintable that counts renders. */
function fakeRuntime(): { render(): void; renders: number } {
  return { renders: 0, render() { this.renders++; } };
}

test("the clock disarms when nothing is playing and arms when something is", () => {
  fakeClock(0);
  const rt = fakeRuntime();
  const p = new VideoPlayer(fakePack(10, 10));
  registerPlayer(rt, p);
  eq(videoActive(rt), false, "idle player: inactive");
  p.play();
  rearm(rt);
  eq(videoActive(rt), true, "playing: active");
  p.pause();
  rearm(rt);
  eq(videoActive(rt), false, "paused again: inactive");
  stopAllVideo(rt);
});

test("one schedule serves all players on a runtime", () => {
  fakeClock(0);
  const rt = fakeRuntime();
  const a = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  const b = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  registerPlayer(rt, a);
  registerPlayer(rt, b);
  eq(playersOf(rt).length, 2, "both registered");
  unregisterPlayer(rt, a);
  eq(playersOf(rt).length, 1, "one removed");
  stopAllVideo(rt);
  eq(playersOf(rt).length, 0, "all cleared");
});

test("a player the renderer stopped stamping is swept after two passes", () => {
  fakeClock(0);
  const rt = fakeRuntime();
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  registerPlayer(rt, p);
  p.renderSeq = 5;

  sweepPlayers(rt, 6);
  eq(playersOf(rt).length, 1, "one missed pass is not enough (a clipped panel scrolls)");
  sweepPlayers(rt, 7);
  eq(playersOf(rt).length, 0, "two missed passes means the block left the tree");
  eq(p.playing, false, "and the departed player is paused");
});

test("nextDueAt is in the future while playing", () => {
  const at = fakeClock(1000);
  const p = new VideoPlayer(fakePack(10, 10), { autoplay: true });
  const due = p.nextDueAt();
  if (due === null) throw new Error("a playing player must have a due time");
  if (due <= 1000) throw new Error(`due time ${due} is not in the future`);
  at(due);
  if (p.currentFrame() === 0) throw new Error("the frame did not advance at its due time");
});

// ─── Restore the real clock ───────────────────────────────
setNowFn(() => Date.now());

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
