import type { RenderContext } from "./base.js";
import type { NumberInputBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { pad, stringWidth } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export interface NumberInputRenderState {
  value: number;
  editing: boolean;
  textBuffer: string; // for direct typing mode
}

export function renderNumberInput(
  config: NumberInputBlock,
  state: NumberInputRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;
  const isEditing = state.editing;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.numberInput);
  const innerWidth = dims.content;

  // Label
  lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + config.label + reset);

  // Display value with arrows
  const leftArrow = fgColor(isFocused ? theme.accent : theme.muted) + "\u25c2" + reset;
  const rightArrow = fgColor(isFocused ? theme.accent : theme.muted) + "\u25b8" + reset;

  let displayValue: string;
  if (isEditing && state.textBuffer.length > 0) {
    displayValue = fgColor(theme.text) + state.textBuffer + fgColor(theme.accent) + "\u2588" + reset;
  } else {
    displayValue = fgColor(theme.text) + bold + String(state.value) + reset;
  }

  const valueStr = leftArrow + "  " + displayValue + "  " + rightArrow;

  const borderColor = isFocused ? theme.accent : theme.border;
  const boxLines = renderBox({
    content: [valueStr],
    width: ctx.width,
    border: (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
    borderColor,
  }, ctx);

  lines.push(...boxLines);
  return lines;
}
