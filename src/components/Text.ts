import type { RenderContext } from "./base.js";
import { styled, wrapText, stripAnsi, stringWidth } from "./base.js";
import { fgColor, bold as boldCode, italic as italicCode, reset } from "../style/colors.js";

export function renderText(content: string, ctx: RenderContext, style?: "markdown" | "plain"): string[] {
  const width = ctx.width;
  const theme = ctx.theme;

  if (style === "markdown") {
    return renderMarkdown(content, width, theme);
  }

  // Plain text - just wrap
  return wrapText(content, width).map(line => styled(line, theme.text));
}

function renderMarkdown(content: string, width: number, theme: any): string[] {
  const lines: string[] = [];

  // Split into blocks by double newlines (paragraphs)
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Split each block into individual lines — single \n is a line break
    const blockLines = trimmed.split("\n");

    for (const rawLine of blockLines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Headings: ### Title, ## Title, # Title
      if (line.startsWith("#")) {
        const match = line.match(/^(#+)\s+(.*)/);
        if (match) {
          const title = match[2];
          lines.push(boldCode + fgColor(theme.accent) + title + reset);
          continue;
        }
      }

      // List items: - text or * text
      if (line.match(/^[-*]\s/)) {
        const itemText = line.replace(/^[-*]\s+/, "");
        const styledItem = applyInlineStyles(itemText, theme);
        const plainItem = stripInlineMarkdown(itemText);
        // Wrap with "- " prefix on first line, "  " continuation on subsequent
        const wrapped = wrapText(plainItem, width - 2);
        for (let i = 0; i < wrapped.length; i++) {
          const prefix = i === 0 ? "\u2022 " : "  ";
          const styledLine = i === 0 ? applyInlineStyles(wrapped[i], theme) : fgColor(theme.text) + wrapped[i] + reset;
          lines.push(fgColor(theme.text) + prefix + styledLine + reset);
        }
        continue;
      }

      // Regular paragraph line — apply inline styles and wrap
      const plain = stripInlineMarkdown(line);
      const wrapped = wrapText(plain, width);
      for (const wl of wrapped) {
        lines.push(fgColor(theme.text) + applyInlineStyles(wl, theme) + reset);
      }
    }

    lines.push(""); // blank line between blocks
  }

  // Remove trailing empty line
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

/** Apply bold/italic/code inline markdown styles. */
function applyInlineStyles(text: string, theme: any): string {
  let result = text;
  result = result.replace(/\*\*(.+?)\*\*/g, (_, t) => boldCode + fgColor(theme.accent) + t + reset + fgColor(theme.text));
  result = result.replace(/\*(.+?)\*/g, (_, t) => italicCode + t + reset + fgColor(theme.text));
  result = result.replace(/`(.+?)`/g, (_, t) => fgColor(theme.warning) + t + reset + fgColor(theme.text));
  return result;
}

/** Strip markdown syntax for plain text measurement. */
function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}
