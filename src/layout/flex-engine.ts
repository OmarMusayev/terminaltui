/**
 * Flex layout engine — computes screen positions (FocusRect) for all
 * focusable items in a content block tree.
 *
 * Uses the existing layout algorithms (layoutColumns, layoutRows, etc.)
 * to determine panel positions, then walks the content tree to assign
 * x, y, width, height to each focusable item.
 */
import type { FocusRect } from "./types.js";
import type {
  ContentBlock, DynamicBlock, FormBlock, ImageBlock, VideoBlock,
  ColumnsBlock, RowsBlock, GridBlock, PanelBlock, PanelConfig,
  RowBlock, ContainerBlock,
} from "../config/types.js";
import { layoutColumns, layoutRows, layoutGrid } from "./panel-layout.js";
import { shouldCollapseColumns, effectiveGridCols } from "./responsive.js";
import { rowColsToPanels, getBreakpoint, getEffectiveSpan } from "./grid-system.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "./box-model.js";
import { imageBlockHeight } from "../components/Image.js";
import { videoBlockRows } from "../components/Video.js";
import {
  focusSlotsOf, framedImageBlock, frameHintRows, pageFitBlockRows, pageFitImageBlock,
  type PageFitGrant,
} from "../image/frame.js";

/**
 * The viewer's frame width for a resizable image, or undefined for "as
 * declared". Supplied by the runtime, which owns the per-block store; passing
 * nothing (tests, the very first layout pass) simply lays out declared sizes.
 */
export type FrameWidthResolver = (block: ImageBlock) => number | undefined;

/**
 * What the page granted a `fitPage` image, or undefined for "no grant".
 *
 * Neither half is computable here. The row leftover is `viewport` minus the rows
 * every SIBLING actually drew, and this walk only estimates sibling heights; the
 * column allowance is the whole terminal, while this walk is seeded with the
 * content column. So the RENDERER computes both, publishes them, and this walk
 * reads them back. Passing nothing (tests, a layout pass before the first paint)
 * lays the image out at its declared size, which is exactly what the renderer
 * does when it has no grant either.
 */
export type PageFitGrantResolver = (block: ImageBlock | VideoBlock) => PageFitGrant | undefined;

/**
 * Rows a `custom` block renders, or undefined for "cannot say".
 *
 * A `custom` block's height is whatever its own `render` returns, so the only
 * honest estimate is to CALL it — which this walk cannot do, because `render`
 * takes a theme and a {@link CustomRenderContext} and this module knows about
 * neither. The runtime supplies both and hands back a row count.
 *
 * The alternative was the flat 3 rows this walk charged before, and that number
 * is wrong by construction for the pattern the framework documents: a block that
 * sets display type sized to `availRows` is routinely 4-7 rows, so every focus
 * rect below one landed that much too high and spatial navigation misrouted.
 *
 * Returning undefined falls back to the old constant, which is what a caller
 * that supplies no resolver (every test, every pre-runtime layout pass) gets.
 */
export type CustomHeightResolver = (
  block: ContentBlock,
  width: number,
  panelHeight: number | undefined,
) => number | undefined;

/**
 * The runtime-supplied lookups this walk needs and cannot derive.
 *
 * Bundled rather than threaded one by one: they are constant for the whole walk
 * (unlike `panelHeight`, which changes per pane), and passing four optional
 * positionals down thirteen recursive call sites is how the set silently went
 * out of step in the first place.
 */
export interface WalkDeps {
  /**
   * Root that relative asset paths resolve against. Only `image` uses it, and it
   * must be the SAME root `renderImage` is handed or the two probe different
   * files and reserve different row counts.
   */
  projectDir?: string;
  /**
   * Current frame width of a resizable image. Must be the same store the
   * renderer reads, for the same reason as `projectDir`: a resized image that
   * layout still reserves the declared height for drags every rect below it out
   * of position — the resizable-frame flavour of the old
   * `case "image": return 10` defect.
   */
  frameWidthOf?: FrameWidthResolver;
  /** What the page granted a `fitPage` image. See {@link PageFitGrantResolver}. */
  pageFitGrantOf?: PageFitGrantResolver;
  /** Measured height of a `custom` block. See {@link CustomHeightResolver}. */
  measureCustom?: CustomHeightResolver;
}

