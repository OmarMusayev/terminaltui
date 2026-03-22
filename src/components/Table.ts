import type { RenderContext } from "./base.js";
import { fgColor, bold, dim, reset } from "../style/colors.js";
import { pad, stripAnsi, truncate, stringWidth } from "./base.js";
import { getBorderChars } from "../style/borders.js";
import type { BorderStyle } from "../style/borders.js";

export function renderTable(headers: string[], rows: string[][], ctx: RenderContext): string[] {
  const theme = ctx.theme;
  const lines: string[] = [];
  const colCount = headers.length;

  // Calculate column widths
  const colWidths: number[] = headers.map((h, i) => {
    const maxData = Math.max(stringWidth(h), ...rows.map(r => stringWidth(r[i] ?? "")));
    return maxData + 2; // padding
  });

  // Fit to available width
  const available = Math.max(colCount, ctx.width - colCount - 1);
  const totalContent = colWidths.reduce((a, b) => a + b, 0);
  if (totalContent > available) {
    // Proportional scaling
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] = Math.max(2, Math.floor((colWidths[i] / totalContent) * available));
    }
    // Force-trim from widest columns until total fits
    let sum = colWidths.reduce((a, b) => a + b, 0);
    while (sum > available) {
      let maxIdx = 0;
      for (let i = 1; i < colWidths.length; i++) {
        if (colWidths[i] > colWidths[maxIdx]) maxIdx = i;
      }
      if (colWidths[maxIdx] <= 2) break;
      colWidths[maxIdx]--;
      sum--;
    }
  }

  const border = (ctx.borderStyle as BorderStyle) ?? "single";
  const chars = getBorderChars(border);

  // Top border
  lines.push(
    fgColor(theme.border) +
    chars.topLeft +
    colWidths.map(w => chars.horizontal.repeat(w)).join(chars.teeDown) +
    chars.topRight +
    reset
  );

  // Header row
  const headerCells = headers.map((h, i) => {
    const cellText = " " + h;
    const fitted = stringWidth(cellText) > colWidths[i] ? truncate(cellText, colWidths[i]) : pad(cellText, colWidths[i]);
    return fgColor(theme.accent) + bold + fitted + reset;
  });
  lines.push(
    fgColor(theme.border) + chars.vertical + reset +
    headerCells.join(fgColor(theme.border) + chars.vertical + reset) +
    fgColor(theme.border) + chars.vertical + reset
  );

  // Header separator
  lines.push(
    fgColor(theme.border) +
    chars.teeRight +
    colWidths.map(w => chars.horizontal.repeat(w)).join(chars.cross) +
    chars.teeLeft +
    reset
  );

  // Data rows
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const cellText = " " + (cell ?? "");
      const fitted = stringWidth(cellText) > colWidths[i] ? truncate(cellText, colWidths[i]) : pad(cellText, colWidths[i]);
      return fgColor(theme.text) + fitted + reset;
    });
    lines.push(
      fgColor(theme.border) + chars.vertical + reset +
      cells.join(fgColor(theme.border) + chars.vertical + reset) +
      fgColor(theme.border) + chars.vertical + reset
    );
  }

  // Bottom border
  lines.push(
    fgColor(theme.border) +
    chars.bottomLeft +
    colWidths.map(w => chars.horizontal.repeat(w)).join(chars.teeUp) +
    chars.bottomRight +
    reset
  );

  return lines;
}
