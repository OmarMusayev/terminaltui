/**
 * Video layout: the two independent walks must agree, every frame.
 *
 * `flex-engine.estimateBlockHeight` reserves rows for a block and
 * `renderVideo` draws them, and they are separate code paths that never
 * consult each other. When they disagree, every FocusRect below the block
 * lands at the wrong Y and the arrow keys select the wrong thing — the
 * documented `case "image": return 10` defect, which this file exists to stop
 * happening again for video.
 *
 * The other half is invariant #2: the row count must be the SAME in every
 * state a block can be in — playing, paused, still packing, missing, corrupt.
 * A block that is 3 rows while it loads and 20 rows once it decodes moves the
 * page under the viewer's cursor.
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { video } from "../src/config/parser.js";
import { encodePack } from "../src/video/pack.js";
import { renderVideo, videoBlockRows, videoCellSize } from "../src/components/Video.js";
import { clearVideoSourceCache } from "../src/video/source.js";
import { setGraphicsCapability } from "../src/image/capability.js";
import { setGraphicsSink } from "../src/components/Image.js";
import { setNowFn } from "../src/video/player.js";
import { focusSlotsOf, frameHintRows, isControlledVideo } from "../src/image/frame.js";
import { setColorMode } from "../src/style/colors.js";
import jpeg from "jpeg-js";
import { themes } from "../src/style/theme.js";
import type { RenderContext } from "../src/components/base.js";

setColorMode("truecolor");

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

console.log("\n  Video Layout Tests\n");

// ─── A real pack on disk ──────────────────────────────────

const DIR = join(tmpdir(), `tui-video-layout-${process.pid}`);
mkdirSync(DIR, { recursive: true });

/**
 * A pack of real JPEGs.
 *
 * Real ones, not stubs: half of what this file asserts is that the DECODE path
 * and the failure path produce the same row count, and a stub frame would only
 * ever exercise the failure path.
 */
function realPack(frameCount: number, w = 64, h = 32): string {
  // Encoded with the same encoder the packer uses, so these are byte-for-byte
  // the kind of frame a real pack holds.
  const frames: Uint8Array[] = [];
  for (let i = 0; i < frameCount; i++) {
    const data = Buffer.alloc(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      data[p * 4] = (i * 20) % 256; data[p * 4 + 1] = 128; data[p * 4 + 2] = 200; data[p * 4 + 3] = 255;
    }
    frames.push(new Uint8Array(jpeg.encode({ data, width: w, height: h }, 80).data));
  }
  const bytes = encodePack({
    width: w, height: h, fps: 10, frameCount,
    durationMs: (frameCount / 10) * 1000, sourceSha1: "0".repeat(40),
  }, frames);
  const path = join(DIR, `pack-${frameCount}-${w}x${h}.tvf`);
  writeFileSync(path, bytes);
  return path;
}

const PACK = realPack(6);
const BROKEN = join(DIR, "broken.tvf");
writeFileSync(BROKEN, Buffer.from("TVF1garbage-not-a-pack"));

function ctx(width: number, panelHeight?: number): RenderContext {
  return { width, theme: themes.nord, borderStyle: "rounded", panelHeight } as RenderContext;
}

const RT = { render() { /* no repaints in a layout test */ } };
let keySeq = 0;
function draw(block: ReturnType<typeof video>, c: RenderContext): string[] {
  return renderVideo(block, c, { rt: RT, blockKey: `k${keySeq++}`, projectDir: DIR });
}

// ─── The estimator agrees with the renderer ───────────────

test("reserved rows equal drawn rows, at several widths", () => {
  for (const width of [20, 40, 60, 99]) {
    const block = video(PACK, {});
    const reserved = videoBlockRows(block, width, undefined, DIR);
    const drawn = draw(block, ctx(width)).length;
    eq(drawn, reserved, `width ${width}`);
  }
});

test("reserved rows equal drawn rows with a border", () => {
  for (const width of [20, 40, 60]) {
    const block = video(PACK, { border: true });
    const reserved = videoBlockRows(block, width, undefined, DIR);
    const drawn = draw(block, ctx(width)).length;
    eq(drawn, reserved, `bordered width ${width}`);
  }
});

test("reserved rows equal drawn rows with controls (the transport row)", () => {
  for (const width of [30, 60]) {
    const block = video(PACK, { controls: true });
    const reserved = videoBlockRows(block, width, undefined, DIR);
    const drawn = draw(block, ctx(width)).length;
    eq(drawn, reserved, `controls width ${width}`);
  }
});

test("reserved rows equal drawn rows inside a panel (panelHeight binds)", () => {
  for (const h of [8, 14, 30]) {
    const block = video(PACK, { border: true });
    const reserved = videoBlockRows(block, 40, h, DIR);
    const drawn = draw(block, ctx(40, h)).length;
    eq(drawn, reserved, `panelHeight ${h}`);
  }
});

