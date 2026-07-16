/** Screen rectangle for a focusable item, used by spatial navigation. */
export interface FocusRect {
  /** Index in the flat pageFocusItems array. */
  focusIndex: number;
  /** Column position (0-based, relative to content area). */
  x: number;
  /** Row position (0-based, relative to content area start). */
  y: number;
  /** Width in columns. */
  width: number;
  /** Height in rows. */
  height: number;
}
