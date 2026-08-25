#!/usr/bin/env npx tsx
/**
 * `fitPage` — an image sized to the rows the PAGE has left.
 *
 * Four things have to hold, and each of them is a defect that has shipped in
 * this area before:
 *
 *  1. THE REWRITE IS EXACTLY THE OLD BUDGET. The feature is spent by rewriting
 *     the block's `maxHeight` before geometry runs, rather than by threading a
 *     new argument into `imageCellSize`. That is only sound because the two are
 *     algebraically the same input to the same clamp — so the equivalence is
 *     swept here rather than argued, and a future change to `rowCap` or
 *     `colsWithinRowCap` breaks this suite instead of the feature.
 *  2. THE BLOCK IS THE SAME HEIGHT AT EVERY TIER. Sizing happens upstream of
 *     tier selection, so a fitted block must occupy `geom.blockRows` rows
 *     whether it lands on quadrant, ascii, braille or the alt box.
 *  3. THE ESTIMATOR AND THE RENDERER AGREE. The renderer is the only thing that
 *     can compute the leftover (it has composed the siblings) and the estimator
 *     is what places every FocusRect, so the number travels renderer → store →
 *     estimator, with a same-frame re-walk closing the lag. If those two drift,
 *     every rect below the image lands at the wrong Y and the arrow keys
 *     misroute — the same defect class as the old `case "image": return 10`.
 *  4. NOTHING CHANGES FOR AN IMAGE THAT DID NOT OPT IN. Pinned by object
 *     IDENTITY, not equality, exactly as `framedImageBlock` is.
 *
 * Run:  npx tsx test/image-page-fit.test.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TUIRuntime } from "../src/core/runtime.js";
import type { Site, ContentBlock, ImageFit, ImageMode } from "../src/config/types.js";
import type { TerminalIO } from "../src/core/terminal-io.js";
import { image, link, panel, video } from "../src/config/parser.js";
import { imageCellSize, renderImage } from "../src/components/Image.js";
import { videoBlockRows } from "../src/components/Video.js";
import { isPageFitImage, pageFitImageBlock, focusSlotsOf } from "../src/image/frame.js";
import { viewportHeight, blockRenderWidth } from "../src/core/layout-constants.js";
import { computeFocusPositions } from "../src/layout/flex-engine.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { themes } from "../src/style/theme.js";
import { setColorMode } from "../src/style/colors.js";
import { clearImageCache } from "../src/image/cache.js";

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

const HERE = dirname(fileURLToPath(import.meta.url));
/** 200x100 — a 2:1 source, so a row cap always binds before the column ceiling. */
const PNG = join(HERE, "fixtures", "gradient-200x100.png");
/** 64x48 JPEG, a different aspect, so the sweep is not one ratio's coincidence. */
const JPG = join(HERE, "fixtures", "quarters-64x48.jpg");
/** A real 848x352 pack, so video geometry comes from its actual header. */
const TVF = join(HERE, "../demos/cinema/assets/sintel.tvf");

/** The width a full-width block is handed on a 100-column page. */
const W = blockRenderWidth(100);

const THEME = themes.tokyoNight;
function ctx(width: number, extra: Partial<RenderContext> = {}): RenderContext {
  return { width, theme: THEME, borderStyle: "rounded", ...extra };
}

setColorMode("256");

console.log("\n\x1b[1m  Page-fit images\x1b[0m\n");

// ─── 1. The load-bearing equivalence ──────────────────────