// ─── Invariant #2: the row count never moves ──────────────

test("row count is identical across EVERY state the block can be in", () => {
  const width = 50;
  const opts = { border: true, controls: true } as const;

  const okBlock = video(PACK, opts);
  const baseline = draw(okBlock, ctx(width)).length;

  // Same geometry, block paused vs played: the picture changes, the size does not.
  const played = video(PACK, { ...opts, autoplay: true });
  eq(draw(played, ctx(width)).length, baseline, "autoplaying");

  // A poster index past the end must not change the footprint either.
  eq(draw(video(PACK, { ...opts, poster: 999 }), ctx(width)).length, baseline, "poster out of range");
});

test("a missing, corrupt or unsupported source still reserves and draws the same rows", () => {
  const width = 50;
  for (const [name, path] of [
    ["missing", join(DIR, "nope.tvf")],
    ["corrupt", BROKEN],
    ["unsupported extension", join(DIR, "thing.xyz")],
  ] as Array<[string, string]>) {
    const block = video(path, { border: true });
    const reserved = videoBlockRows(block, width, undefined, DIR);
    const drawn = draw(block, ctx(width));
    eq(drawn.length, reserved, `${name}: drawn vs reserved`);
    if (drawn.length === 0) throw new Error(`${name}: drew nothing`);
  }
});

test("rendering never throws, whatever the source is", () => {
  for (const path of [
    "", "   ", "/", "/dev/null", join(DIR, "nope.tvf"), BROKEN,
    "https://example.com/x.mp4", "data:video/mp4;base64,AAAA", "\0weird",
  ]) {
    try {
      const rows = draw(video(path, { border: true }), ctx(40));
      if (!Array.isArray(rows)) throw new Error("did not return rows");
    } catch (e: any) {
      throw new Error(`path ${JSON.stringify(path)} threw: ${e.message}`);
    }
  }
});

test("every drawn row is a string, in every state", () => {
  for (const path of [PACK, BROKEN, join(DIR, "nope.tvf")]) {
    for (const row of draw(video(path, { border: true, controls: true }), ctx(44))) {
      if (typeof row !== "string") throw new Error(`${path}: non-string row`);
    }
  }
});

// ─── Focus accounting ─────────────────────────────────────

test("only a controlled video takes a focus slot", () => {
  eq(focusSlotsOf(video(PACK, {})), 0, "plain video");
  eq(focusSlotsOf(video(PACK, { controls: false })), 0, "controls: false");
  eq(focusSlotsOf(video(PACK, { controls: true })), 1, "controls: true");
});

test("only a controlled video charges a chrome row, and the two agree", () => {
  eq(frameHintRows(video(PACK, {})), 0, "plain video");
  eq(frameHintRows(video(PACK, { controls: true })), 1, "controlled video");
  // The predicate the renderer, the estimator and the input handler all share.
  eq(isControlledVideo(video(PACK, { controls: true })), true, "predicate true");
  eq(isControlledVideo(video(PACK, {})), false, "predicate false");
});

test("the transport row is exactly one row, focused or not", () => {
  const block = video(PACK, { controls: true });
  const plain = draw(video(PACK, {}), ctx(40)).length;
  const withControls = draw(block, ctx(40)).length;
  eq(withControls - plain, 1, "controls add exactly one row");

  const focusedRows = renderVideo(block, ctx(40), {
    rt: RT, blockKey: "focus-test", projectDir: DIR, focused: true,
  }).length;
  eq(focusedRows, withControls, "focus does not change the height");
});

// ─── Geometry ─────────────────────────────────────────────

test("geometry is solved from the pack header, before any frame is decoded", () => {
  const geom = videoCellSize(video(PACK, {}), 60, undefined, DIR);
  eq(geom.estimated, false, "header was known, so geometry is not a guess");
  // 64x32 source: twice as wide as tall, and a cell is twice as tall as wide,
  // so a 60-column picture is 60 * (32/64) * 0.5 = 15 rows.
  eq(geom.cols, 60, "columns");
  eq(geom.rows, 15, "rows follow the source aspect through CELL_ASPECT");
});

test("a source with no readable header still yields usable geometry", () => {
  const geom = videoCellSize(video(join(DIR, "nope.tvf"), {}), 60, undefined, DIR);
  eq(geom.estimated, true, "flagged as estimated");
  if (geom.rows < 1 || geom.cols < 1) throw new Error("degenerate geometry");
});

