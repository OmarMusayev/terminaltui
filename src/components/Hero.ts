import type { RenderContext } from "./base.js";
import { fgColor, bold, dim, underline, reset } from "../style/colors.js";
import { pad, wrapText } from "./base.js";

export function renderHero(config: { title: string; subtitle?: string; cta?: { label: string; url: string }; art?: string }, ctx: RenderContext): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const width = ctx.width;

  // Blank spacer
  lines.push("");

  // Title (centered, bold, accent) — wrapped
  const titleWrapped = wrapText(config.title, width);
  for (const tLine of titleWrapped) {
    const titleLine = fgColor(theme.accent) + bold + tLine + reset;
    lines.push(pad(titleLine, width, "center"));
  }

  lines.push("");

  // Subtitle — wrapped
  if (config.subtitle) {
    const subWrapped = wrapText(config.subtitle, width);
    for (const sLine of subWrapped) {
      const subLine = fgColor(theme.text) + sLine + reset;
      lines.push(pad(subLine, width, "center"));
    }
    lines.push("");
  }

  // CTA
  if (config.cta) {
    const ctaLine = fgColor(theme.accent) + bold + underline + config.cta.label + reset;
    lines.push(pad(ctaLine, width, "center"));
    lines.push("");
  }

  // Art
  if (config.art) {
    const artLines = config.art.split("\n");
    for (const al of artLines) {
      lines.push(pad(fgColor(theme.muted) + al + reset, width, "center"));
    }
  }

  lines.push("");

  return lines;
}
