import type { RenderContext } from "./base.js";
import type { TextInputBlock } from "../config/types.js";
import type { InputFieldState } from "../data/types.js";
import { renderBox } from "./Box.js";
import { pad, stringWidth } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";

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
  const innerWidth = Math.max(0, ctx.width - 4); // box borders + padding
  let displayText: string;
  const rawValue = state.value;

  if (rawValue.length === 0 && !isEditing) {
    // Show placeholder
    displayText = fgColor(theme.subtle) + dim + (config.placeholder ?? "") + reset;
  } else if (config.mask && rawValue.length > 0) {
    // Password mode
    displayText = fgColor(theme.text) + "\u25cf".repeat(rawValue.length) + reset;
  } else {
    displayText = fgColor(theme.text) + rawValue + reset;
  }

  // Add cursor if editing
  if (isEditing) {
    const pos = Math.min(state.cursorPos, rawValue.length);
    let visibleValue: string;
    if (config.mask) {
      visibleValue = "\u25cf".repeat(rawValue.length);
    } else {
      visibleValue = rawValue;
    }

    // Calculate visible window if text is longer than inner width
    const availableWidth = Math.max(1, innerWidth - 1); // leave room for cursor
    let viewStart = 0;
    if (pos > availableWidth) {
      viewStart = pos - availableWidth;
    }
    const viewEnd = viewStart + availableWidth;
    const visibleSlice = visibleValue.substring(viewStart, viewEnd);
    const cursorInView = pos - viewStart;

    // Build with cursor
    const before = visibleSlice.substring(0, cursorInView);
    const cursorChar = cursorInView < visibleSlice.length ? visibleSlice[cursorInView] : " ";
    const after = visibleSlice.substring(cursorInView + 1);

    displayText =
      fgColor(theme.text) + before +
      fgColor(theme.accent) + bold + "\u2588" + reset +
      fgColor(theme.text) + after + reset;

    // If at end of text, show block cursor
    if (cursorInView >= visibleSlice.length) {
      displayText =
        fgColor(theme.text) + visibleSlice +
        fgColor(theme.accent) + "\u2588" + reset;
    }
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
