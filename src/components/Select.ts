import type { RenderContext } from "./base.js";
import type { SelectBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { pad, stringWidth, truncate } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

export interface SelectRenderState {
  value: string;
  open: boolean;
  highlightIndex: number;
}

export function renderSelect(
  config: SelectBlock,
  state: SelectRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;
  const innerWidth = Math.max(1, ctx.width - 4);

  // Label
  lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + config.label + reset);

  // Find selected option label
  const selectedOpt = config.options.find(o => o.value === state.value);
  const displayLabel = selectedOpt?.label ?? config.placeholder ?? "Choose an option...";
  const displayColor = selectedOpt ? theme.text : theme.subtle;

  // Arrow indicator
  const arrow = state.open ? "\u25b4" : "\u25be";
  const arrowStr = fgColor(theme.muted) + arrow + reset;

  // Header line: "Selected Value                     ▾"
  const availForLabel = Math.max(1, innerWidth - 2); // 1 for arrow, 1 for space
  const truncLabel = truncate(displayLabel, availForLabel);
  const labelW = stringWidth(truncLabel);
  const gap = Math.max(1, innerWidth - labelW - 1);
  const headerLine = fgColor(displayColor) + truncLabel + reset + " ".repeat(gap) + arrowStr;

  if (!state.open) {
    // Collapsed: just the header in a box
    const borderColor = isFocused ? theme.accent : theme.border;
    const boxLines = renderBox({
      content: [headerLine],
      width: ctx.width,
      border: (ctx.borderStyle as any) ?? "rounded",
      padding: 1,
      borderColor,
    }, ctx);
    lines.push(...boxLines);
  } else {
    // Expanded: header + separator + options
    const contentLines: string[] = [headerLine];
    const separatorIdx = 0; // separator after the first content line

    for (let i = 0; i < config.options.length; i++) {
      const opt = config.options[i];
      const isHighlighted = i === state.highlightIndex;
      const prefix = isHighlighted ? "\u276f " : "  ";
      const optColor = isHighlighted ? theme.accent : theme.text;
      const optLabel = truncate(opt.label, Math.max(1, innerWidth - 2));
      contentLines.push(fgColor(optColor) + (isHighlighted ? bold : "") + prefix + optLabel + reset);
    }

    const borderColor = isFocused ? theme.accent : theme.border;
    const boxLines = renderBox({
      content: contentLines,
      width: ctx.width,
      border: (ctx.borderStyle as any) ?? "rounded",
      padding: 1,
      borderColor,
      midSeparatorAfter: separatorIdx,
    }, ctx);
    lines.push(...boxLines);
  }

  return lines;
}
