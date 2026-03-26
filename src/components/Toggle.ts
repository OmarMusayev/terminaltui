import type { RenderContext } from "./base.js";
import type { ToggleBlock } from "../config/types.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderToggle(
  config: ToggleBlock,
  on: boolean,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const isFocused = !!ctx.focused;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.toggle);

  const onLabel = config.onLabel ?? "On";
  const offLabel = config.offLabel ?? "Off";
  const labelColor = isFocused ? theme.accent : theme.text;

  let track: string;
  let stateLabel: string;
  if (on) {
    track = fgColor(theme.accent) + "\u25cb\u2500\u2500\u2500\u2500\u25cf" + reset;
    stateLabel = fgColor(theme.accent) + bold + " " + onLabel + reset;
  } else {
    track = fgColor(theme.muted) + "\u25cf\u2500\u2500\u2500\u2500\u25cb" + reset;
    stateLabel = fgColor(theme.muted) + dim + " " + offLabel + reset;
  }

  return [
    fgColor(labelColor) + (isFocused ? bold : "") + "  " + config.label + reset +
    "   " + track + stateLabel
  ];
}
