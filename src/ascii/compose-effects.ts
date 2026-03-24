/**
 * Art composition effects: repeat, mirror, rotate, colorize, gradient, rainbow, shadow.
 * Split from compose.ts to keep files under 400 lines.
 */
import { stripAnsi, stringWidth } from "../components/base.js";
import { fgColor, reset, createGradient } from "../style/colors.js";
import { overlay, sideBySide, stack } from "./compose.js";

/** Visible length of a string, ignoring ANSI escape sequences. */
function visLen(line: string): number {
  return stringWidth(line);
}

/** Maximum visible width across all lines. */
function maxWidth(art: string[]): number {
  let w = 0;
  for (const line of art) {
    const vw = visLen(line);
    if (vw > w) w = vw;
  }
  return w;
}

/** Split a line into per-visible-character segments preserving ANSI codes. */
function splitVisChars(line: string): string[] {
  const segments: string[] = [];
  let pending = "";
  let inEscape = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\x1b") { inEscape = true; pending += ch; continue; }
    if (inEscape) { pending += ch; if (ch === "m") inEscape = false; continue; }
    segments.push(pending + ch);
    pending = "";
  }
  if (pending && segments.length > 0) segments[segments.length - 1] += pending;
  return segments;
}

/** Remove trailing whitespace from every line. */
function trimTrailing(art: string[]): string[] {
  return art.map(line => {
    const segs = splitVisChars(line);
    while (segs.length > 0) {
      if (stripAnsi(segs[segs.length - 1]) === " ") segs.pop();
      else break;
    }
    const joined = segs.join("");
    if (joined.includes("\x1b[") && !joined.endsWith(reset) && reset) return joined + reset;
    return joined;
  });
}

/** Repeat art a given number of times either horizontally or vertically. */
export function repeat(art: string[], times: number, direction: "horizontal" | "vertical"): string[] {
  if (art.length === 0 || times <= 0) return [];
  if (times === 1) return [...art];
  if (direction === "horizontal") {
    let result = art;
    for (let i = 1; i < times; i++) result = sideBySide(result, art, 0);
    return result;
  }
  let result = art;
  for (let i = 1; i < times; i++) result = stack(result, art, 0);
  return result;
}

/** Mirror/flip art along an axis. */
export function mirror(art: string[], axis: "horizontal" | "vertical"): string[] {
  if (art.length === 0) return [];
  if (axis === "vertical") return [...art].reverse();
  return trimTrailing(art.map(line => { const segs = splitVisChars(line); segs.reverse(); return segs.join(""); }));
}

/** Rotate art by 90, 180, or 270 degrees clockwise. */
export function rotate(art: string[], degrees: 90 | 180 | 270): string[] {
  if (art.length === 0) return [];
  if (degrees === 180) return mirror(mirror(art, "horizontal"), "vertical");

  const h = art.length;
  const w = maxWidth(art);
  const grid: string[][] = [];
  for (let row = 0; row < h; row++) {
    const segs = splitVisChars(art[row]);
    const rowChars: string[] = [];
    for (let col = 0; col < w; col++) rowChars.push(col < segs.length ? segs[col] : " ");
    grid.push(rowChars);
  }

  const result: string[] = [];
  if (degrees === 90) {
    for (let col = 0; col < w; col++) {
      let line = "";
      for (let row = h - 1; row >= 0; row--) line += grid[row][col];
      result.push(line);
    }
  } else {
    for (let col = w - 1; col >= 0; col--) {
      let line = "";
      for (let row = 0; row < h; row++) line += grid[row][col];
      result.push(line);
    }
  }
  return trimTrailing(result);
}

/** Apply a single foreground color to all non-space characters. */
export function colorize(art: string[], color: string): string[] {
  if (art.length === 0) return [];
  const fg = fgColor(color);
  if (!fg) return [...art];
  return trimTrailing(art.map(line => {
    const stripped = stripAnsi(line);
    if (stripped.length === 0) return "";
    let result = "";
    let colored = false;
    for (const ch of stripped) {
      if (ch !== " ") { if (!colored) { result += fg; colored = true; } result += ch; }
      else { if (colored) { result += reset; colored = false; } result += ch; }
    }
    if (colored) result += reset;
    return result;
  }));
}

/** Apply a color gradient across the art. */
export function gradient(
  art: string[], colors: string[],
  direction: "horizontal" | "vertical" | "diagonal" = "horizontal",
): string[] {
  if (art.length === 0) return [];
  if (colors.length === 0) return [...art];
  const h = art.length;
  const w = maxWidth(art);
  if (w === 0) return [...art];
  const result: string[] = [];

  if (direction === "vertical") {
    const gradColors = createGradient(colors, h);
    for (let row = 0; row < h; row++) {
      const fg = fgColor(gradColors[row]);
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) { result.push(""); continue; }
      let line = "";
      for (const ch of stripped) line += ch !== " " ? fg + ch : ch;
      result.push(line + reset);
    }
  } else if (direction === "horizontal") {
    const gradColors = createGradient(colors, w);
    for (let row = 0; row < h; row++) {
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) { result.push(""); continue; }
      let line = "";
      for (let col = 0; col < stripped.length; col++) {
        const ch = stripped[col];
        line += ch !== " " ? fgColor(gradColors[col]) + ch : ch;
      }
      result.push(line + reset);
    }
  } else {
    const maxDiag = h + w - 2 || 1;
    const gradColors = createGradient(colors, maxDiag + 1);
    for (let row = 0; row < h; row++) {
      const stripped = stripAnsi(art[row]);
      if (stripped.length === 0) { result.push(""); continue; }
      let line = "";
      for (let col = 0; col < stripped.length; col++) {
        const ch = stripped[col];
        line += ch !== " " ? fgColor(gradColors[row + col]) + ch : ch;
      }
      result.push(line + reset);
    }
  }
  return trimTrailing(result);
}

const RAINBOW_COLORS = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"];

/** Apply a rainbow gradient across the art. */
export function rainbow(art: string[]): string[] {
  return gradient(art, RAINBOW_COLORS, "horizontal");
}

/** Add a drop shadow behind the art. */
export function shadow(
  art: string[],
  direction: "bottom-right" | "bottom-left" = "bottom-right",
  char: string = "\u2591",
): string[] {
  if (art.length === 0) return [];
  const w = maxWidth(art);
  const h = art.length;
  const totalH = h + 1;

  const shadowLayer: string[] = [];
  for (let row = 0; row < totalH; row++) {
    const shadowRowIdx = row - 1;
    if (shadowRowIdx < 0 || shadowRowIdx >= h) { shadowLayer.push(""); continue; }
    const srcLine = stripAnsi(art[shadowRowIdx]);
    let shadowLine = "";
    if (direction === "bottom-right") {
      shadowLine = " ";
      for (let col = 0; col < srcLine.length; col++) shadowLine += srcLine[col] !== " " ? char : " ";
    } else {
      for (let col = 0; col < srcLine.length; col++) shadowLine += srcLine[col] !== " " ? char : " ";
    }
    shadowLayer.push(shadowLine);
  }

  const artLayer: string[] = [];
  for (let row = 0; row < totalH; row++) {
    if (row >= h) { artLayer.push(""); continue; }
    artLayer.push(direction === "bottom-left" ? " " + art[row] : art[row]);
  }

  return overlay(shadowLayer, artLayer, 0, 0);
}