test("a maxHeight rewrite is EXACTLY an availHeight budget, across the whole matrix", () => {
  // `pageFitImageBlock` claims that setting `maxHeight = budget - border` is the
  // same input to geometry's `rowCap` clamp as passing `availHeight = budget`.
  // If that ever stops being true the feature silently sizes to something else,
  // and nothing else in the suite would notice — so it is swept, not argued.
  let checked = 0;
  const bad: string[] = [];
  for (const path of [PNG, JPG]) {
    for (const border of [true, false]) {
      for (const width of [undefined, 96, 40]) {
        for (const fit of ["contain", "cover", "fill"] as ImageFit[]) {
          for (let budget = 1; budget <= 60; budget++) {
            const block = image(path, { border, width, fit, fitPage: true });
            const viaAvailHeight = imageCellSize(block, W, budget);
            const viaRewrite = imageCellSize(pageFitImageBlock(block, budget), W);
            checked++;
            if (
              viaAvailHeight.blockRows !== viaRewrite.blockRows ||
              viaAvailHeight.cols !== viaRewrite.cols
            ) {
              bad.push(
                `${border ? "bordered" : "plain"} w=${width} ${fit} budget=${budget}: ` +
                `${viaAvailHeight.cols}x${viaAvailHeight.blockRows} vs ${viaRewrite.cols}x${viaRewrite.blockRows}`,
              );
            }
          }
        }
      }
    }
  }
  assertEqual(checked, 2 * 2 * 3 * 3 * 60, "matrix size");
  assertEqual(bad.length, 0, `divergences (first: ${bad[0] ?? "none"})`);
});

test("the grant binds: a bigger budget is never a smaller block, and the budget is honoured", () => {
  const block = image(PNG, { border: true, fitPage: true });
  let last = 0;
  for (let budget = 3; budget <= 40; budget++) {
    const rows = imageCellSize(pageFitImageBlock(block, budget), W).blockRows;
    assert(rows >= last, `monotonic at budget ${budget}: ${rows} < ${last}`);
    assert(rows <= budget, `budget ${budget} honoured, got ${rows}`);
    last = rows;
  }
});

test("an author's own maxHeight still wins when it is tighter than the grant", () => {
  const block = image(PNG, { border: true, fitPage: true, maxHeight: 6 });
  assertEqual(pageFitImageBlock(block, 40).maxHeight, 6, "declared cap survives a roomy grant");
  assertEqual(pageFitImageBlock(block, 5).maxHeight, 3, "a tighter grant wins over the declared cap");
});

test("a controlled fitPage video spends its transport row INSIDE the page grant", () => {
  let checked = 0;
  for (const border of [true, false]) {
    for (let budget = border ? 4 : 2; budget <= 30; budget++) {
      const block = video(TVF, { border, controls: true, fitPage: true });
      const fitted = pageFitImageBlock(block, budget);

      // Passing one fewer row as availHeight is the direct-geometry form of
      // reserving the transport. The page-fit rewrite must be identical.
      const viaAvailHeight = videoBlockRows(block, W, budget - 1);
      const viaRewrite = videoBlockRows(fitted, W);
      assertEqual(viaRewrite, viaAvailHeight, `${border ? "bordered" : "plain"} budget ${budget}`);
      assert(viaRewrite <= budget, `budget ${budget} honoured, got ${viaRewrite}`);
      checked++;
    }
  }
  assertEqual(checked, 56, "controlled-video matrix size");
});

test("an uncontrolled fitPage video does not pay for a transport it does not draw", () => {
  const plain = video(TVF, { fitPage: true });
  const controlled = video(TVF, { fitPage: true, controls: true });
  assertEqual(pageFitImageBlock(plain, 17).maxHeight, 17, "plain video gets the whole grant");
  assertEqual(pageFitImageBlock(controlled, 17).maxHeight, 16, "controlled video reserves one row");
});

// ─── 2. Opt-in, by object identity ────────────────────────

test("pageFitImageBlock leaves an image that did not opt in strictly alone", () => {
  const plain = image(PNG, { width: 40, border: true });
  assert(pageFitImageBlock(plain, 20) === plain, "same object back for a plain image");

  // `resizable` wins outright: the viewer's chosen size must not be overruled,
  // and the two vertical clamps must not stack (frameRowCap already charges for
  // the hint row).
  const resizable = image(PNG, { fitPage: true, resizable: true, border: true });
  assert(pageFitImageBlock(resizable, 20) === resizable, "resizable beats fitPage");
  assert(!isPageFitImage(resizable), "a resizable image is not a page-fit image");

  const fitted = image(PNG, { fitPage: true });
  assert(pageFitImageBlock(fitted, undefined) === fitted, "no grant, no rewrite");
  assert(pageFitImageBlock(fitted, Number.NaN) === fitted, "a non-finite grant is no grant");
});