test("maxHeight caps the block, which is how fitPage grants rows", () => {
  const tall = videoCellSize(video(PACK, {}), 60, undefined, DIR).blockRows;
  const capped = videoCellSize(video(PACK, { maxHeight: 6 }), 60, undefined, DIR).blockRows;
  if (capped >= tall) throw new Error(`maxHeight did not cap: ${capped} >= ${tall}`);
  if (capped > 6) throw new Error(`maxHeight exceeded: ${capped} > 6`);
});

// ─── The pixel path ───────────────────────────────────────

test("on kitty a playing video transmits pixels and places them as cells", () => {
  setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "env", probed: false } as never);
  let transmits = 0;
  setGraphicsSink({
    graphicsPlace(_id: number, transmit: () => string) { transmits++; transmit(); return true; },
  } as never);
  try {
    const rows = renderVideo(video(PACK, { autoplay: true }), ctx(40), {
      rt: RT, blockKey: "kitty-on", projectDir: DIR,
    });
    eq(transmits, 1, "one transmission for the frame");
    if (!rows.some(r => r.includes("\u{10EEEE}"))) {
      throw new Error("no placeholder cells — the pixel path did not produce a placement");
    }
  } finally {
    setGraphicsSink(null);
    setGraphicsCapability(null as never);
  }
});

test("the pixel path changes the picture but NOT the block's height", () => {
  const block = video(PACK, { autoplay: true, border: true, controls: true });
  const cells = draw(block, ctx(40)).length;

  setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "env", probed: false } as never);
  setGraphicsSink({ graphicsPlace: () => true } as never);
  try {
    const pixels = renderVideo(block, ctx(40), { rt: RT, blockKey: "kitty-h", projectDir: DIR }).length;
    // Invariant #2 across the two rendering paths, not just across states: a
    // terminal that gains or loses pixel support mid-session must not reflow
    // every focus rect on the page.
    eq(pixels, cells, "pixel rows vs cell rows");
  } finally {
    setGraphicsSink(null);
    setGraphicsCapability(null as never);
  }
});

test("a memoised pixel frame RE-PLACES its image on every repaint", () => {
  // The runtime deletes any image id that stops being placed. Memoised rows on
  // the pixel path are not self-contained — they reference that image — so a
  // repaint between two clock ticks that returned the rows without re-placing
  // freed the pixels underneath them. Symptom: one or two frames appear and
  // then playback goes blank.
  setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "env", probed: false } as never);
  const placed: number[] = [];
  setGraphicsSink({ graphicsPlace(id: number) { placed.push(id); return true; } } as never);
  const prevNow = setNowFn(() => 5_000_000);
  try {
    const block = video(PACK, { autoplay: true });
    const deps = { rt: RT, blockKey: "replace", projectDir: DIR };
    for (let i = 0; i < 3; i++) renderVideo(block, ctx(40), deps);
    eq(placed.length, 3, "placed once per repaint");
    eq(new Set(placed).size, 1, "the SAME id — a repaint must not mint a new image");
  } finally {
    setNowFn(prevNow);
    setGraphicsSink(null);
    setGraphicsCapability(null as never);
  }
});

test("each clock tick mints a NEW image id", () => {
  setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "env", probed: false } as never);
  const placed: number[] = [];
  setGraphicsSink({ graphicsPlace(id: number) { placed.push(id); return true; } } as never);
  let t = 6_000_000;
  const prevNow = setNowFn(() => t);
  try {
    const block = video(PACK, { autoplay: true });
    const deps = { rt: RT, blockKey: "tick", projectDir: DIR };
    renderVideo(block, ctx(40), deps);
    t += 200; renderVideo(block, ctx(40), deps);
    t += 200; renderVideo(block, ctx(40), deps);
    // Re-transmitting onto a LIVE id is unspecified (kitty #8701), so a new
    // frame must be a new id, not a rewrite of the old one.
    eq(new Set(placed).size, 3, "three frames, three ids");
  } finally {
    setNowFn(prevNow);
    setGraphicsSink(null);
    setGraphicsCapability(null as never);
  }
});

test("a pinned tier refuses pixels, so snapshots stay byte-stable", () => {
  setGraphicsCapability({ kitty: true, kittyPlaceholders: true, source: "env", probed: false } as never);
  let transmits = 0;
  setGraphicsSink({ graphicsPlace() { transmits++; return true; } } as never);
  try {
    renderVideo(video(PACK, { autoplay: true, mode: "quadrant" }), ctx(40), {
      rt: RT, blockKey: "pinned", projectDir: DIR,
    });
    eq(transmits, 0, "an explicit mode must never transmit");
  } finally {
    setGraphicsSink(null);
    setGraphicsCapability(null as never);
  }
});

// ─── Cleanup ──────────────────────────────────────────────
clearVideoSourceCache();
rmSync(DIR, { recursive: true, force: true });

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
