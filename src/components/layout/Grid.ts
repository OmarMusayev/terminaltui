/**
 * Grid component — renders panels in an N×M grid layout.
 */
import type { GridBlock, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { stringWidth } from "../base.js";
import { fgColor, reset } from "../../style/colors.js";
import { layoutGrid } from "../../layout/panel-layout.js";
import { effectiveGridCols } from "../../layout/responsive.js";
import { renderPanel } from "./Panel.js";

export interface GridRenderOptions {
  availableHeight: number;
  activePanelIndex?: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render a grid layout. Returns string[]. */
export function renderGrid(
  block: GridBlock,
  ctx: RenderContext,
  opts: GridRenderOptions,
): string[] {
  const { config } = block;
  const { availableHeight, activePanelIndex = -1, renderContent } = opts;

  if (config.items.length === 0) return [];

  // Responsive: adjust column count if needed
  const gap = config.gap ?? 1;
  const cols = effectiveGridCols(config.cols, ctx.width, gap);
  const adjustedConfig = { ...config, cols };

  const rects = layoutGrid(adjustedConfig, ctx.width, availableHeight);
  if (rects.length === 0) return [];

  // Render each panel
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

  // Calculate grid dimensions
  const rowCount = adjustedConfig.rows ?? Math.ceil(config.items.length / cols);
  const cellHeight = rects[0]?.height ?? 0;
  const cellWidth = rects[0]?.width ?? 0;

  // Merge into composite lines, row by row
  const lines: string[] = [];
  for (let gridRow = 0; gridRow < rowCount; gridRow++) {
    // Add gap between grid rows
    if (gridRow > 0) {
      for (let g = 0; g < gap; g++) lines.push("");
    }

    for (let lineIdx = 0; lineIdx < cellHeight; lineIdx++) {
      let rowLine = "";
      for (let col = 0; col < cols; col++) {
        const panelIdx = gridRow * cols + col;
        if (col > 0) rowLine += " ".repeat(gap);

        if (panelIdx < panelOutputs.length) {
          const panelLine = panelOutputs[panelIdx][lineIdx] ?? " ".repeat(cellWidth);
          rowLine += panelLine;
        } else {
          // Empty cell
          rowLine += " ".repeat(cellWidth);
        }
      }
      lines.push(rowLine);
    }
  }

  return lines;
}
