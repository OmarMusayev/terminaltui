/**
 * Box-drawing character helpers for framing content with Unicode borders.
 */

import { getBorderChars, type BorderStyle } from "../style/borders.js";

export function frame(content: string[], style: BorderStyle = "rounded", title?: string): string[] {
  const maxWidth = Math.max(0, ...content.map(l => l.length));
  const chars = getBorderChars(style);
  const result: string[] = [];

  // Top border
  if (title) {
    const titleStr = ` ${title} `;
    const remaining = Math.max(0, maxWidth - titleStr.length - 1);
    result.push(chars.topLeft + chars.horizontal + titleStr + chars.horizontal.repeat(remaining) + chars.topRight);
  } else {
    result.push(chars.topLeft + chars.horizontal.repeat(maxWidth) + chars.topRight);
  }

  // Content lines
  for (const line of content) {
    const padded = line + " ".repeat(Math.max(0, maxWidth - line.length));
    result.push(chars.vertical + padded + chars.vertical);
  }

  // Bottom border
  result.push(chars.bottomLeft + chars.horizontal.repeat(maxWidth) + chars.bottomRight);

  return result;
}

export function horizontalRule(width: number, style: BorderStyle = "single"): string {
  const chars = getBorderChars(style);
  return chars.horizontal.repeat(width);
}

export function labeledRule(width: number, label: string, style: BorderStyle = "single"): string {
  const chars = getBorderChars(style);
  const labelStr = ` ${label} `;
  const remaining = Math.max(0, width - labelStr.length - 4);
  const left = Math.floor(remaining / 2);
  const right = remaining - left;
  return chars.horizontal.repeat(left + 2) + labelStr + chars.horizontal.repeat(right + 2);
}
