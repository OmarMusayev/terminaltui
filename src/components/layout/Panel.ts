/**
 * Panel component — renders a clipped content area with optional title.
 * Panels default to NO border so cards inside retain their own styled boxes.
 * Set border: true explicitly to add a panel border.
 */
import type { PanelConfig, ContentBlock } from "../../config/types.js";
import type { RenderContext } from "../base.js";
import { stringWidth, truncate } from "../base.js";
import { fgColor, reset, bold, dim } from "../../style/colors.js";
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
  // The active panel gets a fresh focus tracker (never the inherited one — a
  // nested panel must scroll in its own line-frame) so overflowing content can
  // scroll to keep the focused block visible instead of hard-clipping it away.
  const focusTrack = active ? { start: -1, end: -1 } : undefined;
  const contentCtx: RenderContext = { ...ctx, width: innerWidth, panelHeight: innerHeight, focusTrack };
  const contentLines = renderContent(config.content, contentCtx);

  // Clip content to inner height, scrolled so the focused block stays visible:
  // bottom-align its end, but never scroll past its start (a block taller than
  // the window anchors to its own top, matching page-level scroll behavior).
  let scrollStart = 0;
  if (contentLines.length > innerHeight && focusTrack && focusTrack.start >= 0) {
    // One line of headroom below the focused block when content continues
    // past it, so the ↓ marker gets a slot instead of colliding with the
    // block's last line and being suppressed.
    const headroom = focusTrack.end < contentLines.length ? 1 : 0;
    scrollStart = Math.min(Math.max(0, focusTrack.end + headroom - innerHeight), focusTrack.start);
    scrollStart = Math.min(scrollStart, contentLines.length - innerHeight);
  }
  const clipped = contentLines.slice(scrollStart, scrollStart + innerHeight);

  // Overflow markers — shown when clipped content exists above/below, unless
  // the marker line would overwrite part of the focused block itself.
  const marker = (text: string) =>
    fgColor(ctx.theme.subtle) + dim + truncate(text, innerWidth) + reset;
  const inFocusRange = (line: number) =>
    !!focusTrack && focusTrack.start >= 0 && line >= focusTrack.start && line < focusTrack.end;
  if (scrollStart > 0 && clipped.length > 0 && !inFocusRange(scrollStart)) {
    clipped[0] = marker("  ↑ more");
  }
  const lastVisible = scrollStart + clipped.length - 1;
  if (scrollStart + innerHeight < contentLines.length && clipped.length > 0 && !inFocusRange(lastVisible)) {
    clipped[clipped.length - 1] = marker("  ↓ more");
  }

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
