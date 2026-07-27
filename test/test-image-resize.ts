#!/usr/bin/env npx tsx
/**
 * Tests for resizable image frames — `image(path, { resizable: true })`, the
 * `+` / `-` / `0` keys, and the promise that a bigger frame is a BETTER
 * picture rather than a magnified one.
 *
 * Two halves, because two different things can break.
 *
 * IN PROCESS: the opt-in focus contract and the pure clamp arithmetic
 * (src/image/frame.ts). Focusability is type-keyed everywhere else in the
 * framework, so `resizable` widening it is the one place a focus INDEX can
 * silently shift — `focusSlotsOf` must be the single answer every walker uses,
 * or the semantic walk and the geometry walk drift apart at the first
 * resizable image on the page and every arrow key below it misroutes.
 *
 * THROUGH THE PTY EMULATOR: everything else. A real app in a child process
 * pressing real keys, because the claims worth making are about the SCREEN —
 * the picture got taller, the text below moved down by exactly that many rows,
 * nothing wrapped, and the redraw carries more distinct colours than before.
 * That last one is the objective signature of a fresh, denser resample: an
 * upscaled copy of the old grid cannot invent colours that were not in it.
 *
 * WHY THE GENERATED APP PINS ITS OWN ENVIRONMENT: identical reasoning to
 * test/test-image-rendering.ts — node-pty is an optional peer dependency and is
 * absent, so the emulator falls back to piped stdio, the child's stdout is not
 * a TTY, and the tier ladder would otherwise negotiate the uncoloured "ascii"
 * tier and take the colour-count assertions with it.
 *
 * Run:  npx tsx test/test-image-resize.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { TUIEmulator } from "../src/emulator/index.js";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import type { Cell } from "../src/emulator/types.js";
import {
  FRAME_HINT_ROWS,
  FRAME_MIN_COLS,
  FRAME_STEP_COLS,
  clampFrameCols,
  focusSlotsOf,
  frameRowCap,
  framedImageBlock,
  isResizableImage,
  maxFrameCols,
  stepFrameCols,
} from "../src/image/frame.js";
import { MAX_IMAGE_COLS } from "../src/image/geometry.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";
import { blockRenderWidth, layoutAvailHeight } from "../src/core/layout-constants.js";
import { imageCellSize, renderImage } from "../src/components/Image.js";
import { renderBlock } from "../src/core/runtime-block-render.js";
import type { RuntimeInternal } from "../src/core/runtime-internal.js";
import { stringWidth, stripAnsi } from "../src/components/base.js";
import { focusSlots } from "../src/core/block-taxonomy.js";
import { setColorMode, getColorMode } from "../src/style/colors.js";
import { themes } from "../src/style/theme.js";
import type { ContentBlock, ImageBlock, LinkBlock, TextBlock } from "../src/config/types.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(PROJECT_ROOT, "test", "fixtures", "gradient-200x100.png");

/** The wide run: the 99-column content ceiling is the binding constraint here. */
const COLS = 100;
const ROWS = 60;
/** The short run: 24 rows makes the VERTICAL cap bind instead. */
const SHORT_ROWS = 24;

/** Declared frame widths, one page each — see createRunDir(). */
const DECLARED_SMALL = 20;
const DECLARED_WIDE = 92;
const DECLARED_TALL = 52;

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

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Block builders ───────────────────────────────────────

function img(width: number, extra: Partial<ImageBlock> = {}): ImageBlock {
  return { type: "image", path: FIXTURE, width, ...extra } as ImageBlock;
}

function link(label: string): LinkBlock {
  return { type: "link", label, url: `https://example.com/${label}` } as LinkBlock;
}

function txt(content: string): TextBlock {
  return { type: "text", content, style: "plain" } as TextBlock;
}

