import type { RenderContext } from "./base.js";
import type { TextAreaBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { stringWidth, wrapText } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { computeBoxDimensions, COMPONENT_DEFAULTS } from "../layout/box-model.js";

export interface TextAreaRenderState {
  value: string;
  cursorPos: number;
  editing: boolean;
  error: string | null;
  scrollOffset: number;
}

export function renderTextArea(
  config: TextAreaBlock,
  state: TextAreaRenderState,
  ctx: RenderContext,
): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const isFocused = !!ctx.focused;
  const isEditing = state.editing;
  const visibleRows = config.rows ?? 4;
  const dims = computeBoxDimensions(ctx.width, COMPONENT_DEFAULTS.textArea);
  const innerWidth = dims.content;

  // Label
  lines.push(fgColor(isFocused ? theme.accent : theme.text) + bold + "  " + config.label + reset);

  // Split value into lines
  const rawValue = state.value as string;
  const textLines = rawValue.split("\n");

  // Wrap each line to fit innerWidth
  const wrappedLines: string[] = [];
  const lineMap: { origLine: number; origCol: number }[] = []; // map wrapped line idx -> original pos
  for (let li = 0; li < textLines.length; li++) {
    if (textLines[li].length === 0) {
      wrappedLines.push("");
      lineMap.push({ origLine: li, origCol: 0 });
    } else {
      const wrapped = wrapText(textLines[li], innerWidth);
      for (const wl of wrapped) {
        wrappedLines.push(wl);
        lineMap.push({ origLine: li, origCol: 0 });
      }
    }
  }

  // Find cursor position in wrapped lines
  let cursorWrappedLine = 0;
  let cursorWrappedCol = 0;
  if (isEditing) {
    let pos = state.cursorPos;
    for (let li = 0; li < textLines.length; li++) {
      if (pos <= textLines[li].length) {
        // Cursor is in this line
        // Find which wrapped line
        let wrappedStart = 0;
        for (let wi = 0; wi < wrappedLines.length; wi++) {
          if (lineMap[wi].origLine === li) {
            if (pos <= wrappedLines[wi].length) {
              cursorWrappedLine = wi;
              cursorWrappedCol = pos;
              break;
            }
            pos -= wrappedLines[wi].length;
            if (pos > 0 && wi + 1 < wrappedLines.length && lineMap[wi + 1]?.origLine === li) {
              // Continues to next wrapped line
              continue;
            }
            cursorWrappedLine = wi;
            cursorWrappedCol = wrappedLines[wi].length;
            break;
          }
        }
        break;
      }
      pos -= textLines[li].length + 1; // +1 for \n
    }
  }

  // Calculate scroll offset to keep cursor visible
  let scrollOff = state.scrollOffset;
  if (isEditing) {
    if (cursorWrappedLine < scrollOff) {
      scrollOff = cursorWrappedLine;
    } else if (cursorWrappedLine >= scrollOff + visibleRows) {
      scrollOff = cursorWrappedLine - visibleRows + 1;
    }
  }
  scrollOff = Math.max(0, Math.min(scrollOff, Math.max(0, wrappedLines.length - visibleRows)));

  // Build visible content lines
  const contentLines: string[] = [];
  for (let i = 0; i < visibleRows; i++) {
    const lineIdx = scrollOff + i;
    if (lineIdx < wrappedLines.length) {
      let lineText = wrappedLines[lineIdx];

      // Show cursor on this line if editing
      if (isEditing && lineIdx === cursorWrappedLine) {
        const before = lineText.substring(0, cursorWrappedCol);
        const after = lineText.substring(cursorWrappedCol);
        lineText = fgColor(theme.text) + before +
          fgColor(theme.accent) + "\u2588" + reset +
          fgColor(theme.text) + after + reset;
      } else {
        lineText = fgColor(theme.text) + lineText + reset;
      }

      // Add scrollbar indicator on the right if content overflows
      if (wrappedLines.length > visibleRows) {
        const scrollbarHeight = Math.max(1, Math.floor(visibleRows * visibleRows / wrappedLines.length));
        const scrollbarPos = Math.floor(scrollOff * visibleRows / wrappedLines.length);
        if (i >= scrollbarPos && i < scrollbarPos + scrollbarHeight) {
          // This is part of the scrollbar - append will be handled by box
        }
      }

      contentLines.push(lineText);
    } else {
      contentLines.push("");
    }
  }

  // If empty and not editing, show placeholder
  if (rawValue.length === 0 && !isEditing && config.placeholder) {
    contentLines[0] = fgColor(theme.subtle) + dim + config.placeholder + reset;
  }

  const borderColor = isFocused ? theme.accent : theme.border;
  const boxLines = renderBox({
    content: contentLines,
    width: ctx.width,
    border: (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
    borderColor,
  }, ctx);

  lines.push(...boxLines);

  // Validation error
  if (state.error) {
    lines.push(fgColor(theme.error) + "  \u2717 " + state.error + reset);
  }

  return lines;
}
