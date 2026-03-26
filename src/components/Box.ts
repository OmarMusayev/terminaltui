import type { RenderContext } from "./base.js";
import { styled, pad, stringWidth } from "./base.js";
import { getBorderChars, type BorderStyle } from "../style/borders.js";
import { fgColor, reset } from "../style/colors.js";
import { computeBoxDimensions } from "../layout/box-model.js";

export interface BoxConfig {
  width?: number;
  height?: number;
  padding?: number;
  border?: BorderStyle;
  title?: string;
  titleRight?: string;
  content: string[];
  borderColor?: string;
  midSeparatorAfter?: number; // insert ├──┤ separator after this content line index
}

export function renderBox(config: BoxConfig, ctx: RenderContext): string[] {
  const border = config.border ?? (ctx.borderStyle as BorderStyle) ?? "rounded";
  const chars = getBorderChars(border);
  const boxWidth = config.width ?? ctx.width;
  const requestedPadding = config.padding ?? 1;
  // Clamp padding so border + padding doesn't exceed allocated width
  const maxPadding = Math.max(0, Math.floor((boxWidth - 2) / 2));
  const padding = Math.min(requestedPadding, maxPadding);
  const dims = computeBoxDimensions(boxWidth, { border: true, padding });
  const innerWidth = dims.content;
  const borderColor = config.borderColor ?? ctx.theme.border;
  const lines: string[] = [];

  // Top border
  const topInner = Math.max(0, dims.allocated - dims.border * 2);
  if (config.title) {
    const titleStr = ` ${config.title} `;
    let rightStr = "";
    if (config.titleRight) {
      rightStr = ` ${config.titleRight} `;
    }
    const fillLen = Math.max(0, topInner - stringWidth(titleStr) - stringWidth(rightStr) - 1);
    lines.push(
      fgColor(borderColor) + chars.topLeft + chars.horizontal +
      reset + fgColor(ctx.theme.accent) + titleStr + reset +
      fgColor(borderColor) + chars.horizontal.repeat(fillLen) +
      (rightStr ? reset + fgColor(ctx.theme.muted) + rightStr + reset + fgColor(borderColor) : "") +
      chars.topRight + reset
    );
  } else {
    lines.push(fgColor(borderColor) + chars.topLeft + chars.horizontal.repeat(topInner) + chars.topRight + reset);
  }

  // Content lines with padding
  const paddedContent: string[] = [];
  for (const line of config.content) {
    paddedContent.push(line);
  }

  // Determine height
  const contentHeight = config.height
    ? Math.max(0, config.height - 2)
    : paddedContent.length + (padding > 0 ? 0 : 0);

  const totalContentLines = Math.max(contentHeight, paddedContent.length);

  for (let i = 0; i < totalContentLines; i++) {
    const content = paddedContent[i] ?? "";
    const paddingStr = " ".repeat(padding);
    lines.push(
      fgColor(borderColor) + chars.vertical + reset +
      paddingStr + pad(content, innerWidth) + paddingStr +
      fgColor(borderColor) + chars.vertical + reset
    );
    // Insert mid-separator after specified line
    if (config.midSeparatorAfter !== undefined && i === config.midSeparatorAfter) {
      lines.push(
        fgColor(borderColor) + chars.teeRight + chars.horizontal.repeat(topInner) + chars.teeLeft + reset
      );
    }
  }

  // Bottom border
  lines.push(fgColor(borderColor) + chars.bottomLeft + chars.horizontal.repeat(topInner) + chars.bottomRight + reset);

  return lines;
}