// ═════════════════════════════════════════════════════════════
// THE OPT-IN FOCUS CONTRACT
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Opt-in focusability\x1b[0m\n");

test("`resizable` is the ONLY thing that buys an image a focus slot", () => {
  assertEqual(focusSlotsOf(img(20)), 0, "a plain image occupies no focus slot");
  assertEqual(focusSlotsOf(img(20, { resizable: true })), 1, "a resizable image occupies exactly one");
  assertEqual(focusSlotsOf(img(20, { resizable: false })), 0, "an explicit false is still no slot");
  assertEqual(focusSlotsOf(link("L")), 1, "unrelated types are untouched");
  assertEqual(focusSlotsOf(txt("T")), 0, "…in both directions");
  assert(isResizableImage(img(20, { resizable: true })), "the predicate agrees");
  assert(!isResizableImage(link("L") as ContentBlock), "…and does not fire on a non-image");
  // The two terms can never both be non-zero: "image" is not in FOCUSABLE_TYPES,
  // so the widening is strictly additive and cannot double-count.
  assertEqual(focusSlots(img(20, { resizable: true })), 0, "block-taxonomy still says an image is not focusable");
});

test("The geometry walk assigns one rect per focus slot, in order, with no gap", () => {
  // The defect this pins: any walker that uses `focusSlots` instead of
  // `focusSlotsOf` produces a different count from the one that uses the other,
  // and every index below the first resizable image is off by one.
  const plainPage: ContentBlock[] = [txt("A"), img(20), link("ONE"), img(20), link("TWO")];
  const mixedPage: ContentBlock[] = [txt("A"), img(20, { resizable: true }), link("ONE"), img(20), link("TWO")];
  const width = blockRenderWidth(COLS);
  const height = layoutAvailHeight(ROWS);

  const plain = computeFocusPositions(plainPage, width, height, () => []);
  assertEqual(plain.length, 2, "a page with two plain images has two focusable links");

  const mixed = computeFocusPositions(mixedPage, width, height, () => []);
  assertEqual(mixed.length, 3, "making the first image resizable adds exactly one rect");
  assertEqual(
    mixed.map(r => r.focusIndex).join(","),
    "0,1,2",
    "focus indices stay contiguous from zero",
  );
  // The image's rect really is the first one — it sits above both links.
  assert(mixed[0]!.y < mixed[1]!.y, "the image's rect precedes the first link's");
  assertEqual(
    mixedPage.reduce((n, b) => n + focusSlotsOf(b), 0),
    mixed.length,
    "the semantic slot count and the geometry walk agree",
  );
});

test("The estimator reserves EXACTLY what the renderer draws, at every frame size", () => {
  // The defect class this pins is the one flex-engine's image case documents
  // three separate instances of: layout reserving a different number of rows
  // than the renderer emits, which puts every FocusRect below the image at the
  // wrong Y. Two independent checks, because they fail differently.
  const width = blockRenderWidth(COLS);
  const height = layoutAvailHeight(ROWS);
  const after = link("AFTER");
  const rectsFor = (block: ImageBlock, frameWidth?: number) =>
    computeFocusPositions([txt("BEFORE"), block, after], width, height, () => [],
      { frameWidthOf: () => frameWidth });
  const drawnRows = (frameWidth?: number) =>
    imageCellSize(
      framedImageBlock(img(DECLARED_SMALL, { resizable: true }), frameWidth, { availWidth: width, availRows: height }),
      width,
    ).blockRows;

  // 1. ABSOLUTE. The only structural difference between a plain image and a
  //    resizable one of the same declared width is the hint row, which is
  //    charged whether or not the block is focused. So everything below must
  //    sit exactly FRAME_HINT_ROWS lower.
  const plainRects = rectsFor(img(DECLARED_SMALL));
  const framedRects = rectsFor(img(DECLARED_SMALL, { resizable: true }));
  assertEqual(plainRects.length, 1, "the plain page has one focusable: the link");
  assertEqual(framedRects.length, 2, "the resizable page has two: the frame and the link");
  assertEqual(
    framedRects[1]!.y - plainRects[0]!.y,
    FRAME_HINT_ROWS,
    "the estimator charges the hint row it always draws",
  );

  // 2. DIFFERENTIAL. Growing the frame must move the link below it by exactly
  //    the rows the picture gained — a scale error that happened to preserve
  //    the offset above would show up only here.
  const base = rectsFor(img(DECLARED_SMALL, { resizable: true }), 20)[1]!.y;
  for (const frameWidth of [24, 32, 48, 72]) {
    const moved = rectsFor(img(DECLARED_SMALL, { resizable: true }), frameWidth)[1]!.y - base;
    assertEqual(
      moved,
      drawnRows(frameWidth) - drawnRows(20),
      `frame ${frameWidth}: rows reserved below the image vs rows the renderer draws`,
    );
    assert(moved > 0, `frame ${frameWidth}: growing must actually move the link down`);
  }
});

// ═════════════════════════════════════════════════════════════
// THE HINT ROW
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  The hint row\x1b[0m\n");

/** Just enough runtime for `renderBlock` to render an image block. */
function hintRt(rows = ROWS): RuntimeInternal {
  return {
    projectDir: PROJECT_ROOT,
    site: {},
    screenSize: { columns: COLS, rows },
    getBlockKey: (_b: ContentBlock, legacy: () => string) => legacy(),
    blockKeys: new Map(),
  } as unknown as RuntimeInternal;
}

function hintRow(block: ImageBlock, width: number, focused: boolean, panelHeight?: number): string {
  const ctx = { width, theme: themes.tokyoNight, borderStyle: "rounded", focused, panelHeight };
  const lines = renderBlock(hintRt(), block, ctx as never);
  return lines[lines.length - 1]!;
}

test("The hint row NEVER exceeds its allocation, at any width", () => {
  // It is the one row in an image block that is not `blockCols` wide by
  // construction, and inside a bordered panel an overflow is not merely
  // clipped: Panel.ts truncates the composed row and the character it eats is
  // the panel's own right border.
  const block = img(12, { resizable: true, border: true });
  let worst = "";
  for (let width = 1; width <= 60; width++) {
    const row = hintRow(block, width, true);
    const measured = stringWidth(stripAnsi(row));
    if (measured > width) worst = `focused width ${width}: hint measured ${measured}`;
    const rest = hintRow(block, width, false);
    const restWidth = stringWidth(stripAnsi(rest));
    if (restWidth > width) worst ||= `resting width ${width}: hint measured ${restWidth}`;
  }
  assertEqual(worst, "", "hint overflowed its allocation");
});

test("The hint row costs exactly FRAME_HINT_ROWS rows in every state", () => {
  // flex-engine charges the constant unconditionally, so the renderer must
  // draw exactly that many rows whatever it decides to put in them.
  const block = img(12, { resizable: true });
  const plain = img(12);
  for (const width of [1, 4, 12, 19, 31, 40, 99]) {
    for (const focused of [true, false]) {
      const framed = renderBlock(hintRt(), block, {
        width, theme: themes.tokyoNight, borderStyle: "rounded", focused,
      } as never);
      const bare = renderBlock(hintRt(), plain, {
        width, theme: themes.tokyoNight, borderStyle: "rounded", focused,
      } as never);
      assertEqual(
        framed.length - bare.length,
        FRAME_HINT_ROWS,
        `width ${width} focused=${focused}: rows a resizable frame adds`,
      );
    }
  }
});

test("The hint names the keys when it can, and stays readable when it cannot", () => {
  const block = img(12, { resizable: true });
  const wide = stripAnsi(hintRow(block, 60, true));
  assert(wide.includes("+/-") && wide.includes("0 reset"), `wide focused hint names the keys: ${JSON.stringify(wide)}`);
  const rest = stripAnsi(hintRow(block, 60, false));
  assert(rest.includes("resizable"), `resting hint advertises the feature: ${JSON.stringify(rest)}`);
  // Narrow: the size readout survives even when the key list cannot.
  const narrow = stripAnsi(hintRow(block, 12, true));
  assert(narrow.includes("↔"), `narrow hint keeps the marker: ${JSON.stringify(narrow)}`);
});

test("The hint is painted in muted, never in the invisible subtle+dim pair", () => {
  // Measured off a real capture, `theme.subtle` plus SGR dim came out at
  // 1.36:1 against the page background — the affordance existed and could not
  // be read. `dim` must not appear at all, and the pen must be a theme colour
  // with more luminance than `subtle`.
  const block = img(12, { resizable: true });
  for (const focused of [true, false]) {
    const row = hintRow(block, 60, focused);
    assert(!row.includes("\x1b[2m"), `focused=${focused}: hint must not use SGR dim`);
  }
});

test("A frame the window has shrunk says so instead of printing a bare number", () => {
  // On a 24-row terminal a declared 32-cell frame renders narrower and `+` is
  // inert from the first press; a bare size readout there contradicts the
  // page's own copy and reads as a broken key.
  const block = img(32, { resizable: true });
  const short = stripAnsi(hintRow(block, 60, true, 8));
  assert(short.includes("fits window"), `clamped hint explains itself: ${JSON.stringify(short)}`);
  const roomy = stripAnsi(hintRow(block, 60, true));
  assert(!roomy.includes("fits window"), `an unclamped frame does not: ${JSON.stringify(roomy)}`);
});

// ═════════════════════════════════════════════════════════════
// THE CLAMP ARITHMETIC
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Frame arithmetic\x1b[0m\n");

test("A frame clamps at both ends, and the ceiling beats the floor in a tiny slot", () => {
  const block = img(20, { resizable: true });
  const roomy = { availWidth: 99, availRows: 52 };
  assertEqual(clampFrameCols(4, block, roomy), FRAME_MIN_COLS, "below the floor clamps up");
  assertEqual(clampFrameCols(500, block, roomy), MAX_IMAGE_COLS, "above the ceiling clamps down");
  assertEqual(clampFrameCols(40, block, roomy), 40, "a legal width passes through");
  assertEqual(maxFrameCols(block, roomy), MAX_IMAGE_COLS, "99 is the widest a block can be");
  // In a 6-column allocation no width is both >= 8 and <= 6. Rendering wider
  // than the allocation is the worse failure, so the ceiling wins.
  assertEqual(clampFrameCols(20, block, { availWidth: 6 }), 6, "the ceiling beats the floor");
  // A drawn border costs the image area two columns.
  assertEqual(maxFrameCols(img(20, { resizable: true, border: true }), { availWidth: 40 }), 38, "border chrome");
});

test("A step is exactly FRAME_STEP_COLS, in both directions, clamped", () => {
  const block = img(20, { resizable: true });
  const limits = { availWidth: 99, availRows: 52 };
  assertEqual(stepFrameCols(20, 1, block, limits), 20 + FRAME_STEP_COLS, "grow");
  assertEqual(stepFrameCols(20, -1, block, limits), 20 - FRAME_STEP_COLS, "shrink");
  assertEqual(stepFrameCols(FRAME_MIN_COLS, -1, block, limits), FRAME_MIN_COLS, "shrinking at the floor is a no-op");
  assertEqual(stepFrameCols(MAX_IMAGE_COLS, 1, block, limits), MAX_IMAGE_COLS, "growing at the ceiling is a no-op");
  assert(FRAME_STEP_COLS > 1, "a single-cell step is invisible at the quadrant tier and reads as a dead key");
});

test("The vertical cap reserves the hint row, and an author's maxHeight still wins", () => {
  const block = img(20, { resizable: true });
  assertEqual(frameRowCap(block, { availWidth: 99, availRows: 16 }), 16 - FRAME_HINT_ROWS, "budget minus the hint row");
  assertEqual(frameRowCap(block, { availWidth: 99 }), undefined, "no budget, no cap");
  assertEqual(
    frameRowCap(img(20, { resizable: true, maxHeight: 6 }), { availWidth: 99, availRows: 52 }),
    6,
    "a tighter authored maxHeight wins",
  );
  assertEqual(FRAME_HINT_ROWS, 1, "the hint costs exactly one row, focused or not");
});

test("framedImageBlock leaves a plain image strictly alone", () => {
  // Object IDENTITY, not equality: a plain image must allocate nothing per
  // frame and must be byte-identical to what it rendered before this feature.
  const plain = img(20);
  assert(framedImageBlock(plain, 40, { availWidth: 99, availRows: 52 }) === plain, "same object back");
  const resizable = img(20, { resizable: true });
  const sized = framedImageBlock(resizable, 40, { availWidth: 99, availRows: 52 });
  assert(sized !== resizable, "a resized frame is a copy, so the authored block is never mutated");
  assertEqual(sized.width, 40, "…carrying the viewer's width");
  assertEqual(resizable.width, 20, "…and the author's block still says what the author wrote");
  // undefined means "as declared", which is also what `0` restores.
  assertEqual(framedImageBlock(resizable, undefined, { availWidth: 99 }).width, 20, "undefined restores the declared width");
});

// ═════════════════════════════════════════════════════════════
// GROWING BUYS RESOLUTION (in process)
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  A bigger frame is a denser resample\x1b[0m\n");

/**
 * Distinct foreground|background pairs a set of emitted rows paints, measured
 * by running them through the same terminal parser the E2E uses. This is the
 * signal that separates "more resolution" from "the same picture, bigger":
 * upscaling cannot introduce a colour that was not already in the grid.
 */
function distinctColours(rows: string[], cols: number): number {
  const vt = new VirtualTerminal(cols, rows.length + 1);
  vt.write(rows.join("\r\n"));
  const seen = new Set<string>();
  for (const row of vt.cells() as Cell[][]) {
    for (const cell of row) if (cell.bg !== null) seen.add(`${cell.fg}|${cell.bg}`);
  }
  return seen.size;
}

test("Every frame size resamples the source again — more cells, more colours", () => {
  const prev = getColorMode();
  try {
    setColorMode("truecolor");
    const seen: Array<{ cols: number; rows: number; colours: number }> = [];
    for (const width of [12, 20, 32, 48, 72]) {
      const block = img(width, { resizable: true });
      const geom = imageCellSize(block, MAX_IMAGE_COLS);
      const rows = renderImage(block, { width: MAX_IMAGE_COLS, theme: themes.dracula, borderStyle: "rounded" });
      seen.push({ cols: geom.cols, rows: geom.rows, colours: distinctColours(rows, MAX_IMAGE_COLS + 2) });
    }
    console.log(`      ${seen.map(s => `${s.cols}x${s.rows}: ${s.colours} colours`).join("   ")}`);
    for (let i = 1; i < seen.length; i++) {
      const prevFrame = seen[i - 1]!;
      const frame = seen[i]!;
      assert(
        frame.cols > prevFrame.cols && frame.rows > prevFrame.rows,
        `frame ${i}: ${prevFrame.cols}x${prevFrame.rows} -> ${frame.cols}x${frame.rows} did not grow in both axes`,
      );
      // The strong form. Magnifying the PREVIOUS grid could produce at most as
      // many distinct colours as that grid had CELLS, however it were stretched
      // or interpolated between existing samples. Exceeding that number is only
      // explicable by going back to the source.
      const upscaleCeiling = prevFrame.cols * prevFrame.rows;
      assert(
        frame.colours > upscaleCeiling,
        `frame ${i}: ${frame.cols}x${frame.rows} painted ${frame.colours} distinct colours, but a magnified ` +
        `copy of the ${prevFrame.cols}x${prevFrame.rows} grid could carry at most ${upscaleCeiling}`,
      );
    }
  } finally {
    setColorMode(prev);
  }
});

// ═════════════════════════════════════════════════════════════
// THE APP UNDER TEST
// ═════════════════════════════════════════════════════════════

/**
 * Four pages, one per thing that can bind.
 *
 * `Plain` proves the opt-in on screen rather than only in the type system.
 * `Frames` starts small so `+`, `-` and `0` all have room to move.
 * `Grow` starts near the 99-column content ceiling, so two presses reach it.
 * `Tall` starts near the row cap of a 24-row terminal, so four presses reach
 * THAT. Driving either ceiling from a 20-cell frame would cost a dozen key
 * presses and a dozen full redraws for nothing extra.
 */
function createRunDir(): string {
  const dir = join(tmpdir(), `tui-resize-e2e-${process.pid}-${Date.now()}`);
  const site = join(dir, "site");
  mkdirSync(join(site, "pages"), { recursive: true });
  mkdirSync(join(site, "assets"), { recursive: true });
  copyFileSync(FIXTURE, join(site, "assets", "img.png"));

  // tsx compiles a .ts file with no package.json above it as CJS, which cannot
  // carry the top-level await run.ts needs.
  writeFileSync(join(dir, "package.json"), `{"type":"module"}\n`);

  const page = (file: string, label: string, body: string): void => {
    writeFileSync(join(site, "pages", file), `
import { text, image, link } from "${PROJECT_ROOT}/src/index.js";
export const metadata = { label: "${label}", icon: "*" };
export default function Page() {
  return [
${body}
  ];
}
`);
  };

  page("plain.ts", "Plain", `
    text("PLAINTOP"),
    image("./assets/img.png", { width: ${DECLARED_SMALL}, alt: "PLAINALT" }),
    link("ONLYLINK", "https://example.com"),`);

  // BELOWLINK is the FocusRect drift probe: it is the one thing on the page
  // whose RESERVED position (flex-engine's walk) and DRAWN position (the
  // renderer) can disagree after a resize, and focusing it makes the
  // disagreement visible as a gutter on the wrong row.
  page("frames.ts", "Frames", `
    text("MARKTOP"),
    image("./assets/img.png", { width: ${DECLARED_SMALL}, resizable: true, alt: "FRAMEALT" }),
    text("MARKBOTTOM"),
    link("BELOWLINK", "https://example.com/below"),`);

  page("grow.ts", "Grow", `
    text("GROWTOP"),
    image("./assets/img.png", { width: ${DECLARED_WIDE}, resizable: true, alt: "GROWALT" }),`);

  page("tall.ts", "Tall", `
    text("TALLTOP"),
    image("./assets/img.png", { width: ${DECLARED_TALL}, resizable: true, alt: "TALLALT" }),`);

  // The environment is pinned BEFORE the framework is loaded, because
  // style/colors.ts sniffs the terminal at module-load time.
  writeFileSync(join(dir, "run.ts"), `
process.env.LANG = "en_US.UTF-8";
process.env.TERM = "xterm-256color";
delete process.env.NO_COLOR;
delete process.env.COLORTERM;
delete process.env.TERM_PROGRAM;
delete process.env.TMUX;
delete process.env.STY;
delete process.env.WT_SESSION;
(process.stdout as any).isTTY = true;
const { runFileBasedSite, defineConfig } = await import("${PROJECT_ROOT}/src/index.js");
await runFileBasedSite({
  config: defineConfig({
    name: "RESIZETEST",
    tagline: "resizable frames",
    theme: "dracula",
    animations: { boot: false },
  }),
  pagesDir: "${site}/pages",
  outDir: "${site}/.terminaltui",
});
`);
  return dir;
}

// ─── Screen capture ───────────────────────────────────────

interface Shot {
  lines: string[];
  cells: Cell[][];
  /** Row index of each marker string, or -1. */
  rowOf: Record<string, number>;
  /** Rows carrying a painted background pen — the image's real extent. */
  painted: number[];
  /** Distinct fg|bg pairs across the painted rows. */
  colours: number;
  /** Rows whose column 0 carries the accent focus indicator (U+258C). */
  gutter: number[];
  /** The `N x M` size the hint row advertises, or null when there is no hint. */
  hint: string | null;
}

const MARKERS = [
  "PLAINTOP", "PLAINALT", "ONLYLINK",
  "MARKTOP", "MARKBOTTOM", "FRAMEALT", "BELOWLINK",
  "GROWTOP", "GROWALT", "TALLTOP", "TALLALT",
];

/**
 * A row belongs to the image when it carries at least this many background
 * pens. Measured by the BACKGROUND rather than by ink glyphs, because a flat
 * region legitimately collapses to a space carrying only a background colour —
 * counting glyphs would make the image's height depend on how much detail the
 * source happens to have. Same definition test/test-image-rendering.ts uses.
 */
const PAINTED_MIN = 4;

function shoot(emu: TUIEmulator): Shot {
  const lines = emu.screen.text().split("\n");
  const cells = emu.screen.cells();
  const rowOf: Record<string, number> = {};
  for (const m of MARKERS) rowOf[m] = emu.screen.find(m)?.row ?? -1;

  const painted: number[] = [];
  const seen = new Set<string>();
  for (let r = 0; r < cells.length; r++) {
    let inked = 0;
    for (const cell of cells[r]!) if (cell.bg !== null) inked++;
    if (inked >= PAINTED_MIN) {
      painted.push(r);
      for (const cell of cells[r]!) if (cell.bg !== null) seen.add(`${cell.fg}|${cell.bg}`);
    }
  }

  const gutter: number[] = [];
  for (let r = 0; r < cells.length; r++) if (cells[r]![0]?.char === "▌") gutter.push(r);

  let hint: string | null = null;
  for (const line of lines) {
    const m = /↔\s+(\d+x\d+)/.exec(line);
    if (m) { hint = m[1]!; break; }
  }

  return { lines, cells, rowOf, painted, colours: seen.size, gutter, hint };
}

function report(label: string, s: Shot): void {
  console.log(
    `      ${label.padEnd(16)} hint ${String(s.hint).padEnd(7)}` +
    ` painted ${String(s.painted.length).padStart(2)} rows` +
    `  colours ${String(s.colours).padStart(3)}` +
    `  top@${s.rowOf.MARKTOP}  bottom@${s.rowOf.MARKBOTTOM}`,
  );
}

/** The painted extent of one row: a cell tier paints one contiguous span. */
function paintedSpan(shot: Shot, row: number): { first: number; last: number; count: number } {
  let first = -1;
  let last = -1;
  let count = 0;
  const cells = shot.cells[row] ?? [];
  for (let c = 0; c < cells.length; c++) {
    if (cells[c]!.bg !== null) {
      if (first < 0) first = c;
      last = c;
      count++;
    }
  }
  return { first, last, count };
}

/**
 * The width and height the hint row claims, parsed. Used as the renderer's own
 * statement of the frame size, which every geometric assertion below is then
 * checked against independently.
 */
function hintSize(shot: Shot): { cols: number; rows: number } {
  assert(shot.hint !== null, "expected a resize hint row on screen");
  const [cols, rows] = shot.hint!.split("x").map(Number);
  return { cols: cols!, rows: rows! };
}

// ─── In-process prediction of the key walk ────────────────

/**
 * Replay the input handler's step arithmetic in process, so the E2E has
 * something to check the running app AGAINST rather than a hand-copied table
 * of numbers that would need editing whenever a constant moves.
 *
 * Mirrors `handleImageResizeKey`: it has no RenderContext, so it steps against
 * the page-level budget, and it stores what geometry PRODUCED rather than what
 * was requested — near the row cap those differ, and remembering the request
 * would leave the stored width running ahead of the picture.
 */
function predictWalk(
  declared: number,
  cols: number,
  rows: number,
  intents: Array<1 | -1 | 0>,
): string[] {
  const block = img(declared, { resizable: true });
  const limits = { availWidth: blockRenderWidth(cols), availRows: layoutAvailHeight(rows) };
  const geom = (stored: number | undefined) =>
    imageCellSize(framedImageBlock(block, stored, limits), limits.availWidth);
  const measure = (stored: number | undefined): number => geom(stored).cols;

  let stored: number | undefined;
  const out: string[] = [];
  const label = (): string => {
    const g = geom(stored);
    return `${g.cols}x${g.rows}`;
  };
  out.push(label());
  for (const intent of intents) {
    if (intent === 0) { stored = undefined; out.push(label()); continue; }
    const current = stored ?? measure(undefined);
    const wanted = stepFrameCols(current, intent, block, limits);
    const applied = wanted === current ? current : clampFrameCols(measure(wanted), block, limits);
    if ((applied - current) * intent > 0) stored = applied;
    out.push(label());
  }
  return out;
}

// ═════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  if (process.platform === "win32") {
    console.log("\n\x1b[1m  E2E: resizable frames through the PTY emulator\x1b[0m");
    console.log("  \x1b[2mskipped on Windows: the piped-stdio PTY fallback cannot drive live apps there\x1b[0m");
  } else {
    const runDir = createRunDir();
    try {
      await runWideTerminal(runDir);
      await runShortTerminal(runDir);
    } finally {
      try { rmSync(runDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }

  console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
  console.log("");

  if (failed > 0) process.exit(1);
}

async function launch(runDir: string, rows: number): Promise<TUIEmulator> {
  const emu = await TUIEmulator.launch({
    command: `tsx ${join(runDir, "run.ts")}`,
    cwd: runDir,
    cols: COLS,
    rows,
    timeout: 60000,
    // Pixels off. src/emulator/pty.ts already defaults this, but the frame
    // assertions below are all about painted CELLS, so the suite states it
    // rather than inheriting it: on a kitty tier there would be nothing to
    // count but placeholder cells.
    env: { TERMINALTUI_GRAPHICS: "off" },
  });
  await emu.waitForBoot();
  await emu.waitForIdle();
  return emu;
}

async function goTo(emu: TUIEmulator, page: string): Promise<Shot> {
  await emu.navigateTo(page);
  await emu.waitForIdle();
  return shoot(emu);
}

async function pressAndShoot(emu: TUIEmulator, key: string): Promise<Shot> {
  await emu.press(key);
  await emu.waitForIdle();
  return shoot(emu);
}

// ─── The wide terminal: 100x60 ────────────────────────────

async function runWideTerminal(runDir: string): Promise<void> {
  let emu: TUIEmulator | null = null;
  try {
    emu = await launch(runDir, ROWS);
  } catch (err) {
    test("Emulator launch (100x60)", () => { throw new Error(`could not drive the app: ${err}`); });
    return;
  }

  try {
    // ── A plain image stays a plain image ────────────────
    console.log("\n\x1b[1m  E2E: a plain image is not focusable\x1b[0m\n");

    const plain = await goTo(emu, "Plain");
    report("plain page", plain);

    test("A plain image draws no hint row and takes no focus", () => {
      assert(plain.rowOf.PLAINTOP >= 0, "the plain page must be on screen");
      assert(plain.painted.length > 0, "the plain image must have painted its cells");
      assertEqual(plain.hint, null, "a plain image draws no resize hint");
      assertEqual(plain.gutter.length, 1, "exactly one thing on the page is focused");
      const focusedLine = plain.lines[plain.gutter[0]!] ?? "";
      assert(focusedLine.includes("ONLYLINK"), `focus landed on ${JSON.stringify(focusedLine.trim())}, not the link`);
      assert(
        !plain.gutter.some(r => plain.painted.includes(r)),
        "no painted image row may carry the focus gutter",
      );
    });

    // ── Declared state ───────────────────────────────────
    console.log("\n\x1b[1m  E2E: growing, resetting and shrinking\x1b[0m\n");

    const declared = await goTo(emu, "Frames");
    report("declared", declared);

    test("A resizable image is focusable and advertises its live size", () => {
      assert(declared.rowOf.MARKTOP >= 0 && declared.rowOf.MARKBOTTOM >= 0, "both markers must be on screen");
      assert(declared.hint !== null, "a resizable image draws a hint row");
      assertEqual(declared.hint, predictWalk(DECLARED_SMALL, COLS, ROWS, [])[0], "the hint states the declared frame");
      assertEqual(hintSize(declared).cols, DECLARED_SMALL, "…which is the width the author wrote");
      assertEqual(declared.painted.length, hintSize(declared).rows, "the hint's row count is what got painted");
      assert(
        declared.gutter.some(r => declared.painted.includes(r)),
        "the image carries the focus gutter — it is the first focusable thing on the page",
      );
      assert(
        declared.lines.some(l => l.includes("+/- resize") && l.includes("0 reset")),
        "the focused hint row spells out the keys",
      );
    });

    // ── Grow ─────────────────────────────────────────────
    const growSteps = [declared];
    for (let i = 0; i < 3; i++) {
      growSteps.push(await pressAndShoot(emu, "+"));
      report(`after + x${i + 1}`, growSteps[growSteps.length - 1]!);
    }
    const grown = growSteps[growSteps.length - 1]!;
    const wideWalk = predictWalk(DECLARED_SMALL, COLS, ROWS, [1, 1, 1]);

    test("`+` grows the frame by one step per press, exactly as the arithmetic predicts", () => {
      assertEqual(growSteps.map(s => s.hint).join(" -> "), wideWalk.join(" -> "), "the sequence of frame sizes");
      assertEqual(hintSize(grown).cols, DECLARED_SMALL + 3 * FRAME_STEP_COLS, "three steps of FRAME_STEP_COLS");
    });

    test("Growing makes the picture TALLER on screen at every single press", () => {
      for (let i = 1; i < growSteps.length; i++) {
        const before = growSteps[i - 1]!;
        const after = growSteps[i]!;
        assert(
          after.painted.length > before.painted.length,
          `press ${i}: painted rows went ${before.painted.length} -> ${after.painted.length}`,
        );
        assertEqual(after.painted.length, hintSize(after).rows, `press ${i}: painted rows match the hint`);
      }
    });

    test("Growing adds DISTINCT COLOURS — a denser resample, not a magnified copy", () => {
      // The load-bearing assertion of the whole feature. Upscaling an existing
      // grid cannot introduce a colour that was not already in it, so a strict
      // increase at every step is only explicable by re-sampling the source.
      for (let i = 1; i < growSteps.length; i++) {
        assert(
          growSteps[i]!.colours > growSteps[i - 1]!.colours,
          `press ${i}: distinct colours went ${growSteps[i - 1]!.colours} -> ${growSteps[i]!.colours}`,
        );
      }
      assert(
        grown.colours > declared.colours * 1.2,
        `three presses should add real detail: ${declared.colours} -> ${grown.colours} colours`,
      );
    });

    test("Content below moves by EXACTLY the rows the image gained, and content above does not move", () => {
      // The FocusRect drift guard: the estimator (which reserved the rows) and
      // the renderer (which drew them) must agree to the row, or every rect
      // below the image lands at the wrong Y and the arrow keys misroute.
      for (let i = 1; i < growSteps.length; i++) {
        const before = growSteps[i - 1]!;
        const after = growSteps[i]!;
        const gained = after.painted.length - before.painted.length;
        assertEqual(
          after.rowOf.MARKBOTTOM - before.rowOf.MARKBOTTOM,
          gained,
          `press ${i}: the text below moved by the rows the image gained (${gained})`,
        );
        assertEqual(after.rowOf.MARKTOP, before.rowOf.MARKTOP, `press ${i}: nothing above the image moved`);
      }
    });

    test("Nothing wraps: every painted row is one contiguous span of the frame width", () => {
      for (const shot of growSteps) {
        const { cols } = hintSize(shot);
        for (const r of shot.painted) {
          const span = paintedSpan(shot, r);
          assertEqual(span.count, cols, `row ${r} at frame ${shot.hint}: painted cell count`);
          assertEqual(span.last - span.first + 1, cols, `row ${r} at frame ${shot.hint}: the span is contiguous`);
          assert(span.first > 0, `row ${r} at frame ${shot.hint} starts at column 0 — a wrapped continuation`);
          assert(span.last < COLS, `row ${r} at frame ${shot.hint} runs past the terminal width`);
        }
        for (let r = 0; r < shot.cells.length; r++) {
          assertEqual(shot.cells[r]!.length, COLS, `frame ${shot.hint}: row ${r} cell count`);
          assert((shot.lines[r] ?? "").length <= COLS, `frame ${shot.hint}: row ${r} text is wider than the terminal`);
        }
      }
    });

    // ── The FocusRect drift guard ────────────────────────
    const onLink = await pressAndShoot(emu, "down");
    const backOnImage = await pressAndShoot(emu, "up");

    test("Arrow keys step from the frame to the element below it, after three resizes", () => {
      // The focus-index contract, observed live: the frame occupies slot 0 and
      // the link slot 1, so `down` must move the gutter from the picture onto
      // the link's own drawn row. A walker still using `focusSlots` instead of
      // `focusSlotsOf` gives the image no slot at all, and `down` would then
      // step off the end of a one-item list instead. (The estimator's own
      // agreement with the renderer is checked absolutely, in process, by "The
      // estimator reserves EXACTLY what the renderer draws" above — the gutter
      // is painted by the renderer, so it cannot see that drift.)
      assert(onLink.rowOf.BELOWLINK >= 0, "the link below the image must be on screen");
      assertEqual(onLink.gutter.length, 1, "exactly one element is focused");
      assertEqual(onLink.gutter[0], onLink.rowOf.BELOWLINK, "the gutter is on the link's drawn row");
      assert(
        onLink.rowOf.BELOWLINK > onLink.painted[onLink.painted.length - 1]!,
        "…and that row really is below the picture",
      );
      // Focus returns to the image, which is what makes `0` and `-` below reach
      // the resize handler at all rather than falling through to the bindings.
      assert(
        backOnImage.gutter.some(r => backOnImage.painted.includes(r)),
        "`up` puts focus back on the frame",
      );
      assertEqual(backOnImage.hint, onLink.hint, "moving focus does not change the frame size");
      assertEqual(
        backOnImage.painted.length,
        onLink.painted.length,
        "…and the hint row is charged whether or not the block is focused, so nothing shifts",
      );
    });

    // ── Reset ────────────────────────────────────────────
    const reset = await pressAndShoot(emu, "0");
    report("after 0", reset);

    test("`0` restores the declared frame and puts every row back where it was", () => {
      assertEqual(reset.hint, declared.hint, "the hint is back to the declared size");
      assertEqual(reset.painted.length, declared.painted.length, "…and so is the painted height");
      assertEqual(reset.rowOf.MARKBOTTOM, declared.rowOf.MARKBOTTOM, "the text below is back where it started");
      assertEqual(reset.colours, declared.colours, "the same frame size resamples to the same picture");
    });

    // ── Shrink to the floor ──────────────────────────────
    const shrinkSteps = [reset];
    for (let i = 0; i < 4; i++) shrinkSteps.push(await pressAndShoot(emu, "-"));
    report("after - x4", shrinkSteps[shrinkSteps.length - 1]!);
    const shrunk = shrinkSteps[shrinkSteps.length - 1]!;

    test("`-` shrinks to the floor and then refuses, without crashing or overshooting", () => {
      const walk = predictWalk(DECLARED_SMALL, COLS, ROWS, [-1, -1, -1, -1]);
      assertEqual(shrinkSteps.map(s => s.hint).join(" -> "), walk.join(" -> "), "the sequence of frame sizes");
      assertEqual(hintSize(shrunk).cols, FRAME_MIN_COLS, "the frame stops at the floor");
      assertEqual(shrinkSteps[3]!.hint, shrinkSteps[4]!.hint, "the fourth press changes nothing");
      assert(
        shrunk.lines.some(l => l.includes("Frame at minimum size")),
        "the refused press explains itself in the status row",
      );
      assert(shrunk.rowOf.MARKBOTTOM < declared.rowOf.MARKBOTTOM, "shrinking pulled the content below back up");
      assertEqual(shrunk.painted.length, hintSize(shrunk).rows, "the picture really is that small");
      assert(emu!.isRunning(), "the app survived being driven to the floor");
    });

    // ── The horizontal ceiling ───────────────────────────
    console.log("\n\x1b[1m  E2E: the ceilings clamp\x1b[0m\n");

    const wideSteps = [await goTo(emu, "Grow")];
    report("grow declared", wideSteps[0]!);
    for (let i = 0; i < 3; i++) wideSteps.push(await pressAndShoot(emu, "+"));
    report("grow + x3", wideSteps[wideSteps.length - 1]!);

    test("A frame stops at the content column's width and stays there", () => {
      const walk = predictWalk(DECLARED_WIDE, COLS, ROWS, [1, 1, 1]);
      assertEqual(wideSteps.map(s => s.hint).join(" -> "), walk.join(" -> "), "the sequence of frame sizes");
      const final = wideSteps[wideSteps.length - 1]!;
      assertEqual(hintSize(final).cols, MAX_IMAGE_COLS, "the frame saturates at the 99-column ceiling");
      assertEqual(wideSteps[2]!.hint, final.hint, "further presses are idempotent, not runaway");
      assert(final.lines.some(l => l.includes("Frame at maximum size")), "the refusal explains itself");
      for (const r of final.painted) {
        assertEqual(paintedSpan(final, r).count, MAX_IMAGE_COLS, `row ${r}: painted width at the ceiling`);
        assert(paintedSpan(final, r).last < COLS, `row ${r}: the image stays inside the terminal`);
      }
      assert(emu!.isRunning(), "the app survived being driven to the ceiling");
    });

    const returned = await goTo(emu, "Frames");
    report("frames again", returned);

    test("Each frame keeps its OWN size across navigation", () => {
      // Frame size is per-block viewer state, like accordion and tab state:
      // nothing clears it on a page change, and two frames do not share a slot.
      assertEqual(hintSize(shrunk).cols, FRAME_MIN_COLS, "the Frames page was left at the floor");
      assertEqual(returned.hint, shrunk.hint, "…and is still there after two page changes");
      assertEqual(returned.painted.length, shrunk.painted.length, "…with the same picture");
      assertEqual(
        hintSize(wideSteps[wideSteps.length - 1]!).cols,
        MAX_IMAGE_COLS,
        "meanwhile the Grow page's own frame was at the ceiling — the two never shared a value",
      );
    });

    await emu.press("escape");
    await emu.waitForIdle();
    const home = shoot(emu);

    test("Escape returns home with the app alive after ~15 resize keys", () => {
      assert(emu!.isRunning(), "the app died somewhere in the key walk");
      assert(home.lines.join("\n").includes("RESIZETEST"), "escape did not return to the home page");
      assertEqual(home.hint, null, "and the hint row left with the page");
    });
  } finally {
    await emu.close();
  }
}

// ─── The short terminal: 100x24 ───────────────────────────

async function runShortTerminal(runDir: string): Promise<void> {
  console.log("\n\x1b[1m  E2E: a short terminal clamps the frame to what fits\x1b[0m\n");

  let emu: TUIEmulator | null = null;
  try {
    emu = await launch(runDir, SHORT_ROWS);
  } catch (err) {
    test("Emulator launch (100x24)", () => { throw new Error(`could not drive the app: ${err}`); });
    return;
  }

  try {
    const steps = [await goTo(emu, "Tall")];
    report("tall declared", steps[0]!);
    for (let i = 0; i < 5; i++) {
      steps.push(await pressAndShoot(emu, "+"));
    }
    report("tall + x5", steps[steps.length - 1]!);
    const final = steps[steps.length - 1]!;

    test("A resizable frame never grows past the bottom of the viewport", () => {
      // The one rule that applies ONLY to resizable images: an ordinary image
      // may run off the bottom and be scrolled to, but you cannot judge a frame
      // you are resizing if `+` pushes its own bottom edge off screen.
      const walk = predictWalk(DECLARED_TALL, COLS, SHORT_ROWS, [1, 1, 1, 1, 1]);
      assertEqual(steps.map(s => s.hint).join(" -> "), walk.join(" -> "), "the sequence of frame sizes");
      const cap = layoutAvailHeight(SHORT_ROWS) - FRAME_HINT_ROWS;
      assertEqual(hintSize(final).rows, cap, `the frame saturates at the ${cap}-row vertical budget`);
      assertEqual(final.painted.length, cap, "…and that is exactly what is painted");
      assert(hintSize(final).cols < MAX_IMAGE_COLS, "the HEIGHT is what bound here, not the width");
    });

    test("Presses against the ceiling are idempotent and explain themselves", () => {
      assertEqual(steps[4]!.hint, steps[5]!.hint, "the last two presses changed nothing");
      assert(final.lines.some(l => l.includes("Frame at maximum size")), "the refusal reaches the status row");
      assert(emu!.isRunning(), "the app survived five presses against the row cap");
    });

    test("Nothing overflows a short terminal either", () => {
      for (const shot of steps) {
        for (const r of shot.painted) {
          const span = paintedSpan(shot, r);
          assertEqual(span.count, hintSize(shot).cols, `frame ${shot.hint} row ${r}: painted width`);
          assert(span.last < COLS, `frame ${shot.hint} row ${r}: runs past the terminal`);
        }
        for (let r = 0; r < shot.cells.length; r++) {
          assert((shot.lines[r] ?? "").length <= COLS, `frame ${shot.hint}: row ${r} is wider than the terminal`);
        }
        assertEqual(shot.cells.length, SHORT_ROWS, `frame ${shot.hint}: the screen is still ${SHORT_ROWS} rows`);
      }
    });
  } finally {
    await emu.close();
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
