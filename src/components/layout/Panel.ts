/**
 * Panel component — renders a clipped content area with optional title.
 * Panels default to NO border so cards inside retain their own styled boxes.
 * Set border: true explicitly to add a panel border.
 */
import type { PanelConfig, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { stringWidth, truncate } from "../base.js";
import { fgColor, reset, bold } from "../../style/colors.js";
import { getBorderChars, type BorderStyle } from "../../style/borders.js";
import { computeBoxDimensions } from "../../layout/box-model.js";

export interface PanelRenderOptions {
  active?: boolean;
  width: number;
  height: number;
  renderContent: (blocks: ContentBlock[], ctx: RenderContext) => string[];
}

/** Render a panel with optional border, title, and clipped content. */
export function renderPanel(
  config: PanelConfig,
  ctx: RenderContext,
  opts: PanelRenderOptions,
): string[] {
  const { width, height, active = false, renderContent } = opts;
  if (width <= 0 || height <= 0) return [];

  // Panels only get a border when explicitly requested via border: true or a style string
  const hasBorder = config.border === true || (typeof config.border === "string" && config.border !== "none");
  const borderStyle: BorderStyle = typeof config.border === "string"
    ? (["single", "double", "rounded", "heavy", "dashed", "ascii", "none"].includes(config.border)
      ? config.border as BorderStyle : "rounded")
    : "rounded";
  const chars = getBorderChars(hasBorder ? borderStyle : "none");
  const padding = config.padding ?? 0;

  // Title takes 1 line when present and no border
  const hasTitle = !!config.title && !hasBorder;
  const titleLines = hasTitle ? 1 : 0;

  const widthDims = computeBoxDimensions(width, { border: hasBorder, padding });
  const innerWidth = widthDims.content;
  const heightChrome = widthDims.border * 2 + widthDims.padding * 2 + titleLines;
  const innerHeight = Math.max(0, height - heightChrome);

  if (innerWidth <= 0 || innerHeight <= 0) {
    const lines: string[] = [];
    for (let i = 0; i < height; i++) lines.push(" ".repeat(width));
    return lines;
  }

  // Render content — cards keep their own borders; pass panelHeight so cards fill uniformly
  const contentCtx: RenderContext = { ...ctx, width: innerWidth, panelHeight: innerHeight };
  const contentLines = renderContent(config.content, contentCtx);

  // Clip content to inner height
  const clipped = contentLines.slice(0, innerHeight);

  // Pad content lines to fill inner dimensions
  const padded: string[] = [];
  const padStr = " ".repeat(padding);
  for (let i = 0; i < innerHeight; i++) {
    const line = i < clipped.length ? clipped[i] : "";
    const visWidth = stringWidth(line);
    const fill = Math.max(0, innerWidth - visWidth);
    padded.push(padStr + line + " ".repeat(fill) + padStr);
  }

  const borderColor = active ? ctx.theme.accent : ctx.theme.border;
  const titleColor = active ? ctx.theme.accent : ctx.theme.muted;
  const bc = (s: string) => fgColor(borderColor) + s + reset;

  const lines: string[] = [];

  if (hasBorder) {
    // Bordered panel (only when explicitly requested)
    const innerW = width - 2;
    if (config.title) {
      const titleText = ` ${config.title} `;
      const titleLen = stringWidth(titleText);
      const remaining = Math.max(0, innerW - titleLen - 1);
      lines.push(
        bc(chars.topLeft + chars.horizontal) +
        fgColor(titleColor) + bold + titleText + reset +
        bc(chars.horizontal.repeat(remaining) + chars.topRight)
      );
    } else {
      lines.push(bc(chars.topLeft + chars.horizontal.repeat(innerW) + chars.topRight));
    }
    for (const line of padded) {
      lines.push(bc(chars.vertical) + line + bc(chars.vertical));
    }
    lines.push(bc(chars.bottomLeft + chars.horizontal.repeat(innerW) + chars.bottomRight));
  } else {
    // No border — render title as a dim label, then content
    if (hasTitle) {
      const titleText = config.title!;
      const titleLen = stringWidth(titleText);
      const underline = "─".repeat(Math.min(titleLen + 2, innerWidth));
      lines.push(
        fgColor(titleColor) + bold + titleText + reset +
        " ".repeat(Math.max(0, width - titleLen))
      );
    }
    for (const line of padded) {
      lines.push(line);
    }
  }

  // Ensure we have exactly `height` lines
  while (lines.length < height) lines.push(" ".repeat(width));
  if (lines.length > height) lines.length = height;

  // Clip each line to width
  return lines.map(line => {
    const w = stringWidth(line);
    if (w > width) return truncate(line, width);
    if (w < width) return line + " ".repeat(width - w);
    return line;
  });
}
