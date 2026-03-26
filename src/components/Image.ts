import type { RenderContext } from "./base.js";
import { fgColor, reset } from "../style/colors.js";
import { stringWidth } from "./base.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

// ASCII art rendering of images is a complex topic.
// This provides a basic placeholder that renders a bordered frame
// indicating an image would be displayed.
export function renderImage(path: string, ctx: RenderContext, options?: { width?: number; mode?: string }): string[] {
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.image);
  const width = Math.min(options?.width ?? Math.min(40, dims.content), dims.content);
  const height = Math.floor(width / 3);
  const theme = ctx.theme;
  const lines: string[] = [];

  lines.push(fgColor(theme.border) + "\u250c" + "\u2500".repeat(width) + "\u2510" + reset);
  for (let i = 0; i < height; i++) {
    if (i === Math.floor(height / 2)) {
      const label = `[Image: ${path}]`;
      const padAmount = Math.max(0, width - stringWidth(label));
      const left = Math.floor(padAmount / 2);
      const right = padAmount - left;
      lines.push(
        fgColor(theme.border) + "\u2502" + reset +
        " ".repeat(left) + fgColor(theme.muted) + label + reset + " ".repeat(right) +
        fgColor(theme.border) + "\u2502" + reset
      );
    } else {
      lines.push(fgColor(theme.border) + "\u2502" + " ".repeat(width) + "\u2502" + reset);
    }
  }
  lines.push(fgColor(theme.border) + "\u2514" + "\u2500".repeat(width) + "\u2518" + reset);

  return lines;
}
