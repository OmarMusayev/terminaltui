import type { RenderContext } from "./base.js";
import type { RadioGroupBlock } from "../config/types.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

export interface RadioGroupRenderState {
  value: string;
  /** Which option is highlighted (for navigation within the group) */
  highlightIndex: number;
}

export function renderRadioGroup(
  config: RadioGroupBlock,
  state: RadioGroupRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;

  // Label
  lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + config.label + reset);

  // Options
  for (let i = 0; i < config.options.length; i++) {
    const opt = config.options[i];
    const isSelected = opt.value === state.value;
    const isHighlighted = isFocused && i === state.highlightIndex;

    const radio = isSelected ? "\u25c9" : "\u25cb";
    const radioColor = isSelected ? theme.accent : (isHighlighted ? theme.accent : theme.muted);
    const labelColor = isHighlighted ? theme.accent : theme.text;

    lines.push(
      fgColor(radioColor) + (isHighlighted ? bold : "") + "  " + radio + reset +
      fgColor(labelColor) + " " + opt.label + reset
    );
  }

  return lines;
}
