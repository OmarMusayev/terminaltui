#!/usr/bin/env npx tsx
/**
 * The kitty graphics LIFECYCLE, driven through a real `TUIRuntime` against a
 * fake terminal.
 *
 * `test-image-kitty.ts` pins the wire format and the render path; this pins the
 * four properties that only exist once a runtime is carrying the payload, and
 * each of them shipped broken:
 *
 *  1. A resize does not re-send pixels the terminal already holds. It used to
 *     delete and re-transmit every on-screen image on EVERY SIGWINCH — 1963 KiB
 *     and 15 ms per event for a 99-column image, with the geometry unchanged.
 *  2. An image the viewer cannot see is not transmitted. The page is composed
 *     in full and then sliced to the viewport, so `renderBlock` runs for blocks
 *     that scrolled away; every one of them used to push a full transmission.
 *  3. A transmission that cannot be built DEMOTES to cells. It used to leave a
 *     permanent grid of placeholder cells addressing pixels that never arrived,
 *     re-deriving the same failure every frame.
 *  4. A playing video PRELOADS replacement pixels before swapping placeholder
 *     ids, then deletes the departed id. Placing before transmitting exposed a
 *     blank wallpaper frame while the terminal decoded every replacement.
 */
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TUIRuntime } from "../src/core/runtime.js";
import type { Site } from "../src/config/types.js";
import type { TerminalIO } from "../src/core/terminal-io.js";
import { image, video } from "../src/index.js";
import { encodePack } from "../src/video/pack.js";
import { setNowFn, stopAllVideo } from "../src/video/player.js";
import { setColorMode } from "../src/style/colors.js";
import { clearImageCache } from "../src/image/cache.js";
import { PLACEHOLDER_CHAR, __resetImageIds } from "../src/image/kitty.js";
import { setGraphicsCapability } from "../src/image/capability.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${msg}\x1b[0m`);
  }
}

function assert(ok: boolean, msg: string): void {
  if (!ok) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
}

// ─── Fake terminal ────────────────────────────────────────

/** Records every byte the runtime writes, and can be resized on demand. */
class FakeIO implements TerminalIO {
  written: string[] = [];
  columns = 100;
  rows = 40;
  termType = "xterm-kitty";
  private resizeCbs: Array<(c: number, r: number) => void> = [];
  write(data: string): void { this.written.push(data); }
  onResize(cb: (c: number, r: number) => void): void { this.resizeCbs.push(cb); }
  onData(): void { /* no input in these tests */ }
  removeDataListener(): void { /* no input in these tests */ }
  setRawMode(): void { /* not a real tty */ }
  dispose(): void { /* nothing to release */ }
  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    for (const cb of this.resizeCbs) cb(columns, rows);
  }
  /** Bytes written since the marker, as one string. */
  since(mark: number): string { return this.written.slice(mark).join(""); }
  get mark(): number { return this.written.length; }
}

/** Transmissions in a byte stream: `ESC _ G ... a=T ... ESC \`. */
function transmitCount(bytes: string): number {
  return (bytes.match(/\x1b_G[^\x1b]*a=T/g) ?? []).length;
}
/** Deletes in a byte stream. */
function deleteCount(bytes: string): number {
  return (bytes.match(/\x1b_Ga=d/g) ?? []).length;
}
/** Placeholder cells in a byte stream. */
function placeholderCount(bytes: string): number {
  let n = 0;
  for (const ch of bytes) if (ch === PLACEHOLDER_CHAR) n++;
  return n;
}

// A real decodable PNG, copied per test so `chmod` cannot leak between them.
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "gradient-200x100.png");

let dir = "";
let serial = 0;
function setup(): { path: string } {
  clearImageCache();
  __resetImageIds();
  setColorMode("truecolor");
  setGraphicsCapability({
    kitty: true, kittyPlaceholders: true, source: "override", reason: "test",
  });
  const path = join(dir, `pic-${serial++}.png`);
  copyFileSync(FIXTURE, path);
  chmodSync(path, 0o644);
  return { path };
}

/** A tiny two-frame pack for exercising the moving pixel lifecycle. */
function videoPack(): string {
  const frame = new Uint8Array(readFileSync(FIXTURE));
  const path = join(dir, `clip-${serial++}.tvf`);
  writeFileSync(path, encodePack({
    width: 200,
    height: 100,
    fps: 12,
    frameCount: 2,
    durationMs: 167,
    sourceSha1: "0".repeat(40),
  }, [frame, frame]));
  return path;
}

