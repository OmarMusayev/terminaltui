import type { RenderContext } from "./base.js";
import { fgColor, italic, dim, bold, reset } from "../style/colors.js";
import { wrapText, stringWidth } from "./base.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export function renderQuote(text: string, ctx: RenderContext, options?: { attribution?: string; style?: "border" | "indent" | "fancy" }): string[] {
  const theme = ctx.theme;
  const qStyle = options?.style ?? "border";
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.quote);
  const innerWidth = dims.content;
  const lines: string[] = [];

  const wrapped = wrapText(`"${text}"`, innerWidth);

  if (qStyle === "border") {
    for (const line of wrapped) {
      lines.push(
        fgColor(theme.accent) + "  \u2502 " + reset +
        italic + fgColor(theme.text) + line + reset
      );
    }
    if (options?.attribution) {
      let attrText = "\u2014 " + options.attribution;
      // Truncate attribution if it exceeds available width
      if (stringWidth(attrText) > innerWidth) {
        attrText = attrText.substring(0, innerWidth - 1) + "\u2026";
      }
      const leftPad = Math.max(0, innerWidth - stringWidth(attrText));
      lines.push(
        fgColor(theme.accent) + "  \u2502 " + reset +
        fgColor(theme.muted) + dim + " ".repeat(leftPad) + attrText + reset
      );
    }
  } else if (qStyle === "fancy") {
    lines.push(fgColor(theme.accent) + "  \u250c" + "\u2500".repeat(innerWidth + 2) + "\u2510" + reset);
    for (const line of wrapped) {
      lines.push(
        fgColor(theme.accent) + "  \u2502 " + reset +
        italic + fgColor(theme.text) + line + " ".repeat(Math.max(0, innerWidth - stringWidth(line))) + reset +
        fgColor(theme.accent) + " \u2502" + reset
      );
    }
    if (options?.attribution) {
      const attr = "\u2014 " + options.attribution;
      const attrPad = Math.max(0, innerWidth - stringWidth(attr));
      lines.push(
        fgColor(theme.accent) + "  \u2502 " + reset +
        " ".repeat(attrPad) + fgColor(theme.muted) + attr + reset +
        fgColor(theme.accent) + " \u2502" + reset
      );
    }
    lines.push(fgColor(theme.accent) + "  \u2514" + "\u2500".repeat(innerWidth + 2) + "\u2518" + reset);
  } else {
    // indent style
    for (const line of wrapped) {
      lines.push("    " + italic + fgColor(theme.text) + line + reset);
    }
    if (options?.attribution) {
      lines.push("    " + fgColor(theme.muted) + dim + "\u2014 " + options.attribution + reset);
    }
  }

  return lines;
}
