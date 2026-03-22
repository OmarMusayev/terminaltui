import type { RenderContext } from "./base.js";
import type { ContentBlock } from "../config/types.js";
import { truncate } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

export function renderAccordion(
  items: { label: string; content: ContentBlock[] }[],
  openIndex: number,
  ctx: RenderContext,
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[]
): string[] {
  const theme = ctx.theme;
  const isFocused = ctx.focused ?? false;
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isOpen = i === openIndex;
    const arrow = isOpen ? "\u25be" : "\u25b8";
    // When the accordion is focused, highlight the open item (or first if none open)
    const isActiveItem = isFocused && (isOpen || (openIndex < 0 && i === 0));

    const maxLabelWidth = Math.max(0, ctx.width - 6);
    const truncatedLabel = truncate(item.label, maxLabelWidth);

    const labelColor = isOpen ? theme.accent : (isActiveItem ? theme.accent : theme.text);
    const cursor = isActiveItem ? "\u276f " : "  ";
    lines.push(
      fgColor(labelColor) + bold +
      `${cursor}${arrow} ${truncatedLabel}` + reset
    );

    if (isOpen) {
      const contentLines = renderContent(item.content, { ...ctx, width: ctx.width - 4, focused: false });
      for (const cl of contentLines) {
        lines.push("    " + cl);
      }
      lines.push("");
    }
  }

  return lines;
}