/**
 * Compute FocusRect for every focusable item in the content tree.
 *
 * @param blocks       Page content blocks
 * @param contentWidth Available width (terminal columns minus padding)
 * @param availHeight  Available height for layout blocks
 * @param resolveDyn   Function to resolve DynamicBlock → ContentBlock[]
 * @param deps         Runtime lookups; see {@link WalkDeps}. APPENDED, never
 *   inserted: five test files call this function positionally at arity 4, and a
 *   value landing in `resolveDyn`'s slot would fail silently rather than loudly.
 *   Omitting it lays every block out at its declared size.
 */
export function computeFocusPositions(
  blocks: ContentBlock[],
  contentWidth: number,
  availHeight: number,
  resolveDyn: (block: DynamicBlock) => ContentBlock[],
  deps: WalkDeps = {},
): FocusRect[] {
  const rects: FocusRect[] = [];
  const counter = { value: 0 };
  walkBlocks(blocks, 0, 0, contentWidth, availHeight, rects, counter, resolveDyn, deps, undefined);
  return rects;
}

/**
 * Walk the content tree, accumulating FocusRects. Returns the cursor Y after all blocks.
 *
 * `panelHeight` mirrors `RenderContext.panelHeight` — the value the renderer
 * will actually see for these blocks. It is `undefined` at page level and the
 * enclosing pane's INNER height inside any panel-backed container, because
 * `renderPanel()` is the only thing that ever sets it. An image sizes itself
 * against that budget (geometry.ts turns it into a row cap), so the estimator
 * has to pass the same value or it reserves a taller box than the renderer
 * draws and every focus rect below the image lands too low.
 */
