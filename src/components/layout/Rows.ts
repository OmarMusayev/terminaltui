/**
 * Rows component — renders panels stacked vertically with fixed/flex heights.
 */
import type { RowsBlock, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { fgColor, reset } from "../../style/colors.js";
import { layoutRows } from "../../layout/panel-layout.js";
import { renderPanel } from "./Panel.js";

export interface RowsRenderOptions {
  availableHeight: number;
  activePanelIndex?: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render a rows layout. Returns string[] of vertically stacked panels. */
export function renderRows(
  block: RowsBlock,
  ctx: RenderContext,
  opts: RowsRenderOptions,
): string[] {
  const { panels } = block;
  if (panels.length === 0) return [];

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
