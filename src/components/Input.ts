import type { RenderContext } from "./base.js";
import { fgColor, bold, reset } from "../style/colors.js";

export function renderInput(prompt: string, value: string, ctx: RenderContext): string[] {
  const theme = ctx.theme;
  return [
    fgColor(theme.accent) + bold + prompt + reset +
    fgColor(theme.text) + value + reset +
    fgColor(theme.muted) + "\u2588" + reset
  ];
}