function walkBlocks(
  blocks: ContentBlock[],
  offsetX: number,
  startY: number,
  availWidth: number,
  availHeight: number,
  rects: FocusRect[],
  counter: { value: number },
  resolveDyn: (block: DynamicBlock) => ContentBlock[],
  deps: WalkDeps,
  panelHeight?: number,
): number {
  let cursorY = startY;

  for (const block of blocks) {
    switch (block.type) {
      case "columns": {
        const cols = block as ColumnsBlock;
        if (shouldCollapseColumns(cols.panels.length, availWidth)) {
          // Collapsed: stack vertically
          for (const p of cols.panels) {
            const adj = panelContentAdjust(p);
            cursorY = walkBlocks(
              p.content, offsetX + adj.dx, cursorY + adj.dy,
              availWidth - adj.dw, availHeight - adj.dh,
              rects, counter, resolveDyn, deps, availHeight - adj.dh,
            );
            cursorY += 2; // divider + gap
          }
        } else {
          const panelRects = layoutColumns(cols.panels, availWidth, availHeight);
          for (let i = 0; i < panelRects.length; i++) {
            const pr = panelRects[i];
            const adj = panelContentAdjust(cols.panels[i]);
            walkBlocks(
              cols.panels[i].content,
              offsetX + pr.x + adj.dx, cursorY + adj.dy,
              pr.width - adj.dw, pr.height - adj.dh,
              rects, counter, resolveDyn, deps, pr.height - adj.dh,
            );
          }
          const maxH = panelRects.length > 0
            ? Math.max(...panelRects.map(r => r.height))
            : 0;
          cursorY += maxH + 1;
        }
        break;
      }

      case "rows": {
        const rowsBlock = block as RowsBlock;
        const panelRects = layoutRows(rowsBlock.panels, availWidth, availHeight);
        for (let i = 0; i < panelRects.length; i++) {
          const pr = panelRects[i];
          const adj = panelContentAdjust(rowsBlock.panels[i]);
          walkBlocks(
            rowsBlock.panels[i].content,
            offsetX + pr.x + adj.dx, cursorY + pr.y + adj.dy,
            pr.width - adj.dw, pr.height - adj.dh,
            rects, counter, resolveDyn, deps, pr.height - adj.dh,
          );
        }
        const totalH = panelRects.length > 0
          ? panelRects[panelRects.length - 1].y + panelRects[panelRects.length - 1].height
          : 0;
        cursorY += totalH + 1;
        break;
      }

      case "grid": {
        const gridBlock = block as GridBlock;
        const gap = gridBlock.config.gap ?? 1;
        const cols = effectiveGridCols(gridBlock.config.cols, availWidth, gap);
        const adjustedConfig = { ...gridBlock.config, cols };
        const panelRects = layoutGrid(adjustedConfig, availWidth, availHeight);
        for (let i = 0; i < panelRects.length; i++) {
          const pr = panelRects[i];
          const panel = gridBlock.config.items[i];
          if (!panel) continue;
          const adj = panelContentAdjust(panel);
          walkBlocks(
            panel.content,
            offsetX + pr.x + adj.dx, cursorY + pr.y + adj.dy,
            pr.width - adj.dw, pr.height - adj.dh,
            rects, counter, resolveDyn, deps, pr.height - adj.dh,
          );
        }
        const totalH = panelRects.length > 0
          ? Math.max(...panelRects.map(r => r.y + r.height))
          : 0;
        cursorY += totalH + 1;
        break;
      }

      case "panel": {
        const panelBlock = block as PanelBlock;
        const adj = panelContentAdjust(panelBlock.config);
        cursorY = walkBlocks(
          panelBlock.config.content,
          offsetX + adj.dx, cursorY + adj.dy,
          availWidth - adj.dw, availHeight - adj.dh,
          rects, counter, resolveDyn, deps, availHeight - adj.dh,
        );
        cursorY += 1;
        break;
      }

      case "row": {
        const rowBlock = block as RowBlock;
        const gap = rowBlock.gap ?? 1;
        const cols = rowBlock.cols;

        // Resolve effective spans with responsive wrapping (same logic as renderRowBlock)
        const bp = getBreakpoint(availWidth);
        const autoSpan = Math.max(1, Math.floor(12 / cols.length));
        const spans = cols.map(c => getEffectiveSpan(c, bp, autoSpan));

        // Group into wrapped rows
        const wrappedRows: typeof cols[] = [[]];
        let rowSpan = 0;
        for (let i = 0; i < cols.length; i++) {
          const offset = cols[i].offset ?? 0;
          const total = spans[i] + offset;
          if (rowSpan + total > 12 && wrappedRows[wrappedRows.length - 1].length > 0) {
            wrappedRows.push([]);
            rowSpan = 0;
          }
          wrappedRows[wrappedRows.length - 1].push(cols[i]);
          rowSpan += total;
        }

        // Walk each wrapped row
        for (const wRow of wrappedRows) {
          const panels = rowColsToPanels(wRow, availWidth, gap, availWidth);
          if (shouldCollapseColumns(panels.length, availWidth)) {
            for (const p of panels) {
              cursorY = walkBlocks(
                p.content, offsetX, cursorY, availWidth, availHeight,
                rects, counter, resolveDyn, deps, availHeight - panelContentAdjust(p).dh,
              );
              cursorY += 2;
            }
          } else {
            const panelRects = layoutColumns(panels, availWidth, availHeight);
            for (let i = 0; i < panelRects.length; i++) {
              const pr = panelRects[i];
              // x/y/width stay as they were — only the height BUDGET is adjusted,
              // because `renderPanel` hands its content `height - chrome` as
              // `ctx.panelHeight` and an image sizes itself against exactly that.
              walkBlocks(
                panels[i].content,
                offsetX + pr.x, cursorY,
                pr.width, pr.height,
                rects, counter, resolveDyn, deps, pr.height - panelContentAdjust(panels[i]).dh,
              );
            }
            const maxH = panelRects.length > 0 ? Math.max(...panelRects.map(r => r.height)) : 0;
            cursorY += maxH + 1;
          }
        }
        break;
      }

      case "container": {
        const containerBlock = block as ContainerBlock;
        const padding = containerBlock.padding ?? 0;
        const maxW = containerBlock.maxWidth ?? availWidth;
        const innerW = Math.max(1, Math.min(availWidth, maxW) - padding * 2);
        const totalPad = availWidth - innerW;
        const leftPad = (containerBlock.center !== false) ? Math.floor(totalPad / 2) : padding;
        // container/section/form/dynamic are not panels: they never set
        // `ctx.panelHeight`, so the enclosing pane's budget passes straight
        // through to whatever they contain.
        cursorY = walkBlocks(
          containerBlock.content,
          offsetX + leftPad, cursorY,
          innerW, availHeight,
          rects, counter, resolveDyn, deps, panelHeight,
        );
        cursorY += 1;
        break;
      }

      case "section":
        cursorY += 3; // title + divider + blank line
        cursorY = walkBlocks(block.content, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn, deps, panelHeight);
        break;

      case "form":
        cursorY = walkBlocks((block as FormBlock).fields, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn, deps, panelHeight);
        break;

      case "dynamic": {
        const resolved = resolveDyn(block as DynamicBlock);
        cursorY = walkBlocks(resolved, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn, deps, panelHeight);
        break;
      }

      case "accordion": {
        const slots = focusSlotsOf(block); // one per item
        for (let i = 0; i < slots; i++) {
          const itemH = 2; // header line + spacing
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: itemH });
          counter.value++;
          cursorY += itemH;
        }
        cursorY += 1;
        break;
      }

      case "timeline": {
        const slots = focusSlotsOf(block); // one per item
        for (let i = 0; i < slots; i++) {
          const itemH = 3; // title + period + connector
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: itemH });
          counter.value++;
          cursorY += itemH;
        }
        cursorY += 1;
        break;
      }

      case "tabs": {
        if (focusSlotsOf(block) > 0) {
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: 3 });
          counter.value++;
        }
        cursorY += 4;
        break;
      }

      default: {
        const focusable = focusSlotsOf(block) > 0;
        // `panelHeight ?? availHeight` is the frame's vertical budget, and it
        // is the SAME expression `frameLimitsOf` builds on the renderer side
        // (whose page-level fallback, layoutAvailHeight(rows), is exactly what
        // computeFocusLayout seeds this walk's availHeight with).
        const h = estimateBlockHeight(
          block, availWidth, deps, panelHeight, panelHeight ?? availHeight,
        );
        if (focusable) {
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: h });
          counter.value++;
        }
        cursorY += h + 1;
      }
    }
  }

  return cursorY;
}

