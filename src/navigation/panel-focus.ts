/**
 * PanelFocusManager — manages focus across multiple layout panels.
 *
 * 2D navigation model:
 *   Left/Right — move between panels in the same row (or between split/column panels)
 *   Up/Down    — move to the panel above/below in a grid, or scroll within a panel
 *   Tab        — cycle through all panels sequentially
 *   Enter      — activate the focused item
 *   Escape     — go back
 */
import type { ContentBlock, PanelConfig } from "../config/types.js";

export interface PanelInfo {
  /** The panel configuration. */
  panel: PanelConfig;
  /** Index of this panel in the parent layout. */
  index: number;
  /** Number of focusable items within this panel. */
  focusableCount: number;
  /** Global focus item start index (in the flat pageFocusItems array). */
  focusStart: number;
  /** Grid column count for this panel's parent layout (0 = not a grid). */
  gridCols: number;
  /** Index of the first panel in this panel's layout group. */
  groupStart: number;
  /** Total number of panels in this panel's layout group. */
  groupSize: number;
}

export class PanelFocusManager {
  private panels: PanelInfo[] = [];
  private _activePanelIndex: number = 0;

  get activePanelIndex(): number {
    return this._activePanelIndex;
  }

  set activePanelIndex(idx: number) {
    if (idx >= -1 && idx < this.panels.length) {
      this._activePanelIndex = idx;
    }
  }

  get panelCount(): number {
    return this.panels.length;
  }

  setPanels(panels: PanelInfo[]): void {
    this.panels = panels;
    if (this._activePanelIndex >= this.panels.length) {
      this._activePanelIndex = Math.max(0, this.panels.length - 1);
    }
  }

  getActivePanel(): PanelInfo | undefined {
    return this.panels[this._activePanelIndex];
  }

  /** Get the global focus range for the active panel. */
  getActiveFocusRange(): { start: number; end: number } | undefined {
    const panel = this.getActivePanel();
    if (!panel) return undefined;
    return { start: panel.focusStart, end: panel.focusStart + panel.focusableCount };
  }

  /** Move to next panel (sequential). Returns new active index. */
  nextPanel(): number {
    if (this.panels.length <= 1) return this._activePanelIndex;
    this._activePanelIndex = (this._activePanelIndex + 1) % this.panels.length;
    return this._activePanelIndex;
  }

  /** Move to previous panel (sequential). Returns new active index. */
  prevPanel(): number {
    if (this.panels.length <= 1) return this._activePanelIndex;
    this._activePanelIndex = (this._activePanelIndex - 1 + this.panels.length) % this.panels.length;
    return this._activePanelIndex;
  }

  /** Move right: next panel in the same row (grid), or next panel (columns/split). */
  moveRight(): boolean {
    const p = this.getActivePanel();
    if (!p) return false;
    const localIdx = this._activePanelIndex - p.groupStart;
    if (p.gridCols > 0) {
      // Grid: move to next column in same row
      const col = localIdx % p.gridCols;
      if (col < p.gridCols - 1 && localIdx + 1 < p.groupSize) {
        this._activePanelIndex = p.groupStart + localIdx + 1;
        return true;
      }
      return false; // at right edge
    }
    // Columns/split: next panel in group
    if (localIdx + 1 < p.groupSize) {
      this._activePanelIndex = p.groupStart + localIdx + 1;
      return true;
    }
    return false;
  }

  /** Move left: previous panel in the same row (grid), or previous panel (columns/split). */
  moveLeft(): boolean {
    const p = this.getActivePanel();
    if (!p) return false;
    const localIdx = this._activePanelIndex - p.groupStart;
    if (p.gridCols > 0) {
      // Grid: move to previous column in same row
      const col = localIdx % p.gridCols;
      if (col > 0) {
        this._activePanelIndex = p.groupStart + localIdx - 1;
        return true;
      }
      return false; // at left edge
    }
    // Columns/split: previous panel in group
    if (localIdx > 0) {
      this._activePanelIndex = p.groupStart + localIdx - 1;
      return true;
    }
    return false;
  }

  /** Move down: next row same column (grid), or no-op for columns/split. Returns true if moved. */
  moveDown(): boolean {
    const p = this.getActivePanel();
    if (!p || p.gridCols <= 0) return false;
    const localIdx = this._activePanelIndex - p.groupStart;
    const nextIdx = localIdx + p.gridCols;
    if (nextIdx < p.groupSize) {
      this._activePanelIndex = p.groupStart + nextIdx;
      return true;
    }
    return false; // at bottom row
  }

  /** Move up: previous row same column (grid), or no-op for columns/split. Returns true if moved. */
  moveUp(): boolean {
    const p = this.getActivePanel();
    if (!p || p.gridCols <= 0) return false;
    const localIdx = this._activePanelIndex - p.groupStart;
    const prevIdx = localIdx - p.gridCols;
    if (prevIdx >= 0) {
      this._activePanelIndex = p.groupStart + prevIdx;
      return true;
    }
    return false; // at top row
  }

  /** Check if a given global focus index is within the active panel. */
  isInActivePanel(globalFocusIndex: number): boolean {
    const range = this.getActiveFocusRange();
    if (!range) return false;
    return globalFocusIndex >= range.start && globalFocusIndex < range.end;
  }

  /** Get the first focusable index in the active panel. */
  getFirstFocusInActivePanel(): number {
    const panel = this.getActivePanel();
    return panel ? panel.focusStart : 0;
  }

  /** Find which panel contains a given global focus index and activate it.
   *  If focus is outside all panels, sets active to -1 (no panel active). */
  syncToFocusIndex(globalFocusIndex: number): void {
    for (let i = 0; i < this.panels.length; i++) {
      const p = this.panels[i];
      if (globalFocusIndex >= p.focusStart && globalFocusIndex < p.focusStart + p.focusableCount) {
        this._activePanelIndex = i;
        return;
      }
    }
    // Focus is outside all panels (e.g., on a search bar above the grid)
    this._activePanelIndex = -1;
  }

  /** Reset to first panel. */
  reset(): void {
    this._activePanelIndex = 0;
  }
}
