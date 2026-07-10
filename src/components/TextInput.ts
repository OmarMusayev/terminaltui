import type { RenderContext } from "./base.js";
import type { TextInputBlock } from "../config/types.js";
import type { InputFieldState } from "../data/types.js";
import { renderBox } from "./Box.js";
import { charWidth, truncate } from "./base.js";
import { snapToCodePoint } from "./text-cursor.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export interface TextInputRenderState {
  value: string;
  cursorPos: number;
  editing: boolean;
  error: string | null;
}

export function renderTextInput(
  config: TextInputBlock,
  state: TextInputRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;
  const isEditing = state.editing;

  // Label
  lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + config.label + reset);

  // Build the display text
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.textInput);
  const innerWidth = dims.content;
  let displayText: string;
  const rawValue = state.value;

  if (rawValue.length === 0 && !isEditing) {
    // Show placeholder
    displayText = fgColor(theme.subtle) + dim + truncate(config.placeholder ?? "", innerWidth) + reset;
  } else if (config.mask && rawValue.length > 0) {
    // Password mode \u2014 one bullet per user-visible codepoint, not per UTF-16 unit
    displayText = fgColor(theme.text) + truncate("\u25cf".repeat([...rawValue].length), innerWidth) + reset;
  } else {
    displayText = fgColor(theme.text) + truncate(rawValue, innerWidth) + reset;
  }

  // Add cursor if editing
  if (isEditing) {
    // All window math is in display cells over code points \u2014 UTF-16 slicing
    // would tear surrogate pairs and let wide (CJK/emoji) text overflow the box.
    const pos = snapToCodePoint(rawValue, Math.min(state.cursorPos, rawValue.length));
    const cursorIdx = [...rawValue.substring(0, pos)].length; // code-point index
    const chars = config.mask
      ? [...rawValue].map(() => "\u25cf")
      : [...rawValue];
    const widths = chars.map(ch => charWidth(ch.codePointAt(0) ?? 0));

    // Scroll window: walk left from the cursor filling display cells, leaving
    // one cell for the cursor block itself.
    const availableWidth = Math.max(1, innerWidth - 1);
    let startIdx = cursorIdx;
    let beforeW = 0;
    while (startIdx > 0 && beforeW + widths[startIdx - 1] <= availableWidth) {
      startIdx--;
      beforeW += widths[startIdx];
    }

    // Extend right of the cursor while cells remain.
    let afterEnd = cursorIdx + 1; // the char under the cursor is replaced by the block
    let usedW = beforeW + 1;
    while (afterEnd < chars.length && usedW + widths[afterEnd] <= innerWidth) {
      usedW += widths[afterEnd];
      afterEnd++;
    }

    const before = chars.slice(startIdx, cursorIdx).join("");
    const after = chars.slice(cursorIdx + 1, afterEnd).join("");

    displayText =
      fgColor(theme.text) + before +
      fgColor(theme.accent) + bold + "\u2588" + reset +
      fgColor(theme.text) + after + reset;
  }

  // Render in a box
  const borderColor = isFocused ? theme.accent : theme.border;
  const boxLines = renderBox({
    content: [displayText],
    width: ctx.width,
    border: (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
    borderColor,
  }, ctx);

  lines.push(...boxLines);

  // Validation error
  if (state.error) {
    lines.push(
      fgColor(theme.error) + "  \u2717 " + state.error + reset
    );
  }

  return lines;
}
