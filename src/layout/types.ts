export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Alignment = "left" | "center" | "right";
export type Direction = "vertical" | "horizontal";

export interface LayoutConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  flex?: number;
}

export function parsePadding(value: number | Partial<Padding> | undefined): Padding {
  if (value === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  return { top: value.top ?? 0, right: value.right ?? 0, bottom: value.bottom ?? 0, left: value.left ?? 0 };
}

export function parseMargin(value: number | Partial<Margin> | undefined): Margin {
  return parsePadding(value) as Margin;
}

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
