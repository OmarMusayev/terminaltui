import { createGradient, fgColor, reset } from "./colors.js";

export function gradientText(text: string, colors: string[]): string {
  if (colors.length === 0) return text;
  if (colors.length === 1) return fgColor(colors[0]) + text + reset;

  const chars = [...text];
  const nonSpaceCount = chars.filter(c => c !== " ").length;
  if (nonSpaceCount === 0) return text;

  const gradientColors = createGradient(colors, nonSpaceCount);
  let colorIdx = 0;
  let result = "";

  for (const ch of chars) {
    if (ch === " ") {
      result += ch;
    } else {
      result += fgColor(gradientColors[colorIdx]) + ch;
      colorIdx++;
    }
  }

  return result + reset;
}

export function gradientLines(lines: string[], colors: string[]): string[] {
  if (colors.length === 0) return lines;
  if (colors.length === 1) {
    return lines.map(line => fgColor(colors[0]) + line + reset);
  }

  // Positionally-aligned gradient for multi-line ASCII art.
  // Colors are assigned by character POSITION (for vertical alignment),
  // but ONLY applied to non-space characters. Spaces get a reset so
  // the terminal background shows through — this preserves letter forms
  // when the font uses solid block characters like █.
  const maxLen = Math.max(...lines.map(l => l.length), 2);
  const gradientColors = createGradient(colors, maxLen);

  return lines.map(line => {
    let result = "";
    let inColor = false;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === " ") {
        // Reset before spaces so no color bleeds into the gap
        if (inColor) {
          result += reset;
          inColor = false;
        }
        result += " ";
      } else {
        result += fgColor(gradientColors[i]) + line[i];
        inColor = true;
      }
    }

    return result + reset;
  });
}
