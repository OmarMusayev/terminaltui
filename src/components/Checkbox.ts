import type { RenderContext } from "./base.js";
import type { CheckboxBlock } from "../config/types.js";
import { fgColor, bold, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderCheckbox(
  config: CheckboxBlock,
  checked: boolean,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const isFocused = !!ctx.focused;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.checkbox);

  const box = checked ? "\u2611" : "\u2610";
  const boxColor = checked ? theme.accent : (isFocused ? theme.accent : theme.muted);
  const labelColor = isFocused ? theme.accent : theme.text;

  return [
    fgColor(boxColor) + (isFocused ? bold : "") + "  " + box + reset +
    fgColor(labelColor) + " " + config.label + reset
  ];
}
