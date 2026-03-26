/**
 * Responsive fallback logic for panel layouts.
 * When the terminal is too narrow, columns collapse to vertical stacking.
 */

/** Check if the terminal is too narrow for side-by-side panels. */
export function shouldCollapseColumns(panelCount: number, availableWidth: number): boolean {
  const minPanelWidth = 20;
  const totalMinWidth = panelCount * minPanelWidth + (panelCount - 1);
  return availableWidth < totalMinWidth;
}

/** Check if a grid should collapse to fewer columns. */
export function effectiveGridCols(requestedCols: number, availableWidth: number, gap: number): number {
  const minCellWidth = 20;
  let cols = requestedCols;
  while (cols > 1) {
    const cellWidth = Math.floor((availableWidth - gap * (cols - 1)) / cols);
    if (cellWidth >= minCellWidth) break;
    cols--;
  }
  return Math.max(1, cols);
}
