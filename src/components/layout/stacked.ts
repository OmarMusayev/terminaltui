/**
 * Shared stacked-panel rendering — used by Rows and by the narrow-terminal
 * fallback in Columns, so the two code paths cannot drift.
 */
import type { PanelConfig, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { fgColor, reset } from "../../style/colors.js";
import { layoutRows } from "../../layout/panel-layout.js";
import { renderPanel } from "./Panel.js";

export interface StackedRenderOptions {
  availableHeight: number;
  activePanelIndex?: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render panels stacked vertically with a horizontal divider between rows. */
export function renderStackedPanels(
  panels: PanelConfig[],
  ctx: RenderContext,
  opts: StackedRenderOptions,
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
