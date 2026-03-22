import type { RenderContext } from "./base.js";
import { fgColor, inverse, reset } from "../style/colors.js";

export function renderBadge(text: string, ctx: RenderContext, options?: { color?: string; style?: "filled" | "outline" }): string {
  const color = options?.color ?? ctx.theme.warning;
  const badgeStyle = options?.style ?? "outline";

  if (badgeStyle === "filled") {
    return inverse + fgColor(color) + ` ${text} ` + reset;
  }

  return fgColor(color) + `[${text}]` + reset;
}
