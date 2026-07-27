#!/usr/bin/env npx tsx
/**
 * End-to-end tests for image rendering, driven through the PTY emulator.
 *
 * This is the only place the image engine is exercised the way a user meets it:
 * a real `terminaltui` app, booted in a child process, writing real escape
 * sequences that a real terminal parser consumes. The unit-level companion is
 * test/test-image-engine.ts.
 *
 * WHY THE GENERATED APP FIDDLES WITH ITS OWN ENVIRONMENT
 * node-pty is an optional peer dependency and is not installed, so the emulator
 * falls back to piped stdio: the child's stdout is not a TTY, detectTerminal()
 * reports colorDepth "none" as designed, and the tier ladder selects the
 * uncoloured "ascii" tier. Every coloured tier would then go untested. The
 * generated run.ts therefore pins the handful of environment signals the
 * detector reads (isTTY, TERM, LANG, and the multiplexer variables) so the
 * negotiated tier is deterministic — 256 colours, unicode, not conservative,
 * i.e. "quadrant" — on any machine and in any CI.
 *
 * WHY THE PROJECT ROOT IS NOT THE CWD
 * The app is launched with cwd = <run>/ while its pages live in <run>/site/pages,
 * so the project root the framework derives is <run>/site. The pages reference
 * their image as "./assets/img.png", which exists ONLY under <run>/site. If
 * projectDir threading regressed, every image would resolve against the cwd,
 * miss, and fall back to alt text — which several assertions below would catch.
 *
 * Run:  npx tsx test/test-image-rendering.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { TUIEmulator } from "../src/emulator/index.js";
import type { Cell } from "../src/emulator/types.js";
import type { GraphicsRecord } from "../src/emulator/vterm.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";
import { blockRenderWidth, layoutAvailHeight } from "../src/core/layout-constants.js";
import { imageCellSize } from "../src/components/Image.js";
import type { ContentBlock, ImageBlock, LinkBlock, TextBlock } from "../src/config/types.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(PROJECT_ROOT, "test", "fixtures", "gradient-200x100.png");

const COLS = 100;
const ROWS = 70;

/** The 7 low-ink quadrant glyphs the fitter can emit, space excluded. */
const INK_GLYPHS = "▘▝▀▖▌▞▗";

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

// ─── The app under test ───────────────────────────────────

