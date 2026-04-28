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
  ContentBlock, DynamicBlock, FormBlock,
  ColumnsBlock, RowsBlock, GridBlock, PanelBlock, PanelConfig,
  RowBlock, ContainerBlock,
} from "../config/types.js";
import { layoutColumns, layoutRows, layoutGrid } from "./panel-layout.js";
import { shouldCollapseColumns, effectiveGridCols } from "./responsive.js";
import { rowColsToPanels, getBreakpoint, getEffectiveSpan } from "./grid-system.js";
import { componentRegistry } from "../components/base.js";

/**
 * Compute FocusRect for every focusable item in the content tree.
 *
 * @param blocks       Page content blocks
 * @param contentWidth Available width (terminal columns minus padding)
 * @param availHeight  Available height for layout blocks
 * @param resolveDyn   Function to resolve DynamicBlock → ContentBlock[]
 */
export function computeFocusPositions(
  blocks: ContentBlock[],
  contentWidth: number,
  availHeight: number,
  resolveDyn: (block: DynamicBlock) => ContentBlock[],
): FocusRect[] {
  const rects: FocusRect[] = [];
  const counter = { value: 0 };
  walkBlocks(blocks, 0, 0, contentWidth, availHeight, rects, counter, resolveDyn);
  return rects;
}

/** Walk the content tree, accumulating FocusRects. Returns the cursor Y after all blocks. */
function walkBlocks(
  blocks: ContentBlock[],
  offsetX: number,
  startY: number,
  availWidth: number,
  availHeight: number,
  rects: FocusRect[],
  counter: { value: number },
  resolveDyn: (block: DynamicBlock) => ContentBlock[],
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
              rects, counter, resolveDyn,
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
              rects, counter, resolveDyn,
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
            rects, counter, resolveDyn,
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
            rects, counter, resolveDyn,
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
          rects, counter, resolveDyn,
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
              cursorY = walkBlocks(p.content, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn);
              cursorY += 2;
            }
          } else {
            const panelRects = layoutColumns(panels, availWidth, availHeight);
            for (let i = 0; i < panelRects.length; i++) {
              const pr = panelRects[i];
              walkBlocks(
                panels[i].content,
                offsetX + pr.x, cursorY,
                pr.width, pr.height,
                rects, counter, resolveDyn,
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
        cursorY = walkBlocks(
          containerBlock.content,
          offsetX + leftPad, cursorY,
          innerW, availHeight,
          rects, counter, resolveDyn,
        );
        cursorY += 1;
        break;
      }

      case "section":
        cursorY += 3; // title + divider + blank line
        cursorY = walkBlocks(block.content, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn);
        break;

      case "form":
        cursorY = walkBlocks((block as FormBlock).fields, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn);
        break;

      case "dynamic": {
        const resolved = resolveDyn(block as DynamicBlock);
        cursorY = walkBlocks(resolved, offsetX, cursorY, availWidth, availHeight, rects, counter, resolveDyn);
        break;
      }

      case "accordion": {
        for (let i = 0; i < block.items.length; i++) {
          const itemH = 2; // header line + spacing
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: itemH });
          counter.value++;
          cursorY += itemH;
        }
        cursorY += 1;
        break;
      }

      case "timeline": {
        for (let i = 0; i < block.items.length; i++) {
          const itemH = 3; // title + period + connector
          rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: itemH });
          counter.value++;
          cursorY += itemH;
        }
        cursorY += 1;
        break;
      }

      case "tabs": {
        rects.push({ focusIndex: counter.value, x: offsetX, y: cursorY, width: availWidth, height: 3 });
        counter.value++;
        cursorY += 4;
        break;
      }

      default: {
        const focusable = componentRegistry.isFocusable(block.type);
        const h = estimateBlockHeight(block, availWidth);
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

/** Estimate the rendered height of a block (in terminal rows). */
function estimateBlockHeight(block: ContentBlock, width: number): number {
  switch (block.type) {
    case "card": {
      let h = 3; // top border + title + bottom border
      if (block.subtitle) h++;
      if (block.body) h += Math.ceil(block.body.length / Math.max(1, width - 6)) + 1;
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
    case "image": return 10;
    case "progressBar": return 2;
    case "gallery": return 8;
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
