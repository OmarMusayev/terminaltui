import type { RenderContext } from "./base.js";
import type { ContentBlock } from "../config/types.js";
import { fgColor, bold, dim, inverse, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderTabs(
  items: { label: string; content: ContentBlock[] }[],
  activeIndex: number,
  ctx: RenderContext,
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[]
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.tabs);

  // Tab bar
  let tabBar = "  ";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isActive = i === activeIndex;

    if (isActive) {
      tabBar += inverse + fgColor(theme.accent) + ` ${item.label} ` + reset + " ";
    } else {
      tabBar += fgColor(theme.muted) + `[${item.label}]` + reset + " ";
    }
  }
  lines.push(tabBar);
  lines.push(fgColor(theme.border) + "  " + "\u2500".repeat(Math.max(0, dims.content)) + reset);

  // Active tab content
  const activeItem = items[activeIndex];
  if (activeItem) {
    const contentLines = renderContent(activeItem.content, { ...ctx, width: dims.content });
    for (const cl of contentLines) {
      lines.push("  " + cl);
    }
  }

  return lines;
}
