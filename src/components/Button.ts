import type { RenderContext } from "./base.js";
import type { ButtonBlock } from "../config/types.js";
import { pad, stringWidth, truncate } from "./base.js";
import { getBorderChars, type BorderStyle } from "../style/borders.js";
import { fgColor, bgColor, bold, dim, inverse, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderButton(
  config: ButtonBlock,
  ctx: RenderContext,
  loading?: boolean,
): string[] {
  const theme = ctx.theme;
  const isFocused = !!ctx.focused;
  const isLoading = loading || config.loading;
  const style = config.style ?? "secondary";

  // Determine colors based on style
  let btnColor: string;
  let btnIcon: string;
  switch (style) {
    case "primary":
      btnColor = theme.accent;
      btnIcon = "\u25c6";
      break;
    case "danger":
      btnColor = theme.error;
      btnIcon = "\u25c6";
      break;
    default:
      btnColor = theme.border;
      btnIcon = "";
      break;
  }

  // Build button label
  let label: string;
  if (isLoading) {
    const spinnerFrames = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
    const frame = spinnerFrames[Math.floor(Date.now() / 100) % spinnerFrames.length];
    label = frame + " " + config.label;
  } else if (btnIcon) {
    label = btnIcon + " " + config.label;
  } else {
    label = config.label;
  }

  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.button);
  const btnPadding = 2;
  const maxLabelWidth = Math.max(1, dims.content);
  if (stringWidth(label) > maxLabelWidth) {
    label = truncate(label, maxLabelWidth);
  }
  const labelWidth = stringWidth(label);
  const btnInnerWidth = labelWidth + btnPadding * 2;
  const chars = getBorderChars((ctx.borderStyle as BorderStyle) ?? "rounded");

  const lines: string[] = [];
  const indent = "  ";

  if (isFocused && (style === "primary" || style === "danger")) {
    // Focused primary/danger: bold border + bold accent text (no solid background fill)
    lines.push(
      indent + fgColor(btnColor) + bold + chars.topLeft + chars.horizontal.repeat(btnInnerWidth) + chars.topRight + reset
    );
    lines.push(
      indent + fgColor(btnColor) + bold + chars.vertical + reset +
      fgColor(btnColor) + bold + " ".repeat(btnPadding) + label + " ".repeat(btnPadding) + reset +
      fgColor(btnColor) + bold + chars.vertical + reset
    );
    lines.push(
      indent + fgColor(btnColor) + bold + chars.bottomLeft + chars.horizontal.repeat(btnInnerWidth) + chars.bottomRight + reset
    );
  } else if (isFocused) {
    // Focused non-primary: bright border
    lines.push(
      indent + fgColor(btnColor) + bold + chars.topLeft + chars.horizontal.repeat(btnInnerWidth) + chars.topRight + reset
    );
    lines.push(
      indent + fgColor(btnColor) + bold + chars.vertical + reset +
      fgColor(btnColor) + bold + " ".repeat(btnPadding) + label + " ".repeat(btnPadding) + reset +
      fgColor(btnColor) + bold + chars.vertical + reset
    );
    lines.push(
      indent + fgColor(btnColor) + bold + chars.bottomLeft + chars.horizontal.repeat(btnInnerWidth) + chars.bottomRight + reset
    );
  } else {
    // Unfocused
    const borderCol = style === "danger" ? btnColor : theme.border;
    const textCol = style === "primary" ? btnColor : theme.text;
    lines.push(
      indent + fgColor(borderCol) + chars.topLeft + chars.horizontal.repeat(btnInnerWidth) + chars.topRight + reset
    );
    lines.push(
      indent + fgColor(borderCol) + chars.vertical + reset +
      fgColor(textCol) + " ".repeat(btnPadding) + label + " ".repeat(btnPadding) + reset +
      fgColor(borderCol) + chars.vertical + reset
    );
    lines.push(
      indent + fgColor(borderCol) + chars.bottomLeft + chars.horizontal.repeat(btnInnerWidth) + chars.bottomRight + reset
    );
  }

  return lines;
}
