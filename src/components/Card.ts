import type { RenderContext } from "./base.js";
import type { CardBlock } from "../config/types.js";
import { renderBox } from "./Box.js";
import { styled, styledDim, pad, wrapText, stripAnsi, truncate, stringWidth } from "./base.js";
import { fgColor, bold, dim, inverse, reset } from "../style/colors.js";

export function renderCard(card: CardBlock, ctx: RenderContext): string[] {
  const theme = ctx.theme;
  const innerWidth = Math.max(0, ctx.width - 4); // 2 border + 2 padding
  const content: string[] = [];

  // Title line with optional subtitle on right
  const icon = ctx.focused ? "\u25c6" : "\u25c7";
  const cardTitle = card.title ?? "";
  if (card.subtitle) {
    const prefixPlain = icon + " ";
    let subtitlePlain = card.subtitle;
    const totalPlain = stringWidth(prefixPlain) + stringWidth(cardTitle) + 1 + stringWidth(subtitlePlain);
    if (totalPlain > innerWidth) {
      // Not enough space — truncate title first, then subtitle if still too wide
      const availAfterPrefix = Math.max(1, innerWidth - stringWidth(prefixPlain));
      // Give subtitle at most half the space, title gets the rest
      const maxSubtitle = Math.min(stringWidth(subtitlePlain), Math.max(4, Math.floor(availAfterPrefix / 2)));
      const truncatedSubtitle = truncate(subtitlePlain, maxSubtitle);
      const truncatedSubtitlePlain = stripAnsi(truncatedSubtitle);
      const availForTitle = Math.max(1, availAfterPrefix - 1 - stringWidth(truncatedSubtitlePlain));
      const truncatedTitle = truncate(cardTitle, availForTitle);
      const truncatedTitlePlain = stripAnsi(truncatedTitle);
      const usedWidth = stringWidth(prefixPlain) + stringWidth(truncatedTitlePlain) + stringWidth(truncatedSubtitlePlain);
      const gap = Math.max(1, innerWidth - usedWidth);
      content.push(
        fgColor(theme.accent) + icon + " " + bold + truncatedTitle + reset +
        " ".repeat(gap) +
        fgColor(theme.muted) + truncatedSubtitle + reset
      );
    } else {
      const gap = Math.max(1, innerWidth - totalPlain);
      content.push(
        fgColor(theme.accent) + icon + " " + bold + cardTitle + reset +
        " ".repeat(gap) +
        fgColor(theme.muted) + card.subtitle + reset
      );
    }
  } else {
    const prefixPlain = icon + " ";
    if (stringWidth(prefixPlain) + stringWidth(cardTitle) > innerWidth) {
      const availForTitle = Math.max(1, innerWidth - stringWidth(prefixPlain));
      const truncatedTitle = truncate(cardTitle, availForTitle);
      content.push(fgColor(theme.accent) + icon + " " + bold + truncatedTitle + reset);
    } else {
      content.push(fgColor(theme.accent) + icon + " " + bold + cardTitle + reset);
    }
  }

  // Body
  if (card.body) {
    const wrapped = wrapText(card.body, innerWidth);
    for (const line of wrapped) {
      content.push(fgColor(theme.text) + line + reset);
    }
  }

  // Tags (wrap across multiple lines when they exceed innerWidth)
  if (card.tags && card.tags.length > 0) {
    content.push(""); // spacer
    let currentLinePlain = "";
    let currentLineStyled = "";
    for (let i = 0; i < card.tags.length; i++) {
      const tag = card.tags[i];
      const tagPlain = "[" + tag + "]";
      const tagStyled = fgColor(theme.warning) + tagPlain + reset;
      if (stringWidth(currentLinePlain) === 0) {
        currentLinePlain = tagPlain;
        currentLineStyled = tagStyled;
      } else if (stringWidth(currentLinePlain) + 1 + stringWidth(tagPlain) <= innerWidth) {
        currentLinePlain += " " + tagPlain;
        currentLineStyled += " " + tagStyled;
      } else {
        content.push(currentLineStyled);
        currentLinePlain = tagPlain;
        currentLineStyled = tagStyled;
      }
    }
    if (currentLineStyled) {
      content.push(currentLineStyled);
    }
  }

  return renderBox({
    content,
    width: ctx.width,
    border: card.border ?? (ctx.borderStyle as any) ?? "rounded",
    padding: 1,
  }, ctx);
}
