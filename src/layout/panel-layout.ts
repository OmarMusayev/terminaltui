/**
 * Layout calculations for panel-based layouts: columns, rows, grid, split.
 * Each function takes panel configs and available dimensions, returning
 * positioned rectangles for each panel.
 */
import type { PanelConfig, SplitConfig, GridConfig } from "../config/types.js";

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  panel: PanelConfig;
}

/** Parse a size value (percentage string, "auto", or fixed number). */
function parseSize(value: string | number | undefined, available: number): number | "auto" {
  if (value === undefined || value === "auto") return "auto";
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) {
    const pct = parseFloat(value);
    if (!isNaN(pct)) return Math.floor((pct / 100) * available);
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? "auto" : num;
}

/** Distribute available space among panels with fixed/auto sizes. */
function distribute(sizes: (number | "auto")[], available: number, dividers: number): number[] {
  const usable = Math.max(0, available - dividers);

  let fixedTotal = 0;
  let autoCount = 0;
  for (const s of sizes) {
    if (s === "auto") autoCount++;
    else fixedTotal += s;
  }

  // If fixed sizes exceed usable space, scale them down proportionally
  if (fixedTotal > usable && fixedTotal > 0 && autoCount === 0) {
    const scale = usable / fixedTotal;
    return sizes.map(s => Math.max(0, s === "auto" ? 0 : Math.floor((s as number) * scale)));
  }

  const remaining = Math.max(0, usable - fixedTotal);
  const autoSize = autoCount > 0 ? Math.floor(remaining / autoCount) : 0;

  return sizes.map(s => Math.max(0, s === "auto" ? autoSize : s));
}

const MIN_PANEL_WIDTH = 10;
const MIN_PANEL_HEIGHT = 3;

/** Width of the divider between horizontal panels (padding + border + padding). */
export const DIVIDER_WIDTH = 3; // " │ "

/** Layout panels side-by-side as columns. */
export function layoutColumns(
  panels: PanelConfig[],
  availableWidth: number,
  availableHeight: number,
): PanelRect[] {
  if (panels.length === 0) return [];
  if (panels.length === 1) {
    return [{ x: 0, y: 0, width: availableWidth, height: availableHeight, panel: panels[0] }];
  }

  const dividerCount = panels.length - 1;
  const totalDividerWidth = dividerCount * DIVIDER_WIDTH;
  // Compute percentages against usable width (after dividers) to prevent overflow
  const usableWidth = Math.max(0, availableWidth - totalDividerWidth);
  const rawSizes = panels.map(p => parseSize(p.width, usableWidth));
  const widths = distribute(rawSizes, availableWidth, totalDividerWidth);

  const rects: PanelRect[] = [];
  let x = 0;
  for (let i = 0; i < panels.length; i++) {
    rects.push({ x, y: 0, width: widths[i], height: availableHeight, panel: panels[i] });
    x += widths[i];
    if (i < panels.length - 1) x += DIVIDER_WIDTH; // divider with padding
  }
  return rects;
}

/** Layout panels stacked vertically as rows. */
export function layoutRows(
  panels: PanelConfig[],
  availableWidth: number,
  availableHeight: number,
): PanelRect[] {
  if (panels.length === 0) return [];
  if (panels.length === 1) {
    return [{ x: 0, y: 0, width: availableWidth, height: availableHeight, panel: panels[0] }];
  }

  const dividerCount = panels.length - 1;
  const rawSizes = panels.map(p => parseSize(p.height, availableHeight));
  const heights = distribute(rawSizes, availableHeight, dividerCount);

  const rects: PanelRect[] = [];
  let y = 0;
  for (let i = 0; i < panels.length; i++) {
    rects.push({ x: 0, y, width: availableWidth, height: heights[i], panel: panels[i] });
    y += heights[i];
    if (i < panels.length - 1) y += 1; // divider
  }
  return rects;
}

/** Layout two panels with a split divider. */
export function layoutSplit(
  config: SplitConfig,
  availableWidth: number,
  availableHeight: number,
): PanelRect[] {
  const ratio = config.ratio ?? 50;
  const hasDivider = config.border !== false;
  const dividerSize = hasDivider ? DIVIDER_WIDTH : 0;

  if (config.direction === "horizontal") {
    // left | right
    const firstWidth = Math.floor(((availableWidth - dividerSize) * ratio) / 100);
    const secondWidth = availableWidth - firstWidth - dividerSize;
    return [
      { x: 0, y: 0, width: firstWidth, height: availableHeight, panel: { content: config.first } },
      { x: firstWidth + dividerSize, y: 0, width: secondWidth, height: availableHeight, panel: { content: config.second } },
    ];
  } else {
    // top / bottom
    const firstHeight = Math.floor(((availableHeight - dividerSize) * ratio) / 100);
    const secondHeight = availableHeight - firstHeight - dividerSize;
    return [
      { x: 0, y: 0, width: availableWidth, height: firstHeight, panel: { content: config.first } },
      { x: 0, y: firstHeight + dividerSize, width: availableWidth, height: secondHeight, panel: { content: config.second } },
    ];
  }
}

/** Layout panels in an N×M grid. */
export function layoutGrid(
  config: GridConfig,
  availableWidth: number,
  availableHeight: number,
): PanelRect[] {
  const { cols, items, gap = 1 } = config;
  if (items.length === 0 || cols <= 0) return [];

  const rowCount = config.rows ?? Math.ceil(items.length / cols);
  const cellWidth = Math.max(MIN_PANEL_WIDTH, Math.floor((availableWidth - gap * (cols - 1)) / cols));
  const cellHeight = Math.max(MIN_PANEL_HEIGHT, Math.floor((availableHeight - gap * (rowCount - 1)) / rowCount));

  const rects: PanelRect[] = [];
  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row >= rowCount) break;
    rects.push({
      x: col * (cellWidth + gap),
      y: row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      panel: items[i],
    });
  }
  return rects;
}

/** Check if columns should fall back to vertical stacking. */
export function shouldStack(panelCount: number, availableWidth: number): boolean {
  const minPanelWidth = 20;
  const totalMinWidth = panelCount * minPanelWidth + (panelCount - 1);
  return availableWidth < totalMinWidth;
}
