import type { RenderContext } from "./base.js";
import { styled, styledBold, styledDim, pad, stripAnsi, truncate, stringWidth } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export interface MenuItem {
  label: string;
  icon?: string;
  id: string;
}

export function renderMenu(items: MenuItem[], selectedIndex: number, ctx: RenderContext): string[] {
  const lines: string[] = [];
  const theme = ctx.theme;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.menu);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isSelected = i === selectedIndex;
    const icon = item.icon ?? "\u25c6";
    const number = `${i + 1}`;
    const numSuffix = ` [${number}]`;

    if (isSelected) {
      // Format: "  ❯ icon label [n]" => prefix "  ❯ icon " = 2+1+1+1+1 = 6 + icon is 1 char + space = ~8
      const prefixLen = 2 + 1 + 1 + 1 + 1 + 1; // "  ❯ icon " = 7 visible chars
      const availForLabel = Math.max(1, dims.content - prefixLen - stringWidth(numSuffix));
      const truncatedLabel = truncate(item.label, availForLabel);
      const cursor = fgColor(theme.accent) + "\u276f" + reset;
      const iconStr = fgColor(theme.accent) + bold + ` ${icon} ` + reset;
      const label = fgColor(theme.accent) + bold + truncatedLabel + reset;
      const num = fgColor(theme.muted) + dim + numSuffix + reset;
      lines.push(`  ${cursor}${iconStr}${label}${num}`);
    } else {
      // Format: "     icon label [n]" => prefix "     icon " = 5 + 1 + 1 = 7 visible chars
      const prefixLen = 5 + 1 + 1; // "     icon " = 7 visible chars
      const availForLabel = Math.max(1, dims.content - prefixLen - stringWidth(numSuffix));
      const truncatedLabel = truncate(item.label, availForLabel);
      const iconStr = fgColor(theme.muted) + `   ${icon} ` + reset;
      const label = fgColor(theme.text) + truncatedLabel + reset;
      const num = fgColor(theme.subtle) + dim + numSuffix + reset;
      lines.push(`  ${iconStr}${label}${num}`);
    }
  }

  return lines;
}
