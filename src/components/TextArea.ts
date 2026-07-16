import type { RenderContext } from "./base.js";
import type { TextAreaBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { stringWidth, wrapText } from "./base.js";
import { snapToCodePoint } from "./text-cursor.js";
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
  // Map wrapped line idx -> original line + code-unit start offset within it.
  // wrapText drops the separator space at each word-wrap boundary, so each
  // chunk's true start offset must be recovered (indexOf is safe: chunks
  // appear in order and the gaps between them are only dropped spaces).
  const lineMap: { origLine: number; origCol: number }[] = [];
  for (let li = 0; li < textLines.length; li++) {
    if (textLines[li].length === 0) {
      wrappedLines.push("");
      lineMap.push({ origLine: li, origCol: 0 });
    } else {
      const wrapped = wrapText(textLines[li], innerWidth);
      let searchFrom = 0;
      for (const wl of wrapped) {
        const found = textLines[li].indexOf(wl, searchFrom);
        const origCol = found >= 0 ? found : searchFrom;
        wrappedLines.push(wl);
        lineMap.push({ origLine: li, origCol });
        searchFrom = origCol + wl.length;
      }
    }
  }

  // Find cursor position in wrapped lines
  let cursorWrappedLine = 0;
  let cursorWrappedCol = 0;
  if (isEditing) {
    const pos = snapToCodePoint(rawValue, Math.min(state.cursorPos, rawValue.length));
    // Locate the original line containing the cursor
    let lineStart = 0;
    let cursorLine = 0;
    for (let li = 0; li < textLines.length; li++) {
      const lineEnd = lineStart + textLines[li].length;
      if (pos <= lineEnd || li === textLines.length - 1) {
        cursorLine = li;
        break;
      }
      lineStart = lineEnd + 1; // +1 for \n
    }
    const col = Math.min(pos - lineStart, textLines[cursorLine].length);

    // Find which wrapped chunk of that line holds the cursor column
    for (let wi = 0; wi < wrappedLines.length; wi++) {
      if (lineMap[wi].origLine !== cursorLine) continue;
      const chunkEnd = lineMap[wi].origCol + wrappedLines[wi].length;
      const lastOfLine = wi + 1 >= wrappedLines.length || lineMap[wi + 1].origLine !== cursorLine;
      if (col <= chunkEnd || lastOfLine) {
        cursorWrappedLine = wi;
        cursorWrappedCol = Math.max(0, Math.min(col - lineMap[wi].origCol, wrappedLines[wi].length));
        break;
      }
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
        // Never split inside a surrogate pair when splicing in the cursor block
        const col = snapToCodePoint(lineText, cursorWrappedCol);
        let before = lineText.substring(0, col);
        let after = lineText.substring(col);
        // The cursor block occupies one extra display cell; keep the rendered
        // line (content + cursor) within innerWidth by trimming the tail,
        // then scrolling the head off the left so the cursor stays visible.
        let excess = stringWidth(before) + 1 + stringWidth(after) - innerWidth;
        if (excess > 0) {
          const afterChars = Array.from(after);
          while (excess > 0 && afterChars.length > 0) {
            excess -= stringWidth(afterChars.pop()!);
          }
          after = afterChars.join("");
          const beforeChars = Array.from(before);
          while (excess > 0 && beforeChars.length > 0) {
            excess -= stringWidth(beforeChars.shift()!);
          }
          before = beforeChars.join("");
        }
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