/**
 * Estimate the rendered height of a block (in terminal rows).
 *
 * Heights here approximate what each component renderer actually produces.
 * Width-dependent terms (like `card.body` wrapping) derive their chrome from
 * `COMPONENT_DEFAULTS` so a padding/border change propagates here automatically.
 *
 * @param deps Runtime lookups; see {@link WalkDeps}.
 * @param panelHeight `RenderContext.panelHeight` as the renderer will see it —
 *   `undefined` at page level. Only `image` and `custom` consult it; every other
 *   block type has a height independent of the vertical budget, which is exactly
 *   why the omission stayed invisible until images landed.
 * @param rowBudget Vertical budget for a resizable frame — `panelHeight` when
 *   there is one, else the page's layout height. Distinct from `panelHeight`
 *   because that one must stay `undefined` at page level: it is forwarded to
 *   `imageBlockHeight` as a hard cap, and applying the page budget there would
 *   silently shrink every ordinary (non-resizable) image on a short terminal.
 */
function estimateBlockHeight(
  block: ContentBlock,
  width: number,
  deps: WalkDeps,
  panelHeight?: number,
  rowBudget?: number,
): number {
  switch (block.type) {
    case "card": {
      const cardDims = computeBoxDimensions(width, COMPONENT_DEFAULTS.card);
      // Body wraps inside the content area minus the leading icon prefix ("◆ ").
      const bodyWidth = Math.max(1, cardDims.content - 2);
      // border (top+bottom) + 1 title line.
      let h = cardDims.border * 2 + 1;
      if (block.subtitle) h++;
      if (block.body) h += Math.ceil(block.body.length / bodyWidth) + 1;
      if (block.tags && block.tags.length > 0) h++;
      return Math.max(3, h);
    }
    case "link": return 1;
    case "hero": return 5;
    case "textInput": return 3;
    case "textArea": return ((block as any).rows ?? 3) + 2;
    case "select": return 2;
    case "checkbox": return 1;
    case "toggle": return 1;
    case "radioGroup": return ((block as any).options?.length ?? 2) + 1;
    case "numberInput": return 2;
    case "searchInput": return 3;
    case "button": return 1;
    case "text": return Math.max(1, Math.ceil(((block as any).content?.length ?? 0) / Math.max(1, width)) + 1);
    case "table": return ((block as any).rows?.length ?? 0) + 3;
    case "list": return ((block as any).items?.length ?? 0) + 1;
    case "divider": return 1;
    case "spacer": return (block as any).lines ?? 1;
    case "quote": return 3;
    case "badge": return 1;
    // Not a constant: the hardcoded 10 was five rows short of what the renderer
    // emits at a 99-column content width, so every FocusRect below an image sat
    // five rows too high and the arrow keys misrouted. imageBlockHeight() is
    // the SAME call the renderer sizes itself with (header probe included) with
    // the SAME arguments (`renderImage` passes `ctx.panelHeight` as the height
    // budget), so the two agree by construction rather than by a number kept in
    // sync. Dropping `panelHeight` here reintroduced the same defect with a new
    // cause: a panel shorter than the image's natural height shrinks it in the
    // renderer while the estimator still reserved the full box.
    //
    // And not the DECLARED size either, for the third instance of that same
    // defect: a resizable frame is measured at the size the viewer grew it to,
    // through the same framedImageBlock() the renderer applies, plus the hint
    // row it always draws.
    //
    // And, for the fourth instance: a `fitPage` image is measured through the
    // same pageFitImageBlock() the page loop applies, fed the same grant from
    // the same per-runtime store — including its COLUMN half, because the page
    // composes that image against the whole terminal rather than the content
    // column this walk is seeded with, and columns decide rows under `contain`.
    // The two transforms are each the identity on the other's opt-in (`fitPage`
    // is inert when `resizable` is set), so the order they compose in does not
    // matter.
    case "image": {
      // The grant is consulted only where `panelHeight` is undefined — i.e. at
      // page level, which is by definition the only place the page loop
      // composes and therefore grants anything. Inside a pane the enclosing
      // panel's inner height already governs the image and the page loop never
      // deferred it, so `fitPage` must be inert on both sides.
      const grant = panelHeight === undefined ? deps.pageFitGrantOf?.(block) : undefined;
      const sized = framedImageBlock(block, deps.frameWidthOf?.(block), {
        availWidth: width,
        availRows: rowBudget,
      });
      const fitted = pageFitImageBlock(sized, grant?.rows);
      const availWidth = grant?.cols ?? width;
      const drawn = imageBlockHeight(fitted, availWidth, panelHeight, deps.projectDir, grant?.cols);
      // A granted image is padded out to the whole grant by the page loop, so
      // the rows to reserve are the grant, not the picture — same two functions,
      // same arguments, no arithmetic repeated on this side.
      return pageFitBlockRows(drawn, grant?.rows) + frameHintRows(block);
    }
    // Measured from the pack header, exactly as the image case is measured from
    // the image header — and for the same reason. This estimator walks the tree
    // independently of the renderer, so a constant here (the `case "image":
    // return 10` defect this file's docblock warns about) would put every focus
    // rect below a video at the wrong Y, and the arrow keys would select the
    // wrong block. `videoBlockRows` is the function the renderer itself uses to
    // size the block, transport row included.
    case "video": {
      // Same three steps as the image case above, for the same reason: the page
      // loop grants rows to a `fitPage` block and then pads the picture out to
      // the whole grant, so what must be RESERVED is the grant, not the picture.
      const grant = panelHeight === undefined ? deps.pageFitGrantOf?.(block) : undefined;
      const fitted = pageFitImageBlock(block, grant?.rows);
      const drawn = videoBlockRows(fitted, grant?.cols ?? width, panelHeight, deps.projectDir, grant?.cols);
      return pageFitBlockRows(drawn, grant?.rows);
    }
    case "progressBar": return 2;
    // gallery is not focusable (no rect) but still occupies rendered rows.
    case "gallery": return 8;
    case "chat": return 10;
    // Measured, not assumed. `custom` renders whatever its author returns, and
    // the framework documents sizing that output to `CustomRenderContext.
    // availRows` — display type that steps down a font ladder as the window
    // shrinks is 1 to 7 rows, never the 3 this arm used to charge unconditionally.
    // A single tall `custom` block above a link put the link's rect four rows
    // above where the link was drawn, so spatial focus navigation misrouted on
    // exactly the pages the feature was written for.
    //
    // The resolver calls the block's own `render` (pure and synchronous by
    // contract) and this walk is not per-frame — `renderMain` recomputes it only
    // when the content tree or the terminal size changes — so the extra call is
    // not on the hot path. Without a resolver, or if the resolver throws, the old
    // constant stands: this is the one place the walk calls out to page code, and
    // a layout pass must never be the thing that kills a frame.
    case "custom":
      try {
        return deps.measureCustom?.(block, width, panelHeight) ?? 3;
      } catch {
        return 3;
      }
    default: return 3;
  }
}

/** Compute the content area offset inside a panel (accounting for border, padding, title). */
function panelContentAdjust(panel: PanelConfig): { dx: number; dy: number; dw: number; dh: number } {
  const hasBorder = panel.border === true || (typeof panel.border === "string" && panel.border !== "none" && panel.border !== "left" && panel.border !== "right" && panel.border !== "top" && panel.border !== "bottom");
  const padding = panel.padding ?? 0;
  const hasTitle = !!panel.title && !hasBorder;
  const borderSize = hasBorder ? 1 : 0;
  const titleH = hasTitle ? 1 : 0;
  return {
    dx: borderSize + padding,
    dy: borderSize + padding + titleH,
    dw: (borderSize + padding) * 2,
    dh: (borderSize + padding) * 2 + titleH,
  };
}
