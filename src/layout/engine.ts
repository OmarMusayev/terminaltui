import { Rect, Direction, Alignment, Padding, Margin, LayoutConstraints, parsePadding, parseMargin } from "./types.js";

export interface LayoutNode {
  id: string;
  width?: number | "auto" | "fill";
  height?: number | "auto";
  padding?: number | Partial<Padding>;
  margin?: number | Partial<Margin>;
  direction?: Direction;
  align?: Alignment;
  constraints?: LayoutConstraints;
  children?: LayoutNode[];
}

export interface LayoutResult {
  id: string;
  rect: Rect;
  children: LayoutResult[];
}

export function computeLayout(node: LayoutNode, available: Rect): LayoutResult {
  const padding = parsePadding(node.padding);
  const margin = parseMargin(node.margin);

  const outerX = available.x + margin.left;
  const outerY = available.y + margin.top;
  let outerWidth = node.width === "fill" || node.width === undefined
    ? available.width - margin.left - margin.right
    : node.width === "auto"
      ? available.width - margin.left - margin.right
      : Math.min(node.width, available.width - margin.left - margin.right);

  outerWidth = Math.max(0, outerWidth);

  if (node.constraints?.minWidth) outerWidth = Math.max(outerWidth, node.constraints.minWidth);
  if (node.constraints?.maxWidth) outerWidth = Math.min(outerWidth, node.constraints.maxWidth);

  const innerX = outerX + padding.left;
  const innerY = outerY + padding.top;
  const innerWidth = Math.max(0, outerWidth - padding.left - padding.right);

  const childResults: LayoutResult[] = [];
  const direction = node.direction ?? "vertical";

  if (node.children && node.children.length > 0) {
    if (direction === "vertical") {
      let cursorY = innerY;
      for (const child of node.children) {
        const childAvailable: Rect = {
          x: innerX,
          y: cursorY,
          width: innerWidth,
          height: available.height - (cursorY - available.y),
        };
        const childResult = computeLayout(child, childAvailable);

        // Handle alignment
        if (node.align === "center") {
          const offset = Math.floor((innerWidth - childResult.rect.width) / 2);
          offsetResult(childResult, offset, 0);
        } else if (node.align === "right") {
          const offset = innerWidth - childResult.rect.width;
          offsetResult(childResult, offset, 0);
        }

        childResults.push(childResult);
        cursorY = childResult.rect.y + childResult.rect.height;
      }
    } else {
      // Horizontal layout
      let cursorX = innerX;
      const flexChildren = node.children.filter(c => c.constraints?.flex);
      const fixedChildren = node.children.filter(c => !c.constraints?.flex);

      let usedWidth = 0;
      const fixedResults: Map<string, LayoutResult> = new Map();

      for (const child of fixedChildren) {
        const childWidth = typeof child.width === "number" ? child.width : 0;
        usedWidth += childWidth + (parseMargin(child.margin).left + parseMargin(child.margin).right);
      }

      const remainingWidth = Math.max(0, innerWidth - usedWidth);
      const totalFlex = flexChildren.reduce((sum, c) => sum + (c.constraints?.flex ?? 1), 0);

      for (const child of node.children) {
        const flex = child.constraints?.flex;
        const childWidth = flex
          ? Math.floor((flex / totalFlex) * remainingWidth)
          : undefined;

        const childAvailable: Rect = {
          x: cursorX,
          y: innerY,
          width: childWidth ?? (typeof child.width === "number" ? child.width : innerWidth),
          height: available.height - padding.top - padding.bottom,
        };

        const childResult = computeLayout(
          childWidth ? { ...child, width: childWidth } : child,
          childAvailable
        );
        childResults.push(childResult);
        cursorX = childResult.rect.x + childResult.rect.width;
      }
    }
  }

  // Calculate height
  let outerHeight: number;
  if (typeof node.height === "number") {
    outerHeight = node.height;
  } else if (childResults.length > 0) {
    const lastChild = childResults[childResults.length - 1];
    outerHeight = (lastChild.rect.y + lastChild.rect.height) - outerY + padding.bottom;
  } else {
    outerHeight = padding.top + padding.bottom;
  }

  if (node.constraints?.minHeight) outerHeight = Math.max(outerHeight, node.constraints.minHeight);
  if (node.constraints?.maxHeight) outerHeight = Math.min(outerHeight, node.constraints.maxHeight);

  return {
    id: node.id,
    rect: { x: outerX, y: outerY, width: outerWidth, height: outerHeight },
    children: childResults,
  };
}

function offsetResult(result: LayoutResult, dx: number, dy: number): void {
  result.rect.x += dx;
  result.rect.y += dy;
  for (const child of result.children) {
    offsetResult(child, dx, dy);
  }
}
