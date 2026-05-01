import type { RenderContext } from "./base.js";
import { fgColor, reset } from "../style/colors.js";
import { stringWidth, truncate } from "./base.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderDivider(ctx: RenderContext, options?: { style?: string; label?: string; color?: string }): string[] {
  const theme = ctx.theme;
  const color = options?.color ?? theme.border;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.divider);
  const width = dims.content;

  if (options?.style === "label" && options.label) {
    const maxLabelLen = Math.max(0, width - 8);
    let labelText = options.label;
    if (stringWidth(labelText) > maxLabelLen) {
      labelText = truncate(labelText, maxLabelLen);
    }
    const label = ` ${labelText} `;
    const remaining = Math.max(0, width - stringWidth(label) - 4);
    const left = Math.floor(remaining / 2);
    const right = remaining - left;
    return [
      fgColor(color) + "\u2500\u2500" + "\u2500".repeat(left) + reset +
      fgColor(theme.muted) + label + reset +
      fgColor(color) + "\u2500".repeat(right) + "\u2500\u2500" + reset
    ];
  }

  let char = "\u2500";
  if (options?.style === "dashed") char = "\u2504";
  else if (options?.style === "dotted") char = "\u00b7";
  else if (options?.style === "double") char = "\u2550";

  return [fgColor(color) + char.repeat(width) + reset];
}