test("fitPage confers no focus slot", () => {
  // Focusability is `resizable` alone, in both directions. A sizing option that
  // quietly inserted a focus slot would shift every index below it on every page
  // that shows an image.
  assertEqual(focusSlotsOf(image(PNG, { fitPage: true })), 0, "a page-fit image occupies no focus slot");
  assertEqual(focusSlotsOf(image(PNG, { fitPage: true, resizable: true })), 1, "resizable still buys one");
});

// ─── 3. Degenerate budgets ────────────────────────────────

test("a bordered image cannot go below three rows, and says so rather than vanishing", () => {
  // Geometry drops the border only on a WIDTH shortfall, never for lack of
  // height, so 1 image row + 2 border rows is the floor. The page then scrolls
  // by a row or two — accepted, and pinned here so it is a documented floor
  // rather than a surprise.
  const block = image(PNG, { border: true, fitPage: true });
  for (const budget of [1, 2, 3]) {
    const geom = imageCellSize(pageFitImageBlock(block, budget), W);
    assertEqual(geom.blockRows, 3, `bordered floor at grant ${budget}`);
    assert(geom.cols >= 1, "never a zero-width image");
  }
  const bare = image(PNG, { fitPage: true });
  assertEqual(imageCellSize(pageFitImageBlock(bare, 1), W).blockRows, 1, "unbordered floor is one row");
});

// ─── 4. Same rows at every tier ───────────────────────────

test("a fitted block occupies the same rows at EVERY tier", () => {
  // Sizing happens upstream of tier selection: the block handed to the renderer
  // is indistinguishable from one an author wrote `maxHeight:` on. So the row
  // count must be the geometry's, whichever tier the ladder lands on — including
  // the alt box, which is the failure path.
  const tiers: ImageMode[] = ["quadrant", "half", "solid", "shading", "ascii", "braille"];
  for (const budget of [4, 9, 17, 30]) {
    for (const border of [true, false]) {
      for (const mode of tiers) {
        const fitted = pageFitImageBlock(image(PNG, { border, fitPage: true, mode }), budget);
        const geom = imageCellSize(fitted, W);
        assertEqual(
          renderImage(fitted, ctx(W)).length,
          geom.blockRows,
          `${mode} ${border ? "bordered" : "plain"} at grant ${budget}`,
        );
      }
      // The failure path: a source that cannot be decoded still reserves the
      // rows geometry promised, so the page does not reflow when an asset moves.
      const missing = pageFitImageBlock(
        image(join(HERE, "fixtures", "does-not-exist.png"), { border, fitPage: true, alt: "GONE" }),
        budget,
      );
      assertEqual(
        renderImage(missing, ctx(W)).length,
        imageCellSize(missing, W).blockRows,
        `alt box ${border ? "bordered" : "plain"} at grant ${budget}`,
      );
    }
  }
});

// ─── The runtime harness ──────────────────────────────────

class FakeIO implements TerminalIO {
  columns = 100;
  rows = 50;
  termType = "xterm-256color";
  private cbs: Array<(c: number, r: number) => void> = [];
  write(): void { /* the frame is read back from rt.frameState, not the wire */ }
  onResize(cb: (c: number, r: number) => void): void { this.cbs.push(cb); }
  onData(): void { /* no input */ }
  removeDataListener(): void { /* no input */ }
  setRawMode(): void { /* not a real tty */ }
  dispose(): void { /* nothing to release */ }
  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    for (const cb of this.cbs) cb(columns, rows);
  }
}

interface Harness {
  rt: TUIRuntime;
  io: FakeIO;
  /** The composed frame, ANSI stripped, one entry per terminal row. */
  frame(): string[];
  /** Rows of page CONTENT drawn this frame, i.e. the frame less header/footer. */
  contentRows(): string[];
  /** Whether the page is scrolled or scrollable — the thing a poster may not do. */
  scrolls(): boolean;
  /** Content-relative line index of the first row containing `needle`. */
  lineOf(needle: string): number;
}

