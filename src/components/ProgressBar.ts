import type { RenderContext } from "./base.js";
import { fgColor, reset, bold } from "../style/colors.js";
import { pad, stripAnsi, truncate, stringWidth } from "./base.js";

export function renderProgressBar(label: string, value: number, ctx: RenderContext, options?: { max?: number; showPercent?: boolean }): string[] {
  const theme = ctx.theme;
  const max = options?.max ?? 100;
  const showPercent = options?.showPercent ?? true;
  const safeValue = Number.isFinite(value) ? value : 0;
  const pct = Math.min(100, Math.max(0, (safeValue / max) * 100));

  const percentWidth = showPercent ? 5 : 0;
  // Dynamic label width: use actual label length + 2 for padding, capped at 40% of width
  const maxLabelWidth = Math.max(4, Math.floor(ctx.width * 0.4));
  const labelWidth = Math.min(stringWidth(label) + 2, maxLabelWidth);
  const barWidth = Math.max(5, ctx.width - labelWidth - percentWidth - 2);

  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;

  // Color based on value
  let barColor: string;
  if (pct >= 70) barColor = theme.success;
  else if (pct >= 40) barColor = theme.warning;
  else barColor = theme.error;

  const truncatedLabel = stringWidth(label) > labelWidth - 2 ? truncate(label, labelWidth - 2) : label;
  const labelStr = fgColor(theme.text) + pad(truncatedLabel, labelWidth) + reset;
  const filledStr = fgColor(barColor) + "\u2588".repeat(filled) + reset;
  const emptyStr = fgColor(theme.subtle) + "\u2591".repeat(empty) + reset;
  const pctStr = showPercent ? fgColor(theme.muted) + ` ${Math.round(pct)}%` + reset : "";

  return [labelStr + filledStr + emptyStr + pctStr];
}
