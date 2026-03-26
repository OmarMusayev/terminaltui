/**
 * Split component — two panels with a fixed divider.
 */
import type { SplitBlock, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { fgColor, reset } from "../../style/colors.js";
import { layoutSplit } from "../../layout/panel-layout.js";
import { shouldCollapseColumns } from "../../layout/responsive.js";
import { renderPanel } from "./Panel.js";
import { mergeRects } from "./Columns.js";

export interface SplitRenderOptions {
  availableHeight: number;
  activePanelIndex?: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render a split layout. Returns string[]. */
export function renderSplit(
  block: SplitBlock,
  ctx: RenderContext,
  opts: SplitRenderOptions,
): string[] {
  const { config } = block;
  const { availableHeight, activePanelIndex = -1, renderContent } = opts;

  // For horizontal splits, check if we need to collapse
  if (config.direction === "horizontal" && shouldCollapseColumns(2, ctx.width)) {
    // Fall back to vertical split
    const rects = layoutSplit(
      { ...config, direction: "vertical" },
      ctx.width,
      availableHeight,
    );
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
      if (i === 0 && config.border !== false) {
        lines.push(fgColor(ctx.theme.border) + "\u2500".repeat(ctx.width) + reset);
      }
    }
    return lines;
  }

  const rects = layoutSplit(config, ctx.width, availableHeight);
  return mergeRects(rects, ctx, ctx.width, availableHeight, activePanelIndex, renderContent);
}