function harness(blocks: ContentBlock[], columns = 100, rows = 50): Harness {
  const io = new FakeIO();
  io.columns = columns;
  io.rows = rows;
  const site = {
    config: {
      name: "fit",
      theme: "tokyoNight",
      pages: [
        { id: "home", title: "Home", content: [] },
        { id: "p", title: "P", content: blocks },
      ],
    },
  } as unknown as Site;
  const rt = new TUIRuntime(site, io);
  rt.navigateToPage("p");
  const frame = (): string[] =>
    ((rt as unknown as { frameState: { rows: string[] } }).frameState.rows ?? []).map((r) =>
      stripAnsi(r ?? ""),
    );
  // The page body is HEADER_LINES rows down and viewportHeight(rows) tall.
  const contentRows = (): string[] => frame().slice(4, 4 + viewportHeight(io.rows));
  return {
    rt,
    io,
    frame,
    contentRows,
    scrolls() {
      return frame().some((l) => l.includes("more below") || l.includes("more above") ||
        / [↑↓] \d+ items? (above|below)/.test(l));
    },
    lineOf(needle: string) {
      const offset = (rt as unknown as { pageScrollOffset: number }).pageScrollOffset;
      const i = contentRows().findIndex((l) => l.includes(needle));
      return i < 0 ? -1 : i + offset;
    },
  };
}

/** Total content rows the page composed, derived from the drawn frame. */
function drawnContentHeight(h: Harness): number {
  const rows = h.contentRows();
  let last = -1;
  for (let i = 0; i < rows.length; i++) if (rows[i].trim() !== "") last = i;
  return last + 1;
}

// ─── 5. The page fits ─────────────────────────────────────

/** Poster-shaped: fixed type above and below, one elastic picture between. */
function posterPage(): ContentBlock[] {
  const band = (text: string, height: number): ContentBlock => ({
    type: "custom",
    render: (width: number) => Array.from({ length: height }, (_, i) => (i === 0 ? text : "~".repeat(Math.min(20, width)))),
  });
  return [
    band("HEADONE", 6),
    band("HEADTWO", 6),
    image(PNG, { fitPage: true, border: true, alt: "POSTERALT" }),
    band("IMPRINT", 4),
  ];
}

test("a poster-shaped page fits its viewport at every terminal height that can hold it", () => {
  // The fixed blocks cost 6 + 6 + 4 = 16 rows plus 3 separators = 19, and a
  // bordered picture cannot go below 3 — so 22 content rows is the floor, i.e.
  // a viewport of 22 and a terminal of 29. Above that the page must never
  // scroll, at any height, without a single size constant in the page.
  for (let rows = 29; rows <= 80; rows++) {
    const h = harness(posterPage(), 100, rows);
    h.rt.render();
    const height = drawnContentHeight(h);
    assert(
      height <= viewportHeight(rows),
      `${rows} rows: composed ${height} content rows into a ${viewportHeight(rows)}-row viewport`,
    );
    assert(!h.scrolls(), `${rows} rows: page reports scrollable content`);
  }
});

test("below its floor the page scrolls rather than lying about it", () => {
  // The honest failure. A bordered picture's 3-row floor plus 19 rows of fixed
  // type cannot fit a 20-row viewport, and nothing in the design pretends
  // otherwise: it overflows and the footer says so.
  const h = harness(posterPage(), 100, 24);
  h.rt.render();
  assert(h.scrolls(), "a terminal below the floor must show the scroll affordance");
});

test("the picture grows and shrinks with the window, and re-fits on resize", () => {
  const h = harness(posterPage(), 100, 40);
  h.rt.render();
  const small = drawnContentHeight(h);

  h.io.resize(100, 70);
  h.rt.invalidateFrame();
  h.rt.render();
  const large = drawnContentHeight(h);

  assert(large > small, `a taller window uses more rows (${large} vs ${small})`);
  assert(large <= viewportHeight(70), "and still fits");

  h.io.resize(100, 40);
  h.rt.invalidateFrame();
  h.rt.render();
  assertEqual(drawnContentHeight(h), small, "shrinking back reproduces the smaller fit exactly");
  assert(!h.scrolls(), "and does not scroll");
});

