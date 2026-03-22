/**
 * Figlet-style ASCII art text generator using bundled font definitions.
 */

import { fonts, defaultFont, type Font } from "./fonts.js";
import { getBorderChars, type BorderStyle } from "../style/borders.js";
import { stringWidth, charWidth } from "../components/base.js";
import { registry } from "../art-registry/index.js";

export interface BannerOptions {
  font?: string;
  gradient?: string[];
  align?: "left" | "center" | "right";
  padding?: number;
  shadow?: boolean;
  border?: BorderStyle | false;
  width?: number;
}

export function renderBanner(text: string, options: BannerOptions = {}, maxWidth?: number): string[] {
  const fontName = options.font ?? "ANSI Shadow";
  // Check registry first (custom fonts), then built-in
  const registryFont = registry.get("font", fontName);
  const font = (registryFont as Font | null) ?? fonts[fontName] ?? fonts[defaultFont];
  if (!font) return [text]; // fallback

  const upperText = text.toUpperCase();
  let lines: string[] = Array(font.height).fill("");

  for (const ch of upperText) {
    const charArt = font.chars[ch] ?? font.chars[" "] ?? Array(font.height).fill("  ");
    // Pad all rows of this character to the same width (widest row)
    // so horizontal concatenation stays aligned across all lines
    const cw = Math.max(0, ...charArt.map(r => (r ?? "").length));
    for (let row = 0; row < font.height; row++) {
      const rowStr = charArt[row] ?? "";
      lines[row] += rowStr + " ".repeat(Math.max(0, cw - rowStr.length));
    }
  }

  // Trim trailing whitespace from each line
  lines = lines.map(l => l.trimEnd());

  // Remove trailing empty lines (many fonts have blank bottom rows)
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  // Right-pad ALL lines to the same width so every row is identical width.
  // This prevents misalignment when centering, applying gradients, or composing.
  const maxBannerW = Math.max(0, ...lines.map(l => l.length));
  lines = lines.map(l => l + " ".repeat(Math.max(0, maxBannerW - l.length)));

  // If maxWidth or options.width is specified and banner exceeds it, fall back
  const effectiveMax = options.width ?? maxWidth;
  if (effectiveMax !== undefined) {
    const bannerWidth = Math.max(0, ...lines.map(l => stringWidth(l)));
    if (bannerWidth > effectiveMax) {
      return [text];
    }
  }

  // Add shadow if requested
  if (options.shadow) {
    lines = addShadow(lines);
  }

  // Add border if requested
  if (options.border && options.border !== "none") {
    lines = addBorder(lines, options.border);
  }

  return lines;
}

function addShadow(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    // Add shadow character at end of each line (shifted right by 1)
    result.push(lines[i] + " ");
  }
  // Add shadow bottom row
  const maxW = Math.max(0, ...lines.map(l => stringWidth(l)));
  result.push(" " + "░".repeat(maxW));
  return result;
}

function addBorder(lines: string[], style: BorderStyle): string[] {
  const chars = getBorderChars(style);
  const maxW = Math.max(0, ...lines.map(l => stringWidth(l)));
  const innerW = maxW + 2; // 1 padding each side
  const result: string[] = [];

  result.push(chars.topLeft + chars.horizontal.repeat(innerW) + chars.topRight);
  for (const line of lines) {
    const padded = line + " ".repeat(Math.max(0, maxW - stringWidth(line)));
    result.push(chars.vertical + " " + padded + " " + chars.vertical);
  }
  result.push(chars.bottomLeft + chars.horizontal.repeat(innerW) + chars.bottomRight);

  return result;
}

export function getBannerWidth(text: string, fontName?: string): number {
  const lines = renderBanner(text, { font: fontName });
  return Math.max(0, ...lines.map(l => stringWidth(l)));
}

export function centerBanner(lines: string[], width: number): string[] {
  if (lines.length === 0) return lines;

  // Use the WIDEST line to compute ONE padding value for ALL lines.
  // This keeps the left edge perfectly aligned across every row.
  const maxLineWidth = Math.max(0, ...lines.map(l => stringWidth(l)));
  const pad = Math.max(0, Math.floor((width - maxLineWidth) / 2));
  const padStr = " ".repeat(pad);

  return lines.map(line => {
    const w = stringWidth(line);
    if (w > width) {
      // ANSI-safe truncation — cut at display width, not byte offset
      let visLen = 0;
      let result = "";
      let inEscape = false;
      for (const ch of line) {
        if (ch === "\x1b") { inEscape = true; result += ch; continue; }
        if (inEscape) { result += ch; if (ch === "m") inEscape = false; continue; }
        const cw = charWidth(ch.codePointAt(0) ?? 0);
        if (visLen + cw > width) break;
        result += ch;
        visLen += cw;
      }
      return result + "\x1b[0m";
    }
    return padStr + line;
  });
}
