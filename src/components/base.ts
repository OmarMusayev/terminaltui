import type { Theme } from "../style/theme.js";
import type { ContentBlock } from "../config/types.js";
import { fgColor, bgColor, reset, bold, dim, inverse } from "../style/colors.js";

export interface RenderContext {
  width: number;
  theme: Theme;
  focused?: boolean;
  selected?: boolean;
  borderStyle?: string;
  editing?: boolean;
}

/**
 * Standard component interface. Components can be implemented as either:
 * 1. A class implementing this interface (for complex stateful components)
 * 2. A plain render function registered via the ComponentRegistry
 *
 * All built-in components use pattern #2 for simplicity.
 */
export interface Component {
  /** Component type identifier (e.g. "card", "timeline", "textInput"). */
  readonly type: string;
  /** Whether this component can receive focus. */
  readonly focusable: boolean;
  /** Render the component to an array of ANSI-styled lines. */
  render(block: ContentBlock, ctx: RenderContext): string[];
}

/** A function that renders a content block to string lines. */
export type ComponentRenderer = (block: any, ctx: RenderContext, ...extra: any[]) => string[];

/**
 * Maps block type strings to their render functions.
 * Used by the runtime to dispatch rendering without a giant switch statement.
 */
export class ComponentRegistry {
  private renderers = new Map<string, ComponentRenderer>();
  private focusableTypes = new Set<string>();

  /** Register a component renderer for a block type. */
  register(type: string, renderer: ComponentRenderer, focusable = false): void {
    this.renderers.set(type, renderer);
    if (focusable) this.focusableTypes.add(type);
  }

  /** Get the renderer for a block type, or undefined if not registered. */
  getRenderer(type: string): ComponentRenderer | undefined {
    return this.renderers.get(type);
  }

  /** Check if a block type is focusable. */
  isFocusable(type: string): boolean {
    return this.focusableTypes.has(type);
  }

  /** Check if a renderer is registered for this type. */
  has(type: string): boolean {
    return this.renderers.has(type);
  }
}

/** Global component registry instance. */
export const componentRegistry = new ComponentRegistry();

// ─── Unicode-aware display width ──────────────────────────

/**
 * Get the display width of a single character in terminal cells.
 *
 * Handles:
 * - CJK ideographs (2 cells)
 * - CJK fullwidth forms (2 cells)
 * - Emoji (2 cells)
 * - Combining marks and zero-width chars (0 cells)
 * - Control characters (0 cells)
 * - Everything else including box-drawing, block elements (1 cell)
 */
export function charWidth(code: number): number {
  // Control characters and zero-width
  if (code < 32 || code === 0x7f) return 0;
  // Combining Diacritical Marks (U+0300-U+036F)
  if (code >= 0x0300 && code <= 0x036f) return 0;
  // Zero-width chars: ZWS, ZWNJ, ZWJ, soft hyphen
  if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0x00ad || code === 0xfeff) return 0;
  // Combining marks in other blocks
  if (code >= 0x1ab0 && code <= 0x1aff) return 0; // Combining Diacritical Marks Extended
  if (code >= 0x1dc0 && code <= 0x1dff) return 0; // Combining Diacritical Marks Supplement
  if (code >= 0x20d0 && code <= 0x20ff) return 0; // Combining Marks for Symbols
  if (code >= 0xfe20 && code <= 0xfe2f) return 0; // Combining Half Marks
  // Variation selectors
  if (code >= 0xfe00 && code <= 0xfe0f) return 0;
  if (code >= 0xe0100 && code <= 0xe01ef) return 0;

  // CJK Ideographs and extensions — 2 cells
  if (code >= 0x4e00 && code <= 0x9fff) return 2;  // CJK Unified Ideographs
  if (code >= 0x3400 && code <= 0x4dbf) return 2;  // CJK Extension A
  if (code >= 0x20000 && code <= 0x2a6df) return 2; // CJK Extension B
  if (code >= 0x2a700 && code <= 0x2b73f) return 2; // CJK Extension C
  if (code >= 0x2b740 && code <= 0x2b81f) return 2; // CJK Extension D
  if (code >= 0xf900 && code <= 0xfaff) return 2;   // CJK Compat Ideographs
  // CJK punctuation, Hiragana, Katakana, Hangul
  if (code >= 0x3000 && code <= 0x303f) return 2;  // CJK Symbols & Punctuation
  if (code >= 0x3040 && code <= 0x309f) return 2;  // Hiragana
  if (code >= 0x30a0 && code <= 0x30ff) return 2;  // Katakana
  if (code >= 0xac00 && code <= 0xd7af) return 2;  // Hangul Syllables
  if (code >= 0x1100 && code <= 0x115f) return 2;  // Hangul Jamo
  // Fullwidth forms
  if (code >= 0xff01 && code <= 0xff60) return 2;
  if (code >= 0xffe0 && code <= 0xffe6) return 2;

  // Emoji (common ranges) — 2 cells
  // Miscellaneous Symbols & Pictographs, Emoticons, Transport, Supplemental Symbols
  if (code >= 0x1f300 && code <= 0x1f9ff) return 2;
  if (code >= 0x1fa00 && code <= 0x1fa6f) return 2;
  if (code >= 0x1fa70 && code <= 0x1faff) return 2;
  // Dingbats
  if (code >= 0x2700 && code <= 0x27bf) return 1; // dingbats are typically 1-wide
  // Misc symbols that are sometimes 2-wide
  if (code >= 0x2600 && code <= 0x26ff) return 1; // misc symbols — terminal-dependent, default 1

  // Everything else: ASCII, Latin, Greek, Cyrillic, box-drawing, block elements, etc.
  return 1;
}