test("an image that did not opt in still runs off the bottom, exactly as before", () => {
  // The behaviour `fitPage` exists to change, pinned on the other side: an
  // ordinary image is allowed to overflow and be scrolled to. If the page budget
  // ever leaks onto blocks that did not ask for it, this fails.
  const pages: ContentBlock[] = [
    { type: "custom", render: () => Array.from({ length: 6 }, () => "HEAD") },
    image(PNG, { width: 96, border: true }),
  ];
  const h = harness(pages, 100, 30);
  h.rt.render();
  assert(h.scrolls(), "a plain oversized image still overflows the viewport");
});

// ─── 6. Estimator / renderer parity ───────────────────────

/** Focus rects the runtime is currently navigating with. */
function rectsOf(h: Harness): Array<{ y: number; height: number }> {
  return (h.rt as unknown as { focusRects: Array<{ y: number; height: number }> }).focusRects;
}

test("focus rects land on the rows the fitted image actually left them", () => {
  // The whole reason the grant travels through a store instead of being
  // recomputed on each side. With the image ABOVE the links, every rect below it
  // moves when the picture is resized; if the estimator and the renderer disagree
  // by even one row, the arrow keys route to the wrong block.
  for (const rows of [40, 50, 60, 70]) {
    const h = harness(
      [
        link("LINKONE", "https://example.com/1"),
        image(PNG, { fitPage: true, border: true }),
        link("LINKTWO", "https://example.com/2"),
        link("LINKTHREE", "https://example.com/3"),
      ],
      100,
      rows,
    );
    h.rt.render();
    const rects = rectsOf(h);
    assertEqual(rects.length, 3, `three focusable blocks at ${rows} rows`);
    assertEqual(rects[0].y, h.lineOf("LINKONE"), `LINKONE rect at ${rows} rows`);
    assertEqual(rects[1].y, h.lineOf("LINKTWO"), `LINKTWO rect at ${rows} rows`);
    assertEqual(rects[2].y, h.lineOf("LINKTHREE"), `LINKTHREE rect at ${rows} rows`);
  }
});

test("parity holds with the fitted image first and last, so the splice fix-up is exercised both ways", () => {
  const first = harness(
    [image(PNG, { fitPage: true, border: true }), link("LINKONE", "https://example.com/1")],
    100, 50,
  );
  first.rt.render();
  assertEqual(rectsOf(first)[0].y, first.lineOf("LINKONE"), "image first");

  const last = harness(
    [link("LINKONE", "https://example.com/1"), image(PNG, { fitPage: true, border: true })],
    100, 50,
  );
  last.rt.render();
  assertEqual(rectsOf(last)[0].y, last.lineOf("LINKONE"), "image last");
  assert(!last.scrolls(), "an image in last position still fits");
});

test("the rects are right after ONE frame, and the re-walk stops once converged", () => {
  // `computeFocusLayout` structurally runs before composition, so frame 1 walks
  // with no grant at all. The conditional re-walk at the end of the page render
  // is what makes the rects correct anyway — and it must not fire forever.
  const h = harness(
    [link("LINKONE", "https://example.com/1"), image(PNG, { fitPage: true, border: true }), link("LINKTWO", "https://example.com/2")],
    100, 50,
  );
  h.rt.render();
  assertEqual(rectsOf(h)[1].y, h.lineOf("LINKTWO"), "correct on the FIRST frame");

  const afterFirst = JSON.stringify(rectsOf(h));
  h.rt.invalidateFrame();
  h.rt.render();
  assertEqual(JSON.stringify(rectsOf(h)), afterFirst, "a second identical frame changes nothing");

  for (const rows of [40, 60, 24, 70]) {
    h.io.resize(100, rows);
    h.rt.invalidateFrame();
    h.rt.render();
    assertEqual(rectsOf(h)[1].y, h.lineOf("LINKTWO"), `correct one frame after resizing to ${rows}`);
  }
});

