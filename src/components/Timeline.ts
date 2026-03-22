import type { RenderContext } from "./base.js";
import type { TimelineItem } from "../config/types.js";
import { styled, wrapText, pad, truncate } from "./base.js";
import { getBorderChars } from "../style/borders.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

export function renderTimeline(items: TimelineItem[], ctx: RenderContext, style?: "connected" | "separated"): string[] {
  const lines: string[] = [];
  const theme = ctx.theme;
  const width = ctx.width;
  const innerWidth = Math.max(0, width - 6);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isFirst = i === 0;
    const isLast = i === items.length - 1;

    // Connector
    const dot = isFirst ? "\u25cf" : "\u25cb";
    const connector = fgColor(theme.accent) + "  " + dot + " " + reset;

    // Title + subtitle
    const maxContentWidth = Math.max(0, width - 6);
    let titleLine: string;
    if (item.subtitle) {
      const combined = item.title + " \u00b7 " + item.subtitle;
      if (combined.length > maxContentWidth) {
        // Try truncating subtitle first
        const availableForSubtitle = maxContentWidth - item.title.length - 3; // 3 for " · "
        if (availableForSubtitle > 0) {
          titleLine = connector + fgColor(theme.accent) + bold + item.title + reset +
            fgColor(theme.muted) + " \u00b7 " + truncate(item.subtitle, availableForSubtitle) + reset;
        } else {
          // Title alone exceeds width, truncate it and drop subtitle
          titleLine = connector + fgColor(theme.accent) + bold + truncate(item.title, maxContentWidth) + reset;
        }
      } else {
        titleLine = connector + fgColor(theme.accent) + bold + item.title + reset +
          fgColor(theme.muted) + " \u00b7 " + item.subtitle + reset;
      }
    } else {
      titleLine = connector + fgColor(theme.accent) + bold + truncate(item.title, maxContentWidth) + reset;
    }
    lines.push(titleLine);

    // Period
    if (item.period) {
      lines.push(fgColor(theme.border) + "  \u2502 " + reset + fgColor(theme.muted) + dim + item.period + reset);
    }

    // Description
    if (item.description) {
      const wrapped = wrapText(item.description, innerWidth);
      for (const wl of wrapped) {
        lines.push(fgColor(theme.border) + "  \u2502 " + reset + fgColor(theme.text) + wl + reset);
      }
    }

    // Connector line between items
    if (!isLast) {
      lines.push(fgColor(theme.border) + "  \u2502" + reset);
    }
  }

  return lines;
}
