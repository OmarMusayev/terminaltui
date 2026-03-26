/**
 * 12-column grid system — inspired by Bootstrap but for terminals.
 *
 * Provides responsive column sizing with breakpoints:
 *   xs: <60 cols, sm: 60-89, md: 90-119, lg: >=120
 *
 * Usage:
 *   row([
 *     col([card(...)], { span: 4 }),
 *     col([card(...)], { span: 8 }),
 *   ])
 */
import type { ColConfig, RowBlock, ContainerBlock, ContentBlock, PanelConfig } from "../config/types.js";
import { DIVIDER_WIDTH } from "./panel-layout.js";

const GRID_COLUMNS = 12;

/** Responsive breakpoints based on terminal column width. */
export type Breakpoint = "xs" | "sm" | "md" | "lg";

export function getBreakpoint(terminalWidth: number): Breakpoint {
  if (terminalWidth < 60) return "xs";
  if (terminalWidth < 90) return "sm";
  if (terminalWidth < 120) return "md";
  return "lg";
}

/** Get the effective span for a column at a given breakpoint.
 *  Falls back through breakpoints: xs < sm < md < lg < span. */
export function getEffectiveSpan(col: ColConfig, breakpoint: Breakpoint, autoSpan: number): number {
  const bp = breakpoint;
  // Try exact breakpoint, then fall back through larger breakpoints to span
  if (bp === "xs" && col.xs !== undefined) return col.xs;
  if ((bp === "xs" || bp === "sm") && col.sm !== undefined) return col.sm;
  if ((bp === "xs" || bp === "sm" || bp === "md") && col.md !== undefined) return col.md;
  if (col.lg !== undefined && bp === "lg") return col.lg;
  return col.span ?? autoSpan;
}

export interface GridColRect {
  x: number;
  y: number;
  width: number;
  height: number;
  col: ColConfig;
}

/**
 * Layout row columns into positioned rectangles.
 *
 * @param cols         Column configs from the row
 * @param availWidth   Available width for the row
 * @param availHeight  Available height for the row
 * @param gap          Gap between columns (default: 1)
 * @param terminalWidth Terminal width for responsive breakpoints
 */
export function layoutRow(
  cols: ColConfig[],
  availWidth: number,
  availHeight: number,
  gap: number = 1,
  terminalWidth: number = availWidth,
): GridColRect[] {
  if (cols.length === 0) return [];

  const bp = getBreakpoint(terminalWidth);
  const autoSpan = Math.max(1, Math.floor(GRID_COLUMNS / cols.length));

  // Resolve effective spans
  const spans = cols.map(c => getEffectiveSpan(c, bp, autoSpan));
  const offsets = cols.map(c => c.offset ?? 0);

  // Group columns into rows (wrap when total span exceeds 12)
  const rows: { col: ColConfig; span: number; offset: number }[][] = [[]];
  let currentRowSpan = 0;
  for (let i = 0; i < cols.length; i++) {
    const totalSpan = spans[i] + offsets[i];
    if (currentRowSpan + totalSpan > GRID_COLUMNS && rows[rows.length - 1].length > 0) {
      rows.push([]);
      currentRowSpan = 0;
    }
    rows[rows.length - 1].push({ col: cols[i], span: spans[i], offset: offsets[i] });
    currentRowSpan += totalSpan;
  }

  // Compute column widths
  // Unit width = one grid column in terminal chars
  const totalGapCols = rows[0].length > 1 ? (rows[0].length - 1) : 0;
  const unitWidth = Math.max(1, Math.floor((availWidth - totalGapCols * gap) / GRID_COLUMNS));

  const rects: GridColRect[] = [];
  let cursorY = 0;

  for (const rowCols of rows) {
    let cursorX = 0;
    const rowGaps = rowCols.length > 1 ? rowCols.length - 1 : 0;
    const rowUnit = Math.max(1, Math.floor((availWidth - rowGaps * gap) / GRID_COLUMNS));

    for (let i = 0; i < rowCols.length; i++) {
      const { col, span, offset } = rowCols[i];
      // Apply offset
      cursorX += offset * rowUnit;
      if (offset > 0 && i > 0) cursorX += gap; // gap after offset space

      const colWidth = Math.max(1, span * rowUnit);
      const padding = col.padding ?? 0;

      rects.push({
        x: cursorX,
        y: cursorY,
        width: colWidth,
        height: availHeight,
        col,
      });

      cursorX += colWidth;
      if (i < rowCols.length - 1) cursorX += gap;
    }

    cursorY += availHeight;
    if (rows.indexOf(rowCols) < rows.length - 1) cursorY += gap;
  }

  return rects;
}

/**
 * Convert row columns to PanelConfig[] for rendering via existing panel infrastructure.
 * This allows reusing the panel rendering pipeline (mergeRects, renderPanel).
 */
export function rowColsToPanels(
  cols: ColConfig[],
  availWidth: number,
  gap: number = 1,
  terminalWidth: number = availWidth,
): PanelConfig[] {
  if (cols.length === 0) return [];

  const bp = getBreakpoint(terminalWidth);
  const autoSpan = Math.max(1, Math.floor(GRID_COLUMNS / cols.length));
  const spans = cols.map(c => getEffectiveSpan(c, bp, autoSpan));

  // Compute widths using DIVIDER_WIDTH — the actual rendered divider is " │ " (3 chars),
  // regardless of the gap config. This ensures panel widths match the rendering pipeline.
  const totalSpan = spans.reduce((a, b) => a + b, 0);
  const dividerTotal = cols.length > 1 ? (cols.length - 1) * DIVIDER_WIDTH : 0;
  const usable = Math.max(0, availWidth - dividerTotal);

  // Compute base widths and distribute floor() remainder to first columns
  const widths = cols.map((_, i) => Math.max(1, Math.floor((spans[i] / totalSpan) * usable)));
  let remainder = usable - widths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < widths.length && remainder > 0; i++) {
    widths[i]++;
    remainder--;
  }

  return cols.map((col, i) => ({
    content: col.content,
    width: widths[i],
    padding: col.padding,
  }));
}