// ─── 7. Inert where it must be ────────────────────────────

test("fitPage is inert inside a panel — the pane's own budget governs", () => {
  // A panel composes its own content and clips to its inner height, so the page
  // loop never sees the image and never grants it anything. Both the renderer
  // and the estimator must therefore ignore the flag there, or they disagree.
  const inPanel = harness([panel({ content: [image(PNG, { fitPage: true, border: true })], border: true })], 100, 50);
  inPanel.rt.render();
  const withFlag = drawnContentHeight(inPanel);

  const without = harness([panel({ content: [image(PNG, { border: true })], border: true })], 100, 50);
  without.rt.render();
  assertEqual(withFlag, drawnContentHeight(without), "a panelled image is the same size either way");
});

test("two fitted images on one page split the leftover and the page still fits", () => {
  const h = harness(
    [
      { type: "custom", render: () => ["TOP", "TOP", "TOP"] },
      image(PNG, { fitPage: true, border: true }),
      image(PNG, { fitPage: true, border: true }),
    ],
    100, 60,
  );
  h.rt.render();
  assert(drawnContentHeight(h) <= viewportHeight(60), "two elastic images still fit the viewport");
  assert(!h.scrolls(), "and do not scroll");
});

// ─── 8. The picture can actually spend what it is granted ──

/**
 * Widest run of INK in any content row, in display columns.
 *
 * Leading blanks are discounted deliberately: every ordinary row carries the
 * page's centring pad, so a raw row length would measure the pad rather than the
 * block, and the two flavours of image differ by exactly the thing being tested.
 */
function drawnContentWidth(h: Harness): number {
  return Math.max(0, ...h.contentRows().map((l) => l.trimEnd().length - (l.length - l.trimStart().length)));
}

test("a fitted picture is not pinned to the content column — it uses the whole terminal", () => {
  // The defect: MAX_IMAGE_COLS is CONTENT_MAX_WIDTH - 1, a measure chosen for
  // PROSE, and `contain` derives rows from columns — so on a tall window the
  // picture saturated at 99 columns and could not spend the rows it had just
  // been granted, leaving a quarter of the screen black. The fix lets a page-fit
  // image (and only a page-fit image) compose against `pageFitWidth(columns)`.
  const COLS = 160;
  const wide = harness([image(PNG, { fitPage: true, border: true })], COLS, 60);
  wide.rt.render();
  assert(
    drawnContentWidth(wide) > blockRenderWidth(COLS),
    `a fitted picture exceeds the ${blockRenderWidth(COLS)}-column content column ` +
    `(drew ${drawnContentWidth(wide)})`,
  );
  assert(drawnContentWidth(wide) <= COLS, "and never exceeds the terminal");

  // The other side of the same assertion: an image that did not opt in stays
  // inside the content column exactly as it always has.
  const plain = harness([image(PNG, { border: true })], COLS, 60);
  plain.rt.render();
  assert(
    drawnContentWidth(plain) <= blockRenderWidth(COLS),
    `a plain image stays in the content column (drew ${drawnContentWidth(plain)})`,
  );
});

test("a fitted picture occupies exactly the rows it was granted, surplus and all", () => {
  // `contain` means a wide source cannot always spend its whole grant. The
  // surplus is held inside the block as margin around the picture rather than
  // left at the bottom of the page — so the composed page is exactly the
  // viewport, and the block below the picture sits where the composition puts it
  // instead of floating up under a black band.
  for (const [columns, rows] of [[160, 90], [100, 60], [200, 120]] as const) {
    const h = harness(posterPage(), columns, rows);
    h.rt.render();
    assertEqual(
      drawnContentHeight(h),
      viewportHeight(rows),
      `${columns}x${rows}: the composition fills the viewport exactly`,
    );
    assert(!h.scrolls(), `${columns}x${rows}: and does not scroll`);
    // The block AFTER the picture must still be the last thing on the page —
    // the black-band symptom was everything bunching at the top.
    const imprint = h.lineOf("IMPRINT");
    assert(
      imprint >= viewportHeight(rows) - 6,
      `${columns}x${rows}: the trailing band sits at the foot of the page (row ${imprint})`,
    );
  }
});

