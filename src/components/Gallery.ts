import type { RenderContext } from "./base.js";
import type { CardBlock } from "../config/types.js";
import { renderCard } from "./Card.js";
import { fgColor, dim, reset } from "../style/colors.js";
import { pad } from "./base.js";

export function renderGallery(items: CardBlock[], ctx: RenderContext, options?: { columns?: number; scrollIndex?: number }): string[] {
  let columns = options?.columns ?? Math.min(3, Math.max(1, Math.floor(ctx.width / 30)));
  const scrollIndex = options?.scrollIndex ?? 0;
  const theme = ctx.theme;

  let cardWidth = Math.floor((ctx.width - (columns - 1) * 2) / columns);
  while (cardWidth < 20 && columns > 1) {
    columns--;
    cardWidth = Math.floor((ctx.width - (columns - 1) * 2) / columns);
  }
  const visibleItems = items.slice(scrollIndex, scrollIndex + columns);

  // Render each card
  const renderedCards = visibleItems.map(item =>
    renderCard(item, { ...ctx, width: cardWidth })
  );

  // Combine cards side by side
  const maxHeight = Math.max(0, ...renderedCards.map(c => c.length));
  const lines: string[] = [];

  for (let row = 0; row < maxHeight; row++) {
    const lineParts = renderedCards.map(card => {
      const line = card[row] ?? "";
      return pad(line, cardWidth);
    });
    lines.push(lineParts.join("  "));
  }

  // Scroll indicator
  if (items.length > columns) {
    const indicator = fgColor(theme.muted) + dim +
      `  \u25c2 ${scrollIndex + 1}-${Math.min(scrollIndex + columns, items.length)} of ${items.length} \u25b8` +
      reset;
    lines.push(pad(indicator, ctx.width, "center"));
  }

  return lines;
}
