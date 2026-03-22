import type { RenderContext } from "./base.js";
import { fgColor, reset } from "../style/colors.js";
import { wrapText } from "./base.js";

export function renderList(items: string[], ctx: RenderContext, style?: "bullet" | "number" | "dash" | "check" | "arrow"): string[] {
  const theme = ctx.theme;
  const listStyle = style ?? "bullet";

  const bullets: Record<string, (i: number) => string> = {
    bullet: () => "\u2022",
    number: (i) => `${i + 1}.`,
    dash: () => "\u2500",
    check: () => "\u2713",
    arrow: () => "\u2192",
  };

  const getBullet = bullets[listStyle] ?? bullets.bullet!;

  const result: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const bullet = getBullet(i);
    const prefix = `  ${bullet} `;
    const indent = " ".repeat(prefix.length);
    const availWidth = Math.max(1, ctx.width - prefix.length);
    const wrapped = wrapText(items[i], availWidth);
    for (let j = 0; j < wrapped.length; j++) {
      if (j === 0) {
        result.push(fgColor(theme.accent) + prefix + reset + fgColor(theme.text) + wrapped[j] + reset);
      } else {
        result.push(indent + fgColor(theme.text) + wrapped[j] + reset);
      }
    }
  }
  return result;
}