test("focus rects still land right when the picture bleeds past the content column", () => {
  // Parity again, but with the grant's COLUMN half in play: the estimator's walk
  // is seeded with `blockRenderWidth(columns)` and the renderer composes against
  // `pageFitWidth(columns)`, so if the column allowance did not travel with the
  // row allowance the estimator would reserve a 99-column picture's height for a
  // 158-column one — 12 rows out at this size.
  for (const columns of [100, 137, 160, 200]) {
    const h = harness(
      [
        link("LINKONE", "https://example.com/1"),
        image(PNG, { fitPage: true, border: true }),
        link("LINKTWO", "https://example.com/2"),
      ],
      columns, 60,
    );
    h.rt.render();
    const rects = rectsOf(h);
    assertEqual(rects[0].y, h.lineOf("LINKONE"), `LINKONE rect at ${columns} columns`);
    assertEqual(rects[1].y, h.lineOf("LINKTWO"), `LINKTWO rect at ${columns} columns`);
  }
});

// ─── 9. `custom` blocks are measured, not assumed ─────────

test("a tall custom block moves the rects below it by its real height", () => {
  // flex-engine charged every `custom` block a flat 3 rows while the framework
  // documents sizing one to `CustomRenderContext.availRows` — so a 6-row banner
  // above a link put the link's rect three rows above the link, and spatial
  // focus navigation misrouted on exactly the pages the feature was written for.
  for (const height of [1, 3, 6, 7, 12]) {
    const band: ContentBlock = {
      type: "custom",
      render: () => Array.from({ length: height }, (_, i) => `BAND${i}`),
    };
    const h = harness([band, link("LINKONE", "https://example.com/1")], 100, 60);
    h.rt.render();
    assertEqual(
      rectsOf(h)[0].y,
      h.lineOf("LINKONE"),
      `a ${height}-row custom block puts the link's rect where the link is`,
    );
  }
});

test("a custom block sized to availRows is measured at the size it will render", () => {
  // The measurement has to pass the SAME availRows the renderer will — page
  // level is `viewportHeight(rows)`, not `layoutAvailHeight(rows)`, and the two
  // differ by one. A block that steps on that boundary would otherwise be
  // measured at one height and drawn at another.
  const stepped: ContentBlock = {
    type: "custom",
    render: (_w, _t, ctx) => Array.from({ length: (ctx?.availRows ?? 0) >= 40 ? 9 : 4 }, (_, i) => `STEP${i}`),
  };
  for (const rows of [46, 47, 48, 49]) {
    const h = harness([stepped, link("LINKONE", "https://example.com/1")], 100, rows);
    h.rt.render();
    assertEqual(rectsOf(h)[0].y, h.lineOf("LINKONE"), `rect parity at ${rows} terminal rows`);
  }
});

test("a custom block whose render throws does not take the layout pass down with it", () => {
  // The measurement calls user code, so it must be total. (Rendering that same
  // block still throws — unchanged, and not this pass's business — so this is
  // asserted against the walk directly rather than through a frame.)
  const bad: ContentBlock = { type: "custom", render: () => { throw new Error("boom"); } };
  const rects = computeFocusPositions(
    [bad, link("LINKONE", "https://example.com/1")],
    W, 40, () => [],
    { measureCustom: () => { throw new Error("boom"); } },
  );
  assertEqual(rects.length, 1, "the walk still produced the link's rect");
  assertEqual(rects[0].y, 4, "and charged the throwing block the fallback 3 rows + separator");
});

// ─── Report ───────────────────────────────────────────────

clearImageCache();
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  for (const f of failures) console.log(`  \x1b[31m${f}\x1b[0m`);
  process.exit(1);
}