/** Build a runtime whose one content page holds `blocks`. */
function runtimeWith(blocks: unknown[], io: FakeIO): TUIRuntime {
  const site: Site = {
    config: {
      name: "graphics",
      theme: "tokyoNight",
      pages: [
        { id: "home", title: "Home", content: [] },
        { id: "pics", title: "Pics", content: blocks as never },
      ],
    },
  } as unknown as Site;
  const rt = new TUIRuntime(site, io);
  // Publish the pixel verdict for this session the way startInner() would; the
  // tests never call start(), which would take over the real process's stdio.
  (rt as unknown as { graphicsCapability: unknown }).graphicsCapability = {
    kitty: true, kittyPlaceholders: true, source: "override", reason: "test",
  };
  rt.navigateToPage("pics");
  return rt;
}

console.log("\n\x1b[1m  Kitty graphics lifecycle\x1b[0m\n");

dir = mkdtempSync(join(tmpdir(), "tui-gfx-"));
try {
  test("Every playing video frame transmits, places, then deletes in that order", () => {
    setup();
    const io = new FakeIO();
    let clock = 1_000_000;
    const restoreNow = setNowFn(() => clock);
    let rt: TUIRuntime | null = null;
    try {
      rt = runtimeWith([video(videoPack(), { width: 20, autoplay: true })], io);

      const firstTransmit = io.written.findIndex(bytes => bytes.includes("\x1b_G") && bytes.includes("a=T"));
      const firstPlacement = io.written.findIndex(bytes => bytes.includes(PLACEHOLDER_CHAR));
      assert(firstTransmit >= 0, "the first video frame must transmit pixels");
      assert(firstPlacement >= 0, "the first video frame must place placeholder cells");
      assert(
        firstTransmit < firstPlacement,
        `first transmit write ${firstTransmit} must precede placement write ${firstPlacement}`,
      );

      // Each tick allocates a new image id. The old frame must stay on screen
      // until the replacement pixels exist and its placeholder rows are swapped;
      // only then is deleting the departed id safe.
      for (let tick = 1; tick <= 3; tick++) {
        const mark = io.mark;
        clock += 100;
        rt.render();
        const writes = io.written.slice(mark);
        const transmitAt = writes.findIndex(bytes => bytes.includes("\x1b_G") && bytes.includes("a=T"));
        const placementAt = writes.findIndex(bytes => bytes.includes(PLACEHOLDER_CHAR));
        const deleteAt = writes.findIndex(bytes => bytes.includes("\x1b_Ga=d"));
        assert(transmitAt >= 0, `tick ${tick} must transmit replacement pixels`);
        assert(placementAt >= 0, `tick ${tick} must place the replacement id`);
        assert(deleteAt >= 0, `tick ${tick} must delete the departed id`);
        assert(
          transmitAt < placementAt && placementAt < deleteAt,
          `tick ${tick} write order must be transmit < placement < delete, got ` +
            `${transmitAt} < ${placementAt} < ${deleteAt}`,
        );
      }
    } finally {
      if (rt !== null) stopAllVideo(rt);
      setNowFn(restoreNow);
    }
  });

  test("A resize re-emits the placement cells and re-sends NO pixels", () => {
    const { path } = setup();
    const io = new FakeIO();
    const rt = runtimeWith([image(path, { width: 20 })], io);

    rt.render();
    const first = io.since(0);
    assertEqual(transmitCount(first), 1, "first paint transmits once");
    assert(placeholderCount(first) > 0, "first paint carries placement cells");

    // Twelve resize events, none of which changes the image's geometry: the
    // block is a fixed 20 cells wide, so the id and the pixels are unchanged.
    // This is verbatim what the SIGWINCH handler does per event.
    let m = io.mark;
    for (let i = 0; i < 12; i++) {
      io.resize(100 + (i % 2), 40);
      rt.invalidateFrame();
      rt.render();
    }
    const storm = io.since(m);
    assertEqual(transmitCount(storm), 0, "a resize storm re-transmits nothing");
    assertEqual(deleteCount(storm), 0, "a resize storm deletes nothing");
    assert(placeholderCount(storm) > 0, "the placement cells are re-emitted");

    // And the image is still live: navigating away frees exactly one id.
    m = io.mark;
    rt.navigateToPage("home");
    rt.render();
    assertEqual(deleteCount(io.since(m)), 1, "leaving the page frees the image");
  });

  test("A fitPage image re-transmits once per height it is actually resized to", () => {
    // The one real cost `fitPage` adds, pinned rather than hidden. A page-fit
    // image's geometry depends on the terminal's ROW count, and both image cache
    // keys carry cols/rows — so a height change is a fresh decode, a new kitty
    // image id and a full base64 retransmission. The guard above only varies
    // COLUMNS at a fixed 40 rows and would never catch it.
    //
    // What must NOT happen is a transmission per FRAME. Six distinct heights,
    // rendered twice each: the second render at a height must re-send nothing,
    // because the size — and therefore the id — is unchanged.
    const { path } = setup();
    const io = new FakeIO();
    // A six-row filler above the picture, so the leftover stays well under the
    // 99-column ceiling and every height below really does produce a different
    // geometry. Without it the column ceiling caps growth and most of these
    // heights collapse onto one size — which is a real and welcome mitigation,
    // but it would make this test pass for the wrong reason.
    const filler = { type: "custom", render: () => ["F", "F", "F", "F", "F", "F"] };
    io.rows = 24;
    const rt = runtimeWith([filler, image(path, { fitPage: true })], io);

    rt.render();
    assertEqual(transmitCount(io.since(0)), 1, "the first paint transmits once");

    const heights = [26, 28, 30, 32, 34, 36];
    const m = io.mark;
    for (const rows of heights) {
      for (let repeat = 0; repeat < 2; repeat++) {
        io.resize(100, rows);
        rt.invalidateFrame();
        rt.render();
      }
    }
    const sent = transmitCount(io.since(m));
    assertEqual(sent, heights.length, "one transmission per distinct height, none per repeat frame");

    // And a column-only resize, which cannot move a row budget, is still free.
    const m2 = io.mark;
    for (let i = 0; i < 6; i++) {
      io.resize(100 + (i % 2), 36);
      rt.invalidateFrame();
      rt.render();
    }
    assertEqual(transmitCount(io.since(m2)), 0, "width-only churn re-transmits nothing");
  });

  test("Images outside the viewport are not transmitted until they scroll in", () => {
    const { path } = setup();
    const io = new FakeIO();
    io.rows = 20;
    // Six images of 20 cells (10 rows each): far more than a 20-row terminal
    // can show at once.
    const blocks = Array.from({ length: 6 }, () => image(path, { width: 20 }));
    const rt = runtimeWith(blocks, io);

    rt.render();
    const first = io.since(0);
    const sent = transmitCount(first);
    assert(sent >= 1, `something is transmitted (got ${sent})`);
    assert(sent <= 2, `at most the visible images transmit, got ${sent} of 6`);
  });

  test("A source that stops decoding demotes to cells instead of tofu", () => {
    const { path } = setup();
    const io = new FakeIO();
    const rt = runtimeWith([image(path, { width: 20 })], io);

    rt.render();
    assertEqual(transmitCount(io.since(0)), 1, "the first paint transmits");

    // Same size, same mtime — so `imageIdentity()` yields the identical cache
    // key and the entry is a HIT whose `pending` buffer was already consumed.
    chmodSync(path, 0o000);
    rt.navigateToPage("home");
    rt.render();
    rt.navigateToPage("pics");

    // The frame that discovers the failure may still carry placement cells;
    // every frame after it must not.
    rt.render();
    const m = io.mark;
    for (let i = 0; i < 5; i++) {
      rt.invalidateFrame();
      rt.render();
    }
    const after = io.since(m);
    assertEqual(placeholderCount(after), 0, "no placeholder cells survive the failure");
    assertEqual(transmitCount(after), 0, "no transmission is retried");
    chmodSync(path, 0o644);
  });

  test("A frame whose write throws re-transmits on the next frame", () => {
    const { path } = setup();
    const io = new FakeIO();
    const rt = runtimeWith([image(path, { width: 20 })], io);
    rt.render();

    // Arm the failure only now: navigation renders, and a throw there would
    // escape before the test could see it. Drop the image so the next frame
    // owes a fresh transmission.
    rt.navigateToPage("home");
    rt.render();
    let boom = true;
    const real = io.write.bind(io);
    io.write = (data: string): void => {
      // Fail only the graphics payload, so the frame itself still composes.
      if (boom && data.includes("\x1b_G")) { boom = false; throw new Error("EPIPE"); }
      real(data);
    };
    // Navigation renders, so the failing write may land inside either call.
    try { rt.navigateToPage("pics"); rt.render(); } catch { /* propagates once */ }
    assert(!boom, "the payload write was attempted and failed");

    const m = io.mark;
    rt.invalidateFrame();
    rt.render();
    assertEqual(transmitCount(io.since(m)), 1, "the dropped transmission is retried");
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m${failed > 0 ? `, \x1b[31m${failed} failed\x1b[0m` : ", 0 failed"}\n`);
if (failed > 0) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
export {};