function createRunDir(): string {
  const dir = join(tmpdir(), `tui-image-e2e-${process.pid}-${Date.now()}`);
  const site = join(dir, "site");
  mkdirSync(join(site, "pages"), { recursive: true });
  mkdirSync(join(site, "assets"), { recursive: true });
  copyFileSync(FIXTURE, join(site, "assets", "img.png"));

  // tsx compiles a .ts file with no package.json above it as CJS, which cannot
  // carry the top-level await the environment pinning below needs.
  writeFileSync(join(dir, "package.json"), `{"type":"module"}\n`);

  writeFileSync(join(site, "pages", "gallery.ts"), `
import { link, image } from "${PROJECT_ROOT}/src/index.js";
export const metadata = { label: "Gallery", icon: "*" };
export default function Gallery() {
  return [
    link("LINKONE", "https://example.com/one"),
    image("./assets/img.png", { width: 40, alt: "ALTONE" }),
    link("LINKTWO", "https://example.com/two"),
    image("./assets/img.png", { width: 80, alt: "ALTTWO" }),
    link("LINKTHREE", "https://example.com/three"),
  ];
}
`);

  writeFileSync(join(site, "pages", "broken.ts"), `
import { text, image } from "${PROJECT_ROOT}/src/index.js";
export const metadata = { label: "Broken", icon: "!" };
export default function Broken() {
  return [
    text("MARKA"),
    image("./assets/does-not-exist.png", { width: 40, alt: "MISSINGALT" }),
    text("MARKB"),
    image("./assets/img.png", { width: 40, alt: "REALALT" }),
    text("MARKC"),
  ];
}
`);

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
    name: "IMGTEST",
    tagline: "image engine",
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

interface PageCapture {
  text: string[];
  cells: Cell[][];
  /** Row index of each marker string, or -1. */
  rowOf: Record<string, number>;
}

interface RunCapture {
  gallery: PageCapture;
  broken: PageCapture;
  /** Focus-gutter row observed after each navigation step, in order. */
  focusRows: number[];
  focusLabels: string[];
  graphics: GraphicsRecord[];
  running: boolean;
}

function snapshot(emu: TUIEmulator, markers: string[]): PageCapture {
  const text = emu.screen.text().split("\n");
  const rowOf: Record<string, number> = {};
  for (const m of markers) rowOf[m] = emu.screen.find(m)?.row ?? -1;
  return { text, cells: emu.screen.cells(), rowOf };
}

/** vterm.graphics() is the side channel; TUIEmulator does not surface it yet. */
function graphicsOf(emu: TUIEmulator): GraphicsRecord[] {
  const vt = (emu as unknown as { vterm: { graphics(): GraphicsRecord[] } }).vterm;
  return vt.graphics();
}

/** Rows whose column 0 carries the accent focus indicator (U+258C). */
function gutterRows(cells: Cell[][]): number[] {
  const out: number[] = [];
  for (let r = 0; r < cells.length; r++) if (cells[r][0]?.char === "▌") out.push(r);
  return out;
}

async function captureRun(runDir: string, env: Record<string, string>): Promise<RunCapture> {
  const emu = await TUIEmulator.launch({
    command: `tsx ${join(runDir, "run.ts")}`,
    cwd: runDir,
    cols: COLS,
    rows: ROWS,
    timeout: 45000,
    env,
  });
  try {
    await emu.waitForBoot();
    await emu.waitForIdle();

    // Pages are discovered alphabetically: Broken [1], Gallery [2].
    await emu.press("enter");
    await emu.waitForIdle();
    const broken = snapshot(emu, ["MARKA", "MARKB", "MARKC", "MISSINGALT", "REALALT"]);

    await emu.press("escape");
    await emu.waitForIdle();
    await emu.press("down");
    await emu.waitForIdle();
    await emu.press("enter");
    await emu.waitForIdle();
    const gallery = snapshot(emu, ["LINKONE", "LINKTWO", "LINKTHREE", "ALTONE", "ALTTWO"]);

    // Walk focus down past both images and back up again.
    const focusRows: number[] = [];
    const focusLabels: string[] = [];
    const record = (): void => {
      const rows = gutterRows(emu.screen.cells());
      focusRows.push(rows.length === 1 ? rows[0] : -1);
      const line = rows.length === 1 ? (emu.screen.text().split("\n")[rows[0]] ?? "") : "";
      focusLabels.push(
        ["LINKONE", "LINKTWO", "LINKTHREE"].find(l => line.includes(l)) ?? `<${line.trim()}>`,
      );
    };
    record();
    for (const key of ["down", "down", "up", "up"] as const) {
      await emu.press(key);
      await emu.waitForIdle();
      record();
    }

    return { gallery, broken, focusRows, focusLabels, graphics: graphicsOf(emu), running: emu.isRunning() };
  } finally {
    await emu.close();
  }
}

// ─── Screen analysis helpers ──────────────────────────────

/** Rows in [from, to) that carry at least `min` quadrant ink glyphs. */
/**
 * Rows an image occupies, measured by the BACKGROUND PEN rather than by ink
 * glyphs.
 *
 * A cell tier paints every cell it covers, and a flat region legitimately
 * collapses to a space carrying only a background colour — that is
 * `fitQuadrant`'s degenerate case, and it is a painted pixel, not an absent
 * one. Counting ink glyphs instead would make occupancy depend on how much
 * sub-cell detail the source happens to have, so turning dithering off (which
 * removes the perturbation that used to split flat regions into distinct
 * sub-pixels) would read as the image losing rows. It does not. `paintedSpan`
 * below already uses this definition; this shares it.
 */
function imageRows(cap: PageCapture, from: number, to: number, min = 4): number[] {
  const out: number[] = [];
  for (let r = from; r < to && r < cap.cells.length; r++) {
    if (paintedSpan(cap, r).count >= min) out.push(r);
  }
  return out;
}

/** Columns on a row that carry a background pen — the painted extent of a cell tier. */
function paintedSpan(cap: PageCapture, row: number): { first: number; last: number; count: number } {
  let first = -1;
  let last = -1;
  let count = 0;
  const cells = cap.cells[row] ?? [];
  for (let c = 0; c < cells.length; c++) {
    if (cells[c].bg !== null) {
      if (first < 0) first = c;
      last = c;
      count++;
    }
  }
  return { first, last, count };
}

// ─── In-process predictions (the estimator side of the contract) ──

function imgBlock(width: number, alt: string): ImageBlock {
  return { type: "image", path: FIXTURE, width, alt };
}

function missingBlock(width: number, alt: string): ImageBlock {
  return { type: "image", path: join(PROJECT_ROOT, "test", "fixtures", "does-not-exist.png"), width, alt };
}

const GALLERY_BLOCKS: ContentBlock[] = [
  { type: "link", label: "LINKONE", url: "https://example.com/one" } as LinkBlock,
  imgBlock(40, "ALTONE"),
  { type: "link", label: "LINKTWO", url: "https://example.com/two" } as LinkBlock,
  imgBlock(80, "ALTTWO"),
  { type: "link", label: "LINKTHREE", url: "https://example.com/three" } as LinkBlock,
];

const BROKEN_BLOCKS: ContentBlock[] = [
  { type: "text", content: "MARKA", style: "plain" } as TextBlock,
  missingBlock(40, "MISSINGALT"),
  { type: "text", content: "MARKB", style: "plain" } as TextBlock,
  imgBlock(40, "REALALT"),
  { type: "text", content: "MARKC", style: "plain" } as TextBlock,
];

const RENDER_WIDTH = blockRenderWidth(COLS);
const PRED_SMALL = imageCellSize(imgBlock(40, ""), RENDER_WIDTH).blockRows;
const PRED_LARGE = imageCellSize(imgBlock(80, ""), RENDER_WIDTH).blockRows;
const PRED_MISSING = imageCellSize(missingBlock(40, ""), RENDER_WIDTH).blockRows;

// ═════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("\n\x1b[1m  Image geometry predictions (in-process)\x1b[0m\n");

  test("The fixture's predicted geometry is the one correct answer", () => {
    // 200x100 source: rows = round(cols * (100/200) * CELL_ASPECT).
    assertEqual(PRED_SMALL, 10, "40 cells wide -> 10 rows");
    assertEqual(PRED_LARGE, 20, "80 cells wide -> 20 rows");
    // An unreadable source falls back to the square placeholder, which through
    // the same aspect formula is a 2:1 box.
    assertEqual(PRED_MISSING, 20, "missing file at 40 cells -> 20 rows");
    assert(PRED_LARGE !== PRED_SMALL, "the two images must differ in height for the guards below to bite");
  });

  test("flex-engine sizes an image from its header, not from a constant", () => {
    // The defect this pins: `case "image": return 10;`. Two images of different
    // widths must produce different focus-rect spacing.
    const rects = computeFocusPositions(GALLERY_BLOCKS, RENDER_WIDTH, layoutAvailHeight(ROWS), () => []);
    assertEqual(rects.length, 3, "three focusable links");
    const gapSmall = rects[1].y - rects[0].y;
    const gapLarge = rects[2].y - rects[1].y;
    assertEqual(
      gapLarge - gapSmall,
      PRED_LARGE - PRED_SMALL,
      "the difference between the two gaps must be exactly the difference in image height",
    );
    assert(gapLarge > gapSmall, `a constant estimator would give equal gaps (${gapSmall}, ${gapLarge})`);
  });

  if (process.platform === "win32") {
    console.log("\n\x1b[1m  E2E: image rendering through the PTY emulator\x1b[0m");
    console.log("  \x1b[2mskipped on Windows: the piped-stdio PTY fallback cannot drive live apps there\x1b[0m");
  } else {
    await runE2E();
  }

  console.log(`\n\x1b[2m  ${"─".repeat(50)}\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
  console.log("");

  if (failed > 0) process.exit(1);
}

async function runE2E(): Promise<void> {
  const runDir = createRunDir();
  let cells: RunCapture | null = null;
  let alt: RunCapture | null = null;
  let launchError: unknown = null;

  try {
    cells = await captureRun(runDir, {});
    // A second boot with the kill switch on, to prove the escape hatch works
    // AND that turning pixels off does not move a single row.
    alt = await captureRun(runDir, { TERMINALTUI_IMAGE: "off" });
  } catch (err) {
    launchError = err;
  } finally {
    try { rmSync(runDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log("\n\x1b[1m  E2E: cell tiers through the PTY emulator\x1b[0m\n");

  if (launchError !== null || cells === null || alt === null) {
    test("Emulator launch", () => {
      throw new Error(`could not drive the app: ${launchError}`);
    });
    return;
  }
  const run = cells;
  const off = alt;

  // ── The image actually rendered ────────────────────────

  test("The page renders pixels, not the old [Image: path] placeholder", () => {
    const screen = run.gallery.text.join("\n");
    assert(!screen.includes("[Image:"), "screen still contains the placeholder text");
    assert(!screen.includes("ALTONE"), "the first image fell back to alt text");
    assert(!screen.includes("ALTTWO"), "the second image fell back to alt text");
  });

  test("Real block glyphs are on screen, from the quadrant tier's allowlist", () => {
    let ink = 0;
    let painted = 0;
    const seen = new Set<string>();
    for (let r = 0; r < run.gallery.cells.length; r++) {
      painted += paintedSpan(run.gallery, r).count;
      for (const cell of run.gallery.cells[r]) {
        if (INK_GLYPHS.includes(cell.char)) { ink++; seen.add(cell.char); }
      }
    }
    // Expressed as a FRACTION of painted cells, not an absolute count. The
    // point of this assertion is "the quadrant tier really resolves sub-cell
    // detail rather than emitting flat blocks", and an absolute threshold
    // silently measures the dither default instead: dithering perturbs
    // adjacent sub-pixels apart, so it inflates the ink count without adding
    // real detail. Undithered (the default at 256 colours) a photo's flat
    // regions correctly collapse to solid cells.
    assert(painted > 500, `expected a screen full of painted cells, counted ${painted}`);
    assert(
      ink > painted * 0.1,
      `expected real sub-cell detail, only ${ink} ink glyphs across ${painted} painted cells`,
    );
    assert(seen.size >= 3, `expected several distinct glyphs, saw ${[...seen].join("")}`);
    // The 8 complement glyphs are unreachable by construction — each is the
    // exact complement of a lower-ink partition and always loses the tie-break.
    for (const row of run.gallery.cells) {
      for (const cell of row) {
        assert(
          !"█▄▐▚▛▜▙▟".includes(cell.char),
          `emitted the high-ink glyph ${cell.char}, which should be unreachable`,
        );
      }
    }
  });

  test("Image cells carry real SGR colour, and many distinct colours", () => {
    const rows = imageRows(run.gallery, run.gallery.rowOf.LINKONE, run.gallery.rowOf.LINKTWO);
    assert(rows.length > 0, "no image rows found");
    const backgrounds = new Set<string>();
    const foregrounds = new Set<string>();
    for (const r of rows) {
      for (const cell of run.gallery.cells[r]) {
        if (cell.bg) backgrounds.add(cell.bg);
        if (cell.fg) foregrounds.add(cell.fg);
      }
    }
    assert(backgrounds.size >= 4, `expected several background pens, got ${backgrounds.size}`);
    assert(foregrounds.size >= 4, `expected several foreground pens, got ${foregrounds.size}`);
  });

  test("Relative image paths resolve against the project root, not the cwd", () => {
    // The app's cwd is <run>/ and the asset only exists under <run>/site/.
    // If projectDir threading regressed, both images would be alt boxes.
    const screen = run.gallery.text.join("\n");
    assert(!screen.includes("ALTONE"), "image resolved against the cwd and fell back to alt text");
    assert(imageRows(run.gallery, 0, ROWS).length > 0, "no pixels were drawn at all");
  });

  // ── Row counts: the flex-engine:315 regression guard ───

  test("Each image occupies exactly the number of rows imageCellSize predicts", () => {
    const { LINKONE, LINKTWO, LINKTHREE } = run.gallery.rowOf;
    assert(LINKONE >= 0 && LINKTWO >= 0 && LINKTHREE >= 0, "all three links must be on screen");

    const small = imageRows(run.gallery, LINKONE + 1, LINKTWO);
    const large = imageRows(run.gallery, LINKTWO + 1, LINKTHREE);
    assertEqual(small.length, PRED_SMALL, "rows painted by the 40-cell image");
    assertEqual(large.length, PRED_LARGE, "rows painted by the 80-cell image");

    // Contiguous: a gap would mean rows were dropped or something wrapped.
    for (let i = 1; i < small.length; i++) assertEqual(small[i], small[i - 1] + 1, "small image is contiguous");
    for (let i = 1; i < large.length; i++) assertEqual(large[i], large[i - 1] + 1, "large image is contiguous");
  });

  test("Content after an image starts on the row the estimator reserved", () => {
    // The strongest form of the guard: compare the layout engine's focus-rect
    // spacing with the rows the renderer actually put the links on. A renderer
    // that emits more rows than the estimator reserved shows up here as a
    // mismatch, and it is what shifts every FocusRect below an image.
    const rects = computeFocusPositions(GALLERY_BLOCKS, RENDER_WIDTH, layoutAvailHeight(ROWS), () => []);
    const { LINKONE, LINKTWO, LINKTHREE } = run.gallery.rowOf;
    assertEqual(rects[1].y - rects[0].y, LINKTWO - LINKONE, "gap across the 40-cell image");
    assertEqual(rects[2].y - rects[1].y, LINKTHREE - LINKTWO, "gap across the 80-cell image");
    // And the two gaps really do differ, so the assertions above are not
    // satisfiable by a constant.
    assert(
      (LINKTHREE - LINKTWO) - (LINKTWO - LINKONE) === PRED_LARGE - PRED_SMALL,
      `observed gaps ${LINKTWO - LINKONE} and ${LINKTHREE - LINKTWO} do not differ by ${PRED_LARGE - PRED_SMALL}`,
    );
  });

  test("Nothing wraps: every image row paints exactly one span of the block width", () => {
    const { LINKONE, LINKTWO, LINKTHREE } = run.gallery.rowOf;
    const check = (rows: number[], width: number, label: string): void => {
      for (const r of rows) {
        const span = paintedSpan(run.gallery, r);
        assertEqual(span.count, width, `${label} row ${r}: painted cell count`);
        assertEqual(span.last - span.first + 1, width, `${label} row ${r}: painted extent is contiguous`);
        assert(span.first > 0, `${label} row ${r} starts at column 0 — a wrapped continuation`);
        assert(span.last < COLS, `${label} row ${r} runs past the terminal width`);
      }
    };
    check(imageRows(run.gallery, LINKONE + 1, LINKTWO), 40, "40-cell image");
    check(imageRows(run.gallery, LINKTWO + 1, LINKTHREE), 80, "80-cell image");
  });

  test("No screen row overflows the terminal", () => {
    for (let r = 0; r < run.gallery.cells.length; r++) {
      assertEqual(run.gallery.cells[r].length, COLS, `row ${r} cell count`);
      assert((run.gallery.text[r] ?? "").length <= COLS, `row ${r} text is wider than the terminal`);
    }
  });

  // ── Failure path ───────────────────────────────────────

  test("A missing image renders an alt box and does not crash the app", () => {
    const screen = run.broken.text.join("\n");
    assert(screen.includes("MISSINGALT"), "the alt label is not on screen");
    assert(!screen.includes("[Image:"), "the old placeholder is back");
    assert(run.running, "the app died");
    const { MARKA, MARKB, MARKC } = run.broken.rowOf;
    assert(MARKA >= 0 && MARKB >= 0 && MARKC >= 0, "all three markers must be on screen");
    assert(MARKA < MARKB && MARKB < MARKC, "markers must stay in source order");
  });

  test("The alt box reserves exactly the rows the geometry predicts", () => {
    // Both blocks sit between identical text markers, so the gap difference is
    // the image height difference with every other layout cost cancelled out.
    const { MARKA, MARKB, MARKC } = run.broken.rowOf;
    const missingGap = MARKB - MARKA;
    const realGap = MARKC - MARKB;
    assertEqual(
      missingGap - realGap,
      PRED_MISSING - PRED_SMALL,
      `alt box (${missingGap}) vs rendered image (${realGap}) gap difference`,
    );
    const rects = computeFocusPositions(BROKEN_BLOCKS, RENDER_WIDTH, layoutAvailHeight(ROWS), () => []);
    assertEqual(rects.length, 0, "text blocks are not focusable — sanity check on the replica");
  });

  // ── Focus navigation ───────────────────────────────────

  test("Arrow keys walk past images and land on the right element", () => {
    assertEqual(run.focusLabels.join(" -> "), "LINKONE -> LINKTWO -> LINKTHREE -> LINKTWO -> LINKONE", "focus order");
  });

  test("The focus indicator lands on the row the element is drawn on", () => {
    const { LINKONE, LINKTWO, LINKTHREE } = run.gallery.rowOf;
    assertEqual(run.focusRows.join(","), [LINKONE, LINKTWO, LINKTHREE, LINKTWO, LINKONE].join(","), "gutter rows");
  });

  // ── We are cell-only, by design ────────────────────────

  test("Zero graphics-protocol escape sequences reach the terminal", () => {
    // vterm logs OSC/DCS/APC/PM/SOS to a side channel rather than the cell
    // grid. This engine is cell-only: sixel, kitty and iTerm2 payloads would
    // show up here, and would corrupt every terminal that cannot decode them.
    assertEqual(run.graphics.length, 0, `graphics records: ${JSON.stringify(run.graphics.slice(0, 2))}`);
    assertEqual(off.graphics.length, 0, "graphics records with TERMINALTUI_IMAGE=off");
  });

  // ── The kill switch ────────────────────────────────────

  test("TERMINALTUI_IMAGE=off forces the alt tier for every image", () => {
    const screen = off.broken.text.join("\n");
    assert(screen.includes("REALALT"), "a decodable image should now show its alt text");
    assert(screen.includes("MISSINGALT"), "the missing image should still show its alt text");
    assertEqual(imageRows(off.broken, 0, ROWS).length, 0, "no block glyphs should be drawn");
    assertEqual(imageRows(off.gallery, 0, ROWS).length, 0, "no block glyphs on the gallery page either");
    assert(off.running, "the app died with the kill switch on");
  });

  test("Turning pixels off does not move a single row", () => {
    // Row reservation is a function of the header, not of whether the pixels
    // arrived — that is what keeps every FocusRect stable across the loading,
    // loaded, error and disabled states.
    assertEqual(
      off.broken.rowOf.MARKC - off.broken.rowOf.MARKB,
      run.broken.rowOf.MARKC - run.broken.rowOf.MARKB,
      "rows reserved for a decodable image, pixels vs alt",
    );
    assertEqual(
      off.broken.rowOf.MARKB - off.broken.rowOf.MARKA,
      run.broken.rowOf.MARKB - run.broken.rowOf.MARKA,
      "rows reserved for a missing image",
    );
    assertEqual(off.gallery.rowOf.LINKTWO, run.gallery.rowOf.LINKTWO, "LINKTWO row");
    assertEqual(off.gallery.rowOf.LINKTHREE, run.gallery.rowOf.LINKTHREE, "LINKTHREE row");
  });
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