/**
 * Calculate the display width of a string in terminal cells.
 * Strips ANSI codes, then sums character widths.
 */
export function stringWidth(text: string): number {
  const stripped = stripAnsi(text);
  let width = 0;
  for (const ch of stripped) {
    width += charWidth(ch.codePointAt(0) ?? 0);
  }
  return width;
}

// ─── Styling helpers ──────────────────────────────────────

export function styled(text: string, color: string): string {
  return fgColor(color) + text + reset;
}

export function styledBold(text: string, color: string): string {
  return bold + fgColor(color) + text + reset;
}

export function styledDim(text: string, color: string): string {
  return dim + fgColor(color) + text + reset;
}

export function styledInverse(text: string, color: string): string {
  return inverse + fgColor(color) + text + reset;
}

// ─── Layout helpers (width-aware) ─────────────────────────

export function pad(text: string, width: number, align: "left" | "center" | "right" = "left"): string {
  const visLen = stringWidth(text);
  const padding = Math.max(0, width - visLen);
  switch (align) {
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    case "right":
      return " ".repeat(padding) + text;
    default:
      return text + " ".repeat(padding);
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function truncate(text: string, maxWidth: number): string {
  if (!text) return "";
  if (stringWidth(text) <= maxWidth) return text;
  // Need to truncate accounting for ANSI codes and char widths
  let visLen = 0;
  let result = "";
  let inEscape = false;
  for (const ch of text) {
    if (ch === "\x1b") { inEscape = true; result += ch; continue; }
    if (inEscape) { result += ch; if (ch === "m") inEscape = false; continue; }
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (visLen + cw >= maxWidth) { result += "\u2026"; break; }
    result += ch;
    visLen += cw;
  }
  return result + reset;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];

  // Split on newlines first, then wrap each paragraph
  const paragraphs = text.split("\n");
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (para.length === 0) {
      allLines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = stringWidth(word);
      // Force-break words wider than width
      if (wordWidth > width) {
        if (currentLine) {
          allLines.push(currentLine);
          currentLine = "";
          currentWidth = 0;
        }
        // Break character by character
        let chunk = "";
        let chunkW = 0;
        for (const ch of word) {
          const cw = charWidth(ch.codePointAt(0) ?? 0);
          if (chunkW + cw > width && chunk) {
            allLines.push(chunk);
            chunk = "";
            chunkW = 0;
          }
          chunk += ch;
          chunkW += cw;
        }
        currentLine = chunk;
        currentWidth = chunkW;
        continue;
      }

      if (currentWidth === 0) {
        currentLine = word;
        currentWidth = wordWidth;
      } else if (currentWidth + 1 + wordWidth <= width) {
        currentLine += " " + word;
        currentWidth += 1 + wordWidth;
      } else {
        allLines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }

  return allLines.length > 0 ? allLines : [""];
}
