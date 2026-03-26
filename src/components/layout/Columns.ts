/**
 * Columns component — renders panels side-by-side.
 * Falls back to vertical stacking if terminal is too narrow.
 */
import type { ColumnsBlock, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { stringWidth, truncate } from "../base.js";
import { fgColor, reset } from "../../style/colors.js";
import { layoutColumns, layoutRows, type PanelRect } from "../../layout/panel-layout.js";
import { shouldCollapseColumns } from "../../layout/responsive.js";
import { renderPanel } from "./Panel.js";

export interface ColumnsRenderOptions {
  availableHeight: number;
  activePanelIndex?: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render a columns layout. Returns string[] of merged lines. */
export function renderColumns(
  block: ColumnsBlock,
  ctx: RenderContext,
  opts: ColumnsRenderOptions,
): string[] {
  const { panels } = block;
  if (panels.length === 0) return [];

  const { availableHeight, activePanelIndex = -1, renderContent } = opts;
  const width = ctx.width;

  // Responsive: collapse to rows if too narrow
  if (shouldCollapseColumns(panels.length, width)) {
    return renderAsRows(panels, ctx, opts);
  }

  const rects = layoutColumns(panels, width, availableHeight);
  return mergeRects(rects, ctx, width, availableHeight, activePanelIndex, renderContent);
}

/** Fallback: render as stacked rows when terminal is too narrow. */
function renderAsRows(
  panels: ColumnsBlock["panels"],
  ctx: RenderContext,
  opts: ColumnsRenderOptions,
): string[] {
  const { availableHeight, activePanelIndex = -1, renderContent } = opts;
  const rects = layoutRows(panels, ctx.width, availableHeight);
  const lines: string[] = [];

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const panelLines = renderPanel(rect.panel, ctx, {
      width: rect.width,
      height: rect.height,
      active: i === activePanelIndex,
      renderContent,
    });
    lines.push(...panelLines);
    // Add divider between rows
    if (i < rects.length - 1) {
      lines.push(fgColor(ctx.theme.border) + "\u2500".repeat(ctx.width) + reset);
    }
  }
  return lines;
}

/** Merge panel rects into composite lines by placing them side-by-side. */
export function mergeRects(
  rects: PanelRect[],
  ctx: RenderContext,
  totalWidth: number,
  totalHeight: number,
  activePanelIndex: number,
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[],
): string[] {
  // Render each panel independently
  const panelOutputs: string[][] = [];
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const panelCtx: RenderContext = { ...ctx, width: rect.width };
    const panelLines = renderPanel(rect.panel, panelCtx, {
      width: rect.width,
      height: rect.height,
      active: i === activePanelIndex,
      renderContent,
    });
    panelOutputs.push(panelLines);
  }

  // Check if this is a horizontal layout (columns/horizontal split)
  const isHorizontal = rects.length > 1 && rects[0].y === rects[1].y;

  if (isHorizontal) {
    // Merge horizontally: combine lines from each panel at the same row
    const maxLines = Math.max(...panelOutputs.map(p => p.length));
    const lines: string[] = [];

    for (let row = 0; row < maxLines; row++) {
      let line = "";
      for (let i = 0; i < rects.length; i++) {
        const panelLine = panelOutputs[i][row] ?? " ".repeat(rects[i].width);

        // Add divider between panels (with 1-char padding on each side)
        if (i > 0) {
          const dividerChar = " " + fgColor(ctx.theme.border) + "\u2502" + reset + " ";
          line += dividerChar;
        }

        line += panelLine;
      }
      lines.push(line);
    }
    return lines;
  } else {
    // Vertical: just stack with dividers
    const lines: string[] = [];
    for (let i = 0; i < panelOutputs.length; i++) {
      lines.push(...panelOutputs[i]);
      if (i < panelOutputs.length - 1) {
        lines.push(fgColor(ctx.theme.border) + "\u2500".repeat(totalWidth) + reset);
      }
    }
    return lines;
  }
}
